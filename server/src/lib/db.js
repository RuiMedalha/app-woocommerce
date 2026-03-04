const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'hotelequip.db');

let db;

function ensureDatabaseDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDb() {
  if (!db) {
    ensureDatabaseDir();
    db = new sqlite3.Database(DB_PATH);
  }
  return db;
}

function runSql(database, sql) {
  return new Promise((resolve, reject) => {
    database.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

async function init() {
  const database = getDb();

  // 1. Tabela brands (fornecedores: Udex, Arisco, etc.)
  await runSql(
    database,
    `CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku_prefix TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // 2. Tabela products
  await runSql(
    database,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL,
      status TEXT DEFAULT 'Pendente',
      brand TEXT,
      original_title TEXT,
      original_description TEXT,
      original_short_description TEXT,
      raw_text_from_file TEXT,
      optimized_title TEXT,
      optimized_meta_title TEXT,
      optimized_meta_description TEXT,
      optimized_short_description TEXT,
      optimized_full_description TEXT,
      cross_sell_skus TEXT,
      upsell_skus TEXT,
      price REAL,
      image_url TEXT,
      image_s3_url TEXT,
      woo_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSql(
    database,
    `CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      original_url_or_path TEXT,
      processed_s3_url TEXT,
      alt_text TEXT,
      is_main_image INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`
  );

  await runSql(database, `CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT )`);
  await runSql(
    database,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      action TEXT,
      details TEXT,
      status TEXT
    )`
  );

  // 3. Tabela uploaded_files (inventory = Excel, library = PDF/links)
  await runSql(
    database,
    `CREATE TABLE IF NOT EXISTS uploaded_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      path TEXT,
      type TEXT,
      file_kind TEXT DEFAULT 'inventory',
      status TEXT DEFAULT 'Aguardando processamento',
      product_count INTEGER,
      error_message TEXT,
      brand_id INTEGER,
      extracted_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    )`
  );

  // 4. Biblioteca de conhecimento (PDFs e referências – não criam produtos)
  await runSql(
    database,
    `CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      title TEXT,
      content TEXT NOT NULL,
      brand_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    )`
  );

  const alterColumns = [
    'ALTER TABLE products ADD COLUMN status TEXT DEFAULT \'Pendente\'',
    'ALTER TABLE products ADD COLUMN original_title TEXT',
    'ALTER TABLE products ADD COLUMN original_description TEXT',
    'ALTER TABLE products ADD COLUMN optimized_title TEXT',
    'ALTER TABLE products ADD COLUMN optimized_meta_title TEXT',
    'ALTER TABLE products ADD COLUMN optimized_meta_description TEXT',
    'ALTER TABLE products ADD COLUMN optimized_short_description TEXT',
    'ALTER TABLE products ADD COLUMN optimized_full_description TEXT',
    'ALTER TABLE products ADD COLUMN cross_sell_skus TEXT',
    'ALTER TABLE products ADD COLUMN upsell_skus TEXT',
    'ALTER TABLE products ADD COLUMN raw_text_from_file TEXT',
    'ALTER TABLE uploaded_files ADD COLUMN brand_id INTEGER',
    'ALTER TABLE uploaded_files ADD COLUMN extracted_text TEXT',
    'ALTER TABLE uploaded_files ADD COLUMN file_kind TEXT',
    'ALTER TABLE products ADD COLUMN meta_keywords TEXT',
    'ALTER TABLE products ADD COLUMN faqs TEXT',
  ];
  for (const sql of alterColumns) {
    await runSql(database, sql).catch(() => {});
  }
}

function insertProduct(product) {
  const database = getDb();
  const sku = product.sku || product.sku_original || product.sku_clean || '';
  const status = product.status || 'Pendente';
  const original_title = product.original_title ?? product.name ?? null;
  const original_description = product.original_description ?? product.description ?? null;
  const original_short_description = product.original_short_description ?? product.short_description ?? null;
  const raw_text_from_file = product.raw_text_from_file ?? null;

  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO products (sku, status, brand, original_title, original_description, original_short_description, raw_text_from_file,
        optimized_title, optimized_meta_title, optimized_meta_description, optimized_short_description, optimized_full_description,
        cross_sell_skus, upsell_skus, price, image_url, image_s3_url, woo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku,
        status,
        product.brand ?? null,
        original_title,
        original_description,
        original_short_description,
        raw_text_from_file,
        product.optimized_title ?? null,
        product.optimized_meta_title ?? null,
        product.optimized_meta_description ?? null,
        product.optimized_short_description ?? null,
        product.optimized_full_description ?? null,
        product.cross_sell_skus ?? null,
        product.upsell_skus ?? null,
        product.price ?? null,
        product.image_url ?? null,
        product.image_s3_url ?? null,
        product.woo_id ?? null,
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getAllProducts(filters = {}) {
  const database = getDb();
  let sql = `SELECT * FROM products WHERE 1=1`;
  const params = [];
  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  sql += ` ORDER BY id DESC`;

  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getProductById(id) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get(`SELECT * FROM products WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function updateProduct(id, fields) {
  const database = getDb();
  const allowed = [
    'status', 'original_title', 'original_description', 'original_short_description', 'raw_text_from_file',
    'optimized_title', 'optimized_meta_title', 'optimized_meta_description',
    'optimized_short_description', 'optimized_full_description',
    'cross_sell_skus', 'upsell_skus', 'price', 'image_url', 'image_s3_url', 'woo_id',
    'meta_keywords', 'faqs',
  ];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (!(key in fields)) continue;
    set.push(`${key} = ?`);
    values.push(fields[key]);
  }
  if (set.length === 0) return Promise.resolve();
  set.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  return new Promise((resolve, reject) => {
    database.run(`UPDATE products SET ${set.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

// Imagens
function getImagesByProductId(productId) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(`SELECT * FROM images WHERE product_id = ? ORDER BY is_main_image DESC, id`, [productId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function insertImage(image) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO images (product_id, original_url_or_path, processed_s3_url, alt_text, is_main_image)
       VALUES (?, ?, ?, ?, ?)`,
      [
        image.product_id,
        image.original_url_or_path ?? null,
        image.processed_s3_url ?? null,
        image.alt_text ?? null,
        image.is_main_image ? 1 : 0,
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function updateImage(id, fields) {
  const database = getDb();
  const allowed = ['processed_s3_url', 'alt_text', 'is_main_image'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (!(key in fields)) continue;
    set.push(`${key} = ?`);
    values.push(key === 'is_main_image' ? (fields[key] ? 1 : 0) : fields[key]);
  }
  if (set.length === 0) return Promise.resolve();
  values.push(id);
  return new Promise((resolve, reject) => {
    database.run(`UPDATE images SET ${set.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

// Settings (key/value)
function getSetting(key) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
}

function setSetting(key, value) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
      [key, value, value],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Activity log
function addActivityLog(entry) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO activity_log (action, details, status) VALUES (?, ?, ?)`,
      [entry.action || '', entry.details || '', entry.status || 'Success'],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getActivityLog(limit = 10) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT * FROM activity_log ORDER BY id DESC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

// Estatísticas para o dashboard
function getProductStats() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN status = 'Aprovado' THEN 1 ELSE 0 END) as aprovados,
        SUM(CASE WHEN status = 'Aplicado no Site' OR status = 'Aplicado' THEN 1 ELSE 0 END) as aplicados
      FROM products`,
      [],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || { total: 0, pendentes: 0, aprovados: 0, aplicados: 0 });
      }
    );
  });
}

// Uploaded files (file_kind: 'inventory' = Excel, 'library' = PDF/Biblioteca)
function insertUploadedFile(record) {
  const database = getDb();
  const fileKind = record.file_kind || (record.type === 'pdf' ? 'library' : 'inventory');
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO uploaded_files (filename, path, type, file_kind, status, brand_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.filename,
        record.path,
        record.type || '',
        fileKind,
        record.status || 'Aguardando processamento',
        record.brand_id != null ? record.brand_id : null,
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function updateUploadedFile(id, fields) {
  const database = getDb();
  const allowed = ['status', 'product_count', 'error_message', 'brand_id', 'extracted_text', 'file_kind'];
  const set = [];
  const values = [];
  for (const key of allowed) {
    if (!(key in fields)) continue;
    set.push(`${key} = ?`);
    values.push(fields[key]);
  }
  if (set.length === 0) return Promise.resolve();
  values.push(id);
  return new Promise((resolve, reject) => {
    database.run(`UPDATE uploaded_files SET ${set.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

function getUploadedFiles(limit = 50, fileKind = null) {
  const database = getDb();
  let sql = `SELECT * FROM uploaded_files WHERE 1=1`;
  const params = [];
  if (fileKind) {
    sql += ` AND (file_kind = ? OR (file_kind IS NULL AND ? = 'inventory'))`;
    params.push(fileKind, fileKind);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(limit);
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/** Devolve todos os valores da coluna path (para sincronização com a pasta uploads). */
function getUploadedFilePaths() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(`SELECT path FROM uploaded_files`, [], (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []).map((r) => r.path));
    });
  });
}

// Knowledge base (Biblioteca Técnica – PDFs e referências)
function insertKnowledgeBase(record) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO knowledge_base (source_type, source_ref, title, content, brand_id) VALUES (?, ?, ?, ?, ?)`,
      [
        record.source_type || 'pdf',
        record.source_ref ?? null,
        record.title ?? null,
        record.content || '',
        record.brand_id != null ? record.brand_id : null,
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getKnowledgeBaseEntries(limit = 100) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(`SELECT * FROM knowledge_base ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/** Conteúdo concatenado da knowledge_base para contexto da IA (ex.: primeiros 15000 caracteres). */
function getKnowledgeBaseContentForContext(maxChars = 15000) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(`SELECT title, content FROM knowledge_base ORDER BY id DESC`, [], (err, rows) => {
      if (err) return reject(err);
      const parts = (rows || []).map((r) => (r.title ? `[${r.title}]\n${r.content}` : r.content));
      const full = parts.join('\n\n').slice(0, maxChars);
      resolve(full);
    });
  });
}

module.exports = {
  getDb,
  init,
  insertProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  getImagesByProductId,
  insertImage,
  updateImage,
  getSetting,
  setSetting,
  addActivityLog,
  getActivityLog,
  getProductStats,
  insertUploadedFile,
  updateUploadedFile,
  getUploadedFiles,
  getUploadedFilePaths,
  insertKnowledgeBase,
  getKnowledgeBaseEntries,
  getKnowledgeBaseContentForContext,
};
