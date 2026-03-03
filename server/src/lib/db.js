const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
  }
  return db;
}

function init() {
  const database = getDb();

  database.serialize(() => {
    database.run(
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        sku_original TEXT NOT NULL,
        sku_clean TEXT NOT NULL,
        name TEXT,
        price REAL,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );
  });
}

function insertProduct(product) {
  const database = getDb();
  const { brand, sku_original, sku_clean, name, price, image_url } = product;

  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO products (brand, sku_original, sku_clean, name, price, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [brand, sku_original, sku_clean, name || null, price || null, image_url || null],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

module.exports = {
  getDb,
  init,
  insertProduct,
};

