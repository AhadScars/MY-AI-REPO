const I = {
  search:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  cart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M12 7v12" stroke="currentColor" fill="none" stroke-width="2.2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h4l1 5-2.5 1.5a12 12 0 0 0 5 5L16 12l5 1v4c0 1-1 2-2 2C9 19 5 15 5 5c0-1 1-2 2-2z"/></svg>',
  google:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.72.12-1.43.34-2.09V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
  visa:
    '<svg class="card-mark" viewBox="0 0 48 32" aria-label="Visa"><rect width="48" height="32" rx="4" fill="#fff"/><path fill="#1A1F71" d="M19.4 21.2h-2.7l1.7-10.4h2.7l-1.7 10.4zm11.2-10.1c-.5-.2-1.4-.5-2.5-.5-2.7 0-4.6 1.4-4.7 3.4-.1 1.5 1.4 2.3 2.4 2.8 1.1.5 1.4.9 1.4 1.3 0 .7-.9 1.1-1.7 1.1-1.1 0-1.7-.2-2.7-.6l-.4-.2-.4 2.4c.7.3 2 .6 3.3.6 2.9 0 4.8-1.4 4.8-3.5 0-1.2-.7-2.1-2.3-2.8-1-.5-1.5-.8-1.5-1.3 0-.4.5-1 1.6-1 1 0 1.6.2 2.1.4l.3.1.4-2.2zm6.4-.3h-2.1c-.6 0-1.1.2-1.4.8l-3.9 9.6h2.8l.5-1.5h3.4l.3 1.5h2.5l-2.1-10.4zm-3.3 6.8.9-2.6c0 .1.5-1.3.8-2.2l.4 2 .3 1.6-2.4 1.2h0zM17 10.8l-2.6 10.4h-2.7L9.4 13c-.1-.5-.3-.7-.7-1-.7-.4-1.8-.7-2.7-.9l.1-.3h4.6c.6 0 1.1.4 1.3 1.1l1.1 6.1 2.8-7.2H17z"/></svg>',
  mastercard:
    '<svg class="card-mark" viewBox="0 0 48 32" aria-label="Mastercard"><rect width="48" height="32" rx="4" fill="#fff"/><circle cx="19.5" cy="16" r="7.2" fill="#EB001B"/><circle cx="28.5" cy="16" r="7.2" fill="#F79E1B"/><path fill="#FF5F00" d="M24 10.6a7.16 7.16 0 0 0-2.7 5.4 7.16 7.16 0 0 0 2.7 5.4 7.16 7.16 0 0 0 2.7-5.4 7.16 7.16 0 0 0-2.7-5.4z"/></svg>',
};

function authNext() {
  return encodeURIComponent(location.pathname + location.search);
}

function googleHref() {
  return `/auth/google?next=${authNext()}`;
}

function logoutHref() {
  return `/auth/logout?next=${authNext()}`;
}

function currentUser() {
  return (APP_CONFIG && APP_CONFIG.user) || null;
}

function accountSlot() {
  const user = currentUser();
  if (user) {
    const first = (user.name || user.email || "Account").split(" ")[0];
    return `<div class="account">
      ${user.picture ? `<img class="account-pic" src="${user.picture}" alt="">` : `<span class="account-fallback">${first[0] || "U"}</span>`}
      <a class="account-name" href="${accountHref()}">${first}</a>
      <a class="account-out" href="${accountHref()}">Orders</a>
      <a class="account-out" href="${logoutHref()}">Sign out</a>
    </div>`;
  }
  if (APP_CONFIG.googleEnabled) {
    return `<a class="btn-google" href="${googleHref()}">${I.google}<span>Sign in</span></a>`;
  }
  return "";
}

const CART_KEY = "tibgstore-cart";
const PROMO_KEY = "tibg-promo";
const VIEW_KEY = "tibg-viewed";

function wishIds() {
  return Array.isArray(APP_CONFIG.wishlist) ? APP_CONFIG.wishlist : [];
}

function isWished(id) {
  return wishIds().includes(id);
}

function wishBtn(id) {
  const on = isWished(id);
  return `<button type="button" class="wish-btn ${on ? "on" : ""}" data-wish="${id}" aria-label="${on ? "Remove from wishlist" : "Add to wishlist"}" title="${on ? "Saved" : "Save"}">${on ? "♥" : "♡"}</button>`;
}

function getViewed() {
  try {
    const ids = JSON.parse(localStorage.getItem(VIEW_KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function recordView(id) {
  if (!id) return;
  const ids = [id, ...getViewed().filter((x) => x !== id)].slice(0, 8);
  localStorage.setItem(VIEW_KEY, JSON.stringify(ids));
}

function viewedProducts(skipId) {
  return getViewed()
    .filter((id) => id !== skipId)
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean);
}

function viewedBlock(skipId) {
  const list = viewedProducts(skipId).slice(0, 4);
  if (!list.length) return "";
  return `
    <section class="section" style="padding-top:0">
      <div class="wrap">
        <div class="section-head"><div><p class="kicker">You looked at</p><h2>Recently viewed</h2></div></div>
        <div class="grid-4">${list.map(productCard).join("")}</div>
      </div>
    </section>`;
}

function shopQuery(extra) {
  const next = new URLSearchParams(location.search);
  Object.entries(extra || {}).forEach(([k, v]) => {
    if (v == null || v === "" || v === "all" || v === "featured") next.delete(k);
    else next.set(k, v);
  });
  const q = next.toString();
  return location.pathname.replace(/^\//, "") + (q ? "?" + q : "");
}

function applyShopList(list) {
  const stock = qs("stock");
  let next = list.slice();
  if (stock === "in") next = next.filter((p) => stockCount(p) > 0);
  if (stock === "few") next = next.filter((p) => stockCount(p) > 0 && stockCount(p) < 5);
  const sort = qs("sort") || "featured";
  if (sort === "price-asc") next.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") next.sort((a, b) => b.price - a.price);
  else if (sort === "name") next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return next;
}

function shopTools() {
  const stock = qs("stock") || "all";
  const sort = qs("sort") || "featured";
  const pills = [
    ["all", "All"],
    ["in", "In stock"],
    ["few", "Few left"],
  ];
  return `
    <div class="shop-tools">
      <div class="filter-pills">
        ${pills
          .map(
            ([id, label]) =>
              `<a href="${shopQuery({ stock: id })}" class="${stock === id ? "active" : ""}">${label}</a>`
          )
          .join("")}
      </div>
      <label class="sort-field">
        <span>Sort</span>
        <select id="shop-sort">
          <option value="featured" ${sort === "featured" ? "selected" : ""}>Featured</option>
          <option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Price: low to high</option>
          <option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Price: high to low</option>
          <option value="name" ${sort === "name" ? "selected" : ""}>Name</option>
        </select>
      </label>
    </div>`;
}

async function toggleWish(id) {
  if (!currentUser()) {
    location.href = `/auth/google?next=${authNext()}`;
    return;
  }
  const on = isWished(id);
  try {
    const data = on
      ? await api(`/api/wishlist/${encodeURIComponent(id)}`, { method: "DELETE" })
      : await api("/api/wishlist", { method: "POST", body: JSON.stringify({ id }) });
    APP_CONFIG.wishlist = data.ids || [];
    document.querySelectorAll(`[data-wish="${id}"]`).forEach((btn) => {
      const now = isWished(id);
      btn.classList.toggle("on", now);
      btn.textContent = now ? "♥" : "♡";
      btn.setAttribute("aria-label", now ? "Remove from wishlist" : "Add to wishlist");
    });
    UI.toast(isWished(id) ? "Saved to your account" : "Removed from wishlist");
  } catch (err) {
    UI.toast(err.message);
  }
}

function getAppliedCoupon() {
  try {
    return JSON.parse(sessionStorage.getItem(PROMO_KEY) || "null");
  } catch {
    return null;
  }
}

function setAppliedCoupon(data) {
  if (!data) sessionStorage.removeItem(PROMO_KEY);
  else sessionStorage.setItem(PROMO_KEY, JSON.stringify(data));
}

function couponOff(sub, coupon) {
  if (!coupon) return 0;
  if (Number(coupon.minSub) > 0 && sub < Number(coupon.minSub)) return 0;
  if (coupon.type === "flat") return Math.min(sub, Math.max(0, Number(coupon.value) || 0));
  return Math.round(sub * (Math.max(0, Math.min(100, Number(coupon.value) || 0)) / 100));
}

function qs(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

function routeKey() {
  const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || "");
}

function accountHref() {
  return (APP_CONFIG && APP_CONFIG.accountPath) || "/";
}

function closeOwnerLogin() {
  document.getElementById("owner-login")?.remove();
  document.body.classList.remove("modal-open");
}

async function openOwnerLogin() {
  try {
    const me = await api("/api/admin/me");
    if (me.ok && me.path) {
      location.href = me.path;
      return;
    }
  } catch {
    /* show the panel */
  }
  if (document.getElementById("owner-login")) return;
  const box = document.createElement("div");
  box.id = "owner-login";
  box.className = "owner-overlay";
  box.innerHTML = `
    <div class="owner-panel" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
      <button type="button" class="modal-close" data-close-owner aria-label="Close">×</button>
      <img class="admin-gate-logo" src="assets/logo.jpg" alt="">
      <p class="kicker">TIBGSTORE</p>
      <h2 id="owner-login-title">Owner login</h2>
      <p class="muted">Password for the desk. Nothing here is public.</p>
      <form id="owner-login-form">
        <label class="field">
          <span>Password</span>
          <div class="pw-wrap">
            <input name="password" type="password" required autofocus autocomplete="current-password">
            <button type="button" class="pw-toggle" data-toggle-pw>Show</button>
          </div>
        </label>
        <button class="btn btn-accent" type="submit">Sign in</button>
      </form>
    </div>`;
  document.body.appendChild(box);
  document.body.classList.add("modal-open");
  const close = () => closeOwnerLogin();
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.closest("[data-close-owner]")) close();
  });
  box.querySelector("[data-toggle-pw]")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const input = btn.parentElement.querySelector("input");
    if (!input) return;
    const hide = input.type === "text";
    input.type = hide ? "password" : "text";
    btn.textContent = hide ? "Show" : "Hide";
  });
  box.querySelector("#owner-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = new FormData(e.target).get("password");
    try {
      const data = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (data.path) location.href = data.path;
    } catch (err) {
      UI.toast(err.message);
    }
  });
}

function productHref(p) {
  return p && p.key ? `/i/${encodeURIComponent(p.key)}` : "index.html";
}

function postHref(p) {
  return p && p.key ? `/n/${encodeURIComponent(p.key)}` : "blog.html";
}

function waLink(text) {
  const num = SITE.whatsapp || String(SITE.phone || "").replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(text || "Hi TIBGSTORE — I want help picking a custom PC.")}`;
}

async function api(url, opts) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...((opts && opts.headers) || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function money(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  UI.updateCartBadge();
}

function cartCount() {
  return getCart().reduce((n, i) => n + i.qty, 0);
}

function stockCount(p) {
  if (!p || p.stock == null || p.stock === "") return 999;
  const n = Number(p.stock);
  return Number.isFinite(n) ? n : 999;
}

function cartQtyOf(id) {
  const found = getCart().find((i) => i.id === id);
  return found ? found.qty : 0;
}

function stockFlag(p) {
  const s = stockCount(p);
  if (s <= 0) return `<span class="stock-flag out">Sold out</span>`;
  if (s < 5) return `<span class="stock-flag">Few left</span>`;
  return "";
}

function addToCart(id, qty, silent) {
  const p = PRODUCTS.find((x) => x.id === id);
  const stock = stockCount(p);
  if (stock <= 0) {
    if (!silent) UI.toast("Sold out — cannot add to cart");
    return false;
  }
  const want = Math.max(1, qty || 1);
  const have = cartQtyOf(id);
  const room = stock - have;
  if (room <= 0) {
    if (!silent) UI.toast(`Only ${stock} left`);
    return false;
  }
  const add = Math.min(want, room);
  const items = getCart();
  const found = items.find((i) => i.id === id);
  if (found) found.qty += add;
  else items.push({ id, qty: add });
  saveCart(items);
  if (!silent) {
    UI.toast(add < want ? `Only ${stock} left — added ${add}` : `${p ? p.name : "Item"} added to cart`);
  }
  return true;
}

function setQty(id, qty) {
  const p = PRODUCTS.find((x) => x.id === id);
  const stock = stockCount(p);
  let items = getCart();
  if (qty <= 0) items = items.filter((i) => i.id !== id);
  else {
    const next = Math.min(qty, stock);
    if (next <= 0) items = items.filter((i) => i.id !== id);
    else {
      const found = items.find((i) => i.id === id);
      if (found) found.qty = next;
      if (qty > stock) UI.toast(`Only ${stock} left`);
    }
  }
  saveCart(items);
}

function cartLines() {
  return getCart()
    .map((line) => {
      const product = PRODUCTS.find((p) => p.id === line.id);
      return product ? { ...line, product } : null;
    })
    .filter(Boolean);
}

function cartTotals(code, method) {
  const lines = cartLines();
  const sub = lines.reduce((n, l) => n + l.product.price * l.qty, 0);
  const coupon = getAppliedCoupon();
  const discount = couponOff(sub, coupon);
  const freeAt = Number((SITE && SITE.freeShipAt) || 99999);
  const shipFee = Number((SITE && SITE.shipFee) || 999);
  const ship = sub >= freeAt || sub === 0 ? 0 : shipFee;
  const rawCod = SITE && SITE.codFee == null ? 500 : Number(SITE && SITE.codFee);
  const codFee = method === "cod" ? Math.max(0, Number.isFinite(rawCod) ? rawCod : 500) : 0;
  return { lines, sub, discount, ship, codFee, total: sub - discount + ship + codFee };
}

function stars(n) {
  const full = Math.round(n);
  return `${"★".repeat(full)}${"☆".repeat(5 - full)}`;
}

function productCard(p) {
  const chips = p.type === "build" && p.specs
    ? [p.specs.CPU, p.specs.GPU, p.specs.RAM].filter(Boolean).map((s) => String(s).replace("GeForce ", "").replace("Radeon ", "").split(" ").slice(-2).join(" "))
    : Object.values(p.specs || {}).slice(0, 3);
  const sold = stockCount(p) <= 0;
  return `
    <article class="card ${sold ? "sold-out" : ""}">
      <a class="card-media" href="${productHref(p)}">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        ${p.badge ? `<span class="pill ${/sale|hot/i.test(p.badge) ? "sale" : "hot"}">${p.badge}</span>` : ""}
        ${p.resolution ? `<span class="res-tag">${p.resolution}</span>` : ""}
        ${stockFlag(p)}
      </a>
      ${wishBtn(p.id)}
      <div class="card-body">
        <h3><a href="${productHref(p)}">${p.name}</a></h3>
        <p class="tagline">${p.tagline}</p>
        <div class="card-specs">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
        <div class="card-foot">
          <div class="price">${p.compareAt ? `<s>${money(p.compareAt)}</s>` : ""}${money(p.price)}</div>
          ${
            sold
              ? `<button class="btn btn-line" type="button" disabled>Sold out</button>`
              : `<button class="btn btn-line" type="button" data-add="${p.id}">Add</button>`
          }
        </div>
      </div>
    </article>`;
}

function tierCard(t) {
  return `
    <a class="tier-card ${t.color}" href="${t.href}">
      <img src="${t.image}" alt="${t.title}">
      <div class="tier-body">
        <p class="kicker">${t.kicker}</p>
        <h3>${t.title}</h3>
        <p class="price-from">From ${money(t.priceFrom)}</p>
        <p class="muted">${t.blurb}</p>
      </div>
    </a>`;
}

const UI = {
  toast(message) {
    let box = document.querySelector(".toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },

  updateCartBadge() {
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      const n = cartCount();
      el.textContent = n;
      el.hidden = n === 0;
    });
  },

  header() {
    const page = document.body.dataset.page;
    const links = [
      ["index.html", "Home", "home"],
      ["budget.html", "Budget", "budget"],
      ["mid-range.html", "Mid", "mid"],
      ["high-end.html", "High", "high"],
      ["build.html", "Custom", "build"],
      ["parts.html", "Parts", "parts"],
      ["blog.html", "Blog", "blog"],
      ["contact.html", "Contact", "contact"],
    ];
    return `
      <div class="announcement">
        <div class="wrap announcement-inner">
          <span><strong>Free ground shipping</strong> on prebuilts over ₹99,999 · Apply a coupon in the cart</span>
          <span><a href="${SITE.phoneHref}">Call ${SITE.phone}</a> · ${SITE.hours}</span>
        </div>
      </div>
      <header class="site-header">
        <div class="wrap header-inner">
          <a class="logo" href="index.html" aria-label="${SITE.name} home">
            <img class="logo-img" src="assets/logo.jpg" alt="TIBGSTORE">
            <span class="logo-word">TIBG <span>STORE</span></span>
          </a>
          <nav class="nav">
            ${links
              .map(
                ([href, label, id]) =>
                  `<a href="${href}" class="${page === id ? "active" : ""}">${label}</a>`
              )
              .join("")}
          </nav>
          <div class="header-actions">
            ${accountSlot()}
            ${
              APP_CONFIG.googleEnabled
                ? `<a class="icon-btn wish-nav ${wishIds().length ? "has-wishes" : ""}" href="${accountHref()}#wishlist" aria-label="Wishlist">♡</a>`
                : ""
            }
            <button class="icon-btn" type="button" data-open-search aria-label="Search">${I.search}</button>
            <a class="icon-btn" href="cart.html" aria-label="Cart">
              ${I.cart}
              <span class="badge-count" data-cart-count hidden>0</span>
            </a>
            <button class="icon-btn menu-toggle" type="button" data-menu aria-label="Menu">${I.menu}</button>
          </div>
        </div>
      </header>
      <div class="mobile-nav" id="mobile-nav">
        ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
        <a href="cart.html">Cart</a>
        <a href="faq.html">FAQ</a>
        ${
          currentUser()
            ? `<a href="${accountHref()}">Your orders</a><a href="${accountHref()}#wishlist">Wishlist</a><a href="${logoutHref()}">Sign out</a>`
            : APP_CONFIG.googleEnabled
              ? `<a href="${googleHref()}">Sign in with Google</a>`
              : ""
        }
        <button type="button" class="footer-owner" data-owner-login>Owner login</button>
      </div>
      <div class="search-overlay" id="search-overlay">
        <div class="search-panel">
          <div class="search-field">
            <input id="search-input" type="search" placeholder="Search Pulse 5, RTX 5080, 360mm AIO…" autocomplete="off">
          </div>
          <div class="search-results" id="search-results"></div>
        </div>
      </div>`;
  },

  footer() {
    return `
      <footer class="site-footer">
        <div class="wrap footer-grid">
          <div>
            <a class="logo" href="index.html">
              <img class="logo-img" src="assets/logo.jpg" alt="TIBGSTORE">
              <span class="logo-word">TIBG <span>STORE</span></span>
            </a>
            <p style="margin-top:0.8rem">${SITE.blurb}</p>
          </div>
          <div>
            <h4>Shop</h4>
            <a href="budget.html">Budget PCs</a>
            <a href="mid-range.html">Mid-range PCs</a>
            <a href="high-end.html">High-end PCs</a>
            <a href="parts.html">PC parts</a>
            <a href="build.html">Custom PC build</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="about.html">About the bench</a>
            <a href="blog.html">Journal</a>
            <a href="faq.html">FAQ & warranty</a>
            <a href="contact.html">Contact</a>
            <a href="${accountHref()}">Your orders</a>
            ${APP_CONFIG.googleEnabled ? `<a href="${accountHref()}#wishlist">Wishlist</a>` : ""}
            <button type="button" class="footer-owner" data-owner-login>Owner login</button>
          </div>
          <div>
            <h4>Visit</h4>
            <p>${SITE.address}</p>
            <p>${SITE.hours}</p>
            <a href="${SITE.phoneHref}">${SITE.phone}</a>
            <a href="mailto:${SITE.email}">${SITE.email}</a>
          </div>
        </div>
        <div class="wrap legal">
          <span>© ${new Date().getFullYear()} TIBGSTORE. Built to be used, not just unboxed.</span>
          <span class="pay-marks">${
            APP_CONFIG.stripeEnabled
              ? `Pay with Stripe ${I.visa}${I.mastercard}`
              : ""
          }</span>
        </div>
      </footer>`;
  },

  bindChrome() {
    document.getElementById("site-header").innerHTML = UI.header();
    document.getElementById("site-footer").innerHTML = UI.footer();
    UI.updateCartBadge();
    UI.bindSliders();

    document.querySelector("[data-menu]")?.addEventListener("click", () => {
      document.getElementById("mobile-nav").classList.toggle("open");
    });

    const overlay = document.getElementById("search-overlay");
    const input = document.getElementById("search-input");
    document.querySelector("[data-open-search]")?.addEventListener("click", () => {
      overlay.classList.add("open");
      input.focus();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
    input.addEventListener("input", () => UI.renderSearch(input.value));

    if (UI._globalBound) return;
    UI._globalBound = true;
    document.addEventListener("keydown", (e) => {
      const box = document.getElementById("search-overlay");
      const field = document.getElementById("search-input");
      if (e.key === "Escape") {
        box?.classList.remove("open");
        closeOwnerLogin();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        box?.classList.add("open");
        field?.focus();
      }
    });
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add]");
      if (btn && !btn.disabled) addToCart(btn.dataset.add, 1);
      const wish = e.target.closest("[data-wish]");
      if (wish) {
        e.preventDefault();
        e.stopPropagation();
        toggleWish(wish.dataset.wish);
      }
      if (e.target.closest("[data-owner-login]")) {
        e.preventDefault();
        openOwnerLogin();
      }
    });
  },

  bindSliders() {
    const sels = ".grid-4, .grid-3, .reviews, .process, .tier-grid, .blog-grid, .trust";
    document.querySelectorAll(sels).forEach((el) => {
      if (el.closest(".h-slide")) return;
      const kids = [...el.children].filter((n) => !n.classList.contains("empty"));
      if (kids.length < 2) return;
      const wrap = document.createElement("div");
      wrap.className = "h-slide";
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "h-slide-btn prev";
      prev.setAttribute("aria-label", "Previous");
      prev.textContent = "‹";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "h-slide-btn next";
      next.setAttribute("aria-label", "Next");
      next.textContent = "›";
      wrap.appendChild(prev);
      wrap.appendChild(next);
      const go = (dir) => {
        const card = el.children[0];
        const w = card ? card.getBoundingClientRect().width + 14 : 280;
        el.scrollBy({ left: dir * w, behavior: "smooth" });
      };
      prev.addEventListener("click", () => go(-1));
      next.addEventListener("click", () => go(1));
    });
  },

  renderSearch(q) {
    const box = document.getElementById("search-results");
    const query = q.trim().toLowerCase();
    if (query.length < 2) {
      box.innerHTML = `<p class="muted" style="padding:0.6rem">Type a build, GPU, or CPU.</p>`;
      return;
    }
    const hits = PRODUCTS.filter((p) =>
      [p.name, p.tagline, p.description, p.category, p.tier, ...Object.values(p.specs || {})]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    ).slice(0, 8);
    if (!hits.length) {
      box.innerHTML = `<p class="muted" style="padding:0.6rem">Nothing matches “${q}”.</p>`;
      return;
    }
    box.innerHTML = hits
      .map(
        (p) => `
        <a class="search-hit" href="${productHref(p)}">
          <img src="${p.image}" alt="">
          <div>
            <strong>${p.name}</strong>
            <div class="muted">${p.tagline}</div>
          </div>
          <div>${money(p.price)}</div>
        </a>`
      )
      .join("");
  },
};
