const I = {
  menu: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>',
  heart: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.5-8.2C.8 9 2.2 5.5 6 5.5c2 0 3.4 1.2 4 2.2.6-1 2-2.2 4-2.2 3.8 0 5.2 3.5 3.5 6.3C19 15.6 12 20 12 20z"/></svg>',
  bag: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V7a3 3 0 016 0v1"/></svg>',
  minus: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>',
  lock: '<svg class="icon" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
};

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

  refreshChrome() {
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      const n = Store.cartCount();
      el.hidden = n === 0;
      el.textContent = n;
    });
    document.querySelectorAll("[data-wish-count]").forEach((el) => {
      const n = Store.wishlist.length;
      el.hidden = n === 0;
      el.textContent = n;
    });
    const body = document.getElementById("cart-drawer-body");
    if (body) body.innerHTML = this.cartDrawerHtml();
    const sub = document.getElementById("cart-drawer-sub");
    if (sub) sub.textContent = money(Store.subtotal());
    const foot = document.getElementById("cart-drawer-foot");
    if (foot) foot.hidden = Store.cartItems().length === 0;
  },

  productCard(p) {
    const saved = Store.wishlist.includes(p.id);
    const sold = p.stock <= 0;
    return `
      <article class="card">
        <div class="card-media">
          <a href="${Store.href("product.html?slug=" + encodeURIComponent(p.slug))}">
            <img src="${Store.img(p.image)}" alt="${p.name}">
          </a>
          ${p.compareAt && !sold ? '<span class="tag">Sale</span>' : ""}
          ${sold ? '<span class="tag out">Sold out</span>' : ""}
          <button class="wish ${saved ? "on" : ""}" data-wish="${p.id}" aria-label="Wishlist">${I.heart}</button>
          <button class="add-hover" data-add="${p.id}" ${sold ? "disabled" : ""}>${sold ? "Sold out" : "Add to bag"}</button>
        </div>
        <div class="card-meta">
          <div>
            <h3><a href="${Store.href("product.html?slug=" + encodeURIComponent(p.slug))}">${p.name}</a></h3>
            <p>${p.shape} · ${p.color}</p>
          </div>
          <div class="price">
            ${money(p.price)}
            ${p.compareAt ? "<s>" + money(p.compareAt) + "</s>" : ""}
          </div>
        </div>
      </article>`;
  },

  cartDrawerHtml() {
    const items = Store.cartItems();
    if (!items.length) {
      return `<div class="empty">
        <h1 style="font-size:32px">Your bag is empty</h1>
        <p class="muted">Start with a pair that feels like you.</p>
        <a class="btn" href="${Store.href("shop.html")}" style="margin-top:20px">Shop frames</a>
      </div>`;
    }
    return items
      .map(
        ({ product: p, qty }) => `
      <div class="line-item">
        <a href="${Store.href("product.html?slug=" + p.slug)}"><img src="${Store.img(p.image)}" alt=""></a>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <div>
              <a href="${Store.href("product.html?slug=" + p.slug)}" class="display" style="font-size:20px">${p.name}</a>
              <p class="muted" style="margin:4px 0;font-size:12px">${p.color}</p>
            </div>
            <div>${money(p.price * qty)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
            <div class="qty">
              <button data-qty="${p.id}" data-next="${qty - 1}">${I.minus}</button>
              <span>${qty}</span>
              <button data-qty="${p.id}" data-next="${qty + 1}">${I.plus}</button>
            </div>
            <button class="muted" style="font-size:12px;text-decoration:underline" data-remove="${p.id}">Remove</button>
          </div>
        </div>
      </div>`
      )
      .join("");
  },

  mountStore() {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (header) {
      header.innerHTML = `
        <header class="site-header">
          <div class="wrap nav-bar">
            <button class="icon-btn menu-btn" data-open-menu aria-label="Open menu">${I.menu}</button>
            <a class="logo" href="${Store.href("index.html")}">SOLEIL</a>
            <nav class="nav-links">
              <a href="${Store.href("shop.html")}">Shop</a>
              <a href="${Store.href("shop.html?shape=Aviator")}">Aviator</a>
              <a href="${Store.href("shop.html?shape=Wayfarer")}">Wayfarer</a>
              <a href="${Store.href("about.html")}">About</a>
              <a href="${Store.href("contact.html")}">Contact</a>
            </nav>
            <div class="nav-actions">
              <button class="icon-btn" data-open-search aria-label="Search">${I.search}</button>
              <a class="icon-btn" href="${Store.href("wishlist.html")}" aria-label="Wishlist">
                ${I.heart}<span class="badge" data-wish-count hidden></span>
              </a>
              <button class="icon-btn" data-open-cart aria-label="Open bag">
                ${I.bag}<span class="badge" data-cart-count hidden></span>
              </button>
            </div>
          </div>
        </header>
        <div class="mobile-menu" id="mobile-menu">
          <header>
            <span class="logo" style="position:static;transform:none">SOLEIL</span>
            <button class="icon-btn" data-close-menu aria-label="Close menu">${I.close}</button>
          </header>
          <nav>
            <a href="${Store.href("shop.html")}">Shop</a>
            <a href="${Store.href("shop.html?shape=Aviator")}">Aviator</a>
            <a href="${Store.href("shop.html?shape=Wayfarer")}">Wayfarer</a>
            <a href="${Store.href("about.html")}">About</a>
            <a href="${Store.href("contact.html")}">Contact</a>
            <a class="admin-link" href="${Store.href("admin/login.html")}">Admin</a>
          </nav>
        </div>
        <div class="search-overlay" id="search-overlay">
          <div class="search-box">
            <div class="search-row">
              ${I.search}
              <input id="search-input" placeholder="Search frames, shapes, colors">
              <button class="icon-btn" data-close-search aria-label="Close search">${I.close}</button>
            </div>
            <div class="search-results" id="search-results"></div>
          </div>
        </div>
        <div class="overlay" id="cart-overlay"></div>
        <aside class="drawer" id="cart-drawer">
          <div class="drawer-head" style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <p class="eyebrow">Your bag</p>
              <h2 class="display" style="font-size:30px;margin:0">Items</h2>
            </div>
            <button class="icon-btn" data-close-cart aria-label="Close bag">${I.close}</button>
          </div>
          <div class="drawer-body" id="cart-drawer-body"></div>
          <div class="drawer-foot" id="cart-drawer-foot">
            <div class="row"><span class="muted">Subtotal</span><span id="cart-drawer-sub"></span></div>
            <a class="btn btn-full" href="${Store.href("checkout.html")}">Checkout</a>
            <a href="${Store.href("cart.html")}" class="muted" style="display:block;text-align:center;margin-top:12px;font-size:12px;text-decoration:underline">View bag</a>
          </div>
        </aside>`;
    }
    if (footer) {
      footer.innerHTML = `
        <footer class="site-footer">
          <div class="wrap foot-grid">
            <div>
              <div class="logo">SOLEIL</div>
              <p class="muted" style="max-width:360px;line-height:1.7;margin-top:12px">Sunglasses designed with a quieter kind of luxury. Light-first lenses, considered frames, made to last more than one summer.</p>
            </div>
            <div>
              <p class="eyebrow">Shop</p>
              <ul>
                <li><a href="${Store.href("shop.html")}">All frames</a></li>
                <li><a href="${Store.href("shop.html?shape=Aviator")}">Aviator</a></li>
                <li><a href="${Store.href("shop.html?shape=Cat-eye")}">Cat-eye</a></li>
                <li><a href="${Store.href("wishlist.html")}">Wishlist</a></li>
              </ul>
            </div>
            <div>
              <p class="eyebrow">Maison</p>
              <ul>
                <li><a href="${Store.href("about.html")}">Our story</a></li>
                <li><a href="${Store.href("contact.html")}">Contact</a></li>
                <li><a href="${Store.href("admin/login.html")}">Admin</a></li>
              </ul>
            </div>
          </div>
          <div class="legal">© ${new Date().getFullYear()} Soleil Eyewear. Demo store — payments are simulated.</div>
        </footer>`;
    }

    const menu = document.getElementById("mobile-menu");
    const search = document.getElementById("search-overlay");
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.getElementById("cart-overlay");
    const openCart = () => {
      drawer.classList.add("open");
      overlay.classList.add("open");
      this.refreshChrome();
    };
    const closeCart = () => {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
    };

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-open-menu],[data-close-menu],[data-open-search],[data-close-search],[data-open-cart],[data-close-cart],[data-add],[data-wish],[data-qty],[data-remove]");
      if (e.target === overlay) closeCart();
      if (!t) return;
      if (t.matches("[data-open-menu]")) menu.classList.add("open");
      if (t.matches("[data-close-menu]")) menu.classList.remove("open");
      if (t.matches("[data-open-search]")) {
        search.classList.add("open");
        document.getElementById("search-input").focus();
      }
      if (t.matches("[data-close-search]")) search.classList.remove("open");
      if (t.matches("[data-open-cart]")) openCart();
      if (t.matches("[data-close-cart]")) closeCart();
      if (t.dataset.add) Store.addToCart(t.dataset.add);
      if (t.dataset.wish) {
        Store.toggleWishlist(t.dataset.wish);
        if (typeof window.rerenderPage === "function") window.rerenderPage();
        else t.classList.toggle("on", Store.wishlist.includes(t.dataset.wish));
      }
      if (t.dataset.qty) {
        Store.setQty(t.dataset.qty, Number(t.dataset.next));
        if (typeof window.rerenderPage === "function") window.rerenderPage();
      }
      if (t.dataset.remove) {
        Store.removeFromCart(t.dataset.remove);
        if (typeof window.rerenderPage === "function") window.rerenderPage();
      }
    });

    const input = document.getElementById("search-input");
    if (input) {
      const renderResults = () => {
        const q = input.value.trim().toLowerCase();
        const box = document.getElementById("search-results");
        if (!q) {
          box.innerHTML = "";
          return;
        }
        const hits = Store.products
          .filter((p) => `${p.name} ${p.shape} ${p.color}`.toLowerCase().includes(q))
          .slice(0, 6);
        box.innerHTML = hits
          .map(
            (p) =>
              `<a href="${Store.href("product.html?slug=" + p.slug)}"><img src="${Store.img(p.image)}" alt=""><div><p class="display" style="font-size:20px;margin:0">${p.name}</p><p class="muted" style="margin:0;font-size:12px">${p.shape}</p></div></a>`
          )
          .join("");
      };
      input.addEventListener("input", renderResults);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          location.href = Store.href("shop.html?q=" + encodeURIComponent(input.value));
        }
      });
    }

    this.refreshChrome();
  },

  statusBadge(status) {
    return `<span class="badge-s s-${status}">${status}</span>`;
  },

  requireAdmin() {
    if (Store.isAdmin) return true;
    location.href = Store.href("admin/login.html");
    return false;
  },

  mountAdmin(active) {
    const side = (id) => `
      <div class="brand"><a href="${Store.href("index.html")}"><strong>SOLEIL</strong><em>Admin</em></a></div>
      <nav class="admin-nav">
        <a class="${active === "overview" ? "active" : ""}" href="${Store.href("admin/index.html")}">Overview</a>
        <a class="${active === "products" ? "active" : ""}" href="${Store.href("admin/products.html")}">Products</a>
        <a class="${active === "orders" ? "active" : ""}" href="${Store.href("admin/orders.html")}">Orders</a>
        <a class="${active === "customers" ? "active" : ""}" href="${Store.href("admin/customers.html")}">Customers</a>
        <a class="${active === "settings" ? "active" : ""}" href="${Store.href("admin/settings.html")}">Settings</a>
      </nav>
      <button class="admin-logout muted" style="margin:16px;color:rgba(251,250,247,.6);text-align:left">Sign out</button>`;

    const root = document.getElementById("admin-shell");
    if (!root) return;
    root.innerHTML = `
      <aside class="admin-side">${side("desk")}</aside>
      <div class="admin-drawer" id="admin-drawer">
        <div class="scrim" data-close-admin></div>
        <div class="pane">${side("mobile")}</div>
      </div>
      <div style="flex:1;min-width:0">
        <header class="admin-top">
          <button class="icon-btn" data-open-admin aria-label="Open admin menu">${I.menu}</button>
          <span class="display" style="letter-spacing:.16em;font-size:20px">SOLEIL</span>
          <span class="eyebrow" style="margin:0">Admin</span>
        </header>
        <div class="admin-main" id="admin-main"></div>
      </div>`;
    root.querySelectorAll(".admin-logout").forEach((b) =>
      b.addEventListener("click", () => {
        Store.loginAdmin(false);
        location.href = Store.href("admin/login.html");
      })
    );
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-admin]")) document.getElementById("admin-drawer").classList.add("open");
      if (e.target.closest("[data-close-admin]")) document.getElementById("admin-drawer").classList.remove("open");
    });
    root.querySelectorAll(".admin-nav a").forEach((a) => {
      if (a.getAttribute("href") && a.getAttribute("href").endsWith(location.pathname.split("/").pop())) {
        a.classList.add("active");
      }
    });
  },
};
