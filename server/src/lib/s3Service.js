/**
 * Alojamento de imagens no S3 (1000x1000 já processadas pelo sharp).
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

let s3Client = null;

function getS3() {
  if (!s3Client) {
    const region = process.env.AWS_REGION || 'eu-west-1';
    s3Client = new S3Client({
      region,
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return s3Client;
}

/**
 * Faz upload de um buffer (imagem) para o S3.
 * @param {Buffer} buffer - Imagem (ex: JPEG 1000x1000)
 * @param {string} key - Caminho no bucket (ex: products/UD-123.jpg)
 * @param {string} contentType - ex: image/jpeg
 * @returns {Promise<string>} URL pública ou path do objeto
 */
async function uploadImage(buffer, key, contentType = 'image/jpeg') {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET não definido');

  const s3 = getS3();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    })
  );

  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `https://${bucket}.s3.${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com/${key}`;
}

module.exports = {
  uploadImage,
  getS3,
};
