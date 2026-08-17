const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const outDir = path.join(__dirname, '..', '..', 'sample-data');
const outFile = path.join(outDir, 'demo.db');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

const db = new DatabaseSync(outFile);

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'member',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    description TEXT
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    ordered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

const insertUser = db.prepare(
  'INSERT INTO users (name, email, role, active) VALUES (?, ?, ?, ?)'
);
const users = [
  ['Aisha Khan', 'aisha@example.com', 'admin', 1],
  ['Omar Farooq', 'omar@example.com', 'member', 1],
  ['Sara Ahmed', 'sara@example.com', 'member', 1],
  ['Bilal Hussain', 'bilal@example.com', 'editor', 1],
  ['Noor Fatima', 'noor@example.com', 'member', 0],
];
for (const u of users) insertUser.run(...u);

const insertProduct = db.prepare(
  'INSERT INTO products (sku, name, category, price, stock, description) VALUES (?, ?, ?, ?, ?, ?)'
);
const products = [
  ['SKU-1001', 'Wireless Mouse', 'Electronics', 24.99, 120, 'Ergonomic wireless mouse with USB receiver'],
  ['SKU-1002', 'Mechanical Keyboard', 'Electronics', 89.5, 45, 'RGB backlit mechanical keyboard'],
  ['SKU-2001', 'Notebook A5', 'Stationery', 4.25, 500, 'Ruled paper notebook, 120 pages'],
  ['SKU-2002', 'Gel Pen Pack', 'Stationery', 6.99, 300, 'Pack of 10 assorted gel pens'],
  ['SKU-3001', 'Desk Lamp', 'Home', 32.0, 60, 'LED desk lamp with adjustable brightness'],
  ['SKU-3002', 'Water Bottle', 'Home', 14.5, 200, 'Stainless steel 750ml bottle'],
];
for (const p of products) insertProduct.run(...p);

const insertOrder = db.prepare(
  'INSERT INTO orders (user_id, product_id, quantity, total, status) VALUES (?, ?, ?, ?, ?)'
);
const orders = [
  [1, 1, 2, 49.98, 'shipped'],
  [2, 3, 5, 21.25, 'pending'],
  [3, 2, 1, 89.5, 'delivered'],
  [1, 5, 1, 32.0, 'shipped'],
  [4, 6, 3, 43.5, 'pending'],
  [2, 4, 2, 13.98, 'cancelled'],
];
for (const o of orders) insertOrder.run(...o);

db.close();
console.log('Sample database created at', outFile);
