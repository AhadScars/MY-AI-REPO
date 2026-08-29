const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "data");
const useMysql = Boolean((process.env.MYSQL_HOST || process.env.DB_HOST || "").trim());

let pool = null;

function parse(raw, fallback) {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(DATA, { recursive: true });
  const dest = path.join(DATA, file);
  const tmp = dest + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, dest);
}

async function init() {
  if (!useMysql) {
    console.log("Store · JSON files in /data (set MYSQL_HOST to use Hostinger MySQL)");
    return { driver: "json" };
  }
  const mysql = require("mysql2/promise");
  pool = mysql.createPool({
    host: (process.env.MYSQL_HOST || process.env.DB_HOST || "localhost").trim(),
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: (process.env.MYSQL_USER || process.env.DB_USER || "").trim(),
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
    database: (process.env.MYSQL_DATABASE || process.env.DB_NAME || "").trim(),
    waitForConnections: true,
    connectionLimit: 8,
    charset: "utf8mb4",
  });
  const conn = await pool.getConnection();
  conn.release();
  console.log("Store · MySQL " + (process.env.MYSQL_DATABASE || process.env.DB_NAME || ""));
  return { driver: "mysql" };
}

async function q(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

const jsonStore = {
  async listProducts() {
    return readJson("products.json", []);
  },
  async saveProducts(list) {
    writeJson("products.json", list);
  },
  async listPosts() {
    return readJson("posts.json", []);
  },
  async savePosts(list) {
    writeJson("posts.json", list);
  },
  async getSettings() {
    return readJson("settings.json", {});
  },
  async saveSettings(obj) {
    writeJson("settings.json", obj);
  },
  async listLeads() {
    return readJson("leads.json", []);
  },
  async saveLeads(list) {
    writeJson("leads.json", list);
  },
  async listOrders() {
    return readJson("orders.json", []);
  },
  async saveOrders(list) {
    writeJson("orders.json", list);
  },
  async listCoupons() {
    return readJson("coupons.json", []);
  },
  async saveCoupons(list) {
    writeJson("coupons.json", list);
  },
  async listUsers() {
    return readJson("users.json", []);
  },
  async saveUsers(list) {
    writeJson("users.json", list);
  },
  async wishIds(userId) {
    const all = readJson("wishlists.json", {});
    return Array.isArray(all[userId]) ? all[userId] : [];
  },
  async setWishIds(userId, ids) {
    const all = readJson("wishlists.json", {});
    all[userId] = ids;
    writeJson("wishlists.json", all);
  },
  async getAdminAuth() {
    return readJson("admin.json", {});
  },
  async setAdminAuth(rec) {
    writeJson("admin.json", rec);
  },
};

const mysqlStore = {
  async listProducts() {
    const rows = await q("SELECT payload FROM products");
    return rows.map((r) => parse(r.payload, null)).filter(Boolean);
  },
  async saveProducts(list) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM products");
      for (const p of list) {
        await conn.query("INSERT INTO products (id, payload) VALUES (?, ?)", [p.id, JSON.stringify(p)]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async listPosts() {
    const rows = await q("SELECT payload FROM posts");
    return rows.map((r) => parse(r.payload, null)).filter(Boolean);
  },
  async savePosts(list) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM posts");
      for (const p of list) {
        await conn.query("INSERT INTO posts (id, published, post_date, payload) VALUES (?, ?, ?, ?)", [
          p.id,
          p.published === false ? 0 : 1,
          p.date || "",
          JSON.stringify(p),
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async getSettings() {
    const rows = await q("SELECT payload FROM settings WHERE k = 'site' LIMIT 1");
    return rows[0] ? parse(rows[0].payload, {}) : {};
  },
  async saveSettings(obj) {
    await q(
      "INSERT INTO settings (k, payload) VALUES ('site', ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)",
      [JSON.stringify(obj)]
    );
  },
  async listLeads() {
    const rows = await q("SELECT payload FROM leads ORDER BY created_at DESC");
    return rows.map((r) => parse(r.payload, null)).filter(Boolean);
  },
  async saveLeads(list) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM leads");
      for (const l of list) {
        await conn.query("INSERT INTO leads (id, created_at, payload) VALUES (?, ?, ?)", [
          l.id,
          l.createdAt || "",
          JSON.stringify(l),
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async listOrders() {
    const rows = await q("SELECT payload FROM orders ORDER BY created_at DESC");
    return rows.map((r) => parse(r.payload, null)).filter(Boolean);
  },
  async saveOrders(list) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM orders");
      for (const o of list) {
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
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async listCoupons() {
    const rows = await q("SELECT payload FROM coupons");
    return rows.map((r) => parse(r.payload, null)).filter(Boolean);
  },
  async saveCoupons(list) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM coupons");
      for (const c of list) {
        await conn.query("INSERT INTO coupons (id, code, payload) VALUES (?, ?, ?)", [
          c.id,
          String(c.code || "").toUpperCase(),
          JSON.stringify(c),
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async listUsers() {
    const rows = await q("SELECT payload FROM users");
    return rows.map((r) => parse(r.payload, null)).filter(Boolean);
  },
  async saveUsers(list) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM users");
      for (const u of list) {
        await conn.query("INSERT INTO users (id, google_id, email, payload) VALUES (?, ?, ?, ?)", [
          u.id,
          u.googleId || "",
          u.email || "",
          JSON.stringify(u),
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async wishIds(userId) {
    const rows = await q("SELECT product_id FROM wishlists WHERE user_id = ?", [userId]);
    return rows.map((r) => r.product_id);
  },
  async setWishIds(userId, ids) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM wishlists WHERE user_id = ?", [userId]);
      for (const id of ids) {
        await conn.query("INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)", [userId, id]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async getAdminAuth() {
    const rows = await q("SELECT hash, salt, updated_at FROM admin_auth WHERE id = 1 LIMIT 1");
    if (!rows[0] || !rows[0].hash) return {};
    return { hash: rows[0].hash, salt: rows[0].salt, updatedAt: rows[0].updated_at || "" };
  },
  async setAdminAuth(rec) {
    await q(
      "INSERT INTO admin_auth (id, hash, salt, updated_at) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE hash = VALUES(hash), salt = VALUES(salt), updated_at = VALUES(updated_at)",
      [rec.hash || "", rec.salt || "", rec.updatedAt || ""]
    );
  },
};

function active() {
  return useMysql ? mysqlStore : jsonStore;
}

module.exports = {
  useMysql,
  init,
  listProducts: (...a) => active().listProducts(...a),
  saveProducts: (...a) => active().saveProducts(...a),
  listPosts: (...a) => active().listPosts(...a),
  savePosts: (...a) => active().savePosts(...a),
  getSettings: (...a) => active().getSettings(...a),
  saveSettings: (...a) => active().saveSettings(...a),
  listLeads: (...a) => active().listLeads(...a),
  saveLeads: (...a) => active().saveLeads(...a),
  listOrders: (...a) => active().listOrders(...a),
  saveOrders: (...a) => active().saveOrders(...a),
  listCoupons: (...a) => active().listCoupons(...a),
  saveCoupons: (...a) => active().saveCoupons(...a),
  listUsers: (...a) => active().listUsers(...a),
  saveUsers: (...a) => active().saveUsers(...a),
  wishIds: (...a) => active().wishIds(...a),
  setWishIds: (...a) => active().setWishIds(...a),
  getAdminAuth: (...a) => active().getAdminAuth(...a),
  setAdminAuth: (...a) => active().setAdminAuth(...a),
};
