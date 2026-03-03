const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const db = require('./lib/db');
const brandConfig = require('./lib/brands');
const { cleanSku } = require('./lib/skuCleaner');
const { scrapeSupplier } = require('./lib/scraper');
const { processImageBuffer } = require('./lib/imageProcessor');
const { importExcelFromPath } = require('./lib/excelImporter');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(bodyParser.json());

// Expor diretório de uploads/imagens se necessário
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

// Lista de marcas e respetiva configuração
app.get('/brands', (req, res) => {
  res.json(brandConfig.getAllBrands());
});

// Limpeza de SKU com base na marca
app.post('/sku/clean', (req, res) => {
  const { brandKey, sku } = req.body;
  if (!brandKey || !sku) {
    return res.status(400).json({ error: 'brandKey e sku são obrigatórios.' });
  }

  const brand = brandConfig.getBrand(brandKey);
  if (!brand) {
    return res.status(404).json({ error: 'Marca não encontrada.' });
  }

  const cleaned = cleanSku(sku, brand);
  res.json({ original: sku, cleaned, brand: brandKey });
});

// Scraper genérico por marca
app.post('/scrape', async (req, res) => {
  const { brandKey, url } = req.body;
  if (!brandKey || !url) {
    return res.status(400).json({ error: 'brandKey e url são obrigatórios.' });
  }

  const brand = brandConfig.getBrand(brandKey);
  if (!brand) {
    return res.status(404).json({ error: 'Marca não encontrada.' });
  }

  try {
    const products = await scrapeSupplier(url, brand);
    res.json({ count: products.length, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer scraping.', details: err.message });
  }
});

// Importação de Excel (a partir de um caminho local para simplificar)
app.post('/excel/import', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'filePath é obrigatório.' });
  }

  try {
    const rows = await importExcelFromPath(filePath);
    res.json({ rowsCount: rows.length, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao ler ficheiro Excel.', details: err.message });
  }
});

// Endpoint de teste para processamento de imagem a partir de URL/base64 não incluído por simplicidade.
// Aqui apenas demonstramos a função.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  db.init();
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});

