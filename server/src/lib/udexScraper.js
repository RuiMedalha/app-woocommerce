/**
 * Scraper Udex: remove prefixo 'UD' do SKU e faz scraping em udex.pt
 * Base URL: https://www.udex.pt (categorias en/products/washing, cold, etc.)
 */
const axios = require('axios');
const cheerio = require('cheerio');

const UDEX_BASE = 'https://www.udex.pt';
const UD_PREFIX = 'UD';

/**
 * Remove o prefixo 'UD' do SKU (case-insensitive, com ou sem espaço/hífen).
 * Ex: "UD 2186.426" -> "2186.426", "UD-2929.052" -> "2929.052"
 */
function removeUdexPrefix(sku) {
  if (!sku || typeof sku !== 'string') return '';
  let code = sku.trim().toUpperCase();
  if (code.startsWith(UD_PREFIX)) {
    code = code.slice(UD_PREFIX.length).replace(/^[\s\-]+/, '');
  }
  return code.trim();
}

/**
 * Normaliza código para comparação (remove pontos se necessário para URL)
 */
function normalizeCodeForMatch(code) {
  return String(code).replace(/\s/g, '').replace(/\./g, '.');
}

/**
 * Faz fetch a uma página Udex e extrai produtos da listagem (título + Code. XXX)
 */
async function fetchPage(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (compatible; Hotelequip-Optimizer/1.0)',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });
  if (res.status !== 200) throw new Error(`Udex HTTP ${res.status}`);
  return res.data;
}

/**
 * Extrai produtos de HTML de listagem Udex (títulos com "Code. X.X.XXX")
 */
function parseListingProducts(html, baseUrl) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  // Títulos de produtos no site costumam ter "Code. 1234.567"
  $('a[href*="/en/"], a[href*="/pt/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    let title = ($el.find('h3').text() || $el.text()).trim();
    if (!title || !href) return;

    const codeMatch = title.match(/Code\.\s*([\d.]+)/i) || title.match(/\b(\d{4}\.\d{3})\b/);
    const code = codeMatch ? codeMatch[1].trim() : null;
    if (!code || seen.has(code)) return;
    seen.add(code);

    const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    products.push({
      code,
      name: title.replace(/\s*Code\.\s*[\d.]+\s*$/i, '').trim(),
      url: fullUrl,
    });
  });

  return products;
}

/**
 * Scrape Udex: dado um SKU (ex: "UD 2186.426"), remove "UD" e procura o produto em udex.pt
 * Opção 1: passar lista de URLs de categorias para varrer
 * Opção 2: procurar por código em páginas conhecidas
 */
async function scrapeUdexBySku(sku) {
  const code = removeUdexPrefix(sku);
  if (!code) return null;

  const categoryPaths = [
    '/en/products/washing/',
    '/en/products/restaurant-industry/',
    '/en/products/cooking/',
    '/en/products/cold/',
    '/en/products/ice-cream/',
    '/en/products/laundry/',
    '/en/new-products/',
    '/en/opportunities/',
  ];

  const codeNorm = normalizeCodeForMatch(code);

  for (const path of categoryPaths) {
    try {
      const html = await fetchPage(UDEX_BASE + path);
      const products = parseListingProducts(html, UDEX_BASE);
      const found = products.find((p) => {
        const pNorm = normalizeCodeForMatch(p.code);
        return pNorm === codeNorm || p.code === code || pNorm.replace(/\./g, '') === codeNorm.replace(/\./g, '');
      });
      if (found) {
        return {
          sku_original: sku,
          sku_clean: code,
          sku_prefix_removed: UD_PREFIX,
          name: found.name,
          code: found.code,
          url: found.url,
          source: 'udex.pt',
        };
      }
    } catch (err) {
      console.warn(`Udex scrape ${path}:`, err.message);
    }
  }

  return null;
}

/**
 * Scrape múltiplos SKUs UD (batch)
 */
async function scrapeUdexBatch(skus) {
  const results = [];
  for (const sku of skus) {
    const r = await scrapeUdexBySku(sku);
    results.push(r || { sku_original: sku, sku_clean: removeUdexPrefix(sku), error: 'Não encontrado' });
  }
  return results;
}

module.exports = {
  removeUdexPrefix,
  scrapeUdexBySku,
  scrapeUdexBatch,
  UDEX_BASE,
  UD_PREFIX,
};
