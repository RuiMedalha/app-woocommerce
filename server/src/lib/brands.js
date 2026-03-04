// Arquitetura universal de marcas:
// Cada marca tem:
// - sku_prefix: prefixo aplicado ou esperado no SKU
// - dictionary_mapping: mapeamento de siglas -> forma normalizada
// - scraper: configuração base opcional para o scraping

const brands = {
  // Udex: prefixo UD, scraping em udex.pt
  udex: {
    name: 'Udex',
    sku_prefix: 'UD',
    dictionary_mapping: {
      UD: '',
    },
    scraper: {
      productSelector: '.product-card',
      skuSelector: '.sku',
      nameSelector: '.product-title',
      priceSelector: '.price',
      imageSelector: 'img',
    },
  },

  ud: {
    name: 'Universal Demo',
    sku_prefix: 'UD',
    dictionary_mapping: { UD: '' },
    scraper: {
      productSelector: '.product-card',
      skuSelector: '.sku',
      nameSelector: '.product-title',
      priceSelector: '.price',
      imageSelector: 'img',
    },
  },

  abc: {
    name: 'Marca ABC',
    sku_prefix: 'ABC',
    dictionary_mapping: {
      ABC: '',
      INOX: 'INOX',
    },
    scraper: {
      productSelector: '.item',
      skuSelector: '.ref',
      nameSelector: '.title',
      priceSelector: '.value',
      imageSelector: 'img',
    },
  },
};

function getBrand(key) {
  return brands[key];
}

function getAllBrands() {
  return Object.entries(brands).map(([key, cfg]) => ({
    key,
    name: cfg.name,
    sku_prefix: cfg.sku_prefix,
  }));
}

module.exports = {
  getBrand,
  getAllBrands,
};

