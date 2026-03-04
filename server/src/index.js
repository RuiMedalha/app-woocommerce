const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');

const db = require('./lib/db');
const brandConfig = require('./lib/brands');
const { cleanSku } = require('./lib/skuCleaner');
const { scrapeSupplier } = require('./lib/scraper');
const { scrapeUdexBySku, scrapeUdexBatch, removeUdexPrefix } = require('./lib/udexScraper');
const { processImageBuffer } = require('./lib/imageProcessor');
const { uploadImage } = require('./lib/s3Service');
const { importExcelFromPath } = require('./lib/excelImporter');
const { expandAcronyms, generateFaqs, optimizeProductText } = require('./lib/openaiService');
const { syncProducts, pullFromWooCommerce } = require('./lib/wooCommerceService');
const { processUploadedFile, ensureUploadsDir, getUploadsDir, syncUploadsWithDatabase } = require('./lib/uploadService');
const uploadController = require('./controllers/uploadController');
const { optimizeProduct } = require('./lib/optimizeService');
const { exportMirrorToBuffer } = require('./lib/exportExcelService');
const axios = require('axios');

const BULK_CONCURRENCY = 5;
const bulkState = { queue: [], inProgress: [], completed: [], failed: [] };

async function runBulkWorker() {
  if (bulkState.queue.length === 0 || bulkState.inProgress.length >= BULK_CONCURRENCY) return;
  const batch = bulkState.queue.splice(0, BULK_CONCURRENCY - bulkState.inProgress.length);
  for (const id of batch) {
    bulkState.inProgress.push(id);
    optimizeProduct(id)
      .then(() => {
        bulkState.inProgress = bulkState.inProgress.filter((x) => x !== id);
        bulkState.completed.push(id);
        runBulkWorker();
      })
      .catch((err) => {
        bulkState.inProgress = bulkState.inProgress.filter((x) => x !== id);
        bulkState.failed.push({ id, error: err.message });
        runBulkWorker();
      });
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5178', 'http://127.0.0.1:5178'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));
app.use(bodyParser.json());
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

ensureUploadsDir();
const multerMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const uploadsDir = getUploadsDir();
const multerDisk = multer({
  dest: uploadsDir,
  limits: { fileSize: 15 * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => { cb(null, getUploadsDir()); },
    filename: (req, file, cb) => { cb(null, `${Date.now()}-${(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`); },
  }),
});
const upload = multerMemory;

// ——— Marcas / Fornecedores (Udex, Arisco, etc.) ———
app.get('/brands', (req, res) => {
  res.json(brandConfig.getAllBrands());
});
app.get('/api/brands', (req, res) => {
  res.json(brandConfig.getAllBrands());
});

app.post('/sku/clean', (req, res) => {
  const { brandKey, sku } = req.body;
  if (!brandKey || !sku) {
    return res.status(400).json({ error: 'brandKey e sku são obrigatórios.' });
  }
  const brand = brandConfig.getBrand(brandKey);
  if (!brand) return res.status(404).json({ error: 'Marca não encontrada.' });
  const cleaned = cleanSku(sku, brand);
  res.json({ original: sku, cleaned, brand: brandKey });
});

// ——— Scraper genérico ———
app.post('/scrape', async (req, res) => {
  const { brandKey, url } = req.body;
  if (!brandKey || !url) return res.status(400).json({ error: 'brandKey e url são obrigatórios.' });
  const brand = brandConfig.getBrand(brandKey);
  if (!brand) return res.status(404).json({ error: 'Marca não encontrada.' });
  try {
    const products = await scrapeSupplier(url, brand);
    res.json({ count: products.length, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer scraping.', details: err.message });
  }
});

// ——— Scraper Udex (remove UD, scrape udex.pt) ———
app.post('/scrape/udex', async (req, res) => {
  const { sku, batch } = req.body;
  try {
    if (Array.isArray(batch) && batch.length) {
      const results = await scrapeUdexBatch(batch);
      return res.json({ results });
    }
    const single = sku || (batch && batch[0]);
    if (!single) return res.status(400).json({ error: 'sku ou batch obrigatório.' });
    const result = await scrapeUdexBySku(single);
    res.json(result || { sku_original: single, sku_clean: removeUdexPrefix(single), error: 'Não encontrado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro scraping Udex.', details: err.message });
  }
});

// ——— Produtos (CRUD) ———
app.get('/products', (req, res) => {
  const status = req.query.status || null;
  db.getAllProducts(status ? { status } : {})
    .then((list) => res.json(list))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
});

app.get('/products/:id', (req, res) => {
  db.getProductById(Number(req.params.id))
    .then((row) => (row ? res.json(row) : res.status(404).json({ error: 'Produto não encontrado.' })))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
});
app.get('/api/products/:id', (req, res) => {
  db.getProductById(Number(req.params.id))
    .then((row) => (row ? res.json(row) : res.status(404).json({ error: 'Produto não encontrado.' })))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
});

app.put('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  db.updateProduct(id, req.body)
    .then(() => db.getProductById(id))
    .then((row) => res.json(row))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
});

// ——— OpenAI: expandir siglas e gerar FAQs (Patos) ———
app.post('/optimize/expand', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text obrigatório.' });
  try {
    const result = await expandAcronyms(text);
    res.json({ original: text, expanded: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/optimize/faqs', async (req, res) => {
  const { productName, productDescription, count } = req.body;
  if (!productName) return res.status(400).json({ error: 'productName obrigatório.' });
  try {
    const faqs = await generateFaqs(productName, productDescription || '', { count: count || 5 });
    res.json({ faqs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/optimize/product', async (req, res) => {
  const { productId, text } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId obrigatório.' });
  try {
    const product = await db.getProductById(Number(productId));
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    const toExpand = text || product.name || '';
    const expanded = await optimizeProductText(toExpand);
    await db.updateProduct(product.id, { text_optimized: expanded });
    const updated = await db.getProductById(product.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ——— Imagem: 1000x1000 fundo branco + upload S3 ———
app.post('/images/process-upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro image obrigatório.' });
  const keyPrefix = req.body.keyPrefix || 'products';
  const keySuffix = req.body.keySuffix || `${Date.now()}.jpg`;
  try {
    const buffer = await processImageBuffer(req.file.buffer, { whiteBackground: true });
    const key = `${keyPrefix}/${keySuffix}`;
    const url = await uploadImage(buffer, key, 'image/jpeg');
    res.json({ url, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Download URL -> process -> S3 (ex: imagem Udex)
app.post('/images/process-from-url', async (req, res) => {
  const { imageUrl, keyPrefix, keySuffix } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl obrigatório.' });
  try {
    const resp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(resp.data);
    const processed = await processImageBuffer(buffer, { whiteBackground: true });
    const key = `${keyPrefix || 'products'}/${keySuffix || `${Date.now()}.jpg`}`;
    const url = await uploadImage(processed, key, 'image/jpeg');
    res.json({ url, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ——— Excel ———
app.post('/excel/import', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath é obrigatório.' });
  try {
    const rows = await importExcelFromPath(filePath);
    res.json({ rowsCount: rows.length, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao ler ficheiro Excel.', details: err.message });
  }
});

// ——— WooCommerce ———
app.post('/woocommerce/sync', async (req, res) => {
  const { productIds, products } = req.body;
  let list = products;
  if (!list && productIds && productIds.length) {
    list = await Promise.all(productIds.map((id) => db.getProductById(Number(id))));
    list = list.filter(Boolean).map((p) => ({
      sku: p.sku,
      woo_id: p.woo_id,
      optimized_title: p.optimized_title,
      original_title: p.original_title,
      optimized_full_description: p.optimized_full_description,
      original_description: p.original_description,
      optimized_short_description: p.optimized_short_description,
      original_short_description: p.original_short_description,
      optimized_meta_title: p.optimized_meta_title,
      optimized_meta_description: p.optimized_meta_description,
      image_s3_url: p.image_s3_url,
      price: p.price,
    }));
  }
  if (!list || !list.length) return res.status(400).json({ error: 'products ou productIds obrigatório.' });
  try {
    const results = await syncProducts(list);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/woo/pull', async (req, res) => {
  try {
    const url = await db.getSetting('woocommerce_url');
    const key = await db.getSetting('woocommerce_consumer_key');
    const secret = await db.getSetting('woocommerce_consumer_secret');
    if (url) process.env.WOOCOMMERCE_URL = url;
    if (key) process.env.WOOCOMMERCE_CONSUMER_KEY = key;
    if (secret) process.env.WOOCOMMERCE_CONSUMER_SECRET = secret;
    const result = await pullFromWooCommerce(db);
    await db.addActivityLog({ action: 'Sincronização WooCommerce (pull)', details: `${result.updated} atualizados, ${result.created} criados`, status: 'Success' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ——— API conforme PDF ———
app.get('/api/stats', (req, res) => {
  Promise.all([db.getProductStats(), db.getActivityLog(10)])
    .then(([stats, activity]) => res.json({ stats, activity }))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.get('/api/activity', (req, res) => {
  db.getActivityLog(Number(req.query.limit) || 10)
    .then((rows) => res.json(rows))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.post('/api/upload', multerDisk.single('file'), (req, res) => uploadController.upload(req, res));

app.get('/api/upload', (req, res) => {
  const kind = req.query.kind || null;
  db.getUploadedFiles(50, kind)
    .then((rows) => res.json(rows))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.get('/api/uploads', (req, res) => {
  db.getUploadedFiles(100, null)
    .then((rows) => res.json(rows || []))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.get('/api/upload/inventory', (req, res) => {
  db.getUploadedFiles(50, 'inventory')
    .then((rows) => res.json(rows))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.get('/api/upload/library', (req, res) => {
  db.getUploadedFiles(50, 'library')
    .then((rows) => res.json(rows))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.get('/api/knowledge-base', (req, res) => {
  db.getKnowledgeBaseEntries(Number(req.query.limit) || 100)
    .then((rows) => res.json(rows))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.post('/api/upload/process', async (req, res) => {
  const { path: filePath, fileId, columnMapping, brand_id } = req.body;
  let pathToUse = filePath;
  if (!pathToUse && fileId) {
    const row = await new Promise((resolve, reject) => {
      db.getDb().get('SELECT * FROM uploaded_files WHERE id = ?', [fileId], (err, r) => (err ? reject(err) : resolve(r)));
    });
    if (!row) return res.status(404).json({ error: 'Ficheiro não encontrado.' });
    pathToUse = row.path;
    await db.updateUploadedFile(fileId, { status: 'A extrair dados' });
  }
  if (!pathToUse) return res.status(400).json({ error: 'path ou fileId obrigatório.' });
  try {
    const result = await processUploadedFile(pathToUse, columnMapping || {}, { brand_id: brand_id != null ? brand_id : null });
    const updateFields = { status: 'Concluído', product_count: result.count ?? 0 };
    if (result.extracted_text != null) updateFields.extracted_text = result.extracted_text;
    if (fileId) await db.updateUploadedFile(fileId, updateFields);
    const msg = result.count > 0 ? `${result.count} produtos extraídos` : 'Texto guardado na Biblioteca de Conhecimento';
    db.addActivityLog({ action: `Ficheiro processado: ${msg}`, details: pathToUse, status: 'Success' });
    res.json({ count: result.count ?? 0, knowledge_id: result.knowledge_id, extracted_text: result.extracted_text });
  } catch (err) {
    if (fileId) await db.updateUploadedFile(fileId, { status: 'Erro', error_message: err.message });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/:id/optimize', async (req, res) => {
  try {
    const apiKey = await db.getSetting('openai_api_key');
    if (!apiKey && !process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OPENAI_API_KEY não definida. Configure em Configurações.' });
    }
    if (apiKey) process.env.OPENAI_API_KEY = apiKey;
    const product = await optimizeProduct(Number(req.params.id));
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/:id/process-image', upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'Ficheiro image obrigatório.' });
  try {
    const buffer = await processImageBuffer(req.file.buffer, { whiteBackground: true, format: 'webp', quality: 80 });
    const key = `products/${id}-${Date.now()}.webp`;
    const url = await uploadImage(buffer, key, 'image/webp');
    await db.insertImage({ product_id: id, original_url_or_path: req.file.originalname, processed_s3_url: url, is_main_image: true });
    await db.updateProduct(id, { image_s3_url: url });
    const product = await db.getProductById(id);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/:id/apply', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const product = await db.getProductById(id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    const { applyProductToWooCommerce } = require('./lib/wooCommerceService');
    const data = await applyProductToWooCommerce(product);
    await db.updateProduct(id, { status: 'Aplicado no Site', woo_id: data.id });
    await db.addActivityLog({ action: `Produto ${product.sku} atualizado no WooCommerce`, details: String(id), status: 'Success' });
    const updated = await db.getProductById(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    await db.addActivityLog({ action: `Erro ao aplicar produto ${id}`, details: err.message, status: 'Error' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  const key = req.query.key;
  if (key) {
    db.getSetting(key).then((value) => res.json({ key, value })).catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
  } else {
    db.getDb().all('SELECT key, value FROM settings', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const obj = {};
      (rows || []).forEach((r) => { obj[r.key] = r.value; });
      res.json(obj);
    });
  }
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key obrigatório.' });
  db.setSetting(key, value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value))
    .then(() => res.json({ ok: true }))
    .catch((err) => { console.error(err); res.status(500).json({ error: err.message }); });
});

app.get('/api/export/excel', async (req, res) => {
  try {
    const buffer = await exportMirrorToBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=produtos-espelho.xlsx');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/bulk-optimize', async (req, res) => {
  const { productIds } = req.body;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds (array) obrigatório.' });
  }
  const apiKey = await db.getSetting('openai_api_key');
  if (apiKey) process.env.OPENAI_API_KEY = apiKey;
  bulkState.queue.push(...productIds);
  runBulkWorker();
  res.json({ queued: productIds.length, message: `Em fila. A processar ${BULK_CONCURRENCY} de cada vez.` });
});

app.get('/api/products/bulk-optimize/status', (req, res) => {
  res.json({
    queue: bulkState.queue.length,
    inProgress: bulkState.inProgress,
    completed: bulkState.completed.length,
    failed: bulkState.failed,
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Servir frontend build (Docker / produção)
const fs = require('fs');
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

(async () => {
  await db.init();
  try {
    const added = await syncUploadsWithDatabase();
    if (added > 0) {
      console.log(`[Auto-sync] ${added} ficheiro(s) na pasta /uploads adicionado(s) à tabela uploaded_files.`);
    }
  } catch (err) {
    console.error('[Auto-sync] Erro ao sincronizar pasta uploads:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
  });
})();
