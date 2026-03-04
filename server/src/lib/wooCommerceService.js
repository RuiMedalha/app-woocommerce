/**
 * Envio de produtos para o WooCommerce via API REST.
 * Inclui meta_data RankMath (rank_math_title, rank_math_description) conforme PDF.
 */
const axios = require('axios');

function getWooConfig() {
  const baseUrl = process.env.WOOCOMMERCE_URL;
  const key = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
  if (!baseUrl || !key || !secret) {
    throw new Error('WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY e WOOCOMMERCE_CONSUMER_SECRET são obrigatórios.');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), key, secret };
}

function getAuthHeader() {
  const { key, secret } = getWooConfig();
  const token = Buffer.from(`${key}:${secret}`, 'utf8').toString('base64');
  return { Authorization: `Basic ${token}` };
}

/**
 * Encontra o ID do produto no WooCommerce pelo SKU.
 */
async function findProductIdBySku(sku) {
  const { baseUrl } = getWooConfig();
  const res = await axios.get(`${baseUrl}/wp-json/wc/v3/products`, {
    params: { sku },
    headers: getAuthHeader(),
  });
  const list = res.data;
  if (list && list.length > 0) return list[0].id;
  return null;
}

/**
 * Aplica um produto no WooCommerce (conforme PDF: name, description, short_description, meta_data RankMath, images com alt).
 */
async function applyProductToWooCommerce(product) {
  const { baseUrl } = getWooConfig();
  const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };

  const meta_data = [];
  if (product.optimized_meta_title) {
    meta_data.push({ key: 'rank_math_title', value: product.optimized_meta_title });
  }
  if (product.optimized_meta_description) {
    meta_data.push({ key: 'rank_math_description', value: product.optimized_meta_description });
  }

  const images = [];
  if (product.image_s3_url) {
    images.push({
      src: product.image_s3_url,
      alt: product.image_alt_text || product.optimized_title || product.original_title || '',
    });
  }
  if (product.images && product.images.length) {
    product.images.forEach((img) => {
      images.push({
        src: typeof img === 'string' ? img : img.src,
        alt: typeof img === 'object' && img.alt ? img.alt : product.image_alt_text || '',
      });
    });
  }

  const body = {
    name: product.optimized_title || product.original_title || product.name,
    sku: product.sku || '',
    type: 'simple',
    regular_price: String(product.price || ''),
    description: product.optimized_full_description || product.original_description || '',
    short_description: product.optimized_short_description || product.original_short_description || '',
    images,
    meta_data,
  };

  let wooId = product.woo_id;
  if (!wooId) {
    wooId = await findProductIdBySku(product.sku);
  }

  const url = wooId
    ? `${baseUrl}/wp-json/wc/v3/products/${wooId}`
    : `${baseUrl}/wp-json/wc/v3/products`;

  if (wooId) {
    const res = await axios.put(url, body, { headers });
    return res.data;
  }
  const res = await axios.post(url, body, { headers });
  return res.data;
}

/**
 * Envia vários produtos (batch). Para cada um: buscar da BD, aplicar, atualizar estado e woo_id.
 */
async function syncProducts(products) {
  const results = [];
  for (const p of products) {
    try {
      const data = await applyProductToWooCommerce(p);
      results.push({ sku: p.sku, success: true, id: data.id, data });
    } catch (err) {
      results.push({
        sku: p.sku,
        success: false,
        error: err.response?.data?.message || err.message,
      });
    }
  }
  return results;
}

module.exports = {
  applyProductToWooCommerce,
  findProductIdBySku,
  syncProducts,
  getWooConfig,
};
