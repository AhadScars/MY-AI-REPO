window.KM = window.KM || {};

KM.store = {
  cartKey: "km-cart",
  orderKey: "km-orders",
  promoKey: "km-promo",
};

KM.cart = {
  read() {
    try { return JSON.parse(localStorage.getItem(KM.store.cartKey) || "[]"); }
    catch { return []; }
  },
  write(items) {
    localStorage.setItem(KM.store.cartKey, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("km:cart"));
  },
  count() { return this.read().reduce((n, i) => n + i.qty, 0); },
  add(id, qty = 1) {
    const item = KM.item(id);
    if (!item) return;
    const items = this.read();
    const found = items.find((i) => i.id === id);
    if (found) found.qty += qty;
    else items.push({ id, qty });
    this.write(items);
    KM.toast(`${item.name} added`);
  },
  set(id, qty) {
    let items = this.read();
    if (qty <= 0) items = items.filter((i) => i.id !== id);
    else {
      const found = items.find((i) => i.id === id);
      if (found) found.qty = qty;
    }
    this.write(items);
  },
  clear() { this.write([]); },
  lines() {
    return this.read().map((row) => {
      const item = KM.item(row.id);
      return item ? { ...item, qty: row.qty, line: item.price * row.qty } : null;
    }).filter(Boolean);
  },
};

KM.promo = {
  get() { return localStorage.getItem(KM.store.promoKey) || ""; },
  set(code) { localStorage.setItem(KM.store.promoKey, (code || "").toUpperCase().trim()); },
};

KM.totals = (zoneId) => {
  const lines = KM.cart.lines();
  const subtotal = lines.reduce((n, i) => n + i.line, 0);
  const packaging = lines.length ? KM.delivery.packaging : 0;
  const zone = KM.delivery.zones.find((z) => z.id === zoneId);
  let delivery = 0;
  if (zoneId) {
    delivery = zone ? zone.fee : KM.delivery.fee;
    if (subtotal >= KM.delivery.freeAbove) delivery = 0;
  }
  const taxable = subtotal + packaging + delivery;
  const gst = Math.round(taxable * KM.delivery.gstRate);
  let discount = 0;
  let promoLabel = "";
  const code = KM.promo.get();
  const promo = KM.promos[code];
  if (promo && subtotal >= promo.min) {
    discount = promo.type === "flat" ? promo.value : Math.round(subtotal * promo.value / 100);
    promoLabel = `${code} · ${promo.label}`;
  }
  const grand = Math.max(0, taxable + gst - discount);
  return { lines, subtotal, packaging, delivery, gst, discount, promoLabel, grand, zone };
};

KM.api = {
  async health() {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },
  async post(url, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["X-Admin-Token"] = token;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body || {}), credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
  async get(url, token) {
    const headers = {};
    if (token) headers["X-Admin-Token"] = token;
    const res = await fetch(url, { headers, cache: "no-store", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
  async patch(url, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["X-Admin-Token"] = token;
    const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
  async del(url, token) {
    const headers = {};
    if (token) headers["X-Admin-Token"] = token;
    const res = await fetch(url, { method: "DELETE", headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
  async form(url, form, token, method = "POST") {
    const headers = {};
    if (token) headers["X-Admin-Token"] = token;
    const res = await fetch(url, { method, headers, body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
};

KM.orders = {
  all() {
    try { return JSON.parse(localStorage.getItem(KM.store.orderKey) || "[]"); }
    catch { return []; }
  },
  save(list) { localStorage.setItem(KM.store.orderKey, JSON.stringify(list)); },
  cache(order) {
    if (!order?.id) return;
    const list = this.all().filter((o) => o.id !== order.id);
    list.unshift(order);
    this.save(list);
  },
  get(id) { return this.all().find((o) => o.id === id); },
  async place(payload) {
    const clean = {
      ...payload,
      totals: {
        subtotal: payload.totals?.subtotal || 0,
        packaging: payload.totals?.packaging || 0,
        delivery: payload.totals?.delivery || 0,
        gst: payload.totals?.gst || 0,
        discount: payload.totals?.discount || 0,
        promoLabel: payload.totals?.promoLabel || "",
        loyalty: payload.totals?.loyalty || 0,
        grand: payload.totals?.grand || 0,
      },
      useLoyalty: !!payload.useLoyalty,
      loyaltyPoints: payload.loyaltyPoints || 0,
    };
    const data = await KM.api.post("/api/orders", clean);
    const order = data.order;
    if (!order) throw new Error("Could not place the order");
    this.cache(order);
    KM.cart.clear();
    KM.promo.set("");
    return data;
  },
  async fetch(id) {
    if (!id) return null;
    try {
      const data = await KM.api.get("/api/orders/" + encodeURIComponent(id));
      this.cache(data.order);
      return data.order;
    } catch {
      return this.get(id.toUpperCase());
    }
  },
  update(id, status) {
    const list = this.all();
    const order = list.find((o) => o.id === id);
    if (!order) return null;
    order.status = status;
    order.history.push({ status, at: new Date().toISOString() });
    this.save(list);
    return order;
  },
};

KM.toast = (msg) => {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(KM._toast);
  KM._toast = setTimeout(() => el.classList.remove("show"), 2200);
};

KM.inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

KM.steps = (type) => type === "pickup"
  ? ["placed", "confirmed", "preparing", "ready", "collected"]
  : ["placed", "confirmed", "preparing", "out", "delivered"];

KM.stepLabel = {
  placed: "Order placed",
  confirmed: "Kitchen confirmed",
  preparing: "Fresh kunafa on the griddle",
  out: "Out for delivery",
  delivered: "Delivered",
  ready: "Ready for pickup",
  collected: "Collected",
  cancelled: "Cancelled",
};
