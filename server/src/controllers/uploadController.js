/**
 * Controller de upload: após o multer gravar o ficheiro, faz INSERT na tabela uploaded_files
 * com nome, caminho e data (created_at é preenchido pela BD).
 */
const path = require('path');
const db = require('../lib/db');
const { registerUploadedFile } = require('../lib/uploadService');

/**
 * POST /api/upload - chamado após multer.single('file').
 * Garante que cada ficheiro guardado é registado na tabela uploaded_files.
 */
function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Ficheiro obrigatório.' });
  }

  const filename = req.file.originalname || req.file.filename || 'ficheiro';
  const filePath = req.file.filename; // nome com que o multer guardou no disco
  const ext = path.extname(filename).toLowerCase();
  const type = ext === '.pdf' ? 'pdf' : ext === '.xlsx' || ext === '.xls' ? 'excel' : 'other';
  const status = 'Aguardando processamento';

  registerUploadedFile(filename, filePath, type, status)
    .then((id) => {
      db.getDb().get('SELECT * FROM uploaded_files WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json(row || { id, filename, path: filePath, type, status, created_at: new Date().toISOString() });
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
}

module.exports = {
  upload,
};
