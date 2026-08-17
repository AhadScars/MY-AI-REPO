function qs(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

function filtersHtml(shape, gender, max) {
  return `
    <p class="filter-title">Shape</p>
    <div class="chip-row">
      ${SHAPES.map((s) => `<button class="chip ${shape === s ? "on" : ""}" data-filter="shape" data-value="${s}">${s}</button>`).join("")}
    </div>
    <p class="filter-title">Designed for</p>
    <div class="chip-row">
      ${GENDERS.map((g) => `<button class="chip ${gender === g ? "on" : ""}" data-filter="gender" data-value="${g}">${g}</button>`).join("")}
    </div>
    <p class="filter-title">Max price · $${max}</p>
    <input type="range" min="80" max="300" value="${max}" id="price-range">`;
}

function renderHome() {
  const featured = Store.products.filter((p) => p.featured).slice(0, 4);
  const collections = [
    { name: "Aviator", image: "products/solstice.jpg", note: "The original silhouette" },
    { name: "Wayfarer", image: "products/noir.jpg", note: "Everyday black" },
    { name: "Cat-eye", image: "products/isolde.jpg", note: "Lifted, considered" },
    { name: "Sport", image: "products/apex.jpg", note: "Built for glare" },
  ];
  const slides = [
    {
      image: "products/hero-1.jpg",
      kicker: "Spring / Summer",
      title: "Light, framed.",
      text: "New coastal frames for long afternoons and open water. Cut in small batches.",
      cta: "Shop the collection",
      href: "shop.html",
    },
    {
      image: "products/hero-2.jpg",
      kicker: "City edit",
      title: "Worn every day.",
      text: "Quiet black acetate. The pair you reach for without thinking.",
      cta: "Shop wayfarers",
      href: "shop.html?shape=Wayfarer",
    },
    {
      image: "products/hero-3.jpg",
      kicker: "For her",
      title: "A lifted line.",
      text: "Cat-eye frames with olive lenses — vintage glamour, none of the costume.",
      cta: "Shop cat-eye",
      href: "shop.html?shape=Cat-eye",
    },
    {
      image: "products/hero-4.jpg",
      kicker: "Made to travel",
      title: "Take the long way.",
      text: "Lenses mixed for real daylight. Frames that last more than one summer.",
      cta: "Explore all frames",
      href: "shop.html",
    },
  ];
  document.getElementById("page").innerHTML = `
    <section class="hero" id="hero">
      <div class="hero-slides">
        ${slides
          .map(
            (s, i) => `<div class="hero-slide ${i === 0 ? "is-active" : ""}">
              <img src="${Store.img(s.image)}" alt="${s.title}">
            </div>`
          )
          .join("")}
      </div>
      <div class="wrap hero-inner">
        <div class="hero-copy-wrap">
          ${slides
            .map(
              (s, i) => `<div class="hero-copy ${i === 0 ? "is-active" : ""}">
                <p class="eyebrow" style="color:rgba(251,250,247,.8)">${s.kicker}</p>
                <h1>${s.title}</h1>
                <p>${s.text}</p>
                <div class="hero-actions">
                  <a class="btn" style="background:var(--paper);color:var(--ink);border-color:var(--paper)" href="${s.href}">${s.cta}</a>
                  <a class="btn btn-ghost" href="about.html">Our story</a>
                </div>
              </div>`
            )
            .join("")}
        </div>
      </div>
      <button class="hero-nav prev" type="button" aria-label="Previous slide">
        <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <button class="hero-nav next" type="button" aria-label="Next slide">
        <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
      </button>
      <div class="hero-dots">
        ${slides.map((_, i) => `<button class="hero-dot ${i === 0 ? "is-active" : ""}" type="button" data-slide="${i}" aria-label="Go to slide ${i + 1}"></button>`).join("")}
      </div>
    </section>
    <section class="benefits">
      <div class="benefit"><h3>UV400</h3><p>Full-spectrum sun protection in every pair.</p></div>
      <div class="benefit"><h3>Free shipping</h3><p>On orders over $150, worldwide.</p></div>
      <div class="benefit"><h3>30-day returns</h3><p>Try them in real daylight. Send them back if not.</p></div>
      <div class="benefit"><h3>Small batches</h3><p>Short runs. Tight hinges. Honest acetate.</p></div>
    </section>
    <section class="section wrap">
      <div class="section-head">
        <div><p class="eyebrow">Featured</p><h2>This season</h2></div>
        <a href="shop.html" class="muted" style="font-size:12px;letter-spacing:.16em;text-transform:uppercase">View all</a>
      </div>
      <div class="grid-4">${featured.map((p) => UI.productCard(p)).join("")}</div>
    </section>
    <section class="wrap section" style="padding-top:0">
      <div class="duo">
        <a class="duo-card" href="shop.html?gender=Women">
          <img src="${Store.img("products/hero-3.jpg")}" alt="Women">
          <span></span>
          <div>
            <p class="eyebrow" style="color:rgba(251,250,247,.8)">The edit</p>
            <h3>For her</h3>
            <p>Cat-eye, pearl, and wine acetate.</p>
          </div>
        </a>
        <a class="duo-card" href="shop.html?gender=Men">
          <img src="${Store.img("products/hero-2.jpg")}" alt="Men">
          <span></span>
          <div>
            <p class="eyebrow" style="color:rgba(251,250,247,.8)">The edit</p>
            <h3>For him</h3>
            <p>Pilots, sport wraps, and everyday black.</p>
          </div>
        </a>
      </div>
    </section>
    <section style="background:var(--paper);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div class="wrap section">
        <p class="eyebrow">Collections</p>
        <h2 class="page-title">Find your line</h2>
        <div class="grid-4" style="margin-top:32px">
          ${collections
            .map(
              (c) => `<a class="collection" href="shop.html?shape=${encodeURIComponent(c.name)}">
                <img src="${Store.img(c.image)}" alt="${c.name}"><span></span>
                <div><h3>${c.name}</h3><p class="muted" style="color:rgba(251,250,247,.8);margin:4px 0 0">${c.note}</p></div>
              </a>`
            )
            .join("")}
        </div>
      </div>
    </section>
    <section class="section wrap">
      <div class="section-head">
        <div><p class="eyebrow">Just in</p><h2>New arrivals</h2></div>
        <a href="shop.html?sort=new" class="muted" style="font-size:12px;letter-spacing:.16em;text-transform:uppercase">See more</a>
      </div>
      <div class="grid-4">${Store.products.filter((p) => !p.featured).slice(0, 4).map((p) => UI.productCard(p)).join("")}</div>
    </section>
    <section class="wrap split section">
      <img src="${Store.img("products/dune.jpg")}" alt="">
      <div>
        <p class="eyebrow">The maison</p>
        <h2 class="page-title" style="line-height:1.05">Made for the hours the sun is generous.</h2>
        <p class="muted" style="max-width:440px;line-height:1.75">Soleil is a small eyewear house. We obsess over hinge weight, lens warmth, and the way a frame sits after a long day. No seasonal noise — just frames you will reach for again.</p>
        <a href="about.html" style="display:inline-block;margin-top:24px;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Read the story</a>
      </div>
    </section>
    <section style="background:var(--paper);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div class="wrap section">
        <p class="eyebrow">The craft</p>
        <h2 class="page-title">How a pair is made</h2>
        <div class="steps" style="margin-top:40px">
          <div><p class="step-num">01</p><h3 class="display" style="font-size:28px;margin:8px 0">Acetate & metal</h3><p class="muted">Italian acetate and stainless steel, chosen for weight first — then color.</p></div>
          <div><p class="step-num">02</p><h3 class="display" style="font-size:28px;margin:8px 0">Lens mix</h3><p class="muted">UV400 tints mixed for real daylight, not the photo studio. Polarized where glare matters.</p></div>
          <div><p class="step-num">03</p><h3 class="display" style="font-size:28px;margin:8px 0">Hand finish</h3><p class="muted">Hinges seated, temples warmed, and each pair checked on a face — not just a form.</p></div>
        </div>
      </div>
    </section>
    <section class="section wrap">
      <div class="section-head">
        <div><p class="eyebrow">Journal</p><h2>From the studio</h2></div>
      </div>
      <div class="journal">
        <article>
          <img src="${Store.img("products/hero-1.jpg")}" alt="">
          <div>
            <p class="eyebrow">Notes</p>
            <h3>Why gradient lenses feel kinder at dusk</h3>
            <p class="muted">A short note on warmth, contrast, and driving home.</p>
          </div>
        </article>
        <article>
          <img src="${Store.img("products/isolde.jpg")}" alt="">
          <div>
            <p class="eyebrow">Fit</p>
            <h3>How to know a cat-eye will sit right</h3>
            <p class="muted">Cheekbones, temple length, and the two-finger test.</p>
          </div>
        </article>
        <article>
          <img src="${Store.img("products/hero-4.jpg")}" alt="">
          <div>
            <p class="eyebrow">Travel</p>
            <h3>Packing one pair for a week of sun</h3>
            <p class="muted">What we take when the bag has to stay light.</p>
          </div>
        </article>
      </div>
    </section>
    <section class="quotes">
      <div class="wrap">
        <blockquote>“The Solstice aviators feel like they were made for my face. Quiet luxury, finally.”<footer>Amelia R.</footer></blockquote>
        <blockquote>“Packaging was beautiful, lenses are crystal. I bought a second pair the same week.”<footer>James K.</footer></blockquote>
        <blockquote>“Isolde is the only cat-eye I’ve worn that doesn’t feel like a costume.”<footer>Sofia M.</footer></blockquote>
      </div>
    </section>
    <section class="section wrap">
      <p class="eyebrow center">On film</p>
      <h2 class="page-title center">The lookbook</h2>
      <div class="mosaic" style="margin-top:32px">
        ${["solstice", "noir", "luna", "isolde", "apex", "eclipse"]
          .map((id) => {
            const p = Store.products.find((x) => x.image.includes(id));
            const href = p ? "product.html?slug=" + p.slug : "shop.html";
            return `<a href="${href}"><img src="${Store.img("products/" + id + ".jpg")}" alt=""></a>`;
          })
          .join("")}
      </div>
    </section>
    <section class="newsletter">
      <div class="wrap">
        <div>
          <p class="eyebrow" style="color:rgba(251,250,247,.65)">The list</p>
          <h2>New frames, first.</h2>
          <p style="color:rgba(251,250,247,.7);max-width:420px;line-height:1.7">A short note when we release a pair. No seasonal noise.</p>
        </div>
        <form class="news-form" id="news-form">
          <input type="email" required placeholder="Your email" aria-label="Email">
          <button class="btn" type="submit" style="background:var(--paper);color:var(--ink);border-color:var(--paper)">Join</button>
        </form>
      </div>
    </section>
    <section class="section wrap">
      <p class="eyebrow center">Questions</p>
      <h2 class="page-title center">Before you order</h2>
      <div class="faq" style="margin-top:28px">
        <details open><summary>Do you ship internationally?</summary><p>Yes. Free over $150, otherwise a flat $12. Duties may apply depending on where you live.</p></details>
        <details><summary>Are the lenses polarized?</summary><p>Aviators, sport, and oversized styles are polarized. Others are UV400 with a tint mixed for daylight.</p></details>
        <details><summary>What if they don’t fit?</summary><p>Return them within 30 days, unworn with the case. We’ll refund or exchange.</p></details>
        <details><summary>Is checkout a real payment?</summary><p>This is a demo store. Use 4242 4242 4242 4242 — nothing is charged.</p></details>
      </div>
    </section>`;
  initHeroSlider();
  const news = document.getElementById("news-form");
  if (news) {
    news.onsubmit = (e) => {
      e.preventDefault();
      UI.toast("You're on the list.");
      e.target.reset();
    };
  }
}

function initHeroSlider() {
  const root = document.getElementById("hero");
  if (!root) return;
  const slides = [...root.querySelectorAll(".hero-slide")];
  const copies = [...root.querySelectorAll(".hero-copy")];
  const dots = [...root.querySelectorAll(".hero-dot")];
  if (!slides.length) return;
  let index = 0;
  let timer = null;

  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((el, i) => el.classList.toggle("is-active", i === index));
    copies.forEach((el, i) => el.classList.toggle("is-active", i === index));
    dots.forEach((el, i) => el.classList.toggle("is-active", i === index));
  };

  const play = () => {
    stop();
    timer = setInterval(() => show(index + 1), 5500);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  root.querySelector(".hero-nav.next").onclick = () => {
    show(index + 1);
    play();
  };
  root.querySelector(".hero-nav.prev").onclick = () => {
    show(index - 1);
    play();
  };
  dots.forEach((dot) => {
    dot.onclick = () => {
      show(Number(dot.dataset.slide));
      play();
    };
  });

  let startX = 0;
  root.addEventListener("touchstart", (e) => {
    startX = e.changedTouches[0].clientX;
    stop();
  }, { passive: true });
  root.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    play();
  }, { passive: true });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", play);
  play();
}

function renderShop() {
  const params = new URLSearchParams(location.search);
  let shape = params.get("shape") || "";
  let gender = params.get("gender") || "";
  let q = params.get("q") || "";
  let max = Number(params.get("max") || 300);
  let sort = params.get("sort") || "featured";

  const apply = () => {
    const next = new URLSearchParams();
    if (shape) next.set("shape", shape);
    if (gender) next.set("gender", gender);
    if (q) next.set("q", q);
    if (max !== 300) next.set("max", String(max));
    if (sort !== "featured") next.set("sort", sort);
    history.replaceState(null, "", "shop.html" + (next.toString() ? "?" + next : ""));
    paint();
  };

  const list = () => {
    let items = Store.products.slice();
    if (q) {
      const t = q.toLowerCase();
      items = items.filter((p) => `${p.name} ${p.color} ${p.shape}`.toLowerCase().includes(t));
    }
    if (shape) items = items.filter((p) => p.shape === shape);
    if (gender) items = items.filter((p) => p.gender === gender || p.gender === "Unisex");
    items = items.filter((p) => p.price <= max);
    if (sort === "price-asc") items.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") items.sort((a, b) => b.price - a.price);
    if (sort === "new") items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "featured") items.sort((a, b) => Number(b.featured) - Number(a.featured));
    return items;
  };

  const paint = () => {
    const items = list();
    document.getElementById("page").innerHTML = `
      <div class="wrap shop-top">
        <div>
          <p class="eyebrow">The collection</p>
          <h1 class="page-title">All frames</h1>
          <p class="muted">${items.length} styles</p>
        </div>
        <div style="display:flex;gap:12px">
          <button class="btn-line filters-btn" id="open-filters" style="padding:8px 12px;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Filters</button>
          <select id="sort">
            <option value="featured" ${sort === "featured" ? "selected" : ""}>Featured</option>
            <option value="new" ${sort === "new" ? "selected" : ""}>Newest</option>
            <option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Price: low</option>
            <option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Price: high</option>
          </select>
        </div>
      </div>
      <div class="wrap shop-layout">
        <aside class="filters-desk">${filtersHtml(shape, gender, max)}</aside>
        <div class="grid-3">${items.map((p) => UI.productCard(p)).join("")}</div>
      </div>
      <div class="sheet" id="filter-sheet">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <h2 class="display" style="font-size:32px;margin:0">Filters</h2>
          <button id="close-filters">${I.close}</button>
        </div>
        ${filtersHtml(shape, gender, max)}
        <button class="btn btn-full" id="apply-filters" style="margin-top:32px">Show ${items.length} frames</button>
      </div>`;

    document.getElementById("sort").onchange = (e) => {
      sort = e.target.value;
      apply();
    };
    document.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.filter;
        const val = btn.dataset.value;
        if (key === "shape") shape = shape === val ? "" : val;
        if (key === "gender") gender = gender === val ? "" : val;
        apply();
      };
    });
    document.querySelectorAll("#price-range").forEach((el) => {
      el.oninput = () => {
        max = Number(el.value);
      };
      el.onchange = () => apply();
    });
    const sheet = document.getElementById("filter-sheet");
    document.getElementById("open-filters").onclick = () => sheet.classList.add("open");
    document.getElementById("close-filters").onclick = () => sheet.classList.remove("open");
    document.getElementById("apply-filters").onclick = () => {
      sheet.classList.remove("open");
      apply();
    };
  };

  window.rerenderPage = paint;
  paint();
}

function renderProduct() {
  const slug = qs("slug");
  const p = Store.productBySlug(slug);
  const page = document.getElementById("page");
  if (!p) {
    page.innerHTML = `<div class="empty"><h1>Frame not found</h1><a href="shop.html">Back to shop</a></div>`;
    return;
  }
  const paint = () => {
    const product = Store.productBySlug(slug);
    const related = Store.products.filter((x) => x.id !== product.id && x.shape === product.shape).slice(0, 4);
    const saved = Store.wishlist.includes(product.id);
    const sold = product.stock <= 0;
    const qty = Number(document.getElementById("qty-val")?.textContent || 1);
    page.innerHTML = `
      <div class="wrap">
        <p class="crumb"><a href="shop.html">Shop</a> / ${product.name}</p>
        <div class="pdp">
          <div class="pdp-img"><img src="${Store.img(product.image)}" alt="${product.name}"></div>
          <div>
            <p class="eyebrow">${product.shape} · ${product.gender}</p>
            <h1>${product.name}</h1>
            <p style="font-size:20px">${money(product.price)}${product.compareAt ? ` <s class="muted">${money(product.compareAt)}</s>` : ""}</p>
            <p class="muted" style="max-width:440px;line-height:1.75">${product.description}</p>
            <dl class="specs">
              <div><dt>Frame</dt><dd>${product.frame}</dd></div>
              <div><dt>Lens</dt><dd>${product.lens}</dd></div>
              <div><dt>Material</dt><dd>${product.material}</dd></div>
              <div><dt>Stock</dt><dd>${sold ? "Sold out" : product.stock + " available"}</dd></div>
            </dl>
            <div class="buy-row">
              <div class="qty" style="height:48px">
                <button id="qty-minus">${I.minus}</button>
                <span id="qty-val">${qty}</span>
                <button id="qty-plus">${I.plus}</button>
              </div>
              <button class="btn" id="add-pdp" ${sold ? "disabled" : ""}>${sold ? "Sold out" : "Add to bag"}</button>
              <button class="btn-line wish ${saved ? "on" : ""}" data-wish="${product.id}" style="width:48px;height:48px;position:static">${I.heart}</button>
            </div>
            <ul class="details">${product.details.map((d) => `<li>— ${d}</li>`).join("")}</ul>
          </div>
        </div>
        ${
          related.length
            ? `<section class="section"><h2 class="page-title">You may also like</h2><div class="grid-4" style="margin-top:24px">${related.map((r) => UI.productCard(r)).join("")}</div></section>`
            : ""
        }
      </div>`;
    document.getElementById("qty-minus").onclick = () => {
      const el = document.getElementById("qty-val");
      el.textContent = Math.max(1, Number(el.textContent) - 1);
    };
    document.getElementById("qty-plus").onclick = () => {
      const el = document.getElementById("qty-val");
      el.textContent = Math.min(product.stock || 1, Number(el.textContent) + 1);
    };
    document.getElementById("add-pdp").onclick = () => {
      Store.addToCart(product.id, Number(document.getElementById("qty-val").textContent));
    };
  };
  window.rerenderPage = paint;
  paint();
}

function summaryHtml() {
  return `
    <aside class="summary">
      <h2>Summary</h2>
      ${Store.cartItems()
        .map(
          ({ product: p, qty }) =>
            `<div class="line-item" style="margin-bottom:12px"><img src="${Store.img(p.image)}" alt="" style="width:48px;height:64px"><div style="flex:1"><p style="margin:0">${p.name}</p><p class="muted" style="margin:0;font-size:12px">Qty ${qty}</p></div><div>${moneyExact(p.price * qty)}</div></div>`
        )
        .join("")}
      <div class="row"><span class="muted">Subtotal</span><span>${moneyExact(Store.subtotal())}</span></div>
      <div class="row"><span class="muted">Shipping</span><span>${Store.shipping() === 0 ? "Free" : moneyExact(Store.shipping())}</span></div>
      <div class="row"><span class="muted">Tax</span><span>${moneyExact(Store.tax())}</span></div>
      <div class="row" style="border-top:1px solid var(--line);padding-top:12px;font-size:16px"><span>Total</span><span>${moneyExact(Store.total())}</span></div>
    </aside>`;
}

function renderCart() {
  const paint = () => {
    const items = Store.cartItems();
    if (!items.length) {
      document.getElementById("page").innerHTML = `<div class="empty"><h1>Your bag is empty</h1><p class="muted">The right pair is still waiting.</p><a class="btn" href="shop.html" style="margin-top:24px">Shop frames</a></div>`;
      return;
    }
    document.getElementById("page").innerHTML = `
      <div class="wrap" style="padding-top:40px">
        <h1 class="page-title">Your bag</h1>
        <div class="two-col">
          <ul style="list-style:none;padding:0;margin:0;border-top:1px solid var(--line)">
            ${items
              .map(
                ({ product: p, qty }) => `
              <li class="line-item" style="padding:20px 0;border-bottom:1px solid var(--line);margin:0">
                <a href="product.html?slug=${p.slug}"><img src="${Store.img(p.image)}" alt=""></a>
                <div style="flex:1;display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px">
                  <div>
                    <a href="product.html?slug=${p.slug}" class="display" style="font-size:24px">${p.name}</a>
                    <p class="muted" style="margin:4px 0;font-size:12px">${p.color} · ${p.shape}</p>
                    <button class="muted" style="font-size:12px;text-decoration:underline" data-remove="${p.id}">Remove</button>
                  </div>
                  <div>
                    <p>${money(p.price * qty)}</p>
                    <div class="qty">
                      <button data-qty="${p.id}" data-next="${qty - 1}">${I.minus}</button>
                      <span>${qty}</span>
                      <button data-qty="${p.id}" data-next="${qty + 1}">${I.plus}</button>
                    </div>
                  </div>
                </div>
              </li>`
              )
              .join("")}
          </ul>
          ${summaryHtml()}
        </div>
        <div class="wrap" style="max-width:340px;margin-left:auto;padding-bottom:40px">
          <p class="muted" style="font-size:12px">Free shipping on orders over $150.</p>
          <a class="btn btn-full" href="checkout.html">Checkout</a>
        </div>
      </div>`;
  };
  window.rerenderPage = paint;
  paint();
}

function renderCheckout() {
  const page = document.getElementById("page");
  if (!Store.cartItems().length) {
    page.innerHTML = `<div class="empty"><h1>Nothing to check out</h1><a href="shop.html">Return to shop</a></div>`;
    return;
  }
  page.innerHTML = `
    <div class="wrap" style="padding-top:40px">
      <h1 class="page-title">Checkout</h1>
      <p class="muted" style="display:flex;align-items:center;gap:8px;font-size:12px">${I.lock} Demo payment — no real charge. Use 4242 4242 4242 4242.</p>
      <form id="pay-form" class="two-col">
        <div>
          <h2 class="display" style="font-size:30px">Shipping</h2>
          <div class="form-grid two" style="margin-top:16px">
            <label class="field"><span>First name</span><input name="firstName" required></label>
            <label class="field"><span>Last name</span><input name="lastName" required></label>
            <label class="field span-2"><span>Email</span><input name="email" type="email" required></label>
            <label class="field span-2"><span>Phone</span><input name="phone" required></label>
            <label class="field span-2"><span>Address</span><input name="address" required></label>
            <label class="field"><span>City</span><input name="city" required></label>
            <label class="field"><span>ZIP</span><input name="zip" required></label>
            <label class="field span-2"><span>Country</span><input name="country" value="United States" required></label>
          </div>
          <h2 class="display" style="font-size:30px;margin-top:40px">Payment</h2>
          <div class="pay-card">
            <div style="display:flex;justify-content:space-between;font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.6"><span>Soleil Pay</span><span>CARD</span></div>
            <p class="num" id="card-preview">•••• •••• •••• ••••</p>
            <div style="display:flex;justify-content:space-between;font-size:12px;letter-spacing:.14em;text-transform:uppercase">
              <span id="name-preview">Cardholder</span><span id="exp-preview">MM/YY</span>
            </div>
            <p id="brand-preview" style="margin:12px 0 0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)">Card</p>
          </div>
          <div class="form-grid two">
            <label class="field span-2"><span>Card number</span><input id="card-number" placeholder="4242 4242 4242 4242" required></label>
            <label class="field span-2"><span>Name on card</span><input id="card-name" required></label>
            <label class="field"><span>Expiry</span><input id="card-exp" placeholder="MM/YY" required></label>
            <label class="field"><span>CVC</span><input id="card-cvc" required></label>
          </div>
          <p class="err" id="pay-err"></p>
        </div>
        <div>
          ${summaryHtml()}
          <button class="btn btn-full" style="margin-top:16px" id="pay-btn" type="submit">Pay ${moneyExact(Store.total())}</button>
        </div>
      </form>
    </div>`;

  const number = document.getElementById("card-number");
  const name = document.getElementById("card-name");
  const exp = document.getElementById("card-exp");
  number.addEventListener("input", () => {
    number.value = maskCard(number.value);
    document.getElementById("card-preview").textContent = number.value || "•••• •••• •••• ••••";
    document.getElementById("brand-preview").textContent = detectBrand(number.value);
  });
  name.addEventListener("input", () => {
    document.getElementById("name-preview").textContent = name.value || "Cardholder";
  });
  exp.addEventListener("input", () => {
    let v = exp.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    exp.value = v;
    document.getElementById("exp-preview").textContent = v || "MM/YY";
  });
  document.getElementById("card-cvc").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  document.getElementById("pay-form").onsubmit = (e) => {
    e.preventDefault();
    const digits = number.value.replace(/\D/g, "");
    const err = document.getElementById("pay-err");
    if (digits.length < 16) return (err.textContent = "Enter a 16-digit card number.");
    if (!/^\d{2}\/\d{2}$/.test(exp.value)) return (err.textContent = "Expiry must be MM/YY.");
    if (document.getElementById("card-cvc").value.length < 3) return (err.textContent = "Enter a valid CVC.");
    if (digits === "4000000000000002") return (err.textContent = "Card declined. Try 4242 4242 4242 4242.");
    err.textContent = "";
    const btn = document.getElementById("pay-btn");
    btn.disabled = true;
    btn.textContent = "Processing payment…";
    const fd = new FormData(e.target);
    setTimeout(() => {
      const order = Store.placeOrder({
        items: Store.cartItems().map(({ product: p, qty }) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          qty,
          image: p.image,
        })),
        customer: {
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          address: fd.get("address"),
          city: fd.get("city"),
          zip: fd.get("zip"),
          country: fd.get("country"),
        },
        last4: digits.slice(-4),
        cardBrand: detectBrand(digits),
        subtotal: Store.subtotal(),
        shipping: Store.shipping(),
        tax: Store.tax(),
        total: Store.total(),
      });
      UI.toast("Payment successful");
      location.href = "order.html?id=" + encodeURIComponent(order.id);
    }, 1600);
  };
}

function renderOrder() {
  const order = Store.orders.find((o) => o.id === qs("id"));
  if (!order) {
    document.getElementById("page").innerHTML = `<div class="empty"><h1>Order not found</h1><a href="shop.html">Continue shopping</a></div>`;
    return;
  }
  document.getElementById("page").innerHTML = `
    <div class="wrap" style="max-width:640px;padding:64px 0">
      <div style="width:48px;height:48px;border-radius:99px;background:var(--ink);color:var(--paper);display:grid;place-items:center;font-size:22px">✓</div>
      <p class="eyebrow" style="margin-top:24px">Payment confirmed</p>
      <h1 class="page-title">Thank you, ${order.customer.firstName}.</h1>
      <p class="muted">Order <strong style="color:var(--ink)">${order.id}</strong> · ${formatDate(order.createdAt)} · ${order.cardBrand} •••• ${order.last4}</p>
      <ul style="list-style:none;padding:0;border-top:1px solid var(--line)">
        ${order.items
          .map(
            (i) =>
              `<li class="line-item" style="padding:16px 0;border-bottom:1px solid var(--line);margin:0"><img src="${Store.img(i.image)}" style="width:48px;height:64px" alt=""><div style="flex:1"><p style="margin:0">${i.name}</p><p class="muted" style="margin:0;font-size:12px">Qty ${i.qty}</p></div><div>${moneyExact(i.price * i.qty)}</div></li>`
          )
          .join("")}
      </ul>
      <div class="row"><span class="muted">Total paid</span><span>${moneyExact(order.total)}</span></div>
      <p class="muted" style="line-height:1.6">A confirmation would normally go to ${order.customer.email}. This is a demo store — no email is sent and no card was charged.</p>
      <a class="btn" href="shop.html" style="margin-top:24px">Continue shopping</a>
    </div>`;
}

function renderAbout() {
  document.getElementById("page").innerHTML = `
    <div class="wrap center" style="max-width:720px;padding:64px 0">
      <p class="eyebrow">The maison</p>
      <h1 class="page-title" style="font-size:clamp(48px,8vw,72px);line-height:.95">We make frames for light.</h1>
      <p class="muted" style="max-width:520px;margin:24px auto;line-height:1.75">Soleil began as a studio for people who wanted sunglasses that felt considered — not seasonal, not loud. Every pair is edited for weight, warmth, and the way it sits after a long day.</p>
    </div>
    <div class="wrap"><img src="${Store.img("products/hero.jpg")}" alt=""></div>
    <div class="wrap grid-3" style="padding:80px 0;gap:40px">
      <div><h2 class="display" style="font-size:30px;margin:0">Lenses first</h2><p class="muted">UV400, polarized where it matters, tints mixed for real daylight — not just the photo studio.</p></div>
      <div><h2 class="display" style="font-size:30px;margin:0">Small batches</h2><p class="muted">We produce in short runs so hinges stay tight and acetate stays honest.</p></div>
      <div><h2 class="display" style="font-size:30px;margin:0">Kept, not replaced</h2><p class="muted">Spare parts, a case that lasts, and frames designed to survive more than one summer.</p></div>
    </div>
    <div class="center" style="padding-bottom:64px"><a class="btn" href="shop.html">Shop the collection</a></div>`;
}

function renderContact() {
  document.getElementById("page").innerHTML = `
    <div class="wrap split" style="padding:56px 0">
      <div>
        <p class="eyebrow">Contact</p>
        <h1 class="page-title">Write to the studio.</h1>
        <p class="muted" style="max-width:400px;line-height:1.75">Fit questions, wholesale, or a frame that needs a second look. We read everything.</p>
        <p><span class="eyebrow">Email</span><br>hello@soleil.studio</p>
        <p><span class="eyebrow">Studio</span><br>14 Rue du Soleil, Lisbon</p>
        <p><span class="eyebrow">Hours</span><br>Mon–Fri, 10–18</p>
      </div>
      <form id="contact-form">
        <label class="field"><span>Name</span><input required></label>
        <label class="field" style="margin-top:12px"><span>Email</span><input type="email" required></label>
        <label class="field" style="margin-top:12px"><span>Message</span><textarea rows="5" required></textarea></label>
        <button class="btn" style="margin-top:16px">Send message</button>
      </form>
    </div>`;
  document.getElementById("contact-form").onsubmit = (e) => {
    e.preventDefault();
    document.getElementById("contact-form").outerHTML =
      `<div class="summary"><h2>Sent.</h2><p class="muted">Thank you. We’ll get back within two working days.</p></div>`;
    UI.toast("Message received — we’ll reply soon.");
  };
}

function renderWishlist() {
  const paint = () => {
    const list = Store.products.filter((p) => Store.wishlist.includes(p.id));
    document.getElementById("page").innerHTML = `
      <div class="wrap" style="padding:40px 0 64px">
        <h1 class="page-title">Wishlist</h1>
        ${
          list.length
            ? `<div class="grid-4" style="margin-top:32px">${list.map((p) => UI.productCard(p)).join("")}</div>`
            : `<div class="empty"><p class="muted">Nothing saved yet.</p><a class="btn" href="shop.html">Browse frames</a></div>`
        }
      </div>`;
  };
  window.rerenderPage = paint;
  paint();
}

function renderAdminLogin() {
  if (Store.isAdmin) {
    location.href = Store.href("admin/index.html");
    return;
  }
  document.getElementById("page").innerHTML = `
    <div class="login-grid">
      <div class="login-art">
        <img src="${Store.img("products/hero.jpg")}" alt="">
        <p>SOLEIL</p>
      </div>
      <div class="login-form">
        <form id="login-form">
          <a class="logo" href="${Store.href("index.html")}" style="position:static;transform:none">SOLEIL</a>
          <h1 class="page-title" style="margin-top:32px">Sign in</h1>
          <p class="muted">Manage frames, orders, and customers.</p>
          <label class="field" style="margin-top:28px"><span>Email</span><input name="email" type="email" required></label>
          <label class="field" style="margin-top:12px"><span>Password</span><input name="password" type="password" required></label>
          <p class="err" id="login-err"></p>
          <button class="btn btn-full" style="margin-top:20px">Enter studio</button>
          <p class="hint">Demo: <strong>${ADMIN.email}</strong> / <strong>${ADMIN.password}</strong></p>
        </form>
      </div>
    </div>`;
  document.getElementById("login-form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (
      String(fd.get("email")).trim().toLowerCase() === ADMIN.email &&
      fd.get("password") === ADMIN.password
    ) {
      Store.loginAdmin(true);
      location.href = Store.href("admin/index.html");
    } else {
      document.getElementById("login-err").textContent = "Invalid credentials. Use the demo login below.";
    }
  };
}

function renderAdminDashboard() {
  const revenue = Store.orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const customers = new Set(Store.orders.map((o) => o.customer.email)).size;
  const low = Store.products.filter((p) => p.stock < 10);
  document.getElementById("admin-main").innerHTML = `
    <p class="eyebrow">Studio</p>
    <div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap">
      <h1 class="page-title">Overview</h1>
      <a href="${Store.href("index.html")}" class="muted" style="font-size:12px;letter-spacing:.14em;text-transform:uppercase">View store</a>
    </div>
    <div class="stat-grid">
      <div class="stat"><p class="eyebrow">Revenue</p><b>${money(Math.round(revenue))}</b></div>
      <div class="stat"><p class="eyebrow">Orders</p><b>${Store.orders.length}</b></div>
      <div class="stat"><p class="eyebrow">Products</p><b>${Store.products.length}</b></div>
      <div class="stat"><p class="eyebrow">Customers</p><b>${customers}</b></div>
    </div>
    <div class="split" style="align-items:start">
      <section class="panel">
        <h2>Recent orders</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              ${
                Store.orders
                  .slice(0, 6)
                  .map(
                    (o) =>
                      `<tr><td><a href="order.html?id=${encodeURIComponent(o.id)}">${o.id}</a><div class="muted" style="font-size:12px">${formatDate(o.createdAt)}</div></td><td>${o.customer.firstName} ${o.customer.lastName}</td><td>${moneyExact(o.total)}</td><td>${UI.statusBadge(o.status)}</td></tr>`
                  )
                  .join("") || `<tr><td colspan="4" class="center muted" style="padding:40px">No orders yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <h2>Low stock</h2>
        ${
          low
            .slice(0, 6)
            .map(
              (p) =>
                `<div class="prod-cell" style="padding:12px 20px;border-top:1px solid var(--line)"><img src="${Store.img(p.image)}" alt=""><div>${p.name}<div class="muted" style="font-size:12px">${p.stock} left</div></div></div>`
            )
            .join("") || `<p class="center muted" style="padding:32px">Stock is healthy.</p>`
        }
      </section>
    </div>`;
}

function renderAdminProducts() {
  const main = document.getElementById("admin-main");
  const paint = (q = "") => {
    const list = Store.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    main.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:end;flex-wrap:wrap;gap:12px">
        <div><p class="eyebrow">Catalog</p><h1 class="page-title">Products</h1></div>
        <button class="btn" id="new-product">New frame</button>
      </div>
      <input id="prod-q" value="${q}" placeholder="Search products" style="margin:24px 0;max-width:320px">
      <div class="panel table-wrap">
        <table>
          <thead><tr><th>Frame</th><th>Shape</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            ${list
              .map(
                (p) => `<tr>
                  <td><div class="prod-cell"><img src="${Store.img(p.image)}" alt=""><div>${p.name}<div class="muted" style="font-size:12px">${p.color}</div></div></div></td>
                  <td>${p.shape}</td><td>${money(p.price)}</td><td>${p.stock}</td>
                  <td style="text-align:right">
                    <button data-edit="${p.id}">Edit</button>
                    <button data-del="${p.id}" style="color:#9b1c1c">Delete</button>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="modal" id="prod-modal"></div>`;
    document.getElementById("prod-q").oninput = (e) => paint(e.target.value);
    document.getElementById("new-product").onclick = () => openForm(null);
    main.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openForm(Store.productById(b.dataset.edit))));
    main.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = () => {
        const p = Store.productById(b.dataset.del);
        if (p && confirm("Delete " + p.name + "?")) {
          Store.deleteProduct(p.id);
          UI.toast("Product deleted");
          paint(q);
        }
      };
    });
  };

  const openForm = (p) => {
    const modal = document.getElementById("prod-modal");
    const f = p || {
      name: "",
      slug: "",
      price: "",
      compareAt: "",
      description: "",
      shape: "Aviator",
      gender: "Unisex",
      color: "",
      frame: "",
      lens: "",
      material: "",
      stock: 10,
      featured: false,
      image: "products/noir.jpg",
    };
    modal.className = "modal open";
    modal.innerHTML = `
      <div class="modal-card">
        <h2 class="display" style="font-size:32px;margin:0 0 16px">${p ? "Edit frame" : "New frame"}</h2>
        <form id="prod-form" class="form-grid two">
          <label class="field"><span>Name</span><input name="name" value="${f.name}" required></label>
          <label class="field"><span>Slug</span><input name="slug" value="${f.slug}"></label>
          <label class="field"><span>Price</span><input name="price" type="number" value="${f.price}" required></label>
          <label class="field"><span>Compare at</span><input name="compareAt" type="number" value="${f.compareAt || ""}"></label>
          <label class="field span-2"><span>Description</span><textarea name="description" rows="3">${f.description || ""}</textarea></label>
          <label class="field"><span>Shape</span><select name="shape">${SHAPES.map((s) => `<option ${f.shape === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label class="field"><span>Gender</span><select name="gender">${GENDERS.map((s) => `<option ${f.gender === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label class="field"><span>Color</span><input name="color" value="${f.color || ""}"></label>
          <label class="field"><span>Stock</span><input name="stock" type="number" value="${f.stock}"></label>
          <label class="field"><span>Frame</span><input name="frame" value="${f.frame || ""}"></label>
          <label class="field"><span>Lens</span><input name="lens" value="${f.lens || ""}"></label>
          <label class="field"><span>Material</span><input name="material" value="${f.material || ""}"></label>
          <label class="field" style="display:flex;align-items:center;gap:8px;padding-top:22px"><input type="checkbox" name="featured" ${f.featured ? "checked" : ""}> Featured</label>
          <label class="field span-2"><span>Image URL or upload</span><input name="image" id="img-url" value="${f.image}"><input type="file" accept="image/*" id="img-file" style="margin-top:8px"></label>
          <div class="span-2" style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px">
            <button type="button" id="cancel-prod">Cancel</button>
            <button class="btn" type="submit">Save</button>
          </div>
        </form>
      </div>`;
    document.getElementById("cancel-prod").onclick = () => modal.classList.remove("open");
    document.getElementById("img-file").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => (document.getElementById("img-url").value = reader.result);
      reader.readAsDataURL(file);
    };
    document.getElementById("prod-form").onsubmit = (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {
        name: fd.get("name"),
        slug: fd.get("slug") || slugify(fd.get("name")),
        price: Number(fd.get("price")),
        compareAt: fd.get("compareAt") ? Number(fd.get("compareAt")) : undefined,
        description: fd.get("description") || "A Soleil frame.",
        details: ["UV400 protection", "Includes case & cloth"],
        shape: fd.get("shape"),
        gender: fd.get("gender"),
        color: fd.get("color") || "Black",
        frame: fd.get("frame") || fd.get("color"),
        lens: fd.get("lens") || "Smoke",
        material: fd.get("material") || "Acetate",
        stock: Number(fd.get("stock")) || 0,
        featured: ev.target.featured.checked,
        image: fd.get("image"),
      };
      if (p) {
        Store.updateProduct(p.id, payload);
        UI.toast("Product updated");
      } else {
        Store.addProduct(payload);
        UI.toast("Product added");
      }
      modal.classList.remove("open");
      paint();
    };
  };

  paint();
}

function renderAdminOrders() {
  const paint = () => {
    document.getElementById("admin-main").innerHTML = `
      <p class="eyebrow">Sales</p>
      <h1 class="page-title">Orders</h1>
      <div class="panel table-wrap" style="margin-top:24px">
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            ${
              Store.orders
                .map(
                  (o) => `<tr>
                    <td><a href="order.html?id=${encodeURIComponent(o.id)}">${o.id}</a><div class="muted" style="font-size:12px">${formatDate(o.createdAt)}</div></td>
                    <td>${o.customer.firstName} ${o.customer.lastName}<div class="muted" style="font-size:12px">${o.customer.email}</div></td>
                    <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
                    <td>${moneyExact(o.total)}</td>
                    <td>${UI.statusBadge(o.status)}
                      <select data-status="${o.id}" style="margin-left:8px;width:auto">
                        ${STATUSES.map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
                      </select>
                    </td>
                  </tr>`
                )
                .join("") || `<tr><td colspan="5" class="center muted" style="padding:48px">No orders yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>`;
    document.querySelectorAll("[data-status]").forEach((sel) => {
      sel.onchange = () => {
        Store.updateOrderStatus(sel.dataset.status, sel.value);
        paint();
      };
    });
  };
  paint();
}

function renderAdminOrder() {
  const order = Store.orders.find((o) => o.id === qs("id"));
  const main = document.getElementById("admin-main");
  if (!order) {
    main.innerHTML = `<h1 class="page-title">Order not found</h1><a href="orders.html">Back to orders</a>`;
    return;
  }
  const paint = () => {
    const o = Store.orders.find((x) => x.id === order.id);
    const c = o.customer;
    main.innerHTML = `
      <a href="orders.html" class="muted" style="font-size:12px;letter-spacing:.14em;text-transform:uppercase">← Orders</a>
      <div style="display:flex;justify-content:space-between;align-items:end;flex-wrap:wrap;gap:12px;margin-top:8px">
        <div>
          <h1 class="page-title">${o.id}</h1>
          <p class="muted">${UI.statusBadge(o.status)} ${formatDate(o.createdAt)} · ${o.cardBrand} •••• ${o.last4}</p>
        </div>
        <select id="st">${STATUSES.map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      </div>
      <div class="split" style="margin-top:32px;align-items:start">
        <section class="panel" style="padding:20px">
          <h2 style="border:0;padding:0">Items</h2>
          ${o.items
            .map(
              (i) =>
                `<div class="line-item" style="border-top:1px solid var(--line);padding-top:12px"><img src="${Store.img(i.image)}" style="width:48px;height:64px" alt=""><div style="flex:1">${i.name}<div class="muted" style="font-size:12px">Qty ${i.qty}</div></div><div>${moneyExact(i.price * i.qty)}</div></div>`
            )
            .join("")}
          <div class="row"><span class="muted">Subtotal</span><span>${moneyExact(o.subtotal)}</span></div>
          <div class="row"><span class="muted">Shipping</span><span>${moneyExact(o.shipping)}</span></div>
          <div class="row"><span class="muted">Tax</span><span>${moneyExact(o.tax)}</span></div>
          <div class="row"><span>Total</span><span>${moneyExact(o.total)}</span></div>
        </section>
        <section class="panel" style="padding:20px">
          <h2 style="border:0;padding:0">Customer</h2>
          <p>${c.firstName} ${c.lastName}<br><span class="muted">${c.email}<br>${c.phone}</span></p>
          <p class="eyebrow">Ship to</p>
          <p>${c.address}<br>${c.city} ${c.zip}<br>${c.country}</p>
        </section>
      </div>`;
    document.getElementById("st").onchange = (e) => {
      Store.updateOrderStatus(o.id, e.target.value);
      paint();
    };
  };
  paint();
}

function renderAdminCustomers() {
  const map = new Map();
  Store.orders.forEach((o) => {
    const key = o.customer.email;
    const prev = map.get(key);
    const spent = o.status === "cancelled" ? 0 : o.total;
    if (prev) {
      prev.orders += 1;
      prev.spent += spent;
    } else {
      map.set(key, {
        name: o.customer.firstName + " " + o.customer.lastName,
        email: o.customer.email,
        phone: o.customer.phone,
        orders: 1,
        spent,
      });
    }
  });
  const customers = [...map.values()].sort((a, b) => b.spent - a.spent);
  document.getElementById("admin-main").innerHTML = `
    <p class="eyebrow">People</p>
    <h1 class="page-title">Customers</h1>
    <div class="panel table-wrap" style="margin-top:24px">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Spent</th></tr></thead>
        <tbody>
          ${
            customers
              .map(
                (c) =>
                  `<tr><td>${c.name}<div class="muted" style="font-size:12px">${c.phone}</div></td><td>${c.email}</td><td>${c.orders}</td><td>${moneyExact(c.spent)}</td></tr>`
              )
              .join("") || `<tr><td colspan="4" class="center muted" style="padding:48px">Customers appear after a checkout.</td></tr>`
          }
        </tbody>
      </table>
    </div>`;
}

function renderAdminSettings() {
  document.getElementById("admin-main").innerHTML = `
    <p class="eyebrow">Maison</p>
    <h1 class="page-title">Settings</h1>
    <div style="max-width:560px;margin-top:24px;display:grid;gap:16px">
      <section class="panel" style="padding:20px">
        <h2 style="border:0;padding:0">Demo access</h2>
        <p class="muted">Email <strong>${ADMIN.email}</strong><br>Password <strong>${ADMIN.password}</strong></p>
      </section>
      <section class="panel" style="padding:20px">
        <h2 style="border:0;padding:0">Payments</h2>
        <p class="muted">Use card <strong>4242 4242 4242 4242</strong>, any future expiry, any CVC. Card <strong>4000 0000 0000 0002</strong> is declined on purpose.</p>
      </section>
      <section class="panel" style="padding:20px">
        <h2 style="border:0;padding:0">Data</h2>
        <p class="muted">This demo stores catalog, cart, and orders in your browser.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
          <button class="btn-line" id="reset-cat" style="padding:8px 14px">Reset catalog</button>
          <button class="btn-line" id="clear-ord" style="padding:8px 14px">Clear orders</button>
        </div>
      </section>
    </div>`;
  document.getElementById("reset-cat").onclick = () => {
    Store.resetCatalog();
    UI.toast("Catalog reset");
  };
  document.getElementById("clear-ord").onclick = () => {
    Store.clearOrders();
    UI.toast("Orders cleared");
  };
}

document.addEventListener("DOMContentLoaded", () => {
  Store.init();
  const page = document.body.dataset.page;
  const adminPages = {
    "admin-dashboard": renderAdminDashboard,
    "admin-products": renderAdminProducts,
    "admin-orders": renderAdminOrders,
    "admin-order": renderAdminOrder,
    "admin-customers": renderAdminCustomers,
    "admin-settings": renderAdminSettings,
  };

  if (page === "admin-login") {
    renderAdminLogin();
    return;
  }
  if (adminPages[page]) {
    if (!UI.requireAdmin()) return;
    const map = {
      "admin-dashboard": "overview",
      "admin-products": "products",
      "admin-orders": "orders",
      "admin-order": "orders",
      "admin-customers": "customers",
      "admin-settings": "settings",
    };
    UI.mountAdmin(map[page]);
    adminPages[page]();
    return;
  }

  UI.mountStore();
  const pages = {
    home: renderHome,
    shop: renderShop,
    product: renderProduct,
    cart: renderCart,
    checkout: renderCheckout,
    order: renderOrder,
    about: renderAbout,
    contact: renderContact,
    wishlist: renderWishlist,
  };
  (pages[page] || renderHome)();
});
