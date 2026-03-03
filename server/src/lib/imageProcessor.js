const sharp = require('sharp');

// Configuração padrão: imagens 1000x1000, com cover (corte centrado)
const DEFAULT_SIZE = 1000;

async function processImageBuffer(buffer, options = {}) {
  const size = options.size || DEFAULT_SIZE;
  const format = options.format || 'jpeg';
  const quality = options.quality || 80;

  let pipeline = sharp(buffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    });

  if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  return pipeline.toBuffer();
}

module.exports = {
  processImageBuffer,
  DEFAULT_SIZE,
};

