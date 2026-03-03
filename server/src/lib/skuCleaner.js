// Função de limpeza de SKU baseada na configuração da marca.
// Exemplo: remover "UD" ou outros tokens definidos em dictionary_mapping.

function normalizeWhitespace(str) {
  return str
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSku(rawSku, brand) {
  if (!rawSku) return '';

  let result = String(rawSku).toUpperCase();

  // Remover prefixo SKU se existir
  if (brand.sku_prefix) {
    const prefix = String(brand.sku_prefix).toUpperCase();
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
    }
  }

  // Aplicar dictionary_mapping para remover/substituir siglas
  if (brand.dictionary_mapping) {
    for (const [token, replacement] of Object.entries(brand.dictionary_mapping)) {
      const pattern = new RegExp(`\\b${token.toUpperCase()}\\b`, 'g');
      result = result.replace(pattern, replacement.toUpperCase());
    }
  }

  // Remover caracteres não alfanuméricos relevantes (opcional, aqui mantemos / e -)
  result = result.replace(/[^A-Z0-9\-\/ ]+/g, '');

  // Normalizar espaços
  result = normalizeWhitespace(result);

  return result;
}

module.exports = {
  cleanSku,
};

