(() => {
  const TOKEN_KEY = "km-admin-token";
  const root = document.getElementById("admin-app");
  const token = () => sessionStorage.getItem(TOKEN_KEY) || "";

  const state = {
    tab: "orders",
    filter: "active",
    query: "",
    selected: null,
    orders: [],
    messages: [],
    photos: [],
    dishes: [],
    accounts: [],
    smtp: { ready: false },
    google: { ready: false },
    editing: null,
    editingDish: null,
    menuQuery: "",
    error: "",
  };

  const tabTitle = { orders: "Orders", menu: "Menu", loyalty: "Loyalty", messages: "Inbox" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const catName = (id) => (KM.categories.find((c) => c.id === id) || {}).name || id;

  const catOptions = (selected) => KM.categories.map((c) =>
    `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`
  ).join("");

  const filters = [
    { id: "active", label: "Live kitchen" },
    { id: "all", label: "All" },
    { id: "placed", label: "New" },
    { id: "preparing", label: "Cooking" },
    { id: "out", label: "Out" },
    { id: "delivered", label: "Done" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const done = new Set(["delivered", "collected", "cancelled"]);

  const when = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  };

  const toast = (msg) => {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  };

  const loginView = () => `
    <div class="admin-login">
      <div class="order-card admin-login-card">
        <img src="assets/brand/logo.jpg" alt="" class="admin-crest" />
        <div class="eyebrow">Staff only</div>
        <h1>Admin desk</h1>
        <p class="muted">See every delivery and pickup ticket from the Hazratganj kitchen.</p>
        <form class="form" id="admin-login">
          <label>Username<input name="user" autocomplete="username" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="btn btn-maroon" type="submit">Sign in</button>
        </form>
        <a class="btn btn-google" href="/api/auth/google?next=/admin.html">Continue with Google</a>
        <a class="btn btn-ghost" href="index.html">Back to the café</a>
      </div>
    </div>`;

  const stats = () => {
    const orders = state.orders;
    const live = orders.filter((o) => !done.has(o.status));
    const today = new Date().toDateString();
    const todays = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
    const sales = todays.reduce((n, o) => n + (o.totals?.grand || 0), 0);
    const unread = state.messages.filter((m) => !m.read).length;
    return [
      { k: "Live tickets", v: live.length },
      { k: "Today’s orders", v: todays.length },
      { k: "Today’s sales", v: KM.inr(sales) },
      { k: "Messages", v: unread },
      { k: "Menu", v: state.dishes.length },
    ];
  };

  const filtered = () => {
    const q = state.query.trim().toLowerCase();
    return state.orders.filter((o) => {
      if (state.filter === "active" && done.has(o.status)) return false;
      if (!["all", "active"].includes(state.filter) && o.status !== state.filter) return false;
      if (!q) return true;
      return `${o.id} ${o.name} ${o.phone} ${o.zoneName} ${o.address}`.toLowerCase().includes(q);
    });
  };

  const paintDesk = () => {
    const list = filtered();
    const sel = state.orders.find((o) => o.id === state.selected) || list[0] || null;
    root.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-side">
          <a class="brand admin-brand" href="index.html">
            <img src="assets/brand/logo.jpg" alt="" />
            <div class="brand-name">Kunafa Mahal<small>Admin desk</small></div>
          </a>
          <nav>
            <button class="${state.tab === "orders" ? "active" : ""}" data-tab="orders">Orders</button>
            <button class="${state.tab === "menu" ? "active" : ""}" data-tab="menu">Menu</button>
            <button class="${state.tab === "loyalty" ? "active" : ""}" data-tab="loyalty">Loyalty</button>
            <button class="${state.tab === "messages" ? "active" : ""}" data-tab="messages">Messages</button>
          </nav>
          <button class="btn btn-outline admin-out" id="admin-out">Sign out</button>
        </aside>
        <main class="admin-main">
          <header class="admin-top">
            <div>
              <div class="eyebrow">Hazratganj kitchen</div>
              <h1>${tabTitle[state.tab] || "Desk"}</h1>
            </div>
            <button class="btn btn-outline-dark btn-sm" id="admin-refresh">Refresh</button>
          </header>
          ${state.error ? `<p class="notice">${state.error}</p>` : ""}
          <div class="admin-stats">
            ${stats().map((s) => `<article class="stat"><b>${s.v}</b><div>${s.k}</div></article>`).join("")}
          </div>
          ${
            state.tab === "orders" ? ordersPane(list, sel)
            : state.tab === "menu" ? menuPane()
            : state.tab === "loyalty" ? loyaltyPane()
            : messagesPane()
          }
        </main>
      </div>`;
    bindDesk();
  };

  const ordersPane = (list, sel) => `
    <div class="admin-toolbar">
      <div class="chips">
        ${filters.map((f) => `<button class="chip ${state.filter === f.id ? "active" : ""}" data-filter="${f.id}">${f.label}</button>`).join("")}
      </div>
      <input class="search" id="admin-search" value="${state.query}" placeholder="Search name, phone, order ID" />
    </div>
    <div class="admin-split">
      <div class="admin-list">
        ${list.length ? list.map((o) => `
          <button class="admin-row ${sel && sel.id === o.id ? "on" : ""}" data-open="${o.id}">
            <strong>${o.id}</strong>
            <span>${o.name} · ${o.phone}</span>
            <span>${o.type} · ${KM.stepLabel[o.status] || o.status}</span>
            <b>${KM.inr(o.totals?.grand || 0)}</b>
          </button>`).join("") : `<p class="empty">No tickets in this view.</p>`}
      </div>
      <div class="order-card admin-detail">
        ${sel ? detail(sel) : `<p class="muted">Select an order to cook or dispatch it.</p>`}
      </div>
    </div>`;

  const detail = (o) => `
    <div class="eyebrow">${when(o.createdAt)}</div>
    <h2>${o.id}</h2>
    <p><strong>${o.name}</strong> · <a href="tel:${o.phone}">${o.phone}</a>${o.email ? `<br>${o.email}` : ""}</p>
    <p>${o.type === "delivery" ? `${o.address || ""}<br>${o.zoneName}` : "Café pickup · Hazratganj"}</p>
    <p><strong>${KM.inr(o.totals?.grand || 0)}</strong></p>
    ${o.notes ? `<p class="notice">${o.notes}</p>` : ""}
    <h3>Thaal</h3>
    ${(o.items || []).map((i) => `<div class="totals"><div><span>${i.qty} × ${i.name}</span><span>${KM.inr(i.line)}</span></div></div>`).join("")}
    <div class="totals" style="margin-top:10px">
      <div><span>Subtotal</span><span>${KM.inr(o.totals?.subtotal)}</span></div>
      <div><span>Packaging</span><span>${KM.inr(o.totals?.packaging)}</span></div>
      <div><span>Delivery</span><span>${KM.inr(o.totals?.delivery)}</span></div>
      <div><span>GST</span><span>${KM.inr(o.totals?.gst)}</span></div>
      ${o.totals?.discount ? `<div><span>${o.totals.promoLabel || "Offer"}</span><span>−${KM.inr(o.totals.discount)}</span></div>` : ""}
      ${o.loyalty?.rupees ? `<div><span>Loyalty (${o.loyalty.used} pts)</span><span>−${KM.inr(o.loyalty.rupees)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${KM.inr(o.totals?.grand)}</span></div>
    </div>
    ${o.status === "delivered" || o.status === "collected"
      ? `<p class="notice" style="margin-top:14px">Delivered — this ticket is closed.</p>`
      : `<h3>Advance ticket</h3>
    <div class="hero-actions admin-steps">
      ${KM.steps(o.type).concat(["cancelled"]).map((s) =>
        `<button class="btn btn-sm ${s === o.status ? "btn-maroon" : "btn-outline-dark"}" data-adv="${o.id}" data-s="${s}">${KM.stepLabel[s] || "Cancelled"}</button>`
      ).join("")}
    </div>
    <p class="muted" style="margin-top:12px">Customer can track this ID on the website.</p>`}
    ${o.loyalty ? `<p class="notice" style="margin-top:12px">Loyalty: +${o.loyalty.earned} pts${o.loyalty.used ? `, used ${o.loyalty.used} pts (${KM.inr(o.loyalty.rupees)})` : ""}. Balance ${o.loyalty.balance} pts.</p>` : ""}`;

  const loyaltyPane = () => `
    <p class="muted">${KM.loyalty.perOrder} points on every delivery or pickup · ${KM.loyalty.perOrder} points = ${KM.inr(KM.loyalty.rupeesPer100)}.</p>
    <div class="admin-list">
      ${state.accounts.length ? state.accounts.map((a) => `
        <article class="admin-row">
          <strong>${esc(a.name || "Guest")} · ${esc(a.phone)}</strong>
          <span>${a.points} points</span>
          <b>${KM.inr(a.rupees)}</b>
        </article>`).join("") : `<p class="empty">No loyalty accounts yet. Points are added when a guest places an order.</p>`}
    </div>`;

  const menuPane = () => {
    const q = state.menuQuery.trim().toLowerCase();
    const dishes = state.dishes.filter((d) =>
      !q || `${d.name} ${d.desc} ${d.cat} ${d.price}`.toLowerCase().includes(q)
    );
    return `
    <form class="order-card admin-photo-add" id="dish-add">
      <h3>Add to the menu</h3>
      <div class="row-2">
        <label>Dish name<input name="name" required placeholder="Pista Silk Kunafa" /></label>
        <label>Price (₹)<input name="price" type="number" min="1" max="20000" step="1" required placeholder="299" /></label>
      </div>
      <div class="row-2">
        <label>Category<select name="cat">${catOptions("specials")}</select></label>
        <label>Photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      </div>
      <label>Description<textarea name="desc" placeholder="What is in this kunafa?"></textarea></label>
      <div class="row-2">
        <label>Tag<input name="tag" placeholder="New, Seasonal…" /></label>
        <label class="admin-check"><input type="checkbox" name="popular" /> Show as popular</label>
      </div>
      <button class="btn btn-maroon" type="submit">Add dish</button>
      <p class="muted">It appears on the public menu with this price and photo.</p>
    </form>
    <div class="admin-toolbar">
      <input class="search" id="menu-search" value="${esc(state.menuQuery)}" placeholder="Search dishes" />
    </div>
    <div class="admin-dishes">
      ${dishes.length ? dishes.map((d) => `
        <article class="admin-dish">
          <img src="${esc(d.img)}" alt="" />
          ${state.editingDish === d.id ? `
            <form class="admin-photo-edit" data-dish-edit-form="${esc(d.id)}">
              <input name="name" value="${esc(d.name)}" required />
              <input name="price" type="number" min="1" max="20000" step="1" value="${Number(d.price) || 0}" required />
              <select name="cat">${catOptions(d.cat)}</select>
              <textarea name="desc">${esc(d.desc)}</textarea>
              <input name="tag" value="${esc(d.tag)}" placeholder="Tag" />
              <label class="admin-check"><input type="checkbox" name="popular" ${d.popular ? "checked" : ""} /> Popular</label>
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              <div class="hero-actions">
                <button class="btn btn-maroon btn-sm" type="submit">Save</button>
                <button class="btn btn-outline-dark btn-sm" type="button" data-cancel-dish>Cancel</button>
              </div>
            </form>` : `
            <div class="admin-dish-body">
              <strong>${esc(d.name)}</strong>
              <span class="price">${KM.inr(d.price)}</span>
              <span class="muted">${esc(catName(d.cat))}${d.tag ? " · " + esc(d.tag) : ""}</span>
              <p>${esc(d.desc)}</p>
              <div class="hero-actions">
                <button class="btn btn-outline-dark btn-sm" data-dish-edit="${esc(d.id)}">Edit</button>
                <button class="btn btn-outline-dark btn-sm" data-dish-del="${esc(d.id)}">Delete</button>
              </div>
            </div>`}
        </article>`).join("") : `<p class="empty">No dishes match that search.</p>`}
    </div>`;
  };

  const photosPane = () => `
    <form class="order-card admin-photo-add" id="photo-add">
      <h3>Add a kunafa photo</h3>
      <div class="row-2">
        <label>Name<input name="caption" required placeholder="Royal Nabulsi Kunafa" /></label>
        <label>Photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
      </div>
      <button class="btn btn-maroon" type="submit">Upload photo</button>
      <p class="muted">JPG, PNG or WebP · under 8 MB. It appears on the public gallery.</p>
    </form>
    <div class="admin-photos">
      ${state.photos.length ? state.photos.map((p) => `
        <article class="admin-photo" data-photo="${p.id}">
          <img src="${p.src}" alt="${p.cap || ""}" />
          ${state.editing === p.id ? `
            <form class="admin-photo-edit" data-edit-form="${p.id}">
              <input name="caption" value="${(p.cap || "").replace(/"/g, "&quot;")}" required />
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              <div class="hero-actions">
                <button class="btn btn-maroon btn-sm" type="submit">Save</button>
                <button class="btn btn-outline-dark btn-sm" type="button" data-cancel-edit>Cancel</button>
              </div>
            </form>` : `
            <figcaption>${p.cap || "Untitled"}</figcaption>
            <div class="hero-actions">
              <button class="btn btn-outline-dark btn-sm" data-edit="${p.id}">Edit</button>
              <button class="btn btn-outline-dark btn-sm" data-del="${p.id}">Delete</button>
            </div>`}
        </article>`).join("") : `<p class="empty">No kunafa photos yet. Upload the first plate.</p>`}
    </div>`;

  const messagesPane = () => `
    <div class="admin-msgs">
      ${state.messages.length ? state.messages.map((m) => `
        <article class="order-card">
          <strong>${m.name}</strong> · ${m.reach}
          <div class="muted">${when(m.createdAt)}</div>
          <p>${m.msg}</p>
        </article>`).join("") : `<p class="empty">No guest messages yet.</p>`}
    </div>`;

  const bindDesk = () => {
    document.getElementById("admin-out")?.addEventListener("click", async () => {
      try { await KM.api.post("/api/admin/logout", {}, token()); } catch { /* ignore */ }
      sessionStorage.removeItem(TOKEN_KEY);
      render();
    });
    document.getElementById("admin-refresh")?.addEventListener("click", () => load());
    root.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => { state.tab = btn.dataset.tab; paintDesk(); });
    });
    root.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => { state.filter = btn.dataset.filter; paintDesk(); });
    });
    document.getElementById("admin-search")?.addEventListener("input", (e) => {
      state.query = e.target.value;
      paintDesk();
      const box = document.getElementById("admin-search");
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    });
    root.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => { state.selected = btn.dataset.open; paintDesk(); });
    });
    root.querySelectorAll("[data-adv]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const data = await KM.api.patch("/api/orders/" + btn.dataset.adv, { status: btn.dataset.s }, token());
          const idx = state.orders.findIndex((o) => o.id === data.order.id);
          if (idx >= 0) state.orders[idx] = data.order;
          toast("Ticket updated");
          paintDesk();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    document.getElementById("photo-add")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const file = form.image.files[0];
      if (!file) { toast("Choose a photo"); return; }
      const fd = new FormData();
      fd.append("caption", form.caption.value.trim());
      fd.append("image", file, file.name);
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        await KM.api.form("/api/gallery", fd, token(), "POST");
        form.reset();
        toast("Photo added");
        await load();
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    root.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editing = btn.dataset.edit;
        paintDesk();
      });
    });
    root.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editing = null;
        paintDesk();
      });
    });
    root.querySelectorAll("[data-edit-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = form.dataset.editForm;
        const fd = new FormData();
        fd.append("caption", form.caption.value.trim());
        if (form.image.files[0]) {
          fd.append("image", form.image.files[0], form.image.files[0].name);
        }
        try {
          await KM.api.form("/api/gallery/" + id, fd, token(), "PATCH");
          state.editing = null;
          toast("Photo updated");
          await load();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this kunafa photo from the gallery?")) return;
        try {
          await KM.api.del("/api/gallery/" + btn.dataset.del, token());
          if (state.editing === btn.dataset.del) state.editing = null;
          toast("Photo deleted");
          await load();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    document.getElementById("menu-search")?.addEventListener("input", (e) => {
      state.menuQuery = e.target.value;
      paintDesk();
      const box = document.getElementById("menu-search");
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    });
    document.getElementById("dish-add")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const fd = new FormData();
      fd.append("name", form.name.value.trim());
      fd.append("price", form.price.value);
      fd.append("cat", form.cat.value);
      fd.append("desc", form.desc.value.trim());
      fd.append("tag", form.tag.value.trim());
      fd.append("popular", form.popular.checked ? "1" : "0");
      if (form.image.files[0]) fd.append("image", form.image.files[0], form.image.files[0].name);
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        await KM.api.form("/api/menu", fd, token(), "POST");
        form.reset();
        toast("Dish added to the menu");
        await load();
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    root.querySelectorAll("[data-dish-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingDish = btn.dataset.dishEdit;
        paintDesk();
      });
    });
    root.querySelectorAll("[data-cancel-dish]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingDish = null;
        paintDesk();
      });
    });
    root.querySelectorAll("[data-dish-edit-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = form.dataset.dishEditForm;
        const fd = new FormData();
        fd.append("name", form.name.value.trim());
        fd.append("price", form.price.value);
        fd.append("cat", form.cat.value);
        fd.append("desc", form.desc.value.trim());
        fd.append("tag", form.tag.value.trim());
        fd.append("popular", form.popular.checked ? "1" : "0");
        if (form.image.files[0]) fd.append("image", form.image.files[0], form.image.files[0].name);
        try {
          await KM.api.form("/api/menu/" + encodeURIComponent(id), fd, token(), "PATCH");
          state.editingDish = null;
          toast("Dish updated");
          await load();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelectorAll("[data-dish-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this dish from the public menu?")) return;
        try {
          await KM.api.del("/api/menu/" + encodeURIComponent(btn.dataset.dishDel), token());
          if (state.editingDish === btn.dataset.dishDel) state.editingDish = null;
          toast("Dish removed");
          await load();
        } catch (err) {
          toast(err.message);
        }
      });
    });
  };

  const load = async () => {
    state.error = "";
    try {
      const [orders, messages, menu, loyalty, smtp] = await Promise.all([
        KM.api.get("/api/orders", token()),
        KM.api.get("/api/messages", token()),
        KM.api.get("/api/menu"),
        KM.api.get("/api/loyalty", token()),
        KM.api.get("/api/smtp-status", token()),
      ]);
      state.orders = orders.orders || [];
      state.messages = messages.messages || [];
      state.dishes = menu.items || [];
      state.accounts = loyalty.accounts || [];
      state.smtp = smtp || { ready: false };
      state.google = smtp.google || {};
    } catch (err) {
      state.error = err.message || "Could not load the desk. Start the café server.";
      if (String(err.message).includes("Sign in")) {
        sessionStorage.removeItem(TOKEN_KEY);
        return render();
      }
    }
    paintDesk();
  };

  const render = async () => {
    if (!token()) {
      try {
        const me = await fetch("/api/me", { credentials: "include", cache: "no-store" }).then((r) => r.json());
        if (me.admin) {
          root.innerHTML = `<div class="admin-login"><p class="muted">Loading the kitchen…</p></div>`;
          load();
          return;
        }
      } catch { /* show password form */ }
      root.innerHTML = loginView();
      document.getElementById("admin-login").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = e.target;
        try {
          const data = await KM.api.post("/api/admin/login", {
            user: fd.user.value.trim(),
            password: fd.password.value,
          });
          sessionStorage.setItem(TOKEN_KEY, data.token);
          load();
        } catch (err) {
          toast(err.message || "Sign-in failed");
        }
      });
      return;
    }
    root.innerHTML = `<div class="admin-login"><p class="muted">Loading the kitchen…</p></div>`;
    load();
  };

  render();
})();
