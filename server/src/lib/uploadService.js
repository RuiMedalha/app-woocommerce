/**
 * Processamento de ficheiros carregados: PDF (pdf-parse) e Excel (exceljs).
 * Cria entradas na tabela products com status "Pendente" e dados em original_*.
 */
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const db = require('./db');

// Pasta uploads: prioridade a env, depois server/uploads (relativo a __dirname ou process.cwd())
function getUploadsDir() {
  if (process.env.UPLOADS_DIR) return path.resolve(process.env.UPLOADS_DIR);
  const fromLib = path.join(__dirname, '..', '..', 'uploads'); // server/src/lib -> server/uploads
  if (fs.existsSync(fromLib)) return fromLib;
  const fromCwd = path.join(process.cwd(), 'server', 'uploads');
  return fromCwd;
}

const UPLOADS_DIR = getUploadsDir();

function ensureUploadsDir() {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Regista um ficheiro na tabela uploaded_files.
 * file_kind: 'inventory' (Excel) ou 'library' (PDF/Biblioteca Técnica).
 */
function registerUploadedFile(filename, filePath, type, status = 'Aguardando processamento', fileKind = null) {
  const kind = fileKind || (type === 'pdf' ? 'library' : 'inventory');
  return db.insertUploadedFile({
    filename: filename || filePath,
    path: filePath,
    type: type || '',
    file_kind: kind,
    status,
  });
}

/**
 * Sincronização: verifica a pasta uploads no arranque e adiciona à base de dados
 * os ficheiros que existem no disco mas não constam na tabela uploaded_files.
 */
/**
 * Auto-sync: ao iniciar o servidor, verifica a pasta uploads e insere na BD
 * os ficheiros que existem no disco mas não constam na tabela uploaded_files.
 */
async function syncUploadsWithDatabase() {
  ensureUploadsDir();
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) return 0;
  const existingPaths = new Set(await db.getUploadedFilePaths());
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error('Erro ao ler pasta uploads:', err.message);
    return 0;
  }
  let added = 0;
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (existingPaths.has(name)) continue;
    const ext = path.extname(name).toLowerCase();
    const type = ext === '.pdf' ? 'pdf' : ext === '.xlsx' || ext === '.xls' ? 'excel' : 'other';
    const file_kind = type === 'pdf' ? 'library' : 'inventory';
    await db.insertUploadedFile({
      filename: name,
      path: name,
      type,
      file_kind,
      status: 'Aguardando processamento',
    });
    existingPaths.add(name);
    added++;
  }
  return added;
}

/**
 * Extrai apenas o texto de um PDF (para guardar como contexto/conhecimento técnico).
 */
async function extractTextFromPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return (data.text || '').trim();
}

/**
 * Extrai texto de um PDF e identifica blocos que podem ser produtos (linhas com padrão SKU/código).
 * Devolve array de { sku, original_title, raw_text_from_file } para criar entradas em products.
 * Mantido para a lista de upload e contagem de produtos continuarem a funcionar ao processar PDF.
 */
async function extractProductsFromPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const fullText = (data.text || '').trim();
  const products = [];

  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let current = { sku: '', original_title: '', raw: '' };

  for (const line of lines) {
    const looksLikeSku = /^[A-Z]{0,4}[\s\-]?\d[\d.\-\/]*$/i.test(line) || /^\d{4,}/.test(line);
    if (looksLikeSku && line.length < 50) {
      if (current.sku || current.original_title) {
        products.push({
          sku: current.sku || `PDF-${products.length + 1}`,
          original_title: current.original_title || current.raw.slice(0, 200) || 'Sem título',
          raw_text_from_file: current.raw.slice(0, 5000),
        });
      }
      current = { sku: line.replace(/\s+/g, ' ').slice(0, 50), original_title: '', raw: line };
    } else {
      if (!current.original_title && line.length > 2) current.original_title = line.slice(0, 300);
      current.raw = (current.raw + '\n' + line).slice(0, 10000);
    }
  }
  if (current.sku || current.original_title || current.raw) {
    products.push({
      sku: current.sku || `PDF-${products.length + 1}`,
      original_title: current.original_title || current.raw.slice(0, 200) || 'Sem título',
      raw_text_from_file: current.raw.slice(0, 5000),
    });
  }

  if (products.length === 0) {
    products.push({
      sku: 'PDF-1',
      original_title: 'Conteúdo extraído do PDF',
      raw_text_from_file: fullText.slice(0, 15000),
    });
  }
  return products;
}

/**
 * Colunas esperadas no Excel: SKU (código fornecedor), Nome, Descricao, Preco, ID (opcional, para WooCommerce).
 * O SKU é a chave de ligação; o ID do Excel é guardado em woo_id para sincronização.
 */
async function extractProductsFromExcel(filePath, columnMapping = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const products = [];
  const map = columnMapping.SKU != null ? columnMapping : { SKU: 'A', Nome: 'B', Descricao: 'C', Preco: 'D', ID: 'E' };

  const colIndex = (col) => {
    if (typeof col === 'number') return col;
    const s = String(col).toUpperCase();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    let idx = 0;
    for (let i = 0; i < s.length; i++) idx = idx * 26 + (s.charCodeAt(i) - 64);
    return idx - 1;
  };

  const getCell = (row, key) => {
    const idx = colIndex(map[key]);
    const val = row.values;
    if (!val) return '';
    const v = val[idx + 1] ?? val[idx];
    return v != null ? String(v).trim() : '';
  };

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // cabeçalho
      const sku = getCell(row, 'SKU') || getCell(row, 'Nome');
      const nome = getCell(row, 'Nome') || getCell(row, 'SKU');
      if (!sku && !nome) return;
      const precoStr = getCell(row, 'Preco');
      const price = precoStr ? parseFloat(precoStr.replace(/[^\d.,]/g, '').replace(',', '.')) || null : null;
      const idStr = getCell(row, 'ID');
      const woo_id = idStr ? parseInt(idStr, 10) || null : null;
      products.push({
        sku: sku || `ROW-${rowNumber}`,
        original_title: nome,
        original_description: getCell(row, 'Descricao'),
        original_short_description: getCell(row, 'Descricao')?.slice(0, 500) || null,
        raw_text_from_file: null,
        price,
        woo_id,
      });
    });
  });

  return products;
}

/**
 * Processa um ficheiro (path em uploads).
 * - PDF (Biblioteca Técnica): extrai apenas texto e guarda em knowledge_base. NÃO cria produtos.
 * - Excel (Inventário): cria produtos com SKU e ID (woo_id) do ficheiro.
 */
async function processUploadedFile(relativePath, columnMapping = {}, options = {}) {
  ensureUploadsDir();
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(UPLOADS_DIR, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error('Ficheiro não encontrado');

  const ext = path.extname(fullPath).toLowerCase();
  const filename = path.basename(relativePath);

  if (ext === '.pdf') {
    const content = await extractTextFromPdf(fullPath);
    const kid = await db.insertKnowledgeBase({
      source_type: 'pdf',
      source_ref: filename,
      title: filename,
      content: content.slice(0, 500000),
      brand_id: options.brand_id != null ? options.brand_id : null,
    });
    return { count: 0, knowledge_id: kid, extracted_text: content };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const products = await extractProductsFromExcel(fullPath, columnMapping);
    let count = 0;
    for (const p of products) {
      await db.insertProduct({
        sku: p.sku || '',
        status: 'Pendente',
        brand: p.brand ?? null,
        original_title: p.original_title || p.sku,
        original_description: p.original_description ?? null,
        original_short_description: p.original_short_description ?? null,
        raw_text_from_file: p.raw_text_from_file ?? null,
        price: p.price ?? null,
        woo_id: p.woo_id ?? null,
      });
      count++;
    }
    return { count, products };
  }

  throw new Error('Tipo de ficheiro não suportado. Use .pdf ou .xlsx');
}

module.exports = {
  ensureUploadsDir,
  getUploadsDir,
  UPLOADS_DIR,
  registerUploadedFile,
  syncUploadsWithDatabase,
  extractTextFromPdf,
  extractProductsFromPdf,
  extractProductsFromExcel,
  processUploadedFile,
};
