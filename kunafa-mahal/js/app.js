document.addEventListener("DOMContentLoaded", async () => {
  if (KM.loadMenu) await KM.loadMenu();
  if (KM.loadAuth) await KM.loadAuth();
  KM.mount();
  const page = document.body.dataset.page;
  const pages = {
    home: renderHome,
    menu: renderMenu,
    cart: renderCartPage,
    checkout: renderCheckout,
    track: renderTrack,
    about: renderAbout,
    contact: renderContact,
    order: renderOrder,
    kitchen: renderKitchen,
    account: renderOrders,
    orders: renderOrders,
  };
  pages[page]?.();
});

function renderHome() {
  const root = document.getElementById("page");
  const b = KM.brand;
  root.innerHTML = `
    <section class="hero">
      <div class="wrap hero-inner">
        <div class="eyebrow">Hazratganj · Pure vegetarian café</div>
        <h1>${b.tagline}</h1>
        <p class="lead">${b.subtitle} Freshly made kunafa, specialty coffee, and royal hospitality from Shop 4, New Market.</p>
        <div class="hero-actions">
          <a class="btn btn-cream" href="menu.html">Order delivery</a>
          <a class="btn btn-outline" href="about.html">Our heritage</a>
        </div>
        <div class="meta-row">
          <div><strong>${b.hours}</strong>Open daily</div>
          <div><strong>${b.ratingDelivery} · delivery</strong>${b.ratingCount} ratings on Zomato</div>
          <div><strong>${KM.inr(b.costForTwo)} for two</strong>Indoor seating · takeaway</div>
        </div>
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="section-head">
          <div class="eyebrow">The palace table</div>
          <h2>Most loved this week</h2>
          <p class="muted">The same royal plates from our café, packed warm for Hazratganj and beyond.</p>
        </div>
        <div class="grid-4">${KM.popular().slice(0, 8).map(KM.dishCard).join("")}</div>
      </div>
    </section>

    <section class="paper">
      <div class="wrap grid-2">
        <div>
          <div class="eyebrow">Discover Kunafa Mahal</div>
          <h2>Our heritage</h2>
          <p>${b.heritage}</p>
          <p>${b.description}</p>
          <a class="btn btn-maroon" href="about.html">Find out more</a>
        </div>
        <img src="assets/dishes/nabulsi.jpg" alt="Royal Nabulsi Kunafa" style="border-radius:22px;box-shadow:var(--shadow)" />
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="section-head">
          <div class="eyebrow">How delivery works</div>
          <h2>From the griddle to your door</h2>
        </div>
        <div class="grid-3">
          <article class="stat"><b>01</b><h3>Build a thaal</h3><p class="muted">Pick kunafa, tubs, bombs and qahwa. Min ${KM.inr(KM.delivery.minOrder)} for delivery.</p></article>
          <article class="stat"><b>02</b><h3>Choose Lucknow</h3><p class="muted">Hazratganj is ${KM.inr(29)} and about 20 minutes. Free delivery above ${KM.inr(KM.delivery.freeAbove)}.</p></article>
          <article class="stat"><b>03</b><h3>Track the pour</h3><p class="muted">We confirm, cook to order, and share live status on your ticket.</p></article>
        </div>
      </div>
    </section>

    <section class="paper">
      <div class="wrap">
        <div class="section-head">
          <div class="eyebrow">Palace offer</div>
          <h2>Loyalty points</h2>
          <p class="muted">Sign in with Google, then every delivery or pickup earns ${KM.loyalty.perOrder} points. ${KM.loyalty.perOrder} points = ${KM.inr(KM.loyalty.rupeesPer100)} on your next bill. Guest orders do not earn points.</p>
        </div>
        <div class="grid-3">
          <article class="stat"><b>${KM.loyalty.perOrder}</b><h3>Points per order</h3><p class="muted">Added to your mobile number after every delivery or pickup.</p></article>
          <article class="stat"><b>${KM.inr(KM.loyalty.rupeesPer100)}</b><h3>Value of ${KM.loyalty.perOrder} points</h3><p class="muted">Redeem on the next order — full bill or part of it.</p></article>
          <article class="stat"><b>Pay</b><h3>With points next time</h3><p class="muted">Tick “Pay with loyalty points” at checkout. Leftover points stay on your number.</p></article>
        </div>
      </div>
    </section>

    <section class="maroon-band">
      <div class="wrap grid-2">
        <div>
          <div class="eyebrow" style="color:var(--gold-soft)">Visit the café</div>
          <h2>Better yet, see us in person</h2>
          <p>${b.fullAddress}</p>
          <p>${b.hours}</p>
          <div class="hero-actions">
            <a class="btn btn-cream" href="tel:${b.phone}">${b.phoneDisplay}</a>
            <a class="btn btn-outline" href="${b.maps}" target="_blank" rel="noopener">Directions</a>
          </div>
        </div>
        <iframe class="map" title="Kunafa Mahal on the map" src="${b.mapsEmbed}" loading="lazy"></iframe>
      </div>
    </section>`;
}

function renderMenu() {
  const root = document.getElementById("page");
  const chips = [`<button class="chip active" data-cat="all">All</button>`]
    .concat(KM.categories.map((c) => `<button class="chip" data-cat="${c.id}">${c.name}</button>`))
    .join("");
  root.innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">Order online</div>
      <h1>The royal menu</h1>
      <p>Pure vegetarian kunafa, tubs, bombs, Arabic specials and coffee. Delivery across Lucknow or pickup from Hazratganj.</p>
      <p>Signed-in guests earn ${KM.loyalty.perOrder} points per order. ${KM.loyalty.perOrder} points = ${KM.inr(KM.loyalty.rupeesPer100)} next time.</p>
    </div></section>
    <section>
      <div class="wrap">
        <div class="menu-toolbar">
          <input class="search" id="menu-search" placeholder="Search kunafa, pista, qahwa…" />
          <div class="chips">${chips}</div>
        </div>
        <div id="menu-list"></div>
      </div>
    </section>`;

  const list = document.getElementById("menu-list");
  const draw = (cat, q) => {
    const query = (q || "").trim().toLowerCase();
    const cats = cat === "all" ? KM.categories : KM.categories.filter((c) => c.id === cat);
    list.innerHTML = cats.map((c) => {
      const items = KM.byCat(c.id).filter((i) =>
        !query || `${i.name} ${i.desc}`.toLowerCase().includes(query)
      );
      if (!items.length) return "";
      return `<div class="cat-block" id="${c.id}">
        <h2>${c.name}</h2>
        <p class="muted">${c.blurb}</p>
        <div class="grid-4">${items.map(KM.dishCard).join("")}</div>
      </div>`;
    }).join("") || `<p class="empty">No dishes match that search.</p>`;
  };
  draw("all");
  let cat = "all";
  document.getElementById("menu-search").addEventListener("input", (e) => draw(cat, e.target.value));
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      cat = chip.dataset.cat;
      draw(cat, document.getElementById("menu-search").value);
    });
  });
}

function renderCartPage() {
  const root = document.getElementById("page");
  const paint = () => {
    const t = KM.totals();
    root.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <div class="eyebrow">Your thaal</div>
        <h1>Cart</h1>
      </div></section>
      <section><div class="wrap grid-2">
        <div id="full-lines">
          ${t.lines.length ? t.lines.map((i) => `
            <div class="line">
              <img src="${i.img}" alt="" />
              <div>
                <h4>${i.name}</h4>
                <div class="muted">${KM.inr(i.price)} each</div>
                <div class="qty-ctrl">
                  <button data-qty="${i.id}" data-d="-1">−</button>
                  <span>${i.qty}</span>
                  <button data-qty="${i.id}" data-d="1">+</button>
                </div>
              </div>
              <strong>${KM.inr(i.line)}</strong>
            </div>`).join("") : `<div class="empty">Nothing here yet. <a href="menu.html">Add a kunafa</a>.</div>`}
        </div>
        <aside class="order-card">
          <h3>Summary</h3>
          <div class="totals">
            <div><span>Subtotal</span><span>${KM.inr(t.subtotal)}</span></div>
            <div><span>Packaging</span><span>${KM.inr(t.packaging)}</span></div>
            <div class="muted">Delivery calculated at checkout</div>
          </div>
          <a class="btn btn-maroon btn-block" href="checkout.html" style="margin-top:16px" ${t.lines.length ? "" : "aria-disabled=true"}>Continue to checkout</a>
        </aside>
      </div></section>`;
  };
  paint();
  document.addEventListener("km:cart", paint);
}

function renderCheckout() {
  const root = document.getElementById("page");
  const signed = !!KM.auth?.user;
  const zones = KM.delivery.zones.map((z) =>
    `<option value="${z.id}">${z.name} · ${z.eta} min · ${KM.inr(z.fee)}</option>`
  ).join("");
  root.innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">Almost there</div>
      <h1>Checkout</h1>
      <p>Delivery across Lucknow, or pickup from Shop 4, New Market, Hazratganj.</p>
    </div></section>
    <section class="checkout-page"><div class="wrap checkout-grid">
      <form class="form order-card checkout-panel" id="checkout-form">
        <div class="eyebrow">Your details</div>
        <h2>Checkout</h2>
        ${signed ? `<p class="muted">Signed in as ${KM.auth.user.email}</p>` : `<p class="muted">Ordering as a guest. <a href="/api/auth/google?next=/checkout.html">Sign in with Google</a> to earn loyalty points and keep your order history.</p>`}
        <div class="choice">
          <label><input type="radio" name="type" value="delivery" checked /> Delivery</label>
          <label><input type="radio" name="type" value="pickup" /> Café pickup</label>
        </div>
        <div class="row-2">
          <label>Full name<input name="name" required placeholder="Your name" value="${KM.auth?.user?.name || ""}" /></label>
          <label>Mobile<input name="phone" required pattern="[0-9]{10}" placeholder="10-digit number" /></label>
        </div>
        <label>Email<input name="email" type="email" ${signed ? "required readonly" : ""} value="${KM.auth?.user?.email || ""}" placeholder="${signed ? "" : "Optional"}" /></label>
        <div id="delivery-fields">
          <label>Area
            <select name="zone" required>${zones}</select>
          </label>
          <label>Address<input name="address" placeholder="House / shop, street, landmark" /></label>
        </div>
        <label>Notes for the kitchen<textarea name="notes" placeholder="Less syrup, extra pistachio, doorbell instructions…"></textarea></label>
        ${signed ? `<div class="order-card loyalty-box" id="loyalty-box">
          <strong>Loyalty</strong>
          <p id="loyalty-balance" class="muted">100 pts = ₹50 on the next bill.</p>
          <label class="admin-check" id="loyalty-use-wrap" hidden>
            <input type="checkbox" name="useLoyalty" id="use-loyalty" />
            Pay with points
          </label>
        </div>` : ""}
        <div class="row-2">
          <label>Promo<input name="promo" id="promo-input" placeholder="ROYAL50" /></label>
          <label>&nbsp;<button type="button" class="btn btn-outline-dark btn-sm" id="apply-promo">Apply</button></label>
        </div>
        <button class="btn btn-maroon" type="submit">Place order</button>
      </form>
      <aside class="order-card checkout-panel checkout-bill" id="check-sum"></aside>
    </div></section>`;

  const form = document.getElementById("checkout-form");
  const sum = document.getElementById("check-sum");
  const del = document.getElementById("delivery-fields");
  let loyalty = { points: 0, rupees: 0 };
  const bill = () => {
    const type = form.type.value;
    const t = KM.totals(type === "delivery" ? form.zone.value : "");
    const use = !!(form.useLoyalty && form.useLoyalty.checked && loyalty.points > 0);
    const loyaltyRs = use ? Math.min(t.grand, KM.loyalty.rupees(loyalty.points)) : 0;
    const pointsUsed = KM.loyalty.points(loyaltyRs);
    return { type, t, use, loyaltyRs, pointsUsed, toPay: Math.max(0, t.grand - loyaltyRs) };
  };
  const paint = () => {
    const { type, t, use, loyaltyRs, pointsUsed, toPay } = bill();
    del.style.display = type === "delivery" ? "grid" : "none";
    form.zone.required = type === "delivery";
    form.address.required = type === "delivery";
    const minOk = type === "pickup" || t.subtotal >= KM.delivery.minOrder;
    const wrap = document.getElementById("loyalty-use-wrap");
    const bal = document.getElementById("loyalty-balance");
    if (wrap && bal) {
      wrap.hidden = !signed || loyalty.points < 2;
      bal.textContent = loyalty.points
        ? `This account has ${loyalty.points} points (${KM.inr(loyalty.rupees)}).`
        : "No saved points yet — this signed-in order will start the balance.";
    }
    sum.innerHTML = `
      <div class="eyebrow">Your bill</div>
      <h2>To pay</h2>
      ${t.lines.map((i) => `<div class="totals"><div><span>${i.qty} × ${i.name}</span><span>${KM.inr(i.line)}</span></div></div>`).join("")}
      <div class="totals" style="margin-top:12px">
        <div><span>Subtotal</span><span>${KM.inr(t.subtotal)}</span></div>
        <div><span>Packaging</span><span>${KM.inr(t.packaging)}</span></div>
        <div><span>Delivery</span><span>${type === "pickup" ? "—" : KM.inr(t.delivery)}</span></div>
        <div><span>GST 5%</span><span>${KM.inr(t.gst)}</span></div>
        ${t.discount ? `<div><span>${t.promoLabel}</span><span>−${KM.inr(t.discount)}</span></div>` : ""}
        ${use ? `<div><span>Loyalty (${pointsUsed} pts)</span><span>−${KM.inr(loyaltyRs)}</span></div>` : ""}
        <div class="grand"><span>To pay</span><span>${KM.inr(toPay)}</span></div>
      </div>
      <p class="muted" style="margin-top:10px">${signed ? `This order earns ${KM.loyalty.perOrder} loyalty points.` : "Guest orders do not earn loyalty points."}</p>
      ${!minOk ? `<p class="notice" style="margin-top:12px">Add ${KM.inr(KM.delivery.minOrder - t.subtotal)} more for delivery.</p>` : ""}
      <p class="muted" style="margin-top:10px">${type === "delivery" && t.zone ? `Arrives in about ${t.zone.eta} minutes.` : "Pickup from Hazratganj when the kitchen marks ready."}</p>`;
    form.querySelector("[type=submit]").disabled = !t.lines.length || !minOk;
  };
  const refreshLoyalty = async () => {
    if (!signed) {
      loyalty = { points: 0, rupees: 0 };
      paint();
      return;
    }
    const phone = form.phone?.value?.trim() || "";
    try {
      const url = /^[0-9]{10}$/.test(phone)
        ? "/api/loyalty?phone=" + encodeURIComponent(phone)
        : "/api/loyalty";
      const data = await KM.api.get(url);
      loyalty = { points: data.points || 0, rupees: data.rupees || 0 };
    } catch {
      loyalty = { points: KM.auth?.user?.loyalty?.points || 0, rupees: KM.auth?.user?.loyalty?.rupees || 0 };
    }
    paint();
  };
  form.addEventListener("input", paint);
  form.zone?.addEventListener("change", paint);
  form.phone?.addEventListener("change", refreshLoyalty);
  form.phone?.addEventListener("blur", refreshLoyalty);
  document.getElementById("apply-promo").addEventListener("click", () => {
    const code = document.getElementById("promo-input").value.toUpperCase().trim();
    if (!KM.promos[code]) { KM.toast("That code is not valid"); return; }
    KM.promo.set(code);
    KM.toast(`${code} applied`);
    paint();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const typed = document.getElementById("promo-input").value.toUpperCase().trim();
    if (typed && KM.promos[typed]) KM.promo.set(typed);
    const { type, t, use, loyaltyRs, pointsUsed, toPay } = bill();
    if (!t.lines.length) return;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "Placing…";
    try {
      const data = await KM.orders.place({
        type,
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        zone: type === "delivery" ? form.zone.value : "",
        zoneName: type === "delivery" ? (t.zone?.name || "") : "Café pickup",
        address: form.address.value.trim(),
        notes: form.notes.value.trim(),
        pay: signed && toPay === 0 ? "loyalty" : "",
        useLoyalty: signed && use,
        loyaltyPoints: pointsUsed,
        items: t.lines.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, line: i.line })),
        totals: { ...t, loyalty: loyaltyRs, grand: toPay },
      });
      location.href = "order.html?id=" + data.order.id;
    } catch (err) {
      KM.toast(err.message || "Could not place the order");
      btn.disabled = false;
      btn.textContent = "Place order";
    }
  });
  paint();
  refreshLoyalty();
}

async function renderOrder() {
  const id = new URLSearchParams(location.search).get("id");
  const root = document.getElementById("page");
  root.innerHTML = `<section class="page-hero"><div class="wrap"><h1>Confirming your ticket…</h1></div></section>`;
  const order = await KM.orders.fetch(id);
  if (!order) {
    root.innerHTML = `<section class="page-hero"><div class="wrap"><h1>Order not found</h1><a class="btn btn-cream" href="track.html">Track another</a></div></section>`;
    return;
  }
  const steps = KM.steps(order.type);
  root.innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">Shukriya</div>
      <h1>${order.id}</h1>
      <p>${KM.stepLabel[order.status] || order.status} · ${order.type === "pickup" ? "Pickup" : "Delivery"}</p>
    </div></section>
    <section class="checkout-page"><div class="wrap checkout-grid">
      <div class="order-card checkout-panel">
        <div class="eyebrow">Ticket</div>
        <h2>Your thaal</h2>
        <div class="totals">
          ${(order.items || []).map((i) => `<div><span>${i.qty} × ${i.name}</span><span>${KM.inr(i.line)}</span></div>`).join("")}
          ${order.loyalty?.rupees ? `<div><span>Loyalty</span><span>−${KM.inr(order.loyalty.rupees)}</span></div>` : ""}
          <div class="grand"><span>To pay</span><span>${KM.inr(order.totals.grand)}</span></div>
        </div>
        <p class="muted">${order.name}${order.phone ? " · " + order.phone : ""}<br>${order.type === "delivery" ? `${order.address || ""} ${order.zoneName || ""}`.trim() : "Café pickup, Hazratganj"}</p>
      </div>
      <aside class="order-card checkout-panel checkout-bill">
        <div class="eyebrow">Status</div>
        <h2>${KM.stepLabel[order.status] || order.status}</h2>
        <div class="steps-row">
          ${steps.map((s) => `<span class="${s === order.status ? "current" : steps.indexOf(s) < steps.indexOf(order.status) ? "done" : ""}">${KM.stepLabel[s]}</span>`).join("")}
        </div>
        ${order.loyalty?.earned || order.loyalty?.used ? `<p class="muted">+${order.loyalty.earned} pts${order.loyalty.used ? `, used ${order.loyalty.used}` : ""}. Balance ${order.loyalty.balance}.</p>` : `<p class="muted">${KM.auth?.user ? "" : "Guest orders do not earn loyalty points."}</p>`}
        <a class="btn btn-maroon btn-block" href="track.html?id=${order.id}">Track this order</a>
        ${KM.auth?.user ? `<a class="btn btn-outline-dark btn-block" href="orders.html" style="margin-top:10px">All orders</a>` : ""}
      </aside>
    </div></section>`;
}

function renderTrack() {
  const root = document.getElementById("page");
  const preset = new URLSearchParams(location.search).get("id") || "";
  root.innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">Live track</div>
      <h1>Where is my kunafa?</h1>
    </div></section>
    <section><div class="wrap" style="max-width:640px">
      <form class="form order-card" id="track-form">
        <label>Order ID<input name="id" value="${preset}" placeholder="KMxxxxxxxx" required /></label>
        <button class="btn btn-maroon" type="submit">Track</button>
      </form>
      <div id="track-out" style="margin-top:18px"></div>
    </div></section>`;
  const out = document.getElementById("track-out");
  const show = async (id) => {
    out.innerHTML = `<p class="muted">Looking up ${id}…</p>`;
    const order = await KM.orders.fetch(id.toUpperCase());
    if (!order) { out.innerHTML = `<p class="notice">No order with that ID. Ask the café if you just placed it.</p>`; return; }
    const steps = KM.steps(order.type);
    out.innerHTML = `
      <div class="order-card">
        <h3>${order.id} · ${KM.stepLabel[order.status]}</h3>
        <ol class="timeline">
          ${steps.map((s) => `<li class="${s === order.status ? "current done" : steps.indexOf(s) < steps.indexOf(order.status) ? "done" : ""}">${KM.stepLabel[s]}</li>`).join("")}
        </ol>
        ${order.items.map((i) => `<div>${i.qty} × ${i.name}</div>`).join("")}
        <p><strong>${KM.inr(order.totals.grand)}</strong> · ${order.type} · ${order.zoneName}</p>
      </div>`;
  };
  document.getElementById("track-form").addEventListener("submit", (e) => {
    e.preventDefault();
    show(e.target.id.value.trim());
  });
  if (preset) show(preset);
}

async function renderOrders() {
  const root = document.getElementById("page");
  if (!KM.auth?.user) {
    location.replace("index.html");
    return;
  }
  root.innerHTML = `<section class="page-hero"><div class="wrap"><div class="eyebrow">Your palace card</div><h1>Loading orders…</h1></div></section>`;
  let data;
  try {
    data = await KM.api.get("/api/account/history");
  } catch (err) {
    root.innerHTML = `<section class="page-hero"><div class="wrap"><h1>${err.message || "Could not load orders"}</h1></div></section>`;
    return;
  }
  const loy = data.loyalty || { points: 0, rupees: 0, history: [] };
  const orders = data.orders || [];
  const when = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? (iso || "") : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  root.innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">${KM.auth.user.email}</div>
      <h1>Your orders</h1>
      <p>${loy.points} pts · ${KM.inr(loy.rupees)} ready on the next bill</p>
    </div></section>
    <section class="checkout-page"><div class="wrap checkout-grid">
      <div class="order-card checkout-panel">
        <div class="eyebrow">Tickets</div>
        <h2>Recent orders</h2>
        ${orders.length ? orders.map((o) => `
          <article class="checkout-ticket">
            <div class="checkout-ticket-top">
              <div>
                <strong>${o.id}</strong>
                <div class="muted">${when(o.createdAt)} · ${o.type === "pickup" ? "Pickup" : "Delivery"}</div>
              </div>
              <a class="btn btn-maroon btn-sm" href="order.html?id=${o.id}">${KM.stepLabel[o.status] || o.status}</a>
            </div>
            <div class="muted">${(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(" · ")}</div>
            <p><strong>${KM.inr(o.totals?.grand)}</strong></p>
          </article>`).join("") : `<p class="muted">No orders yet. <a href="menu.html">Start a thaal</a>.</p>`}
      </div>
      <aside class="order-card checkout-panel checkout-bill">
        <div class="eyebrow">Loyalty</div>
        <h2>${loy.points} pts</h2>
        <div class="totals">
          <div><span>Worth</span><span>${KM.inr(loy.rupees)}</span></div>
          <div><span>Per order</span><span>+${KM.loyalty.perOrder}</span></div>
        </div>
        <h3>Last points</h3>
        ${loy.history?.length ? `<div class="totals">${loy.history.slice(0, 6).map((h) => `
          <div><span>${h.orderId || "—"}</span><span>+${h.earned || 0}${h.used ? `/−${h.used}` : ""}</span></div>`).join("")}</div>` : `<p class="muted">None yet.</p>`}
        <a class="btn btn-maroon btn-block" href="checkout.html" style="margin-top:16px">Order again</a>
      </aside>
    </div></section>`;
}

function renderAbout() {
  const b = KM.brand;
  document.getElementById("page").innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">Our heritage</div>
      <h1>A modern QSR café of Middle Eastern royalty</h1>
    </div></section>
    <section><div class="wrap grid-2">
      <div>
        <p>${b.heritage}</p>
        <p>${b.description}</p>
        <p>We are a pure-vegetarian café in Hazratganj: indoor seating, takeaway, and our own delivery desk. Average ${KM.inr(b.costForTwo)} for two. Cuisines: ${b.cuisines.join(", ")}.</p>
        <a class="btn btn-maroon" href="menu.html">Taste the menu</a>
      </div>
      <img src="assets/dishes/lucknowi-malai.jpg" alt="Lucknowi Malai Kunafa" style="border-radius:22px" />
    </div></section>
    <section class="paper"><div class="wrap">
      <div class="section-head"><div class="eyebrow">Guests</div><h2>From the dining room</h2></div>
      <div class="grid-4">
        ${KM.reviews.map((r) => `<article class="review"><div class="stars">${"★".repeat(r.stars)}</div><p>${r.text}</p><strong>${r.name}</strong><div class="muted">${r.source}</div></article>`).join("")}
      </div>
    </div></section>`;
}

function renderContact() {
  const b = KM.brand;
  document.getElementById("page").innerHTML = `
    <section class="page-hero"><div class="wrap">
      <div class="eyebrow">Visit</div>
      <h1>Come to the café</h1>
      <p>Shop 4, New Market, Hazratganj — or send a note and we will write back the same day.</p>
    </div></section>
    <section class="contact-page"><div class="wrap">
      <div class="contact-shell">
        <aside class="contact-visit">
          <div class="eyebrow">The palace</div>
          <h2>Kunafa Mahal</h2>
          <p>${b.fullAddress}</p>
          <dl class="contact-meta">
            <div><dt>Phone</dt><dd><a href="tel:${b.phone}">${b.phoneDisplay}</a></dd></div>
            <div><dt>Hours</dt><dd>12:00 pm – 11:45 pm daily</dd></div>
            <div><dt>Note</dt><dd>${b.hoursNote}</dd></div>
          </dl>
          <div class="contact-actions">
            <a class="btn btn-outline" href="tel:${b.phone}">Call</a>
            <a class="btn btn-whatsapp" href="${b.whatsapp}" target="_blank" rel="noopener">${KM.icons.wa} WhatsApp</a>
            <a class="btn btn-outline" href="${b.maps}" target="_blank" rel="noopener">Maps</a>
          </div>
        </aside>
        <form class="form order-card contact-form" id="contact-form">
          <div class="eyebrow">Write to us</div>
          <h2>Send a message</h2>
          <p class="muted">Catering tubs, party boxes, or a table in Hazratganj.</p>
          <label>Name<input name="name" required /></label>
          <label>Phone or email<input name="reach" required /></label>
          <label>Message<textarea name="msg" required></textarea></label>
          <button class="btn btn-maroon" type="submit">Send message</button>
        </form>
      </div>
      <iframe class="map contact-map" title="Kunafa Mahal on the map" src="${b.mapsEmbed}" loading="lazy"></iframe>
    </div></section>`;
  document.getElementById("contact-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = e.target;
    try {
      await KM.api.post("/api/messages", {
        name: fd.name.value.trim(),
        reach: fd.reach.value.trim(),
        msg: fd.msg.value.trim(),
      });
    } catch { /* still thank the guest if the desk is offline */ }
    KM.toast("Message received. We’ll write back soon.");
    fd.reset();
  });
}

function renderKitchen() {
  location.replace("admin.html");
}
