/**
 * Exportação Excel "Espelho": lado esquerdo = dados originais, lado direito = dados otimizados (SEO, FAQs, imagens).
 */
const ExcelJS = require('exceljs');
const db = require('./db');

async function buildMirrorWorkbook() {
  const products = await db.getAllProducts({});
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produtos', { views: [{ state: 'frozen', xSplit: 8, ySplit: 1 }] });

  const leftHeaders = ['SKU', 'ID (WooCommerce)', 'Nome Original', 'Descrição Original', 'Descrição Curta Orig.', 'Preço', 'Marca'];
  const rightHeaders = ['Título Otimizado', 'Meta Title', 'Meta Description', 'Descrição Curta SEO', 'Descrição Completa', 'Meta Keywords', 'FAQs', 'URL Imagem'];
  const headers = [...leftHeaders, ...rightHeaders];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  for (const p of products) {
    sheet.addRow([
      p.sku || '',
      p.woo_id != null ? p.woo_id : '',
      p.original_title || '',
      (p.original_description || '').slice(0, 32000),
      (p.original_short_description || '').slice(0, 32000),
      p.price != null ? p.price : '',
      p.brand || '',
      p.optimized_title || '',
      p.optimized_meta_title || '',
      p.optimized_meta_description || '',
      (p.optimized_short_description || '').slice(0, 32000),
      (p.optimized_full_description || '').slice(0, 32000),
      p.meta_keywords || '',
      p.faqs || '',
      p.image_s3_url || p.image_url || '',
    ]);
  }

  return workbook;
}

async function exportMirrorToBuffer() {
  const workbook = await buildMirrorWorkbook();
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildMirrorWorkbook,
  exportMirrorToBuffer,
};
