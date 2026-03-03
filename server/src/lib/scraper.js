const axios = require('axios');
const cheerio = require('cheerio');
const { cleanSku } = require('./skuCleaner');
const { insertProduct } = require('./db');

// Scraper genérico baseado na configuração da marca.
// A função assume uma listagem de produtos em HTML.

async function scrapeSupplier(listUrl, brand) {
  const res = await axios.get(listUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Hotelequip-Optimizer/1.0)',
    },
  });

  const html = res.data;
  const $ = cheerio.load(html);

  const config = brand.scraper || {};
  const productSelector = config.productSelector || '.product';
  const skuSelector = config.skuSelector || '.sku';
  const nameSelector = config.nameSelector || '.name';
  const priceSelector = config.priceSelector || '.price';
  const imageSelector = config.imageSelector || 'img';

  const products = [];

  $(productSelector).each((_, el) => {
    const skuRaw = $(el).find(skuSelector).text().trim();
    const name = $(el).find(nameSelector).text().trim();
    const priceText = $(el).find(priceSelector).text().replace(/[^\d.,]/g, '').trim();
    const imageUrl = $(el).find(imageSelector).attr('src') || null;

    if (!skuRaw) return;

    const sku_clean = cleanSku(skuRaw, brand);

    let price = null;
    if (priceText) {
      const normalized = priceText.replace('.', '').replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!Number.isNaN(parsed)) {
        price = parsed;
      }
    }

    products.push({
      brand: brand.sku_prefix,
      sku_original: skuRaw,
      sku_clean,
      name,
      price,
      image_url: imageUrl,
    });
  });

  // Guardar na base de dados
  for (const p of products) {
    try {
      await insertProduct(p);
    } catch (err) {
      // Não falhar o scraping completo por causa de um registo
      console.error('Erro ao inserir produto na BD:', err.message);
    }
  }

  return products;
}

module.exports = {
  scrapeSupplier,
};

