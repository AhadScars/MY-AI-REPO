require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const mail = require("./mail");
const store = require("./store");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT || 5174);
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";
const URL_SECRET = (process.env.URL_SECRET || SESSION_SECRET).trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "tibg-admin";

async function adminAuth() {
  return store.getAdminAuth();
}

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password).slice(0, 200), s, 32).toString("hex");
  return { salt: s, hash };
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

async function verifyAdminPassword(password) {
  const rec = await adminAuth();
  if (rec.hash && rec.salt) {
    const next = hashPassword(password, rec.salt).hash;
    return sameSecret(next, rec.hash);
  }
  return sameSecret(password, ADMIN_PASSWORD);
}

function normalizeSecretPath(raw, fallback) {
  let p = String(raw || "").trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  const lower = p.toLowerCase();
  const reserved = new Set(["", "/", "/admin", "/account", "/product", "/post", "/index", "/cart", "/checkout", "/blog"]);
  if (!p || reserved.has(lower) || lower.startsWith("/api") || lower.startsWith("/auth") || p.includes(".")) {
    return fallback;
  }
  return p;
}

const ADMIN_PATH = normalizeSecretPath(process.env.ADMIN_PATH, "/x/" + crypto.randomBytes(16).toString("hex"));
const ACCOUNT_PATH = normalizeSecretPath(process.env.ACCOUNT_PATH, "/u/" + crypto.randomBytes(12).toString("hex"));

function itemKey(kind, id) {
  return crypto.createHmac("sha256", URL_SECRET).update(`${kind}:${id}`).digest("base64url").slice(0, 27);
}

function tokenOk(s) {
  return typeof s === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(s);
}

function sendPage(res, file, noIndex) {
  if (noIndex) res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(ROOT, file));
}
const STRIPE_SECRET = (process.env.STRIPE_SECRET_KEY || "").trim();
const STRIPE_PUBLISHABLE = (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
const GOOGLE_CALLBACK =
  (process.env.GOOGLE_CALLBACK_URL || "").trim() || `http://localhost:${PORT}/auth/google/callback`;
const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

async function products() {
  return store.listProducts();
}
async function posts() {
  return store.listPosts();
}
async function settings() {
  return store.getSettings();
}
async function leads() {
  return store.listLeads();
}
async function orders() {
  return store.listOrders();
}
async function coupons() {
  return store.listCoupons();
}
async function users() {
  return store.listUsers();
}

const ORDER_STATUSES = ["pending", "paid", "cod", "packed", "shipped", "delivered", "cancelled"];

function parseShipTo(body) {
  const line1 = String((body && body.line1) || "").trim().slice(0, 120);
  const line2 = String((body && body.line2) || "").trim().slice(0, 120);
  const city = String((body && body.city) || "").trim().slice(0, 80);
  const state = String((body && body.state) || "").trim().slice(0, 80);
  const pin = String((body && body.pin) || "").replace(/\D/g, "").slice(0, 6);
  if (!line1 || !city || !state || pin.length !== 6) {
    throw new Error("Enter street, city, state, and a 6-digit PIN");
  }
  const shipTo = { line1, line2, city, state, pin };
  return {
    shipTo,
    address: [line1, line2, `${city} ${pin}`, state].filter(Boolean).join(", "),
  };
}

function stockAlreadyDown(order) {
  if (order.stockDropped === true) return true;
  if (order.stockDropped === false) return false;
  const st = order.status || "pending";
  return st !== "pending" && st !== "cancelled";
}

async function applyStock(lines, dir) {
  const list = await products();
  let changed = false;
  for (const line of lines || []) {
    const idx = list.findIndex((p) => p.id === line.id);
    if (idx < 0) continue;
    const n = Number(list[idx].stock);
    if (!Number.isFinite(n)) continue;
    list[idx].stock = Math.max(0, n + dir * Math.max(1, Number(line.qty) || 1));
    changed = true;
  }
  if (changed) await store.saveProducts(list);
}

async function countCoupon(order) {
  if (!order.promo || order.couponCounted) return order;
  const list = await coupons();
  const ci = list.findIndex((c) => String(c.code).toUpperCase() === String(order.promo).toUpperCase());
  if (ci >= 0) {
    list[ci].used = Number(list[ci].used || 0) + 1;
    await store.saveCoupons(list);
  }
  order.couponCounted = true;
  return order;
}

async function wishIdsFor(user) {
  if (!user) return [];
  return store.wishIds(user.id);
}

function publicOrder(o) {
  return {
    id: o.id,
    status: o.status || "pending",
    method: o.method || (String(o.id || "").startsWith("cod-") ? "cod" : "stripe"),
    email: o.email || "",
    name: o.name || "",
    phone: o.phone || "",
    address: o.address || "",
    shipTo: o.shipTo || null,
    fulfillment: o.fulfillment || "",
    tracking: o.tracking || "",
    total: o.total,
    discount: o.discount || 0,
    ship: o.ship || 0,
    codFee: o.codFee || 0,
    promo: o.promo || "",
    lines: o.lines || [],
    createdAt: o.createdAt,
    paidAt: o.paidAt || "",
  };
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, picture: u.picture || "" };
}

async function upsertGoogleUser(profile) {
  const list = await users();
  const email = ((profile.emails && profile.emails[0] && profile.emails[0].value) || "").toLowerCase();
  let user = list.find((u) => u.googleId === profile.id || (email && u.email === email));
  const rec = {
    googleId: profile.id,
    email,
    name: profile.displayName || "",
    picture: (profile.photos && profile.photos[0] && profile.photos[0].value) || "",
    lastLogin: new Date().toISOString(),
  };
  if (user) Object.assign(user, rec);
  else {
    user = { id: uniqueId(list, slugify(email || profile.id)), createdAt: new Date().toISOString(), ...rec };
    list.unshift(user);
  }
  await store.saveUsers(list);
  return publicUser(user);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function findLiveCoupon(code) {
  const needle = String(code || "").trim().toUpperCase();
  if (!needle) return null;
  const c = (await coupons()).find((x) => String(x.code).toUpperCase() === needle);
  if (!c) return null;
  if (c.active === false) return null;
  if (c.expires && String(c.expires) < todayStamp()) return null;
  if (Number(c.maxUses) > 0 && Number(c.used || 0) >= Number(c.maxUses)) return null;
  return c;
}

function couponDiscount(sub, coupon) {
  if (!coupon) return 0;
  if (Number(coupon.minSub) > 0 && sub < Number(coupon.minSub)) return 0;
  if (coupon.type === "flat") return Math.min(sub, Math.max(0, Number(coupon.value) || 0));
  const rate = Math.max(0, Math.min(100, Number(coupon.value) || 0)) / 100;
  return Math.round(sub * rate);
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `item-${Date.now()}`;
}

function uniqueId(list, base) {
  let id = base;
  let n = 2;
  while (list.some((x) => x.id === id)) id = `${base}-${n++}`;
  return id;
}

function publicProduct(p) {
  return { ...p, key: itemKey("p", p.id) };
}

function publicPost(p) {
  return { ...p, key: itemKey("n", p.id) };
}

function stripeClient() {
  if (!STRIPE_SECRET) return null;
  const Stripe = require("stripe");
  return new Stripe(STRIPE_SECRET);
}

const sessions = new Map();

function setSession(res) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + 1000 * 60 * 60 * 12);
  res.cookie("tibg_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 12,
  });
}

function isAdmin(req) {
  const token = req.cookies.tibg_admin;
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Sign in required" });
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Images only"));
    cb(null, true);
  },
});

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cookieParser(SESSION_SECRET));
app.use(express.json({ limit: "2mb" }));
app.use(
  session({
    name: "tibg_sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = (await users()).find((u) => u.id === id);
    done(null, publicUser(user));
  } catch (err) {
    done(err);
  }
});

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK,
      },
      (_access, _refresh, profile, done) => {
        upsertGoogleUser(profile).then((user) => done(null, user)).catch(done);
      }
    )
  );
}
const HIDDEN_PAGES = new Set([
  "/admin",
  "/admin.html",
  "/account",
  "/account.html",
  "/product",
  "/product.html",
  "/post",
  "/post.html",
]);

app.use((req, res, next) => {
  const p = req.path.toLowerCase().replace(/\/+$/, "") || "/";
  if (
    p.includes("/.") ||
    p.startsWith("/data") ||
    p.startsWith("/node_modules") ||
    p.endsWith(".env") ||
    p.endsWith("server.js") ||
    p.endsWith("package.json") ||
    p.endsWith("package-lock.json") ||
    HIDDEN_PAGES.has(p)
  ) {
    return res.status(404).end();
  }
  next();
});

app.get(ADMIN_PATH, (_req, res) => sendPage(res, "admin.html", true));
app.get(ACCOUNT_PATH, (_req, res) => sendPage(res, "account.html", true));
app.get("/i/:key", (req, res) => {
  if (!tokenOk(req.params.key)) return res.status(404).end();
  sendPage(res, "product.html");
});
app.get("/n/:key", (req, res) => {
  if (!tokenOk(req.params.key)) return res.status(404).end();
  sendPage(res, "post.html");
});

app.use("/uploads", express.static(UPLOADS));
app.use(express.static(ROOT, { extensions: ["html"], index: ["index.html"], dotfiles: "deny" }));

app.get("/api/config", async (req, res) => {
  const site = await settings();
  res.json({
    site,
    stripeEnabled: Boolean(STRIPE_SECRET && STRIPE_PUBLISHABLE),
    publishableKey: STRIPE_PUBLISHABLE || "",
    googleEnabled,
    user: req.user || null,
    accountPath: ACCOUNT_PATH,
    wishlist: await wishIdsFor(req.user),
  });
});

app.get("/api/me", async (req, res) => {
  res.json({ user: req.user || null, googleEnabled, wishlist: await wishIdsFor(req.user) });
});

app.get("/api/wishlist", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in with Google to use a wishlist" });
  res.json({ ids: await wishIdsFor(req.user) });
});

app.post("/api/wishlist", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in with Google to use a wishlist" });
  const id = String((req.body && req.body.id) || "");
  const catalog = await products();
  if (!id || !catalog.some((p) => p.id === id)) {
    return res.status(400).json({ error: "Unknown item" });
  }
  const ids = await store.wishIds(req.user.id);
  if (!ids.includes(id)) ids.unshift(id);
  const next = ids.slice(0, 80);
  await store.setWishIds(req.user.id, next);
  res.json({ ids: next, on: true });
});

app.delete("/api/wishlist/:id", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in with Google to use a wishlist" });
  const ids = (await store.wishIds(req.user.id)).filter((x) => x !== req.params.id);
  await store.setWishIds(req.user.id, ids);
  res.json({ ids, on: false });
});

app.get("/api/my/orders", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in with Google to see your orders" });
  const email = String(req.user.email || "").toLowerCase();
  const uid = req.user.id;
  const mine = (await orders())
    .filter((o) => o.userId === uid || (email && String(o.email || "").toLowerCase() === email))
    .map(publicOrder);
  res.json({ orders: mine });
});

app.get("/auth/google", (req, res, next) => {
  if (!googleEnabled) return res.redirect("/index.html?auth=off");
  req.session.oauthNext = String(req.query.next || "/index.html");
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })(req, res, next);
});

app.get(
  "/auth/google/callback",
  (req, res, next) => {
    if (!googleEnabled) return res.redirect("/index.html?auth=off");
    passport.authenticate("google", { failureRedirect: "/index.html?auth=fail" })(req, res, next);
  },
  (req, res) => {
    let nextUrl = req.session.oauthNext || "/index.html";
    delete req.session.oauthNext;
    if (!nextUrl.startsWith("/") || nextUrl.startsWith("//")) nextUrl = "/index.html";
    res.redirect(nextUrl);
  }
);

app.get("/auth/logout", (req, res) => {
  const nextUrl = String(req.query.next || "/index.html");
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("tibg_sid");
      res.redirect(nextUrl.startsWith("/") ? nextUrl : "/index.html");
    });
  });
});

app.get("/api/catalog", async (_req, res) => {
  res.json({ products: (await products()).map(publicProduct) });
});

app.get("/api/posts", async (_req, res) => {
  const list = (await posts())
    .filter((p) => p.published !== false)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json({ posts: list.map(publicPost) });
});

app.get("/api/posts/:id", async (req, res) => {
  const post = (await posts()).find((p) => p.id === req.params.id && p.published !== false);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json({ post: publicPost(post) });
});

app.get("/api/images", (_req, res) => {
  const dir = path.join(ROOT, "assets", "images");
  const stock = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)).map((f) => `assets/images/${f}`)
    : [];
  const extra = fs.existsSync(UPLOADS)
    ? fs.readdirSync(UPLOADS).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)).map((f) => `uploads/${f}`)
    : [];
  res.json({ images: [...stock, ...extra] });
});

app.post("/api/leads", async (req, res) => {
  const body = req.body || {};
  const lead = {
    id: `lead-${Date.now()}`,
    name: String(body.name || "").slice(0, 120),
    phone: String(body.phone || "").slice(0, 40),
    email: String(body.email || "").slice(0, 120),
    note: String(body.note || "").slice(0, 2000),
    build: body.build || null,
    source: String(body.source || "custom-build"),
    createdAt: new Date().toISOString(),
  };
  if (!lead.name || (!lead.phone && !lead.email)) {
    return res.status(400).json({ error: "Name and a phone or email are required" });
  }
  const all = await leads();
  all.unshift(lead);
  await store.saveLeads(all.slice(0, 400));
  res.json({ ok: true, id: lead.id });
});

async function lineItemsFromCart(items, promo, method) {
  const catalog = await products();
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const site = await settings();
  const lines = [];
  for (const raw of items || []) {
    const product = byId.get(raw.id);
    if (!product) continue;
    const stock = Number(product.stock);
    if (Number.isFinite(stock) && stock <= 0) {
      throw new Error(`${product.name} is sold out`);
    }
    let qty = Math.max(1, Math.min(20, Number(raw.qty) || 1));
    if (Number.isFinite(stock) && qty > stock) {
      throw new Error(`Only ${stock} left of ${product.name}`);
    }
    lines.push({ product, qty, unit: Number(product.price) });
  }
  if (!lines.length) throw new Error("Cart is empty or items are no longer listed");
  const sub = lines.reduce((n, l) => n + l.unit * l.qty, 0);
  const coupon = await findLiveCoupon(promo);
  if (String(promo || "").trim() && !coupon) throw new Error("Coupon is not valid");
  if (coupon && Number(coupon.minSub) > 0 && sub < Number(coupon.minSub)) {
    throw new Error(`Add ₹${Number(coupon.minSub).toLocaleString("en-IN")} to use this coupon`);
  }
  const discount = couponDiscount(sub, coupon);
  const freeAt = Number(site.freeShipAt || 99999);
  const shipFee = Number(site.shipFee || 999);
  const ship = sub >= freeAt ? 0 : shipFee;
  const pay = String(method || "").toLowerCase() === "cod" ? "cod" : "stripe";
  const rawCod = site.codFee == null ? 500 : Number(site.codFee);
  const codFee = pay === "cod" ? Math.max(0, Number.isFinite(rawCod) ? rawCod : 500) : 0;
  return { lines, sub, discount, ship, codFee, total: sub - discount + ship + codFee, site, coupon };
}

app.post("/api/checkout", async (req, res) => {
  try {
    const { items, promo, email, name, phone, fulfillment, method } = req.body || {};
    if (googleEnabled && !req.user) {
      return res.status(401).json({ error: "Sign in with Google to buy", needAuth: true });
    }
    const phoneClean = String(phone || "").replace(/[^\d+]/g, "");
    if (!phoneClean || phoneClean.replace(/\D/g, "").length < 10) {
      return res.status(400).json({ error: "A valid phone number is required" });
    }
    const ship = parseShipTo(req.body);
    const buyerName = (req.user && req.user.name) || name || "";
    const buyerEmail = (req.user && req.user.email) || email || "";
    const pay = String(method || "stripe").toLowerCase() === "cod" ? "cod" : "stripe";
    const priced = await lineItemsFromCart(items, promo, pay);
    const lines = priced.lines.map((l) => ({ id: l.product.id, name: l.product.name, qty: l.qty, unit: l.unit }));
    const base = {
      email: buyerEmail,
      name: buyerName,
      userId: (req.user && req.user.id) || "",
      phone: phoneClean.slice(0, 20),
      address: ship.address,
      shipTo: ship.shipTo,
      fulfillment: fulfillment || "Ground shipping",
      total: priced.total,
      discount: priced.discount,
      ship: priced.ship,
      codFee: priced.codFee,
      promo: priced.coupon ? priced.coupon.code : "",
      couponCounted: false,
      stockDropped: false,
      lines,
      createdAt: new Date().toISOString(),
    };

    if (pay === "cod") {
      const order = {
        ...base,
        id: `cod-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        status: "cod",
        method: "cod",
      };
      await applyStock(order.lines, -1);
      order.stockDropped = true;
      await countCoupon(order);
      const all = await orders();
      all.unshift(order);
      await store.saveOrders(all.slice(0, 300));
      try {
        await mail.sendOrderEmails(order, await settings());
        order.emailSent = true;
        await store.saveOrders(all.slice(0, 300));
      } catch (err) {
        console.error("Order mail:", err.message);
      }
      return res.json({ method: "cod", id: order.id, redirect: `/success.html?order=${encodeURIComponent(order.id)}` });
    }

    const stripe = stripeClient();
    if (!stripe || !STRIPE_PUBLISHABLE) {
      return res.status(400).json({
        error: "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to the .env file and restart the server.",
      });
    }
    const origin = `${req.protocol}://${req.get("host")}`;
    const description = priced.lines.map((l) => `${l.qty}× ${l.product.name}`).join(", ");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail || undefined,
      metadata: {
        name: String(buyerName || "").slice(0, 80),
        phone: phoneClean.slice(0, 20),
        fulfillment: String(fulfillment || "Ground shipping").slice(0, 40),
        promo: String(promo || ""),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "inr",
            unit_amount: Math.round(priced.total * 100),
            product_data: {
              name: "TIBGSTORE order",
              description: description.slice(0, 500),
            },
          },
        },
      ],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout.html?cancelled=1`,
    });

    const all = await orders();
    all.unshift({
      ...base,
      id: session.id,
      status: "pending",
      method: "stripe",
    });
    await store.saveOrders(all.slice(0, 300));
    res.json({ method: "stripe", url: session.url, id: session.id });
  } catch (err) {
    res.status(400).json({ error: err.message || "Checkout failed" });
  }
});

app.post("/api/coupon/validate", async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || "");
    const priced = await lineItemsFromCart((req.body && req.body.items) || [], code);
    if (!priced.coupon) return res.status(400).json({ error: "Enter a coupon code" });
    res.json({
      code: priced.coupon.code,
      type: priced.coupon.type,
      value: priced.coupon.value,
      minSub: priced.coupon.minSub || 0,
      discount: priced.discount,
      label: priced.coupon.type === "flat" ? `₹${Number(priced.coupon.value).toLocaleString("en-IN")} off` : `${priced.coupon.value}% off`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Invalid coupon" });
  }
});

app.get("/api/checkout/session", async (req, res) => {
  try {
    const stripe = stripeClient();
    if (!stripe || !req.query.session_id) return res.status(400).json({ error: "Missing session" });
    const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
    if (session.payment_status === "paid") {
      const all = await orders();
      const idx = all.findIndex((o) => o.id === session.id);
      if (idx >= 0) {
        all[idx].status = "paid";
        all[idx].method = "stripe";
        all[idx].paidAt = new Date().toISOString();
        if (session.customer_details && session.customer_details.email && !all[idx].email) {
          all[idx].email = session.customer_details.email;
        }
        if (!stockAlreadyDown(all[idx])) {
          await applyStock(all[idx].lines, -1);
          all[idx].stockDropped = true;
        } else {
          all[idx].stockDropped = true;
        }
        await countCoupon(all[idx]);
        if (!all[idx].emailSent) {
          try {
            await mail.sendOrderEmails(all[idx], await settings());
            all[idx].emailSent = true;
          } catch (err) {
            console.error("Order mail:", err.message);
            all[idx].emailError = err.message;
          }
        }
        await store.saveOrders(all);
      }
    }
    const latest = (await orders()).find((o) => o.id === session.id) || {};
    res.json({
      id: session.id,
      status: session.payment_status,
      amount: session.amount_total,
      email: session.customer_details && session.customer_details.email,
      mailed: !!latest.emailSent,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Session lookup failed" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const password = String((req.body && req.body.password) || "");
  if (!(await verifyAdminPassword(password))) {
    return res.status(401).json({ error: "Wrong password" });
  }
  setSession(res);
  res.json({ ok: true, path: ADMIN_PATH });
});

app.post("/api/admin/logout", (req, res) => {
  if (req.cookies.tibg_admin) sessions.delete(req.cookies.tibg_admin);
  res.clearCookie("tibg_admin");
  res.json({ ok: true });
});

app.get("/api/admin/me", (req, res) => {
  if (!isAdmin(req)) return res.json({ ok: false });
  res.json({ ok: true, path: ADMIN_PATH });
});

app.get("/api/admin/leads", requireAdmin, async (_req, res) => {
  res.json({ leads: await leads() });
});

app.get("/api/checkout/order", async (req, res) => {
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "Missing order" });
  const order = (await orders()).find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user) {
    const email = String(req.user.email || "").toLowerCase();
    const mine = order.userId === req.user.id || (email && String(order.email || "").toLowerCase() === email);
    if (!mine && order.method !== "cod") return res.status(404).json({ error: "Order not found" });
  }
  res.json({ order: publicOrder(order) });
});

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  res.json({ orders: await orders() });
});

app.put("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const all = await orders();
  const idx = all.findIndex((o) => o.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const next = String((req.body && req.body.status) || all[idx].status);
  if (!ORDER_STATUSES.includes(next)) return res.status(400).json({ error: "Unknown status" });
  const prev = all[idx].status;
  if (next === "cancelled" && prev !== "cancelled" && stockAlreadyDown(all[idx])) {
    await applyStock(all[idx].lines, 1);
    all[idx].stockDropped = false;
  }
  if (next !== "cancelled" && next !== "pending" && !stockAlreadyDown(all[idx])) {
    await applyStock(all[idx].lines, -1);
    all[idx].stockDropped = true;
  }
  all[idx].status = next;
  if (req.body && req.body.tracking != null) all[idx].tracking = String(req.body.tracking).slice(0, 80);
  if (next === "paid" && !all[idx].paidAt) all[idx].paidAt = new Date().toISOString();
  await store.saveOrders(all);
  res.json({ order: publicOrder(all[idx]) });
});

app.get("/api/admin/coupons", requireAdmin, async (_req, res) => {
  res.json({ coupons: await coupons() });
});

app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
  const list = await coupons();
  const body = req.body || {};
  const code = String(body.code || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return res.status(400).json({ error: "Code is required" });
  if (list.some((c) => c.code === code)) return res.status(400).json({ error: "That code already exists" });
  const item = {
    id: uniqueId(list, slugify(code)),
    code,
    type: body.type === "flat" ? "flat" : "percent",
    value: Number(body.value) || 0,
    minSub: Number(body.minSub) || 0,
    maxUses: Number(body.maxUses) || 0,
    used: 0,
    expires: body.expires || "",
    active: body.active !== false,
    note: String(body.note || "").slice(0, 160),
  };
  list.unshift(item);
  await store.saveCoupons(list);
  res.json({ coupon: item });
});

app.put("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
  const list = await coupons();
  const idx = list.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const body = req.body || {};
  const code = String(body.code || list[idx].code).trim().toUpperCase().replace(/\s+/g, "");
  if (list.some((c, i) => i !== idx && c.code === code)) return res.status(400).json({ error: "That code already exists" });
  list[idx] = {
    ...list[idx],
    code,
    type: body.type === "flat" ? "flat" : "percent",
    value: Number(body.value ?? list[idx].value),
    minSub: Number(body.minSub ?? list[idx].minSub),
    maxUses: Number(body.maxUses ?? list[idx].maxUses),
    expires: body.expires != null ? body.expires : list[idx].expires,
    active: body.active !== false,
    note: body.note != null ? String(body.note).slice(0, 160) : list[idx].note,
  };
  await store.saveCoupons(list);
  res.json({ coupon: list[idx] });
});

app.delete("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
  const list = (await coupons()).filter((c) => c.id !== req.params.id);
  await store.saveCoupons(list);
  res.json({ ok: true });
});

app.get("/api/admin/posts", requireAdmin, async (_req, res) => {
  res.json({ posts: await posts() });
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  const list = await products();
  const body = req.body || {};
  const id = uniqueId(list, slugify(body.id || body.name));
  const item = { ...body, id, price: Number(body.price) || 0, stock: Number(body.stock) || 0 };
  list.unshift(item);
  await store.saveProducts(list);
  res.json({ product: item });
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const list = await products();
  const idx = list.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const body = req.body || {};
  list[idx] = { ...list[idx], ...body, id: req.params.id, price: Number(body.price ?? list[idx].price), stock: Number(body.stock ?? list[idx].stock) };
  await store.saveProducts(list);
  res.json({ product: list[idx] });
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const next = (await products()).filter((p) => p.id !== req.params.id);
  await store.saveProducts(next);
  res.json({ ok: true });
});

app.post("/api/admin/posts", requireAdmin, async (req, res) => {
  const list = await posts();
  const body = req.body || {};
  const id = uniqueId(list, slugify(body.id || body.title));
  const item = {
    id,
    title: body.title || "Untitled",
    excerpt: body.excerpt || "",
    body: body.body || "",
    cover: body.cover || "assets/images/workshop.jpg",
    date: body.date || new Date().toISOString().slice(0, 10),
    published: body.published !== false,
  };
  list.unshift(item);
  await store.savePosts(list);
  res.json({ post: item });
});

app.put("/api/admin/posts/:id", requireAdmin, async (req, res) => {
  const list = await posts();
  const idx = list.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  list[idx] = { ...list[idx], ...req.body, id: req.params.id };
  await store.savePosts(list);
  res.json({ post: list[idx] });
});

app.delete("/api/admin/posts/:id", requireAdmin, async (req, res) => {
  const list = (await posts()).filter((p) => p.id !== req.params.id);
  await store.savePosts(list);
  res.json({ ok: true });
});

app.post("/api/admin/test-email", requireAdmin, async (_req, res) => {
  try {
    const to = mail.adminAddress(await settings());
    if (!to) return res.status(400).json({ error: "Set ADMIN_EMAIL in .env" });
    const result = await mail.sendTest(to);
    res.json({ ok: true, ...result, to });
  } catch (err) {
    res.status(400).json({ error: err.message || "Send failed" });
  }
});

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  const body = { ...(req.body || {}) };
  ["password", "current", "next", "confirm", "hash", "salt", "adminPassword", "adminPasswordHash"].forEach(
    (k) => delete body[k]
  );
  ["shipFee", "freeShipAt", "codFee"].forEach((k) => {
    if (body[k] != null && body[k] !== "") body[k] = Math.max(0, Number(body[k]) || 0);
  });
  const next = { ...(await settings()), ...body };
  await store.saveSettings(next);
  res.json({ settings: next });
});

app.put("/api/admin/password", requireAdmin, async (req, res) => {
  const body = req.body || {};
  const current = String(body.current || "");
  const next = String(body.next || "");
  const confirm = String(body.confirm || "");
  if (!(await verifyAdminPassword(current))) {
    return res.status(401).json({ error: "Current password is wrong" });
  }
  if (next.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }
  if (next !== confirm) {
    return res.status(400).json({ error: "New passwords do not match" });
  }
  const rec = hashPassword(next);
  await store.setAdminAuth({
    hash: rec.hash,
    salt: rec.salt,
    updatedAt: new Date().toISOString(),
  });
  setSession(res);
  res.json({ ok: true });
});

app.post("/api/admin/upload", requireAdmin, upload.fields([
  { name: "files", maxCount: 12 },
  { name: "file", maxCount: 1 },
]), (req, res) => {
  const files = [
    ...((req.files && req.files.files) || []),
    ...((req.files && req.files.file) || []),
    ...(req.file ? [req.file] : []),
  ];
  if (!files.length) return res.status(400).json({ error: "No file" });
  const urls = files.map((f) => `uploads/${f.filename}`);
  res.json({ urls, url: urls[0] });
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Request failed" });
});

store
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TIBGSTORE → http://localhost:${PORT}`);
      console.log(`Owner desk → http://localhost:${PORT}${ADMIN_PATH}`);
      if (!STRIPE_SECRET || !STRIPE_PUBLISHABLE) {
        console.log("Stripe keys missing. Add them to .env to take cards.");
      }
      if (!mail.enabled()) {
        console.log("SMTP not set. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env, then restart.");
      } else {
        console.log("SMTP ready · " + (process.env.SMTP_USER || "").trim());
      }
      if (!googleEnabled) {
        console.log("Google OAuth not set. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.");
      } else {
        console.log("Google OAuth ready · " + GOOGLE_CALLBACK);
      }
    });
  })
  .catch((err) => {
    console.error("Store failed to start:", err.message);
    process.exit(1);
  });
