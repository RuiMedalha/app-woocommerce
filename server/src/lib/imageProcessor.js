const sharp = require('sharp');

const DEFAULT_SIZE = 1000;
const WHITE_BG = { r: 255, g: 255, b: 255 };

/**
 * Processa imagem para 1000x1000 com fundo branco (fit contain sobre branco).
 * Útil para catálogos e WooCommerce.
 */
async function processImageBuffer(buffer, options = {}) {
  const size = options.size ?? DEFAULT_SIZE;
  const format = options.format || 'jpeg';
  const quality = options.quality ?? 90;
  const whiteBackground = options.whiteBackground !== false;

  let pipeline = sharp(buffer)
    .resize(size, size, {
      fit: 'contain',
      position: 'centre',
      background: whiteBackground ? WHITE_BG : undefined,
      withoutEnlargement: false,
    });

  if (whiteBackground) {
    pipeline = pipeline.flatten({ background: WHITE_BG });
  }

  if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: options.quality ?? 80 });
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  return pipeline.toBuffer();
}

module.exports = {
  processImageBuffer,
  DEFAULT_SIZE,
  WHITE_BG,
};
