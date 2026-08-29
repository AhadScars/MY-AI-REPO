const Pages = {
  home() {
    const featured = ["pulse-5", "nova-7", "titan-x", "apex-ultra"].map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    const parts = PART_CATS;
    return `
      <section class="hero">
        <div class="hero-media">
          <img src="assets/images/hero.jpg" alt="TIBGSTORE glass gaming PC">
        </div>
        <p class="hero-watermark" aria-hidden="true">TIBG</p>
        <p class="hero-side">Built · tested · shipped</p>
        <div class="wrap hero-copy">
          <p class="hero-line">Prebuilts &nbsp;/&nbsp; Parts &nbsp;/&nbsp; Custom</p>
          <h1>Every budget.<br>One bench.</h1>
          <div class="hero-actions">
            <a class="btn btn-accent" href="budget.html">Shop</a>
            <a class="btn btn-ghost" href="build.html">Custom build</a>
          </div>
        </div>
      </section>
      <div class="wrap">
        <div class="trust">
          <article><h3>Named PSUs only</h3><p>Gold or better. No mystery units in a complete PC.</p></article>
          <article><h3>Clearance-checked</h3><p>GPU length, AIO, and RAM height verified on the bench.</p></article>
          <article><h3>14-day returns</h3><p>Parts unopened. Prebuilts re-tested if they come back.</p></article>
          <article><h3>Local pickup</h3><p>Folsom Street. Same-week slots when the queue allows.</p></article>
        </div>
      </div>
      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="kicker">Pick a lane</p>
              <h2>Three floors. Honest specs.</h2>
            </div>
            <p>Start with how you play, not a brand. We will not upsell you a 5090 for Valorant.</p>
          </div>
          <div class="tier-grid">
            ${Object.values(TIERS).map(tierCard).join("")}
          </div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="kicker">On the floor</p>
              <h2>Featured builds</h2>
            </div>
            <a class="btn btn-ghost" href="mid-range.html">All mid-range ${I.arrow}</a>
          </div>
          <div class="grid-4">${featured.map(productCard).join("")}</div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="kicker">Build it yourself</p>
              <h2>Parts, same standard.</h2>
            </div>
            <a class="btn btn-ghost" href="parts.html">Browse parts ${I.arrow}</a>
          </div>
          <div class="grid-4">
            ${parts
              .map(
                (c) => `
              <a class="card" href="parts.html?cat=${c.id}">
                <div class="card-media"><img src="${c.image}" alt="${c.label}"></div>
                <div class="card-body"><h3>${c.label}</h3><p class="tagline">In stock on the bench</p></div>
              </a>`
              )
              .join("")}
          </div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="kicker">From the bench</p>
              <h2>How a TIBG PC leaves.</h2>
            </div>
          </div>
          <div class="process">${PROCESS.map((s) => `<article class="step"><div class="n">${s.n}</div><h3>${s.title}</h3><p>${s.text}</p></article>`).join("")}</div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="kicker">Journal</p>
              <h2>From the bench.</h2>
            </div>
            <a class="btn btn-ghost" href="blog.html">All notes ${I.arrow}</a>
          </div>
          <div class="blog-grid">
            ${POSTS.slice(0, 3)
              .map(
                (p) => `
              <article class="card blog-card">
                <a class="card-media" href="${postHref(p)}"><img src="${p.cover}" alt=""></a>
                <div class="card-body">
                  <p class="tagline">${p.date || ""}</p>
                  <h3><a href="${postHref(p)}">${p.title}</a></h3>
                </div>
              </article>`
              )
              .join("")}
          </div>
        </div>
      </section>
      ${viewedBlock()}
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head">
            <div>
              <p class="kicker">Owners</p>
              <h2>What people actually say.</h2>
            </div>
            <a class="btn btn-ghost" href="about.html">About the shop</a>
          </div>
          <div class="reviews">
            ${REVIEWS.map(
              (r) => `
              <article class="review">
                <div class="stars">${stars(r.stars)}</div>
                <p>${r.text}</p>
                <strong style="margin-top:0.8rem">${r.name}</strong>
                <div class="meta">${r.meta}</div>
              </article>`
            ).join("")}
          </div>
        </div>
      </section>`;
  },

  tier(id) {
    const t = TIERS[id];
    const list = applyShopList(PRODUCTS.filter((p) => p.type === "build" && p.tier === id));
    const compareSrc = PRODUCTS.filter((p) => p.type === "build" && p.tier === id);
    const compareRows = ["CPU", "GPU", "RAM", "Storage", "PSU", "Cooler"];
    return `
      <section class="page-hero ${id}">
        <div class="wrap">
          <p class="kicker">${t.kicker}</p>
          <h1>${t.title}</h1>
          <p>${t.blurb} Starting at ${money(t.priceFrom)}.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          ${shopTools()}
          <div class="grid-4" style="margin-bottom:3rem">${
            list.length ? list.map(productCard).join("") : `<div class="empty"><p>Nothing matches those filters.</p></div>`
          }</div>
          <div class="section-head">
            <div>
              <p class="kicker">Side by side</p>
              <h2>Compare this floor</h2>
            </div>
          </div>
          <div style="overflow:auto">
            <table class="compare">
              <thead>
                <tr>
                  <th>Spec</th>
                  ${compareSrc.map((p) => `<th><a href="${productHref(p)}">${p.name.replace("TIBG ", "")}</a><div class="muted">${money(p.price)}</div></th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${compareRows
                  .map(
                    (row) =>
                      `<tr><th>${row}</th>${compareSrc.map((p) => `<td>${p.specs[row]}</td>`).join("")}</tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>`;
  },

  parts() {
    const cat = qs("cat");
    const list = applyShopList(PRODUCTS.filter((p) => p.type === "part" && (!cat || p.category === cat)));
    return `
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">À la carte</p>
          <h1>PC parts</h1>
          <p>The same CPUs, GPUs, and PSUs we put in complete machines. We will still refuse a bad pairing.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="filter-pills" style="margin-bottom:1rem">
            <a href="${shopQuery({ cat: "" })}" class="${!cat ? "active" : ""}">All</a>
            ${PART_CATS.map(
              (c) =>
                `<a href="${shopQuery({ cat: c.id })}" class="${cat === c.id ? "active" : ""}">${c.label}</a>`
            ).join("")}
          </div>
          ${shopTools()}
          <div class="grid-4">${
            list.length ? list.map(productCard).join("") : `<div class="empty"><p>Nothing matches those filters.</p></div>`
          }</div>
        </div>
      </section>`;
  },

  product() {
    const p = PRODUCTS.find((x) => x.key === routeKey());
    if (!p) {
      return `<section class="section"><div class="wrap empty"><h2>That item is gone.</h2><p><a class="btn btn-accent" href="index.html">Back to the floor</a></p></div></section>`;
    }
    document.title = `${p.name} · TIBGSTORE`;
    const related = PRODUCTS.filter((x) => x.id !== p.id && (x.tier === p.tier || x.category === p.category)).slice(0, 4);
    const images = p.images && p.images.length ? p.images : [p.image];
    const kindLabel = p.type === "build" ? ((TIERS[p.tier] || {}).label || "Prebuilt") : ((PART_CATS.find((c) => c.id === p.category) || {}).label || "Part");
    const backHref = p.type === "build" ? ((TIERS[p.tier] || {}).href || "index.html") : p.category ? `parts.html?cat=${p.category}` : "parts.html";
    const stock = stockCount(p);
    const specEntries = Object.entries(p.specs || {});
    return `
      <section class="pdp-page">
        <div class="wrap">
          <nav class="crumbs">
            <a href="index.html">Home</a>
            <span>/</span>
            <a href="${backHref}">${kindLabel}</a>
            <span>/</span>
            <em>${p.name}</em>
          </nav>
          <div class="pdp">
            <div class="gallery">
              ${
                images.length > 1
                  ? `<div class="thumbs">${images
                      .map(
                        (src, i) =>
                          `<button type="button" class="${i === 0 ? "active" : ""}" data-thumb="${src}"><img src="${src}" alt=""></button>`
                      )
                      .join("")}</div>`
                  : ""
              }
              <div class="gallery-main">${stockFlag(p)}${wishBtn(p.id)}<button type="button" class="zoom-hit" id="zoom-open" aria-label="Zoom image"><img id="gallery-main" src="${images[0]}" alt="${p.name}"></button></div>
            </div>
            <aside class="pdp-buy">
              <div class="pdp-kicker">
                <span class="kicker">${kindLabel}${p.type === "build" ? " prebuilt" : ""}</span>
                ${p.badge ? `<span class="pill hot" style="position:static">${p.badge}</span>` : ""}
              </div>
              <h1>${p.name}</h1>
              <p class="pdp-tag">${p.tagline || ""}</p>
              <div class="pdp-rate">${stars(p.rating)} <span>${p.rating || "—"} · ${p.reviews || 0} reviews</span></div>
              <div class="pdp-price">
                ${p.compareAt ? `<s>${money(p.compareAt)}</s>` : ""}
                <strong>${money(p.price)}</strong>
              </div>
              <p class="${stock < 5 ? "stock-note" : "pdp-ship"}">${
                stock <= 0
                  ? "Sold out"
                  : stock < 5
                    ? `Few left — ${stock} in stock`
                    : `${p.stock} in stock · ships in 2–5 business days${p.type === "build" ? " after burn-in" : ""}`
              }</p>
              ${
                p.fps && p.fps.length
                  ? `<div class="fps-block">
                      <p class="kicker">In-game</p>
                      <div class="fps-row">${p.fps
                        .map((f) => `<div class="fps"><b>${f.fps}</b><span>${f.game}</span></div>`)
                        .join("")}</div>
                    </div>`
                  : ""
              }
              <div class="qty-row">
                ${
                  stock <= 0
                    ? `<button class="btn btn-line" type="button" disabled>Sold out</button>`
                    : `<div class="qty">
                  <button type="button" data-qty="-1">−</button>
                  <span id="qty">1</span>
                  <button type="button" data-qty="1">+</button>
                </div>
                <button class="btn btn-accent" type="button" id="add-detail">Add to cart ${I.arrow}</button>`
                }
              </div>
              <a class="btn btn-ghost pdp-cart" href="cart.html">View cart</a>
              <ul class="pdp-trust">
                <li>Named PSU only on complete PCs</li>
                <li>14-day returns</li>
                <li>Pay in INR with Stripe</li>
              </ul>
              ${
                p.type === "build"
                  ? `<a class="pdp-call" href="${SITE.phoneHref}">${I.phone} Unsure? Call the owner</a>`
                  : ""
              }
            </aside>
          </div>
          <div class="pdp-body">
            <div class="pdp-about">
              <p class="kicker">About</p>
              <h2>What you are buying</h2>
              <p>${p.description || ""}</p>
              ${
                p.highlights && p.highlights.length
                  ? `<ul class="pdp-points">${p.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>`
                  : ""
              }
            </div>
            ${
              specEntries.length
                ? `<div class="pdp-specs">
                    <p class="kicker">Spec</p>
                    <h2>On the bench</h2>
                    <dl class="spec-grid">
                      ${specEntries.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
                    </dl>
                  </div>`
                : ""
            }
          </div>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><p class="kicker">Also look at</p><h2>Related</h2></div></div>
          <div class="grid-4">${related.map(productCard).join("")}</div>
        </div>
      </section>
      ${viewedBlock(p.id)}
      <div class="zoom-overlay" id="zoom-overlay" hidden>
        <button type="button" class="zoom-close" id="zoom-close" aria-label="Close">×</button>
        <img id="zoom-img" alt="">
        <p class="zoom-hint">Click image to zoom · Esc to close</p>
      </div>`;
  },

  about() {
    return `
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">The shop</p>
          <h1>A bench, not a warehouse sticker.</h1>
          <p>TIBGSTORE started as after-hours builds for friends who kept buying prebuilts with 500W PSUs behind a 4080. We got louder about it.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap split">
          <img src="assets/images/workshop.jpg" alt="TIBGSTORE workshop bench">
          <div>
            <p class="kicker">Folsom Street</p>
            <h2 style="font-size:2rem;margin:0.4rem 0 0.8rem">We will not sell a bad pairing.</h2>
            <p class="muted">Every complete PC is assembled here, photographed, and load-tested. If a customer asks for a 5090 and a 650W unit, we say no and explain the transient spikes. That conversation is the brand.</p>
            <p class="muted" style="margin-top:0.8rem">Budget, mid-range, and high-end are just lanes. The same people cable-manage a Pulse 5 and a Sovereign.</p>
          </div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="process">${PROCESS.map((s) => `<article class="step"><div class="n">${s.n}</div><h3>${s.title}</h3><p>${s.text}</p></article>`).join("")}</div>
        </div>
      </section>`;
  },

  contact() {
    return `
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">Talk to the bench</p>
          <h1>Custom quote, pickup, or a second opinion.</h1>
          <p>We reply during ${SITE.hours}. If you already know the build name, put it in the note.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap split">
          <form class="form" id="contact-form">
            <label class="field"><span>Name</span><input name="name" required placeholder="Your name"></label>
            <label class="field"><span>Email</span><input name="email" type="email" required placeholder="you@studio.com"></label>
            <label class="field"><span>I want to</span>
              <select name="intent">
                <option>Buy a prebuilt</option>
                <option>Customize a prebuilt</option>
                <option>Order parts</option>
                <option>Ask about a pairing</option>
                <option>Schedule pickup</option>
              </select>
            </label>
            <label class="field"><span>Note</span><textarea name="note" placeholder="Pulse 5 with 32GB, or a 5080 + case question…"></textarea></label>
            <button class="btn btn-accent" type="submit">Send to the bench</button>
            <p class="faint">Goes to the owner inbox on this shop. Or call ${SITE.phone} if it is urgent.</p>
          </form>
          <div>
            <article class="step">
              <h3>Visit</h3>
              <p>${SITE.address}</p>
              <p>${SITE.hours}</p>
              <p><a href="${SITE.phoneHref}">${SITE.phone}</a></p>
              <p><a href="mailto:${SITE.email}">${SITE.email}</a></p>
            </article>
            <article class="step" style="margin-top:1rem">
              <h3>What to bring</h3>
              <p>If you are picking up, bring a photo ID and the order number. Street parking is easier after 6pm.</p>
            </article>
          </div>
        </div>
      </section>`;
  },

  faq() {
    return `
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">Warranty & shipping</p>
          <h1>Straight answers.</h1>
        </div>
      </section>
      <section class="section">
        <div class="wrap faq">
          ${FAQS.map((f) => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join("")}
        </div>
      </section>`;
  },

  cart() {
    const { lines, sub, discount, ship, total } = cartTotals(sessionStorage.getItem("tibg-promo") || "");
    if (!lines.length) {
      return `<section class="section"><div class="wrap empty"><h2>Cart is empty.</h2><p class="muted">A Pulse 5 is a decent place to start.</p><p style="margin-top:1rem"><a class="btn btn-accent" href="budget.html">Shop budget PCs</a></p></div></section>`;
    }
    return `
      <section class="page-hero"><div class="wrap"><p class="kicker">Cart</p><h1>Ready to check out.</h1></div></section>
      <div class="wrap cart-layout">
        <div>
          ${lines
            .map(
              (l) => `
            <article class="cart-item">
              <img src="${l.product.image}" alt="">
              <div>
                <a href="${productHref(l.product)}"><strong>${l.product.name}</strong></a>
                <p class="muted">${l.product.tagline}</p>
                <p>${money(l.product.price)}</p>
                ${stockCount(l.product) <= 0 ? `<p class="stock-note">Sold out — remove this line</p>` : stockCount(l.product) < 5 ? `<p class="stock-note">Few left · ${stockCount(l.product)} in stock</p>` : ""}
              </div>
              <div class="qty">
                <button type="button" data-set-qty="${l.id}" data-next="${l.qty - 1}">−</button>
                <span>${l.qty}</span>
                <button type="button" data-set-qty="${l.id}" data-next="${l.qty + 1}" ${l.qty >= stockCount(l.product) ? "disabled" : ""}>+</button>
              </div>
            </article>`
            )
            .join("")}
        </div>
        <aside class="summary">
          <h3>Summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${money(sub)}</span></div>
          <div class="summary-row"><span>Discount</span><span>${discount ? "−" + money(discount) : "—"}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${ship ? money(ship) : "Free"}</span></div>
          <div class="summary-row total"><span>Total</span><span>${money(total)}</span></div>
          <label class="field" style="margin:1rem 0">
            <span>Promo code</span>
            <input id="promo" value="${(getAppliedCoupon() && getAppliedCoupon().code) || ""}" placeholder="Coupon code">
          </label>
          <button class="btn btn-line" type="button" id="apply-promo" style="width:100%;margin-bottom:0.6rem">Apply</button>
          <a class="btn btn-accent" href="checkout.html" style="width:100%">Checkout</a>
        </aside>
      </div>`;
  },

  checkout() {
    const { lines, sub, discount, ship, total } = cartTotals(sessionStorage.getItem("tibg-promo") || "");
    if (!lines.length) {
      location.href = "cart.html";
      return "";
    }
    const user = currentUser();
    const needGoogle = APP_CONFIG.googleEnabled && !user;
    return `
      <section class="page-hero"><div class="wrap"><p class="kicker">Checkout</p><h1>Where should it go?</h1></div></section>
      <div class="wrap cart-layout">
        ${
          needGoogle
            ? `<div class="form">
                <p class="kicker">Google account</p>
                <h2 style="margin:0.4rem 0 0.7rem">Sign in to buy</h2>
                <p class="muted">Use Google so we can send the receipt to the right mailbox.</p>
                <a class="btn-google btn-google-lg" href="/auth/google?next=${encodeURIComponent("/checkout.html")}">${I.google}<span>Continue with Google</span></a>
              </div>`
            : `<form class="form" id="checkout-form">
          ${user ? `<p class="notice">Signed in as ${user.name || user.email}</p>` : ""}
          <label class="field"><span>Full name</span><input name="name" required autocomplete="name" value="${user ? user.name || "" : ""}" ${user ? "readonly" : ""}></label>
          <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email" value="${user ? user.email || "" : ""}" ${user ? "readonly" : ""}></label>
          <label class="field"><span>Phone</span><input name="phone" type="tel" required autocomplete="tel" inputmode="numeric" placeholder="10-digit mobile"></label>
          <label class="field"><span>Street address</span><input name="line1" required autocomplete="address-line1" placeholder="House no., street"></label>
          <label class="field"><span>Apartment / landmark (optional)</span><input name="line2" autocomplete="address-line2" placeholder="Flat, society, landmark"></label>
          <div class="two-col">
            <label class="field"><span>City</span><input name="city" required autocomplete="address-level2" placeholder="City"></label>
            <label class="field"><span>PIN code</span><input name="pin" required inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="208001"></label>
          </div>
          <label class="field"><span>State</span>
            <select name="state" required autocomplete="address-level1">
              <option value="">Select state</option>
              ${IN_STATES.map((s) => `<option ${s === "Uttar Pradesh" ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
          <label class="field"><span>Fulfillment</span>
            <select name="ship">
              <option>Ground shipping</option>
              <option>Store pickup</option>
            </select>
          </label>
          <p class="kicker" style="margin-top:0.4rem">Pay with</p>
          <div class="pay-pick">
            <label class="pay-opt"><input type="radio" name="method" value="stripe" ${APP_CONFIG.stripeEnabled ? "checked" : "disabled"}> <span><strong>Card / UPI via Stripe</strong><em>Pay now online</em></span></label>
            <label class="pay-opt"><input type="radio" name="method" value="cod" ${APP_CONFIG.stripeEnabled ? "" : "checked"}> <span><strong>Cash on delivery</strong><em>${
              Number((SITE && SITE.codFee) ?? 500) > 0
                ? `+ ${money(Number((SITE && SITE.codFee) ?? 500))} extra, pay the courier`
                : "Pay the courier in cash"
            }</em></span></label>
          </div>
          <button class="btn btn-accent" type="submit" id="pay-submit">${APP_CONFIG.stripeEnabled ? `Pay · ${money(total)}` : `Place COD order · ${money(total)}`}</button>
        </form>`
        }
        <aside class="summary">
          ${lines.map((l) => `<div class="summary-row"><span>${l.qty}× ${l.product.name}</span><span>${money(l.product.price * l.qty)}</span></div>`).join("")}
          <div class="summary-row"><span>Discount</span><span>${discount ? "−" + money(discount) : "—"}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${ship ? money(ship) : "Free"}</span></div>
          <div class="summary-row" id="cod-fee-row" hidden><span>COD fee</span><span id="cod-fee-amt"></span></div>
          <div class="summary-row total"><span>Total</span><span id="checkout-total">${money(total)}</span></div>
        </aside>
      </div>`;
  },

  build() {
    const wa = waLink("Hi — I am on the Custom Build page and want to pick parts on a call.");
    return `
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">Custom PC</p>
          <h1>Pick the parts. Stay on the line.</h1>
          <p>Build the list here, then call. The owner will check wattage, socket, and case clearance before you pay. If something is wrong, we say so.</p>
        </div>
      </section>
      <div class="wrap builder">
        <div class="builder-main">
          <div class="part-tabs" id="part-tabs" role="tablist" aria-label="Part type"></div>
          <div id="builder-steps"></div>
        </div>
        <aside class="assist" id="builder-assist">
          <p class="kicker">Owner on call</p>
          <h2>Do not guess the last 10%.</h2>
          <p class="muted">Stay on the phone while you tap parts. We will read the list back and stop a bad pairing.</p>
          <div class="call-row">
            <a class="btn btn-accent" href="${SITE.phoneHref}">${I.phone} Call ${SITE.phone}</a>
            <a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">WhatsApp the bench</a>
          </div>
          <p class="faint">${SITE.hours} · ${SITE.address}</p>
        </aside>
      </div>`;
  },

  blog() {
    const list = POSTS.length
      ? POSTS
      : [];
    return `
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">Journal</p>
          <h1>Notes from the bench.</h1>
          <p>How we spec machines, what we will not sell, and what burn-in actually means.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          ${
            list.length
              ? `<div class="blog-grid">${list
                  .map(
                    (p) => `
                <article class="card blog-card">
                  <a class="card-media" href="${postHref(p)}"><img src="${p.cover}" alt=""></a>
                  <div class="card-body">
                    <p class="tagline">${p.date || ""}</p>
                    <h3><a href="${postHref(p)}">${p.title}</a></h3>
                    <p class="tagline">${p.excerpt || ""}</p>
                  </div>
                </article>`
                  )
                  .join("")}</div>`
              : `<div class="empty"><p>No posts yet.</p></div>`
          }
        </div>
      </section>`;
  },

  post() {
    const p = POSTS.find((x) => x.key === routeKey());
    if (!p) {
      return `<section class="section"><div class="wrap empty"><h2>That post is gone.</h2><p><a class="btn btn-accent" href="blog.html">Back to the journal</a></p></div></section>`;
    }
    document.title = `${p.title} · TIBGSTORE`;
    const paras = String(p.body || "")
      .split(/\n{2,}/)
      .map((t) => `<p>${t.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
      .join("");
    return `
      <section class="page-hero">
        <div class="wrap post-body">
          <p class="kicker">${p.date || "Journal"}</p>
          <h1>${p.title}</h1>
          <p>${p.excerpt || ""}</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap post-body">
          ${p.cover ? `<img src="${p.cover}" alt="" style="width:100%;margin-bottom:1.5rem;border:1px solid var(--line)">` : ""}
          ${paras}
          <p style="margin-top:2rem"><a class="btn btn-ghost" href="blog.html">All notes</a> <a class="btn btn-accent" href="build.html">Build a custom PC</a></p>
        </div>
      </section>`;
  },

  success() {
    return `
      <section class="section">
        <div class="wrap empty">
          <p class="kicker">Stripe</p>
          <h1 id="pay-status">Checking payment…</h1>
          <p class="muted" id="pay-msg">Hold on while we confirm with Stripe.</p>
          <p style="margin-top:1.2rem"><a class="btn btn-ghost" href="index.html">Home</a>${currentUser() ? ` <a class="btn btn-accent" href="${accountHref()}">Your orders</a>` : ""}</p>
        </div>
      </section>`;
  },

  account() {
    const user = currentUser();
    if (!user) {
      return `
        <section class="acct">
          <div class="wrap acct-narrow">
            <p class="kicker">Account</p>
            <h1>Your orders</h1>
            <p class="muted">Sign in with Google to see orders and your saved list.</p>
            <a class="btn-google btn-google-lg" href="/auth/google?next=${encodeURIComponent(accountHref())}">${I.google}<span>Continue with Google</span></a>
          </div>
        </section>`;
    }
    const first = (user.name || user.email || "Account").split(" ")[0];
    const tab = location.hash === "#wishlist" ? "wish" : "orders";
    const saved = wishIds()
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter(Boolean);
    return `
      <section class="acct">
        <div class="wrap">
          <header class="acct-head">
            <div class="acct-who">
              ${user.picture ? `<img src="${user.picture}" alt="">` : `<span class="acct-fallback">${(first[0] || "U").toUpperCase()}</span>`}
              <div>
                <p class="kicker">Signed in</p>
                <h1>${user.name || first}</h1>
                <p class="muted">${user.email || ""}</p>
              </div>
            </div>
            <a class="btn btn-line" href="budget.html">Continue shopping</a>
          </header>
          <nav class="acct-tabs">
            <a href="#orders" data-acct-tab="orders" class="${tab === "orders" ? "on" : ""}">Orders</a>
            <a href="#wishlist" data-acct-tab="wish" class="${tab === "wish" ? "on" : ""}">Saved${saved.length ? ` · ${saved.length}` : ""}</a>
          </nav>
          <div id="acct-orders" class="acct-pane" ${tab === "wish" ? "hidden" : ""}>
            <div id="order-history"><p class="muted">Loading orders…</p></div>
          </div>
          <div id="acct-wish" class="acct-pane" ${tab === "orders" ? "hidden" : ""}>
            ${
              saved.length
                ? `<div class="grid-4">${saved.map(productCard).join("")}</div>`
                : `<div class="acct-empty"><p>Nothing saved yet.</p><p class="muted">Tap the heart on a product to keep it here.</p></div>`
            }
          </div>
        </div>
      </section>
      ${viewedBlock()}`;
  },
};

function bindPage() {
  const page = document.body.dataset.page;
  if (page === "product") {
    let qty = 1;
    const product = PRODUCTS.find((x) => x.key === routeKey());
    const id = product ? product.id : "";
    const maxQty = Math.max(1, stockCount(product) - cartQtyOf(id));
    document.querySelectorAll("[data-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        qty = Math.min(maxQty, Math.max(1, qty + Number(btn.dataset.qty)));
        const el = document.getElementById("qty");
        if (el) el.textContent = qty;
        if (Number(btn.dataset.qty) > 0 && qty >= maxQty && stockCount(product) > 0) {
          UI.toast(`Only ${stockCount(product)} left`);
        }
      });
    });
    document.getElementById("add-detail")?.addEventListener("click", () => addToCart(id, qty));
    if (id) recordView(id);
    document.querySelectorAll("[data-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("gallery-main").src = btn.dataset.thumb;
        document.querySelectorAll("[data-thumb]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    const overlay = document.getElementById("zoom-overlay");
    const zoomImg = document.getElementById("zoom-img");
    const openZoom = () => {
      if (!overlay || !zoomImg) return;
      zoomImg.src = document.getElementById("gallery-main")?.src || "";
      overlay.hidden = false;
      document.body.classList.add("modal-open");
    };
    const closeZoom = () => {
      if (!overlay) return;
      overlay.hidden = true;
      overlay.classList.remove("zoomed");
      document.body.classList.remove("modal-open");
    };
    document.getElementById("zoom-open")?.addEventListener("click", openZoom);
    document.getElementById("zoom-close")?.addEventListener("click", closeZoom);
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeZoom();
    });
    zoomImg?.addEventListener("click", () => overlay?.classList.toggle("zoomed"));
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        closeZoom();
        document.removeEventListener("keydown", onEsc);
      }
    });
  }

  document.getElementById("shop-sort")?.addEventListener("change", (e) => {
    location.href = shopQuery({ sort: e.target.value });
  });

  if (page === "cart") {
    document.querySelectorAll("[data-set-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setQty(btn.dataset.setQty, Number(btn.dataset.next));
        render();
      });
    });
    document.getElementById("apply-promo")?.addEventListener("click", async () => {
      const code = document.getElementById("promo").value.trim().toUpperCase();
      if (!code) {
        setAppliedCoupon(null);
        UI.toast("Coupon cleared");
        render();
        return;
      }
      try {
        const data = await api("/api/coupon/validate", {
          method: "POST",
          body: JSON.stringify({ code, items: getCart() }),
        });
        setAppliedCoupon(data);
        UI.toast(`${data.code} applied — ${data.label}`);
      } catch (err) {
        setAppliedCoupon(null);
        UI.toast(err.message);
      }
      render();
    });
  }

  if (page === "contact") {
    document.getElementById("contact-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/api/leads", {
          method: "POST",
          body: JSON.stringify({
            name: fd.get("name"),
            email: fd.get("email"),
            note: `${fd.get("intent") || ""} — ${fd.get("note") || ""}`,
            source: "contact",
          }),
        });
        UI.toast("Saved. We will reply during shop hours.");
        e.target.reset();
      } catch (err) {
        UI.toast(err.message);
      }
    });
  }

  if (page === "checkout") {
    if (qs("cancelled")) UI.toast("Stripe checkout cancelled");
    const form = document.getElementById("checkout-form");
    const paintPay = () => {
      const pay = form.querySelector("[name=method]:checked")?.value || "stripe";
      const { total, codFee } = cartTotals(null, pay);
      const btn = document.getElementById("pay-submit");
      const row = document.getElementById("cod-fee-row");
      const amt = document.getElementById("cod-fee-amt");
      const tot = document.getElementById("checkout-total");
      if (row) row.hidden = !codFee;
      if (amt) amt.textContent = money(codFee);
      if (tot) tot.textContent = money(total);
      if (btn) btn.textContent = pay === "cod" ? `Place COD order · ${money(total)}` : `Pay · ${money(total)}`;
    };
    form?.querySelectorAll("[name=method]").forEach((el) => el.addEventListener("change", paintPay));
    if (form) paintPay();
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        const data = await api("/api/checkout", {
          method: "POST",
          body: JSON.stringify({
            items: getCart(),
            promo: (getAppliedCoupon() && getAppliedCoupon().code) || "",
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            line1: fd.get("line1"),
            line2: fd.get("line2"),
            city: fd.get("city"),
            state: fd.get("state"),
            pin: fd.get("pin"),
            fulfillment: fd.get("ship"),
            method: fd.get("method") || "stripe",
          }),
        });
        if (data.redirect) location.href = data.redirect;
        else if (data.url) location.href = data.url;
        else throw new Error("Checkout did not return a next step");
      } catch (err) {
        if (/Google/i.test(err.message)) {
          location.href = "/auth/google?next=" + encodeURIComponent("/checkout.html");
          return;
        }
        UI.toast(err.message);
        btn.disabled = false;
      }
    });
  }

  if (page === "build") bindBuilder();
  if (page === "success") bindSuccess();
  if (page === "account") bindAccount();
}

function render() {
  const page = document.body.dataset.page;
  const main = document.getElementById("page");
  const map = {
    home: Pages.home,
    budget: () => Pages.tier("budget"),
    mid: () => Pages.tier("mid"),
    high: () => Pages.tier("high"),
    parts: Pages.parts,
    product: Pages.product,
    about: Pages.about,
    contact: Pages.contact,
    faq: Pages.faq,
    cart: Pages.cart,
    checkout: Pages.checkout,
    build: Pages.build,
    blog: Pages.blog,
    post: Pages.post,
    success: Pages.success,
    account: Pages.account,
  };
  main.innerHTML = (map[page] || Pages.home)();
  bindPage();
  UI.bindSliders();
}

function partsByCat(cat) {
  return PRODUCTS.filter((p) => p.type === "part" && p.category === cat);
}

function buildWarnings(sel) {
  const warns = [];
  const cpu = sel.cpu;
  const mb = sel.motherboard;
  const gpu = sel.gpu;
  const psu = sel.psu;
  const cse = sel.case;
  if (cpu && mb && cpu.compat && mb.compat && cpu.compat.socket && mb.compat.socket && cpu.compat.socket !== mb.compat.socket) {
    warns.push(`Socket mismatch: ${cpu.name} is ${cpu.compat.socket}, board is ${mb.compat.socket}.`);
  }
  if (gpu && psu && gpu.compat && psu.compat && gpu.compat.watts && psu.compat.watts) {
    const need = gpu.compat.watts + 200;
    if (psu.compat.watts < need) warns.push(`PSU looks light. ${gpu.name} wants about ${need}W system power; ${psu.name} is ${psu.compat.watts}W.`);
  }
  if (gpu && cse && gpu.compat && cse.compat && gpu.compat.gpuMm && cse.compat.gpuMm && gpu.compat.gpuMm > cse.compat.gpuMm) {
    warns.push(`GPU may not fit. Card is ${gpu.compat.gpuMm}mm, case lists ${cse.compat.gpuMm}mm.`);
  }
  if (gpu && /5090/.test(gpu.name) && psu && (!psu.compat || psu.compat.watts < 1000)) {
    warns.push("We will not sell a 5090 under 1000W. Call and we will fix the list.");
  }
  return warns;
}

function bindBuilder() {
  const selected = {};
  const assemblyOn = { value: true };
  let activeCat = PART_CATS[0].id;
  const leadDraft = { name: "", phone: "", note: "" };

  function nextEmptyCat() {
    const empty = PART_CATS.find((c) => !selected[c.id]);
    return empty ? empty.id : activeCat;
  }

  function paint(opts) {
    const keepScroll = opts && opts.keepScroll;
    const y = window.scrollY;
    const tabs = document.getElementById("part-tabs");
    const steps = document.getElementById("builder-steps");
    const assist = document.getElementById("builder-assist");
    if (!tabs || !steps || !assist) return;

    const cat = PART_CATS.find((c) => c.id === activeCat) || PART_CATS[0];
    const list = partsByCat(cat.id);

    tabs.innerHTML = PART_CATS.map((c) => {
      const chosen = selected[c.id];
      return `<button type="button" class="part-tab ${c.id === activeCat ? "on" : ""} ${chosen ? "has" : ""}" data-cat="${c.id}">
        ${c.label}${chosen ? "<span>✓</span>" : ""}
      </button>`;
    }).join("");

    steps.innerHTML = `
      <div class="build-step">
        <div class="build-step-head">
          <h3>${cat.label}</h3>
          <p class="muted">${list.length} options · tap one, then the next part button. The page stays put.</p>
        </div>
        <div class="pick-grid" id="pick-grid">
          ${list
            .map((p) => {
              const on = selected[cat.id] && selected[cat.id].id === p.id;
              const sold = stockCount(p) <= 0;
              return `<button class="pick ${on ? "on" : ""} ${sold ? "sold-out" : ""}" type="button" data-pick="${cat.id}" data-id="${p.id}" ${sold ? "disabled" : ""}>
                <img src="${p.image}" alt="">
                <div><strong>${p.name}</strong><span class="muted">${p.tagline || ""}</span>${stockCount(p) > 0 && stockCount(p) < 5 ? `<span class="stock-inline">Few left</span>` : sold ? `<span class="stock-inline">Sold out</span>` : ""}</div>
                <div>${money(p.price)}</div>
              </button>`;
            })
            .join("")}
        </div>
      </div>`;

    const picks = Object.values(selected);
    const assemblyPrice = (PRODUCTS.find((p) => p.id === "assembly") || { price: 12699 }).price;
    const sub = picks.reduce((n, p) => n + p.price, 0) + (assemblyOn.value ? assemblyPrice : 0);
    const warns = buildWarnings(selected);
    const summary = picks.map((p) => `${p.name} — ${money(p.price)}`).join("\n");
    const wa = waLink(`Hi, I am building a custom PC on TIBGSTORE.\n\n${summary || "(still picking)"}\n\nTotal so far: ${money(sub)}\nCan you check this list with me?`);

    assist.innerHTML = `
      <p class="kicker">Owner on call</p>
      <h2>Do not guess the last 10%.</h2>
      <p class="muted">Switch parts with the buttons. Call while you tap.</p>
      <div class="assist-total">${money(sub)}</div>
      <ul class="build-list">
        ${PART_CATS.map(
          (c) => `<li>
            <button type="button" class="goto-cat" data-cat="${c.id}">${c.label}</button>
            <span>${selected[c.id] ? selected[c.id].name : "—"}</span>
          </li>`
        ).join("")}
        <li><span>Assembly</span><span>${assemblyOn.value ? money(assemblyPrice) : "none"}</span></li>
      </ul>
      ${warns.map((w) => `<div class="warn">${w}</div>`).join("")}
      <label class="field" style="margin:0.6rem 0">
        <span><input type="checkbox" id="want-assembly" ${assemblyOn.value ? "checked" : ""}> Bench assembly + 24h burn-in (${money(assemblyPrice)})</span>
      </label>
      <div class="call-row">
        <a class="btn btn-accent" href="${SITE.phoneHref}">${I.phone} Call ${SITE.phone}</a>
        <a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">WhatsApp this list</a>
      </div>
      <p class="faint">${SITE.hours}</p>
      <form class="form" id="build-lead" style="margin-top:1rem;padding:0;border:0;background:transparent">
        <label class="field"><span>Your name</span><input name="name" required placeholder="Name" value="${leadDraft.name}"></label>
        <label class="field"><span>Phone</span><input name="phone" required placeholder="So we can call back" value="${leadDraft.phone}"></label>
        <label class="field"><span>Note</span><textarea name="note" placeholder="Resolution, games, silent case…">${leadDraft.note}</textarea></label>
        <button class="btn btn-line" type="submit" style="width:100%">Ask the owner to review this list</button>
      </form>
      <button class="btn btn-accent" type="button" id="add-build" style="width:100%;margin-top:0.6rem" ${picks.length ? "" : "disabled"}>Add selected parts to cart</button>
    `;

    function goCat(id) {
      activeCat = id;
      paint({ keepScroll: true });
    }

    tabs.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        goCat(btn.dataset.cat);
      });
    });
    assist.querySelectorAll(".goto-cat").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        goCat(btn.dataset.cat);
      });
    });
    steps.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.dataset.pick;
        const p = PRODUCTS.find((x) => x.id === btn.dataset.id);
        if (selected[id] && selected[id].id === p.id) delete selected[id];
        else {
          selected[id] = p;
          activeCat = nextEmptyCat();
        }
        paint({ keepScroll: true });
      });
    });
    assist.querySelector("#want-assembly")?.addEventListener("change", (e) => {
      assemblyOn.value = e.target.checked;
      paint({ keepScroll: true });
    });
    assist.querySelector("#add-build")?.addEventListener("click", () => {
      const blocked = picks.filter((p) => stockCount(p) <= 0);
      if (blocked.length) {
        UI.toast(`${blocked[0].name} is sold out`);
        return;
      }
      picks.forEach((p) => addToCart(p.id, 1, true));
      if (assemblyOn.value && PRODUCTS.some((p) => p.id === "assembly")) addToCart("assembly", 1, true);
      UI.toast("Parts added. Checkout when you are ready.");
    });
    const leadForm = assist.querySelector("#build-lead");
    leadForm?.querySelectorAll("input, textarea").forEach((el) => {
      el.addEventListener("input", () => {
        leadDraft[el.name] = el.value;
      });
    });
    leadForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/api/leads", {
          method: "POST",
          body: JSON.stringify({
            name: fd.get("name"),
            phone: fd.get("phone"),
            note: fd.get("note"),
            source: "custom-build",
            build: {
              total: sub,
              parts: picks.map((p) => ({ id: p.id, name: p.name, price: p.price })),
              assembly: assemblyOn.value,
              warnings: warns,
            },
          }),
        });
        UI.toast("List sent. We will call you back.");
        leadDraft.name = "";
        leadDraft.phone = "";
        leadDraft.note = "";
        e.target.reset();
      } catch (err) {
        UI.toast(err.message);
      }
    });

    if (keepScroll) window.scrollTo({ top: y, left: 0, behavior: "instant" });
  }
  paint();
}

function bindAcctTabs() {
  const panes = {
    orders: document.getElementById("acct-orders"),
    wish: document.getElementById("acct-wish"),
  };
  const buttons = document.querySelectorAll("[data-acct-tab]");
  if (!buttons.length) return;
  const show = (id) => {
    Object.entries(panes).forEach(([key, el]) => {
      if (el) el.hidden = key !== id;
    });
    buttons.forEach((b) => b.classList.toggle("on", b.dataset.acctTab === id));
  };
  buttons.forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      const id = b.dataset.acctTab;
      history.replaceState(null, "", id === "wish" ? "#wishlist" : "#orders");
      show(id);
    });
  });
}

async function bindAccount() {
  bindAcctTabs();
  const box = document.getElementById("order-history");
  if (!box) return;
  try {
    const data = await api("/api/my/orders");
    const list = data.orders || [];
    if (!list.length) {
      box.innerHTML = `<div class="empty"><h2>No orders yet.</h2><p class="muted">When you pay, the receipt will show up here.</p><p style="margin-top:1rem"><a class="btn btn-accent" href="budget.html">Shop</a></p></div>`;
      return;
    }
    box.innerHTML = `<div class="order-list">${list
      .map((o) => {
        const raw = o.paidAt || o.createdAt || "";
        const when = raw
          ? new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "";
        const short = String(o.id || "").replace(/^cod-/, "").slice(-10).toUpperCase();
        const ship = o.shipTo
          ? [o.shipTo.line1, o.shipTo.line2, `${o.shipTo.city || ""} ${o.shipTo.pin || ""}`.trim(), o.shipTo.state]
              .filter(Boolean)
              .join(", ")
          : o.address || "";
        const lines = o.lines || [];
        return `<article class="order-card">
          <div class="order-card-top">
            <div class="order-meta">
              ${statusBox(o.status)}
              <span class="order-pay">${o.method === "cod" ? "Cash on delivery" : "Paid online"}</span>
            </div>
            <time class="muted">${when}</time>
          </div>
          <ul class="order-lines">
            ${lines
              .map(
                (l) =>
                  `<li><span>${l.qty}× ${l.name}</span><span>${money((l.unit || 0) * (l.qty || 1))}</span></li>`
              )
              .join("")}
          </ul>
          <div class="order-foot">
            <div class="order-ship">
              ${o.fulfillment ? `<p>${o.fulfillment}</p>` : ""}
              ${ship ? `<p>${ship}</p>` : ""}
              ${o.phone ? `<p>${o.phone}</p>` : ""}
              ${o.tracking ? `<p>Tracking ${o.tracking}</p>` : ""}
              ${o.codFee ? `<p>COD fee ${money(o.codFee)}</p>` : ""}
              ${o.promo ? `<p>Coupon ${o.promo}${o.discount ? " · −" + money(o.discount) : ""}</p>` : ""}
              <p class="faint">#${short}</p>
            </div>
            <div class="order-total">
              <span>Total</span>
              <strong>${money(o.total)}</strong>
            </div>
          </div>
        </article>`;
      })
      .join("")}</div>`;
  } catch (err) {
    box.innerHTML = `<div class="empty"><p>${err.message}</p><p style="margin-top:1rem"><a class="btn-google" href="/auth/google?next=${encodeURIComponent(accountHref())}">${I.google}<span>Sign in</span></a></p></div>`;
  }
}

async function bindSuccess() {
  const sessionId = qs("session_id");
  const orderId = qs("order");
  const status = document.getElementById("pay-status");
  const msg = document.getElementById("pay-msg");
  if (!status) return;
  if (!sessionId && !orderId) {
    status.textContent = "No session.";
    return;
  }
  try {
    if (orderId) {
      const data = await api(`/api/checkout/order?id=${encodeURIComponent(orderId)}`);
      const o = data.order || {};
      saveCart([]);
      setAppliedCoupon(null);
      status.textContent = o.method === "cod" ? "COD order placed." : "We have the order.";
      msg.textContent = o.method === "cod"
        ? `Pay ${money(o.total)} in cash when it arrives${o.codFee ? ` (includes ${money(o.codFee)} COD fee)` : ""}. ${o.email ? "A confirmation was sent to " + o.email + "." : ""}`
        : "Order confirmed.";
      return;
    }
    const data = await api(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`);
    if (data.status === "paid") {
      saveCart([]);
      setAppliedCoupon(null);
      status.textContent = "Paid. We have the order.";
      msg.textContent = data.email
        ? `A receipt was sent to ${data.email}. We will send a bench photo after burn-in.`
        : "Payment received. If you entered an email, a receipt is on the way.";
    } else {
      status.textContent = "Payment not finished.";
      msg.textContent = `Stripe status: ${data.status}`;
    }
  } catch (err) {
    status.textContent = "Could not confirm.";
    msg.textContent = err.message;
  }
}

async function boot() {
  try {
    const [cat, posts, cfg] = await Promise.all([
      fetch("/api/catalog").then((r) => r.json()),
      fetch("/api/posts").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ]);
    if (Array.isArray(cat.products) && cat.products.length) PRODUCTS = cat.products;
    if (Array.isArray(posts.posts) && posts.posts.length) POSTS = posts.posts;
    APP_CONFIG = Object.assign({ ready: true }, cfg);
    if (cfg.site) Object.assign(SITE, cfg.site);
    if (Array.isArray(cfg.wishlist)) APP_CONFIG.wishlist = cfg.wishlist;
  } catch {
    APP_CONFIG.ready = true;
  }
  UI.bindChrome();
  render();
  if (qs("auth") === "fail") UI.toast("Google sign-in failed");
  if (qs("auth") === "off") UI.toast("Google OAuth is not configured");
}

document.addEventListener("DOMContentLoaded", boot);
