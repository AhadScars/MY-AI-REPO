#!/usr/bin/env node
/**
 * Import existing /data JSON into Hostinger MySQL.
 * Usage:
 *   node scripts/migrate-json-to-mysql.js
 * Requires MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE in .env
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");

function load(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch {
    return fallback;
  }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function main() {
  const host = (process.env.MYSQL_HOST || process.env.DB_HOST || "").trim();
  if (!host) {
    console.error("Set MYSQL_HOST (and USER / PASSWORD / DATABASE) in .env first.");
    process.exit(1);
  }
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: (process.env.MYSQL_USER || process.env.DB_USER || "").trim(),
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
    database: (process.env.MYSQL_DATABASE || process.env.DB_NAME || "").trim(),
    multipleStatements: true,
    charset: "utf8mb4",
  });

  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await conn.query(schema);

  const products = load("products.json", []);
  const posts = load("posts.json", []);
  const orders = load("orders.json", []);
  const coupons = load("coupons.json", []);
  const leads = load("leads.json", []);
  const users = load("users.json", []);
  const wishlists = load("wishlists.json", {});
  const settings = load("settings.json", {});
  const admin = load("admin.json", {});

  await conn.query("DELETE FROM wishlists");
  await conn.query("DELETE FROM products");
  await conn.query("DELETE FROM posts");
  await conn.query("DELETE FROM orders");
  await conn.query("DELETE FROM coupons");
  await conn.query("DELETE FROM leads");
  await conn.query("DELETE FROM users");
  await conn.query("DELETE FROM settings");

  for (const p of products) {
    await conn.query("INSERT INTO products (id, payload) VALUES (?, ?)", [p.id, JSON.stringify(p)]);
  }
  for (const p of posts) {
    await conn.query("INSERT INTO posts (id, published, post_date, payload) VALUES (?, ?, ?, ?)", [
      p.id,
      p.published === false ? 0 : 1,
      p.date || "",
      JSON.stringify(p),
    ]);
  }
  for (const o of orders) {
    await conn.query(
      "INSERT INTO orders (id, user_id, email, status, method, total, created_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        o.id,
        o.userId || "",
        o.email || "",
        o.status || "pending",
        o.method || "stripe",
        Number(o.total) || 0,
        o.createdAt || "",
        JSON.stringify(o),
      ]
    );
  }
  for (const c of coupons) {
    await conn.query("INSERT INTO coupons (id, code, payload) VALUES (?, ?)", [
      c.id,
      String(c.code || "").toUpperCase(),
      JSON.stringify(c),
    ]);
  }
  for (const l of leads) {
    await conn.query("INSERT INTO leads (id, created_at, payload) VALUES (?, ?, ?)", [
      l.id,
      l.createdAt || "",
      JSON.stringify(l),
    ]);
  }
  for (const u of users) {
    await conn.query("INSERT INTO users (id, google_id, email, payload) VALUES (?, ?, ?, ?)", [
      u.id,
      u.googleId || "",
      u.email || "",
      JSON.stringify(u),
    ]);
  }
  for (const [uid, ids] of Object.entries(wishlists)) {
    for (const pid of ids || []) {
      await conn.query("INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)", [uid, pid]);
    }
  }
  await conn.query("INSERT INTO settings (k, payload) VALUES ('site', ?)", [JSON.stringify(settings)]);
  if (admin.hash) {
    await conn.query(
      "INSERT INTO admin_auth (id, hash, salt, updated_at) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE hash = VALUES(hash), salt = VALUES(salt), updated_at = VALUES(updated_at)",
      [admin.hash, admin.salt || "", admin.updatedAt || ""]
    );
  }

  await conn.end();
  console.log("Imported:");
  console.log("  products", products.length);
  console.log("  posts", posts.length);
  console.log("  orders", orders.length);
  console.log("  coupons", coupons.length);
  console.log("  leads", leads.length);
  console.log("  users", users.length);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
