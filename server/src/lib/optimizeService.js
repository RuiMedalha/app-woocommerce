/**
 * Otimização com IA: scraping por prefixo do SKU (Settings), SKU limpo para o scraper, UD → Udex.
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { franc } = require('franc');
const db = require('./db');
const { scrapeUdexBySku } = require('./udexScraper');

let openaiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY || null;
    if (!key) throw new Error('OPENAI_API_KEY não definida');
    const { OpenAI } = require('openai');
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

/**
 * Lista de fornecedores (prefix → url) ordenada por tamanho do prefixo (maior primeiro).
 * Inclui fallback UD → Udex quando não houver URL nas settings.
 */
async function getSuppliersByPrefix() {
  const raw = await db.getSetting('suppliers');
  const list = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      list.push(...(Array.isArray(parsed) ? parsed : []));
    } catch (_) {}
  }
  const byPrefix = new Map();
  for (const e of list) {
    const p = (e.prefix || '').toUpperCase().trim();
    if (p) byPrefix.set(p, e.url || '');
  }
  if (!byPrefix.has('UD')) byPrefix.set('UD', ''); // Udex: URL vazia = usar scraper Udex
  return [...byPrefix.entries()]
    .map(([prefix, url]) => ({ prefix, url }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * Dado o SKU do produto (do ficheiro Excel/manual), resolve fornecedor e SKU limpo.
 * Retorna { url, cleanSku, useUdex }.
 * - useUdex true: usar scrapeUdexBySku(sku) e obter texto da página do produto.
 * - Caso contrário: usar url com {sku}/{code} e cleanSku.
 */
async function getSupplierForSku(sku) {
  const str = (sku || '').trim();
  if (!str) return { url: null, cleanSku: '', useUdex: false };
  const suppliers = await getSuppliersByPrefix();
  const upper = str.toUpperCase();
  for (const { prefix, url } of suppliers) {
    if (!prefix || !upper.startsWith(prefix)) continue;
    const cleanSku = str.slice(prefix.length).replace(/^[\s\-]+/, '').trim();
    const useUdex = (prefix === 'UD' && url === '');
    return { url: url || null, cleanSku, useUdex };
  }
  return { url: null, cleanSku: str, useUdex: false };
}

/**
 * Scrape de uma URL de fornecedor (pesquisa por código).
 */
async function scrapeSupplierPage(searchUrl, skuCode) {
  const url = searchUrl.replace('{sku}', encodeURIComponent(skuCode)).replace('{code}', encodeURIComponent(skuCode));
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hotelequip-Optimizer/1.0)' },
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });
  if (res.status !== 200) return '';
  const $ = cheerio.load(res.data);
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
  return text;
}

/**
 * Deteta idioma (franc). 'por' = português.
 */
function detectLanguage(text) {
  if (!text || text.length < 50) return 'por';
  const code = franc(text, { minLength: 50 });
  return code === 'und' ? 'por' : code;
}

/**
 * Traduz para PT-PT se não for português.
 */
async function translateToPtPt(text, model = 'gpt-4o-mini') {
  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: `Traduz o seguinte texto para Português de Portugal (PT-PT). Não uses variantes do português do Brasil. Responde apenas com o texto traduzido, sem explicações.\n\n${text.slice(0, 6000)}`,
      },
    ],
    max_tokens: 2000,
    temperature: 0.2,
  });
  return completion.choices[0]?.message?.content?.trim() || text;
}

/**
 * Master prompt SEO. Usa system prompt editável (settings: seo_system_prompt).
 * Contexto: dados do Excel + Biblioteca de Conhecimento (knowledge_base) + scraping do site.
 */
async function runOptimizationPrompt(product, model = 'gpt-4o-mini') {
  const client = getOpenAI();
  const titulo = product.original_title || '';
  const descricao = product.original_description || product.raw_text_from_file || '';
  const dadosFornecedor = product.supplierData || '';
  const knowledgeContext = product.knowledgeContext || '';

  const systemPrompt = await db.getSetting('seo_system_prompt');
  const defaultSystem = `És um especialista em SEO e copywriting para e-commerce de equipamentos de hotelaria e restauração.
Gera conteúdo em Português de Portugal (PT-PT). Usa os dados do Excel, da Biblioteca Técnica e do site do fornecedor para enriquecer títulos e descrições.`;
  const system = (systemPrompt && systemPrompt.trim()) ? systemPrompt.trim() : defaultSystem;

  const userContent = `Com base na seguinte informação:

**Dados do Excel / Produto:**
- SKU: ${product.sku || ''}
- Título Original: ${titulo}
- Descrição Original: ${descricao}
${dadosFornecedor ? `**Dados do site do fornecedor (scraping):**\n${dadosFornecedor.slice(0, 4000)}` : ''}
${knowledgeContext ? `**Biblioteca de Conhecimento (documentação técnica):**\n${knowledgeContext.slice(0, 5000)}` : ''}

Gera o seguinte em JSON (apenas o JSON, sem markdown):
1. title - Título SEO (máx 60 carateres)
2. meta_title - Meta title (máx 60)
3. meta_description - Meta description (máx 155)
4. short_description - Descrição curta (1-2 parágrafos)
5. full_description - Descrição completa com dados técnicos e FAQs quando aplicável
6. alt_text - Alt text imagem (máx 125)
7. meta_keywords - Palavras-chave separadas por vírgula (opcional)
8. faqs - Perguntas e respostas técnicas no formato "P: ... R: ..." separadas por linha dupla (opcional)
9. cross_sell_skus - SKUs separados por vírgula (máx 3)
10. upsell_skus - SKUs separados por vírgula (máx 2)

Chaves exatas: "title", "meta_title", "meta_description", "short_description", "full_description", "alt_text", "meta_keywords", "faqs", "cross_sell_skus", "upsell_skus".`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    max_tokens: 2500,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '{}';
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

/**
 * Fluxo completo: POST /api/products/:id/optimize
 * SKU vem do ficheiro (Excel) ou manual; prefixo das Settings define o scraper; SKU limpo vai para o scraper.
 */
async function optimizeProduct(productId) {
  const product = await db.getProductById(productId);
  if (!product) throw new Error('Produto não encontrado');

  const sku = (product.sku || '').trim();
  const { url: supplierUrl, cleanSku, useUdex } = await getSupplierForSku(sku);

  let supplierData = '';
  if (useUdex) {
    try {
      const r = await scrapeUdexBySku(sku);
      if (r && r.url) {
        const res = await axios.get(r.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hotelequip-Optimizer/1.0)' },
          timeout: 15000,
          validateStatus: (s) => s < 500,
        });
        if (res.status === 200) {
          const $ = cheerio.load(res.data);
          supplierData = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
        }
        if (!supplierData && r.name) supplierData = r.name;
      } else if (r && r.name) supplierData = r.name;
    } catch (e) {
      console.warn('Scrape Udex:', e.message);
    }
  } else if (supplierUrl) {
    try {
      supplierData = await scrapeSupplierPage(supplierUrl, cleanSku);
    } catch (e) {
      console.warn('Scrape fornecedor:', e.message);
    }
  }

  const knowledgeContext = await db.getKnowledgeBaseContentForContext(15000);

  const combinedText = [product.original_title, product.original_description, product.raw_text_from_file, supplierData].filter(Boolean).join('\n');
  const lang = detectLanguage(combinedText);
  let titleForPrompt = product.original_title || '';
  let descForPrompt = (product.original_description || product.raw_text_from_file || '').slice(0, 8000);

  if (lang !== 'por') {
    try {
      titleForPrompt = await translateToPtPt(titleForPrompt);
      if (descForPrompt) descForPrompt = await translateToPtPt(descForPrompt);
    } catch (e) {
      console.warn('Tradução:', e.message);
    }
  }

  const model = (await db.getSetting('openai_model')) || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const result = await runOptimizationPrompt(
    {
      ...product,
      original_title: titleForPrompt,
      original_description: descForPrompt,
      supplierData,
      knowledgeContext,
    },
    model
  );

  await db.updateProduct(productId, {
    optimized_title: result.title || product.optimized_title,
    optimized_meta_title: result.meta_title || product.optimized_meta_title,
    optimized_meta_description: result.meta_description || product.optimized_meta_description,
    optimized_short_description: result.short_description || product.optimized_short_description,
    optimized_full_description: result.full_description || product.optimized_full_description,
    cross_sell_skus: result.cross_sell_skus ?? product.cross_sell_skus,
    upsell_skus: result.upsell_skus ?? product.upsell_skus,
    meta_keywords: result.meta_keywords ?? product.meta_keywords ?? null,
    faqs: result.faqs ?? product.faqs ?? null,
  });

  const updated = await db.getProductById(productId);
  await db.addActivityLog({ action: `Produto ${product.sku} otimizado com IA`, details: String(productId), status: 'Success' });
  return updated;
}

module.exports = {
  optimizeProduct,
  detectLanguage,
  translateToPtPt,
  runOptimizationPrompt,
  getSuppliersByPrefix,
  getSupplierForSku,
  scrapeSupplierPage,
};
