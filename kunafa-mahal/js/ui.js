window.KM = window.KM || {};

KM.icons = {
  cart: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>',
  menu: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  wa: '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.88c0 2.1.55 4.14 1.6 5.95L0 24l6.34-1.66a11.9 11.9 0 0 0 5.7 1.45h.01c6.54 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.16-3.41-8.43zM12.05 21.6h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.99 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.27c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.89 9.89zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.56-.35z"/></svg>',
};

KM.renderHeader = () => {
  const page = document.body.dataset.page;
  const nav = [
    ["index.html", "Home", "home"],
    ["menu.html", "Menu", "menu"],
    ...(KM.auth?.user ? [["orders.html", "Orders", "orders"]] : []),
    ["about.html", "Our Story", "about"],
    ["contact.html", "Visit", "contact"],
  ];
  return `
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="index.html">
          <img src="assets/brand/logo.jpg" alt="Kunafa Mahal crest" />
          <div>
            <div class="brand-name">Kunafa Mahal<small>Hazratganj · Lucknow</small></div>
          </div>
        </a>
        <nav class="nav" id="site-nav">
          ${nav.map(([href, label, key]) =>
            `<a href="${href}" class="${page === key ? "active" : ""}">${label}</a>`
          ).join("")}
          <a class="nav-cta" href="menu.html">Order now</a>
          ${KM.auth?.user ? `<button class="nav-signout" type="button" data-signout>Sign out</button>` : ""}
        </nav>
        <div class="header-actions">
          ${KM.authButton()}
          <button class="icon-btn" id="open-cart" aria-label="Open cart">${KM.icons.cart}<span class="cart-count" data-n="0"></span></button>
          <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menu">${KM.icons.menu}</button>
        </div>
      </div>
    </header>`;
};

KM.renderFooter = () => {
  const b = KM.brand;
  return `
    <footer class="site-footer">
      <div class="wrap footer-top">
        <div class="footer-brand">
          <a class="footer-crest" href="index.html">
            <img src="assets/brand/logo.jpg" alt="Kunafa Mahal crest" />
            <span>
              <strong>Kunafa Mahal</strong>
              <small>Hazratganj · Lucknow</small>
            </span>
          </a>
          <p>Pure vegetarian kunafa café. Fresh pours, tubs and qahwa from Shop 4, New Market.</p>
          <p class="footer-meta">FSSAI ${b.fssai}</p>
          <div class="footer-cta">
            <a class="btn btn-cream btn-sm" href="tel:${b.phone}">${b.phoneDisplay}</a>
            <a class="btn btn-outline btn-sm" href="${b.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>
        <nav class="footer-cols" aria-label="Footer">
          <div>
            <h3>Visit</h3>
            <p>${b.address}<br>${b.area}, ${b.city} ${b.pincode}</p>
            <p>${b.hours}<br>${b.hoursNote}</p>
          </div>
          <div class="footer-links">
            <h3>Order</h3>
            <a href="menu.html">Delivery menu</a>
            <a href="menu.html">Café pickup</a>
            <a href="track.html">Track an order</a>
            <a href="contact.html">Visit the café</a>
          </div>
          <div class="footer-links">
            <h3>Talk</h3>
            <a href="tel:${b.phone}">Call the desk</a>
            <a href="${b.whatsapp}" target="_blank" rel="noopener">WhatsApp kitchen</a>
            <a href="${b.maps}" target="_blank" rel="noopener">Google Maps</a>
          </div>
        </nav>
      </div>
      <div class="wrap footer-legal">
        <span>© ${new Date().getFullYear()} Kunafa Mahal · Hazratganj</span>
        <span>Hazratganj · Lucknow</span>
      </div>
    </footer>
    <a class="wa-float" href="${b.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${KM.icons.wa}</a>
    <div class="drawer-bg" id="drawer-bg"></div>
    <aside class="drawer" id="cart-drawer" aria-label="Cart">
      <div class="drawer-head">
        <strong>Your thaal</strong>
        <button class="icon-btn" id="close-cart" aria-label="Close">${KM.icons.close}</button>
      </div>
      <div class="drawer-body" id="cart-lines"></div>
      <div class="drawer-foot" id="cart-foot"></div>
    </aside>`;
};

KM.auth = { user: null, google: {} };

KM.loadAuth = async () => {
  try {
    const data = await fetch("/api/me", { credentials: "include", cache: "no-store" }).then((r) => r.json());
    KM.auth.user = data.signedIn ? data : null;
    KM.auth.google = data.google || {};
  } catch {
    KM.auth.user = null;
  }
};

KM.authButton = () => {
  const u = KM.auth.user;
  if (u) {
    const pts = u.loyalty?.points || 0;
    const rs = u.loyalty?.rupees || 0;
    return `<div class="google-user">
      <a class="loyalty-chip ${document.body.dataset.page === "orders" ? "on" : ""}" href="orders.html" title="Your orders and loyalty">
        ${KM.inr(rs || pts)} · ${KM.loyalty.percent}%
      </a>
      ${u.picture ? `<img src="${u.picture}" alt="" />` : ""}
      <span class="user-name">${u.name || u.email}</span>
      <button class="btn btn-outline btn-sm header-signout" id="google-out" type="button">Sign out</button>
    </div>`;
  }
  const next = location.pathname.split("/").pop() || "index.html";
  return `<a class="btn btn-google" href="/api/auth/google?next=/${next}">
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l.1.1 6.3 5.3C36.9 41.4 44 36 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
    Google
  </a>`;
};

KM.dishCard = (item) => `
  <article class="dish" data-id="${item.id}">
    <div class="dish-media">
      ${item.tag ? `<span class="pill">${item.tag}</span>` : item.popular ? `<span class="pill">Popular</span>` : ""}
      <img src="${item.img}" alt="${item.name}" />
    </div>
    <div class="dish-body">
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <div class="dish-foot">
        <span class="price">${KM.inr(item.price)}</span>
        <button class="btn btn-maroon btn-sm" data-add="${item.id}">Add</button>
      </div>
    </div>
  </article>`;

KM.renderCart = () => {
  const box = document.getElementById("cart-lines");
  const foot = document.getElementById("cart-foot");
  const badge = document.querySelector(".cart-count");
  if (!box || !foot) return;
  const lines = KM.cart.lines();
  const n = KM.cart.count();
  if (badge) {
    badge.dataset.n = n;
    badge.textContent = n || "";
  }
  if (!lines.length) {
    box.innerHTML = `<div class="empty">Your thaal is empty.<br><a class="btn btn-maroon" href="menu.html" style="margin-top:16px">Browse the menu</a></div>`;
    foot.innerHTML = "";
    return;
  }
  box.innerHTML = lines.map((i) => `
    <div class="line">
      <img src="${i.img}" alt="" />
      <div>
        <h4>${i.name}</h4>
        <div class="price">${KM.inr(i.price)}</div>
        <div class="qty-ctrl">
          <button data-qty="${i.id}" data-d="-1">−</button>
          <span>${i.qty}</span>
          <button data-qty="${i.id}" data-d="1">+</button>
        </div>
      </div>
      <strong>${KM.inr(i.line)}</strong>
    </div>`).join("");
  const t = KM.totals();
  foot.innerHTML = `
    <div class="totals" style="margin-bottom:12px">
      <div><span>Subtotal</span><span>${KM.inr(t.subtotal)}</span></div>
    </div>
    <a class="btn btn-maroon btn-block" href="checkout.html">Checkout</a>
    <a class="btn btn-ghost btn-block" href="cart.html">Review cart</a>`;
};

KM.bindChrome = () => {
  const nav = document.getElementById("site-nav");
  document.getElementById("menu-toggle")?.addEventListener("click", () => nav?.classList.toggle("open"));
  const open = () => {
    document.getElementById("cart-drawer")?.classList.add("open");
    document.getElementById("drawer-bg")?.classList.add("open");
  };
  const close = () => {
    document.getElementById("cart-drawer")?.classList.remove("open");
    document.getElementById("drawer-bg")?.classList.remove("open");
  };
  document.getElementById("open-cart")?.addEventListener("click", open);
  document.getElementById("close-cart")?.addEventListener("click", close);
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    location.reload();
  };
  document.getElementById("google-out")?.addEventListener("click", signOut);
  document.querySelector("[data-signout]")?.addEventListener("click", signOut);
  document.getElementById("drawer-bg")?.addEventListener("click", close);

  document.body.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) KM.cart.add(add.dataset.add);
    const q = e.target.closest("[data-qty]");
    if (q) {
      const row = KM.cart.read().find((i) => i.id === q.dataset.qty);
      KM.cart.set(q.dataset.qty, (row?.qty || 0) + Number(q.dataset.d));
    }
  });
  document.addEventListener("km:cart", KM.renderCart);
  KM.renderCart();
};

KM.mount = () => {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  if (header) header.outerHTML = KM.renderHeader();
  if (footer) footer.outerHTML = KM.renderFooter();
  KM.bindChrome();
};
