const $ = (s, el = document) => el.querySelector(s);

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

function toast(msg) {
  let box = $(".toasts");
  if (!box) {
    box = document.createElement("div");
    box.className = "toasts";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

const PAGE_SIZE = 8;
const state = {
  tab: "products",
  products: [],
  posts: [],
  leads: [],
  orders: [],
  coupons: [],
  settings: {},
  images: [],
  editing: null,
  page: { products: 1, blog: 1, leads: 1, orders: 1, coupons: 1 },
};

function pageOf(tab, list) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  let page = Number(state.page[tab]) || 1;
  if (page > pages) page = pages;
  if (page < 1) page = 1;
  state.page[tab] = page;
  const start = (page - 1) * PAGE_SIZE;
  return {
    slice: list.slice(start, start + PAGE_SIZE),
    page,
    pages,
    total,
    from: total ? start + 1 : 0,
    to: Math.min(start + PAGE_SIZE, total),
  };
}

function pagerHtml(tab, info) {
  if (!info.total) return "";
  const buttons = [];
  buttons.push(`<button type="button" class="pager-btn" data-page-tab="${tab}" data-page-to="${info.page - 1}" ${info.page <= 1 ? "disabled" : ""}>Prev</button>`);
  const windowSize = 5;
  let from = Math.max(1, info.page - 2);
  let to = Math.min(info.pages, from + windowSize - 1);
  from = Math.max(1, to - windowSize + 1);
  if (from > 1) {
    buttons.push(`<button type="button" class="pager-btn" data-page-tab="${tab}" data-page-to="1">1</button>`);
    if (from > 2) buttons.push(`<span class="pager-gap">…</span>`);
  }
  for (let i = from; i <= to; i++) {
    buttons.push(`<button type="button" class="pager-btn ${i === info.page ? "on" : ""}" data-page-tab="${tab}" data-page-to="${i}">${i}</button>`);
  }
  if (to < info.pages) {
    if (to < info.pages - 1) buttons.push(`<span class="pager-gap">…</span>`);
    buttons.push(`<button type="button" class="pager-btn" data-page-tab="${tab}" data-page-to="${info.pages}">${info.pages}</button>`);
  }
  buttons.push(`<button type="button" class="pager-btn" data-page-tab="${tab}" data-page-to="${info.page + 1}" ${info.page >= info.pages ? "disabled" : ""}>Next</button>`);
  return `<div class="pager">
    <p class="muted">Showing ${info.from}–${info.to} of ${info.total}</p>
    <div class="pager-btns">${buttons.join("")}</div>
  </div>`;
}

function loginView() {
  return `
    <div class="admin-gate">
      <form class="admin-gate-form" id="login-form">
        <img class="admin-gate-logo" src="assets/logo.jpg" alt="">
        <p class="kicker">TIBGSTORE</p>
        <h1>Owner login</h1>
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
}

function bindPwToggle(root) {
  (root || document).querySelectorAll("[data-toggle-pw]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      if (!input) return;
      const hide = input.type === "text";
      input.type = hide ? "password" : "text";
      btn.textContent = hide ? "Show" : "Hide";
    });
  });
}

function specText(specs) {
  return Object.entries(specs || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
}

function parseSpecs(text) {
  const specs = {};
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const i = line.indexOf(":");
      if (i < 0) return;
      specs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
  return specs;
}

function modalWrap(inner) {
  return `
    <div class="modal-overlay" id="admin-modal">
      <div class="modal-panel" role="dialog" aria-modal="true">
        <button type="button" class="modal-close" id="cancel-edit" aria-label="Close">×</button>
        ${inner}
      </div>
    </div>`;
}

function productForm(p) {
  const images = state.images
    .map((src) => `<option value="${src}" ${p && p.image === src ? "selected" : ""}>${src}</option>`)
    .join("");
  return `
    <form class="form" id="product-form" data-id="${p ? p.id : ""}">
      <h3>${p ? "Edit product" : "New product"}</h3>
      <div class="two-col">
        <label class="field"><span>Name</span><input name="name" required value="${p ? p.name : ""}"></label>
        <label class="field"><span>Price ₹</span><input name="price" type="number" min="0" step="1" required value="${p ? p.price : ""}"></label>
        <label class="field"><span>Type</span>
          <select name="type">
            <option ${!p || p.type === "build" ? "selected" : ""}>build</option>
            <option ${p && p.type === "part" ? "selected" : ""}>part</option>
            <option ${p && p.type === "service" ? "selected" : ""}>service</option>
          </select>
        </label>
        <label class="field"><span>Tier / category</span><input name="group" value="${p ? p.tier || p.category || "" : ""}" placeholder="budget / mid / high or cpu / gpu"></label>
        <label class="field"><span>Stock</span><input name="stock" type="number" value="${p ? p.stock || 0 : 0}"></label>
        <label class="field"><span>Badge</span><input name="badge" value="${p ? p.badge || "" : ""}"></label>
      </div>
      <label class="field"><span>Tagline</span><input name="tagline" value="${p ? p.tagline || "" : ""}"></label>
      <label class="field"><span>Description</span><textarea name="description">${p ? p.description || "" : ""}</textarea></label>
      <label class="field"><span>Specs (one per line, Key: value)</span><textarea name="specs">${p ? specText(p.specs) : ""}</textarea></label>
      <div class="field">
        <span>Photos</span>
        <div class="img-picker" id="product-gallery">
          ${(state.editing.images || []).map((src, i) => `
            <figure class="img-pick ${i === 0 ? "cover" : ""}">
              <img src="${src}" alt="">
              ${i === 0 ? `<em>Cover</em>` : `<button type="button" class="img-cover" data-cover-img="${src}">Cover</button>`}
              <button type="button" class="img-drop" data-drop-img="${src}" aria-label="Remove">×</button>
            </figure>`).join("")}
          <label class="img-add">
            <input type="file" id="product-files" accept="image/*" multiple>
            <span>+ Add photos</span>
          </label>
        </div>
        <p class="faint">Select several files at once. First photo is the card image.</p>
      </div>
      <div class="field">
        <span>Game FPS on product page</span>
        <div class="fps-edit" id="fps-edit">
          ${(state.editing.fps && state.editing.fps.length ? state.editing.fps : [{ game: "", fps: "" }])
            .map(
              (row, i) => `
            <div class="fps-edit-row">
              <input name="fps-game" placeholder="Valorant" value="${escAttr(row.game)}">
              <input name="fps-val" placeholder="240+" value="${escAttr(row.fps)}">
              <button type="button" class="img-drop" data-drop-fps="${i}" aria-label="Remove">×</button>
            </div>`
            )
            .join("")}
        </div>
        <button class="btn btn-line" type="button" id="add-fps">+ Add game</button>
        <p class="faint">Shows as big FPS chips: 240+ under Valorant.</p>
      </div>
      <label class="field"><span>Or pick from library</span>
        <select name="image"><option value="">—</option>${images}</select>
      </label>
      <div class="call-row">
        <button class="btn btn-accent" type="submit">Save</button>
        <button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>
      </div>
    </form>`;
}

function postForm(p) {
  const images = state.images
    .map((src) => `<option value="${src}" ${p && p.cover === src ? "selected" : ""}>${src}</option>`)
    .join("");
  return `
    <form class="form" id="post-form" data-id="${p ? p.id : ""}">
      <h3>${p ? "Edit post" : "New post"}</h3>
      <label class="field"><span>Title</span><input name="title" required value="${p ? p.title : ""}"></label>
      <label class="field"><span>Excerpt</span><input name="excerpt" value="${p ? p.excerpt || "" : ""}"></label>
      <label class="field"><span>Body</span><textarea name="body">${p ? p.body || "" : ""}</textarea></label>
      <label class="field"><span>Cover</span><select name="cover">${images}</select></label>
      <label class="field"><span>Or upload cover</span><input type="file" id="post-file" accept="image/*"></label>
      <label class="field"><span><input type="checkbox" name="published" ${!p || p.published !== false ? "checked" : ""}> Published</span></label>
      <div class="call-row">
        <button class="btn btn-accent" type="submit">Save post</button>
        <button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>
      </div>
    </form>`;
}

function genCouponCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "TIBG";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function couponForm(c) {
  const item = c || {};
  return `
    <form class="form" id="coupon-form" data-id="${item.id || ""}">
      <h3>${item.id ? "Edit coupon" : "New coupon"}</h3>
      <div class="two-col">
        <label class="field"><span>Code</span>
          <div class="call-row" style="margin:0">
            <input name="code" required value="${escAttr(item.code || genCouponCode())}" style="flex:1">
            <button class="btn btn-line" type="button" id="regen-code">Generate</button>
          </div>
        </label>
        <label class="field"><span>Type</span>
          <select name="type">
            <option value="percent" ${item.type !== "flat" ? "selected" : ""}>Percent off</option>
            <option value="flat" ${item.type === "flat" ? "selected" : ""}>Flat ₹ off</option>
          </select>
        </label>
        <label class="field"><span>Value</span><input name="value" type="number" min="0" step="1" required value="${item.value ?? 10}"></label>
        <label class="field"><span>Min order ₹</span><input name="minSub" type="number" min="0" step="1" value="${item.minSub || 0}"></label>
        <label class="field"><span>Max uses (0 = unlimited)</span><input name="maxUses" type="number" min="0" step="1" value="${item.maxUses || 0}"></label>
        <label class="field"><span>Expires</span><input name="expires" type="date" value="${item.expires || ""}"></label>
      </div>
      <label class="field"><span>Note</span><input name="note" value="${escAttr(item.note || "")}" placeholder="Diwali sale"></label>
      <label class="field"><span><input type="checkbox" name="active" ${item.active !== false ? "checked" : ""}> Active</span></label>
      <div class="call-row">
        <button class="btn btn-accent" type="submit">Save coupon</button>
        <button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>
      </div>
    </form>`;
}

function dashboard() {
  const tabs = ["products", "blog", "coupons", "leads", "orders", "settings"];
  let body = "";
  if (state.tab === "products") {
    const pg = pageOf("products", state.products);
    body = `
      <button class="btn btn-accent" id="new-product" type="button">Add product</button>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Type</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            ${pg.slice
              .map(
                (p) => `<tr>
                  <td>${p.name}</td><td>${p.type}${p.tier || p.category ? " · " + (p.tier || p.category) : ""}</td>
                  <td>₹${Number(p.price).toLocaleString("en-IN")}</td><td>${p.stock ?? ""}</td>
                  <td><button type="button" data-edit-p="${p.id}">Edit</button><button type="button" data-del-p="${p.id}">Remove</button></td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${pagerHtml("products", pg)}`;
  } else if (state.tab === "blog") {
    const pg = pageOf("blog", state.posts);
    body = `
      <button class="btn btn-accent" id="new-post" type="button">Add post</button>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Date</th><th>Live</th><th></th></tr></thead>
          <tbody>
            ${pg.slice
              .map(
                (p) => `<tr>
                  <td>${p.title}</td><td>${p.date || ""}</td><td>${p.published === false ? "draft" : "yes"}</td>
                  <td><button type="button" data-edit-b="${p.id}">Edit</button><button type="button" data-del-b="${p.id}">Remove</button></td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${pagerHtml("blog", pg)}`;
  } else if (state.tab === "coupons") {
    const pg = pageOf("coupons", state.coupons);
    body = `
      <button class="btn btn-accent" id="new-coupon" type="button">Generate coupon</button>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Code</th><th>Offer</th><th>Uses</th><th>Expires</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${pg.slice
              .map((c) => {
                const offer = c.type === "flat" ? `₹${Number(c.value).toLocaleString("en-IN")} off` : `${c.value}% off`;
                const uses = Number(c.maxUses) > 0 ? `${c.used || 0}/${c.maxUses}` : `${c.used || 0}`;
                return `<tr>
                  <td><strong>${c.code}</strong>${c.note ? `<div class="faint">${c.note}</div>` : ""}</td>
                  <td>${offer}${c.minSub ? `<div class="faint">min ₹${Number(c.minSub).toLocaleString("en-IN")}</div>` : ""}</td>
                  <td>${uses}</td>
                  <td>${c.expires || "—"}</td>
                  <td>${c.active === false ? "off" : "live"}</td>
                  <td><button type="button" data-edit-c="${c.id}">Edit</button><button type="button" data-del-c="${c.id}">Remove</button></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      ${pagerHtml("coupons", pg)}`;
  } else if (state.tab === "leads") {
    const pg = pageOf("leads", state.leads);
    body = state.leads.length
      ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Name</th><th>Contact</th><th>Note / build</th></tr></thead><tbody>
        ${pg.slice
          .map(
            (l) => `<tr>
              <td>${(l.createdAt || "").slice(0, 16).replace("T", " ")}</td>
              <td>${l.name}<div class="faint">${l.source || ""}</div></td>
              <td>${l.phone || ""} ${l.email || ""}</td>
              <td>${l.note || ""}${l.build ? `<div class="faint">${(l.build.parts || []).map((p) => p.name).join(", ")} · ₹${Number(l.build.total || 0).toLocaleString("en-IN")}</div>` : ""}</td>
            </tr>`
          )
          .join("")}
      </tbody></table></div>${pagerHtml("leads", pg)}`
      : `<p class="muted">No callbacks yet.</p>`;
  } else if (state.tab === "orders") {
    const pg = pageOf("orders", state.orders);
    body = state.orders.length
      ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Name / ship</th><th>Pay</th><th>Status</th><th>Total</th><th>Items</th></tr></thead><tbody>
        ${pg.slice
          .map((o) => {
            const statuses = ["pending", "paid", "cod", "packed", "shipped", "delivered", "cancelled"];
            return `<tr>
              <td>${(o.createdAt || "").slice(0, 16).replace("T", " ")}</td>
              <td>${o.name || ""}<div class="faint">${o.email || ""}</div><div class="faint">${o.phone || ""}</div><div class="faint">${o.address || ""}</div></td>
              <td>${o.method === "cod" ? "COD" : "Online"}</td>
              <td>
                <span class="st-box st-${o.status || "pending"}">${
                  ({ pending: "Awaiting payment", paid: "Paid", cod: "COD", packed: "Packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" }[o.status] || o.status)
                }</span>
                <select class="status-sel" data-order-status="${o.id}">
                  ${statuses.map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
                <input class="track-in" data-order-track="${o.id}" value="${o.tracking || ""}" placeholder="Tracking">
              </td>
              <td>₹${Number(o.total).toLocaleString("en-IN")}</td>
              <td>${(o.lines || []).map((l) => `${l.qty}× ${l.name}`).join(", ")}</td>
            </tr>`;
          })
          .join("")}
      </tbody></table></div>${pagerHtml("orders", pg)}`
      : `<p class="muted">No orders yet.</p>`;
  } else {
    const s = state.settings;
    body = `
      <form class="form" id="settings-form">
        <div class="two-col">
          <label class="field"><span>Phone display</span><input name="phone" value="${s.phone || ""}"></label>
          <label class="field"><span>Phone tel link</span><input name="phoneHref" value="${s.phoneHref || ""}"></label>
          <label class="field"><span>WhatsApp digits</span><input name="whatsapp" value="${s.whatsapp || ""}"></label>
          <label class="field"><span>Email</span><input name="email" value="${s.email || ""}"></label>
          <label class="field"><span>Hours</span><input name="hours" value="${s.hours || ""}"></label>
          <label class="field"><span>Address</span><input name="address" value="${s.address || ""}"></label>
          <label class="field"><span>Shipping fee ₹</span><input name="shipFee" type="number" min="0" step="1" value="${s.shipFee ?? 999}"></label>
          <label class="field"><span>COD extra fee ₹</span><input name="codFee" type="number" min="0" step="1" value="${s.codFee ?? 500}"></label>
        </div>
        <label class="field"><span>Shop blurb</span><textarea name="blurb">${s.blurb || ""}</textarea></label>
        <button class="btn btn-accent" type="submit">Save settings</button>
      </form>
      <form class="form" id="password-form">
        <p class="kicker">Security</p>
        <h2 class="admin-sub">Owner password</h2>
        <p class="muted">At least 8 characters. You stay signed in after you change it.</p>
        <label class="field">
          <span>Current password</span>
          <div class="pw-wrap">
            <input name="current" type="password" required autocomplete="current-password">
            <button type="button" class="pw-toggle" data-toggle-pw>Show</button>
          </div>
        </label>
        <div class="two-col">
          <label class="field">
            <span>New password</span>
            <div class="pw-wrap">
              <input name="next" type="password" required minlength="8" autocomplete="new-password">
              <button type="button" class="pw-toggle" data-toggle-pw>Show</button>
            </div>
          </label>
          <label class="field">
            <span>Confirm new password</span>
            <div class="pw-wrap">
              <input name="confirm" type="password" required minlength="8" autocomplete="new-password">
              <button type="button" class="pw-toggle" data-toggle-pw>Show</button>
            </div>
          </label>
        </div>
        <button class="btn btn-line" type="submit">Change password</button>
      </form>`;
  }

  return `
    <div class="admin-shell wrap">
      <header class="admin-bar">
        <div>
          <p class="kicker">TIBGSTORE</p>
          <h1>Admin</h1>
        </div>
        <div class="admin-bar-actions">
          <a class="btn btn-ghost" href="index.html">View site</a>
          <button class="btn btn-line" type="button" id="logout">Log out</button>
        </div>
      </header>
      <nav class="tabs">
        ${tabs.map((t) => `<button type="button" data-tab="${t}" class="${state.tab === t ? "on" : ""}">${t}</button>`).join("")}
      </nav>
      <div class="admin-body-pane">${body}</div>
    ${state.editing && state.editing.kind === "product" ? modalWrap(productForm(state.editing.item)) : ""}
    ${state.editing && state.editing.kind === "post" ? modalWrap(postForm(state.editing.item)) : ""}
    ${state.editing && state.editing.kind === "coupon" ? modalWrap(couponForm(state.editing.item)) : ""}
    </div>`;
}

async function refresh() {
  const [cat, posts, leads, orders, coupons, cfg, imgs] = await Promise.all([
    api("/api/catalog"),
    api("/api/admin/posts"),
    api("/api/admin/leads"),
    api("/api/admin/orders"),
    api("/api/admin/coupons"),
    api("/api/config"),
    api("/api/images"),
  ]);
  state.products = cat.products || [];
  state.posts = posts.posts || [];
  state.leads = leads.leads || [];
  state.orders = orders.orders || [];
  state.coupons = coupons.coupons || [];
  state.settings = cfg.site || {};
  state.images = imgs.images || [];
}

async function uploadFiles(input) {
  if (!input || !input.files || !input.files.length) return [];
  const fd = new FormData();
  [...input.files].forEach((file) => fd.append("files", file));
  const res = await fetch("/api/admin/upload", { method: "POST", credentials: "include", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.urls || (data.url ? [data.url] : []);
}

async function uploadFile(input) {
  const urls = await uploadFiles(input);
  return urls[0] || "";
}

function uniqueImages(list) {
  return [...new Set((list || []).filter(Boolean))];
}

function escAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function readFpsFields() {
  const games = [...document.querySelectorAll("[name='fps-game']")].map((el) => el.value.trim());
  const vals = [...document.querySelectorAll("[name='fps-val']")].map((el) => el.value.trim());
  return games.map((game, i) => ({ game, fps: vals[i] || "" }));
}

function closeEdit() {
  state.editing = null;
  document.body.classList.remove("modal-open");
  paint();
}

let escHandler = null;

function bindModal() {
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  const overlay = $("#admin-modal");
  if (!overlay) {
    document.body.classList.remove("modal-open");
    return;
  }
  document.body.classList.add("modal-open");
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "admin-modal") closeEdit();
  });
  escHandler = (e) => {
    if (e.key === "Escape") closeEdit();
  };
  document.addEventListener("keydown", escHandler);
}

function bindDash() {
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      state.editing = null;
      paint();
    });
  });
  document.querySelectorAll("[data-page-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      const tab = b.dataset.pageTab;
      const to = Number(b.dataset.pageTo);
      if (!tab || Number.isNaN(to) || to < 1) return;
      state.page[tab] = to;
      state.editing = null;
      paint();
    });
  });
  document.querySelectorAll("[data-order-status]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const id = sel.dataset.orderStatus;
      const tracking = document.querySelector(`[data-order-track="${id}"]`)?.value || "";
      try {
        await api(`/api/admin/orders/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status: sel.value, tracking }),
        });
        toast("Order updated");
        await refresh();
        paint();
      } catch (err) {
        toast(err.message);
      }
    });
  });
  document.querySelectorAll("[data-order-track]").forEach((input) => {
    input.addEventListener("change", async () => {
      const id = input.dataset.orderTrack;
      const status = document.querySelector(`[data-order-status="${id}"]`)?.value;
      try {
        await api(`/api/admin/orders/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status, tracking: input.value }),
        });
        toast("Tracking saved");
      } catch (err) {
        toast(err.message);
      }
    });
  });
  $("#logout")?.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    paint();
  });
  $("#new-product")?.addEventListener("click", () => {
    state.editing = { kind: "product", item: null, images: [], fps: [{ game: "", fps: "" }] };
    paint();
  });
  $("#new-post")?.addEventListener("click", () => {
    state.editing = { kind: "post", item: null };
    paint();
  });
  $("#new-coupon")?.addEventListener("click", () => {
    state.editing = { kind: "coupon", item: { code: genCouponCode(), type: "percent", value: 10, active: true } };
    paint();
  });
  $("#regen-code")?.addEventListener("click", (e) => {
    e.preventDefault();
    const input = $("#coupon-form input[name=code]");
    if (input) input.value = genCouponCode();
  });
  document.querySelectorAll("[data-edit-c]").forEach((b) => {
    b.addEventListener("click", () => {
      state.editing = { kind: "coupon", item: state.coupons.find((c) => c.id === b.dataset.editC) };
      paint();
    });
  });
  document.querySelectorAll("[data-del-c]").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Remove this coupon?")) return;
      await api(`/api/admin/coupons/${b.dataset.delC}`, { method: "DELETE" });
      await refresh();
      paint();
    });
  });
  $("#coupon-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      code: fd.get("code"),
      type: fd.get("type"),
      value: Number(fd.get("value")),
      minSub: Number(fd.get("minSub")),
      maxUses: Number(fd.get("maxUses")),
      expires: fd.get("expires") || "",
      note: fd.get("note"),
      active: fd.get("active") === "on",
    };
    const id = e.target.dataset.id;
    if (id) await api(`/api/admin/coupons/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
    state.editing = null;
    if (!id) state.page.coupons = 1;
    await refresh();
    toast("Coupon saved");
    paint();
  });
  $("#cancel-edit")?.addEventListener("click", closeEdit);
  document.querySelectorAll("[data-edit-p]").forEach((b) => {
    b.addEventListener("click", () => {
      const item = state.products.find((p) => p.id === b.dataset.editP);
      const imgs = item ? [...(item.images && item.images.length ? item.images : item.image ? [item.image] : [])] : [];
      const fps = item && item.fps && item.fps.length ? item.fps.map((r) => ({ game: r.game || "", fps: r.fps || "" })) : [{ game: "", fps: "" }];
      state.editing = { kind: "product", item, images: imgs, fps };
      paint();
    });
  });
  document.querySelectorAll("[data-del-p]").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Remove this product from the shop?")) return;
      await api(`/api/admin/products/${b.dataset.delP}`, { method: "DELETE" });
      await refresh();
      paint();
    });
  });
  document.querySelectorAll("[data-edit-b]").forEach((b) => {
    b.addEventListener("click", () => {
      state.editing = { kind: "post", item: state.posts.find((p) => p.id === b.dataset.editB) };
      paint();
    });
  });
  document.querySelectorAll("[data-del-b]").forEach((b) => {
    b.addEventListener("click", async () => {
      if (!confirm("Remove this post?")) return;
      await api(`/api/admin/posts/${b.dataset.delB}`, { method: "DELETE" });
      await refresh();
      paint();
    });
  });

  $("#product-files")?.addEventListener("change", async (e) => {
    try {
      const urls = await uploadFiles(e.target);
      state.editing.fps = readFpsFields();
      state.editing.images = uniqueImages([...(state.editing.images || []), ...urls]);
      toast(urls.length > 1 ? `${urls.length} photos added` : "Photo added");
      paint();
    } catch (err) {
      toast(err.message);
    }
  });
  document.querySelectorAll("[data-drop-img]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      state.editing.fps = readFpsFields();
      state.editing.images = (state.editing.images || []).filter((src) => src !== b.dataset.dropImg);
      paint();
    });
  });
  document.querySelectorAll("[data-cover-img]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      state.editing.fps = readFpsFields();
      const src = b.dataset.coverImg;
      state.editing.images = uniqueImages([src, ...(state.editing.images || [])]);
      paint();
    });
  });
  $("#add-fps")?.addEventListener("click", (e) => {
    e.preventDefault();
    state.editing.fps = [...readFpsFields(), { game: "", fps: "" }];
    paint();
  });
  document.querySelectorAll("[data-drop-fps]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      const rows = readFpsFields();
      rows.splice(Number(b.dataset.dropFps), 1);
      state.editing.fps = rows.length ? rows : [{ game: "", fps: "" }];
      paint();
    });
  });
  const library = $("#product-form select[name=image]");
  library?.addEventListener("change", () => {
    const src = library.value;
    if (!src) return;
    state.editing.images = uniqueImages([...(state.editing.images || []), src]);
    library.value = "";
    paint();
  });

  $("#product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pending = $("#product-files");
    const uploaded = pending && pending.files && pending.files.length ? await uploadFiles(pending) : [];
    const group = String(fd.get("group") || "");
    const type = fd.get("type");
    const gallery = uniqueImages([...(state.editing.images || []), ...uploaded, fd.get("image")]);
    const payload = {
      name: fd.get("name"),
      price: Number(fd.get("price")),
      type,
      tagline: fd.get("tagline"),
      description: fd.get("description"),
      badge: fd.get("badge"),
      stock: Number(fd.get("stock")),
      specs: parseSpecs(fd.get("specs")),
      image: gallery[0] || "assets/images/part-gpu.jpg",
      fps: readFpsFields().filter((r) => r.game && r.fps),
    };
    payload.images = gallery.length ? gallery : [payload.image];
    if (type === "build") payload.tier = group || "mid";
    else if (type === "part") payload.category = group || "gpu";
    const id = e.target.dataset.id;
    if (id) await api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
    state.editing = null;
    if (!id) state.page.products = 1;
    await refresh();
    toast("Product saved");
    paint();
  });

  $("#post-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const uploaded = await uploadFile($("#post-file"));
    const payload = {
      title: fd.get("title"),
      excerpt: fd.get("excerpt"),
      body: fd.get("body"),
      cover: uploaded || fd.get("cover") || "assets/images/workshop.jpg",
      published: fd.get("published") === "on",
    };
    const id = e.target.dataset.id;
    if (id) await api(`/api/admin/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/posts", { method: "POST", body: JSON.stringify(payload) });
    state.editing = null;
    if (!id) state.page.blog = 1;
    await refresh();
    toast("Post saved");
    paint();
  });

  $("#settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    await refresh();
    toast("Settings saved");
    paint();
  });

  $("#password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/api/admin/password", {
        method: "PUT",
        body: JSON.stringify({
          current: fd.get("current"),
          next: fd.get("next"),
          confirm: fd.get("confirm"),
        }),
      });
      e.target.reset();
      toast("Password updated");
    } catch (err) {
      toast(err.message);
    }
  });
  bindPwToggle();
}

async function paint() {
  const root = $("#admin-root");
  const me = await api("/api/admin/me");
  if (!me.ok) {
    document.body.classList.add("admin-locked");
    root.innerHTML = loginView();
    bindPwToggle(root);
    $("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ password: new FormData(e.target).get("password") }),
        });
        document.body.classList.remove("admin-locked");
        await refresh();
        paint();
      } catch (err) {
        toast(err.message);
      }
    });
    return;
  }
  document.body.classList.remove("admin-locked");
  if (!state.products.length) await refresh();
  root.innerHTML = dashboard();
  bindDash();
  bindModal();
}

document.addEventListener("DOMContentLoaded", paint);
