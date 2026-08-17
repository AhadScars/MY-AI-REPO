const KEYS = {
  products: "soleil.products",
  cart: "soleil.cart",
  wishlist: "soleil.wishlist",
  orders: "soleil.orders",
  admin: "soleil.admin",
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readOrNull(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function money(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function moneyExact(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function detectBrand(num) {
  const n = String(num).replace(/\s/g, "");
  if (n.startsWith("4")) return "Visa";
  if (n.startsWith("5")) return "Mastercard";
  if (n.startsWith("3")) return "Amex";
  return "Card";
}

function maskCard(num) {
  return String(num)
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const Store = {
  products: readOrNull(KEYS.products) || SEED_PRODUCTS.map((p) => ({ ...p })),
  cart: readJson(KEYS.cart, []),
  wishlist: readJson(KEYS.wishlist, []),
  orders: readOrNull(KEYS.orders) || SEED_ORDERS.map((o) => ({ ...o })),
  base: "",

  init() {
    this.base = document.body.dataset.base || "";
    this.persist();
  },

  persist() {
    writeJson(KEYS.products, this.products);
    writeJson(KEYS.cart, this.cart);
    writeJson(KEYS.wishlist, this.wishlist);
    writeJson(KEYS.orders, this.orders);
  },

  img(src) {
    if (!src) return "";
    if (src.startsWith("data:") || src.startsWith("http")) return src;
    return this.base + src.replace(/^\//, "");
  },

  href(path) {
    return this.base + path.replace(/^\//, "");
  },

  get isAdmin() {
    return sessionStorage.getItem(KEYS.admin) === "1";
  },

  loginAdmin(ok) {
    if (ok) sessionStorage.setItem(KEYS.admin, "1");
    else sessionStorage.removeItem(KEYS.admin);
  },

  productById(id) {
    return this.products.find((p) => p.id === id);
  },

  productBySlug(slug) {
    return this.products.find((p) => p.slug === slug);
  },

  cartItems() {
    return this.cart
      .map((i) => {
        const product = this.productById(i.productId);
        return product ? { product, qty: i.qty } : null;
      })
      .filter(Boolean);
  },

  cartCount() {
    return this.cart.reduce((s, i) => s + i.qty, 0);
  },

  subtotal() {
    return this.cartItems().reduce((s, i) => s + i.product.price * i.qty, 0);
  },

  shipping() {
    const sub = this.subtotal();
    return sub === 0 || sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  },

  tax() {
    return Math.round(this.subtotal() * TAX_RATE * 100) / 100;
  },

  total() {
    return Math.round((this.subtotal() + this.shipping() + this.tax()) * 100) / 100;
  },

  addToCart(productId, qty) {
    qty = qty || 1;
    const product = this.productById(productId);
    if (!product) return;
    if (product.stock <= 0) {
      UI.toast("This frame is sold out.");
      return;
    }
    const found = this.cart.find((i) => i.productId === productId);
    if (found) found.qty = Math.min(found.qty + qty, product.stock);
    else this.cart.push({ productId, qty: Math.min(qty, product.stock) });
    this.persist();
    UI.toast("Added to bag");
    UI.refreshChrome();
  },

  setQty(productId, qty) {
    const product = this.productById(productId);
    const max = product ? product.stock : 1;
    if (qty <= 0) this.cart = this.cart.filter((i) => i.productId !== productId);
    else {
      this.cart = this.cart.map((i) =>
        i.productId === productId ? { ...i, qty: Math.min(qty, max) } : i
      );
    }
    this.persist();
    UI.refreshChrome();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter((i) => i.productId !== productId);
    this.persist();
    UI.refreshChrome();
  },

  clearCart() {
    this.cart = [];
    this.persist();
    UI.refreshChrome();
  },

  toggleWishlist(productId) {
    const has = this.wishlist.includes(productId);
    this.wishlist = has
      ? this.wishlist.filter((id) => id !== productId)
      : this.wishlist.concat(productId);
    this.persist();
    UI.toast(has ? "Removed from wishlist" : "Saved to wishlist");
    UI.refreshChrome();
  },

  addProduct(p) {
    this.products.unshift({
      ...p,
      id: uid("p"),
      createdAt: new Date().toISOString().slice(0, 10),
    });
    this.persist();
  },

  updateProduct(id, patch) {
    this.products = this.products.map((p) => (p.id === id ? { ...p, ...patch } : p));
    this.persist();
  },

  deleteProduct(id) {
    this.products = this.products.filter((p) => p.id !== id);
    this.cart = this.cart.filter((i) => i.productId !== id);
    this.wishlist = this.wishlist.filter((x) => x !== id);
    this.persist();
  },

  placeOrder(order) {
    const next = {
      ...order,
      id: "SL-" + Date.now().toString().slice(-8),
      createdAt: new Date().toISOString(),
      status: "paid",
    };
    this.orders.unshift(next);
    this.products = this.products.map((p) => {
      const item = order.items.find((i) => i.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
    });
    this.cart = [];
    this.persist();
    return next;
  },

  updateOrderStatus(id, status) {
    this.orders = this.orders.map((o) => (o.id === id ? { ...o, status } : o));
    this.persist();
  },

  resetCatalog() {
    this.products = SEED_PRODUCTS.map((p) => ({ ...p }));
    this.persist();
  },

  clearOrders() {
    this.orders = [];
    this.persist();
  },
};
