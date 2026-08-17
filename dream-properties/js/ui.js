const I = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h4l1 5-2.5 1.5a12 12 0 0 0 5 5L16 12l5 1v4c0 1-1 2-2 2C9 19 5 15 5 5c0-1 1-2 2-2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8.5 8.5 0 0 0-7.3 12.9L4 21l5.3-.7A8.5 8.5 0 1 0 12 3zm4.7 12.1c-.2.6-1.2 1.1-1.7 1.1-.4 0-.9.2-3.1-.7-2.6-1.1-4.3-3.8-4.4-4-.1-.2-.9-1.2-.9-2.3s.6-1.6.8-1.8.4-.3.6-.3h.4c.1 0 .3 0 .5.4.2.5.7 1.7.8 1.8s.1.3 0 .5c-.1.2-.2.3-.3.5l-.3.3c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1s.3 0 .5-.1l.7-.8c.1-.2.3-.1.5-.1.2 0 1.3.6 1.5.7s.4.2.4.3-.1.9-.3 1.5z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.5-8.2C.8 9 2.2 5.5 6 5.5c2 0 3.4 1.2 4 2.2.6-1 2-2.2 4-2.2 3.8 0 5.2 3.5 3.5 6.3C19 15.6 12 20 12 20z"/></svg>',
  bed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18v-6a3 3 0 0 1 3-3h13v9"/><path d="M3 14h18"/><path d="M6 9V7h6v2"/></svg>',
  bath: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M6 12V7a2 2 0 0 1 2-2h1"/></svg>',
  area: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 10h16M10 4v16"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.6 6.4L21 10l-5 4.2 1.6 6.8L12 17.5 6.4 21 8 14.2 3 10l6.4-.6z"/></svg>',
};

function qs(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

function waLink(text) {
  const msg = encodeURIComponent(text || "Hello Dream Properties, I would like to speak with Haseeb.");
  return `https://wa.me/${SITE.whatsapp}?text=${msg}`;
}

function telLink() {
  return `tel:${SITE.phone}`;
}

function stars(n) {
  return Array.from({ length: 5 }, (_, i) => `<span class="star ${i < n ? "on" : ""}">${I.star}</span>`).join("");
}

function workCard(p, large) {
  return `
    <article class="card ${large ? "card-lg" : ""}">
      <a class="card-media" href="property.html?id=${encodeURIComponent(p.id)}">
        <img src="${cover(p)}" alt="${p.title}" loading="lazy">
        <span class="card-hover">View photos ${I.arrow}</span>
      </a>
      <div class="card-body">
        <p class="card-kicker">${p.type}</p>
        <h3><a href="property.html?id=${encodeURIComponent(p.id)}">${p.title}</a></h3>
      </div>
    </article>`;
}

function reviewCard(r) {
  const initials = r.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return `
    <article class="review">
      <div class="review-top">
        <span class="avatar">${initials}</span>
        <div>
          <strong>${r.name}</strong>
          <p>${r.meta}</p>
        </div>
      </div>
      <div class="stars">${stars(r.stars)}</div>
      <p class="review-text">${r.text}</p>
      ${
        r.reply
          ? `<div class="owner-reply"><p class="reply-label">Response from the owner · ${r.replyWhen}</p><p>${r.reply}</p></div>`
          : ""
      }
    </article>`;
}

function enquireForm(context) {
  const preset = qs("need") || qs("intent");
  const selected = preset === "sell" ? "Sell a home" : preset === "buy" ? "Find a home" : "";
  return `
    <form class="enquire" data-enquire="${context || "general"}">
      <label>Full name<input name="name" required placeholder="Your name" autocomplete="name"></label>
      <label>Phone<input name="phone" required type="tel" placeholder="10-digit mobile" autocomplete="tel"></label>
      <label>How can we help?
        <select name="need">
          <option value="Find a home" ${selected === "Find a home" ? "selected" : ""}>I want to find a home</option>
          <option value="Sell a home" ${selected === "Sell a home" ? "selected" : ""}>I want to sell a home</option>
          <option value="A conversation">Just a conversation</option>
        </select>
      </label>
      <label>Your brief<input name="note" placeholder="Locality, rooms, timeline — whatever you know"></label>
      <button class="btn btn-gold" type="submit">Write on WhatsApp ${I.arrow}</button>
      <p class="fine">We reply during ${SITE.hoursShort}. A conversation, not a sales script.</p>
    </form>`;
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
    setTimeout(() => el.remove(), 2800);
  },

  header() {
    const page = document.body.dataset.page;
    const links = [
      ["index.html", "Home", "home"],
      ["properties.html", "Work", "properties"],
      ["services.html", "Services", "services"],
      ["reviews.html", "Reviews", "reviews"],
      ["about.html", "About", "about"],
      ["contact.html", "Contact", "contact"],
    ];
    return `
      <div class="topbar">
        <div class="wrap topbar-inner">
          <span>${I.pin} ${SITE.address}, ${SITE.city}</span>
          <span>${SITE.hoursShort} · <a href="${telLink()}">${SITE.phoneDisplay}</a></span>
        </div>
      </div>
      <header class="site-header">
        <div class="wrap header-inner">
          <a class="logo" href="index.html">
            <span class="logo-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40"><path d="M8 28V16L20 8l12 8v12h-6V20h-12v8H8z"/></svg>
            </span>
            <span>
              <strong>Dream Properties</strong>
              <em>Kanpur · 14+ years</em>
            </span>
          </a>
          <nav class="nav" id="nav">
            ${links
              .map(
                ([href, label, key]) =>
                  `<a href="${href}" class="${page === key ? "is-on" : ""}">${label}</a>`
              )
              .join("")}
          </nav>
          <div class="header-cta">
            <a class="btn btn-ghost" href="${telLink()}">${I.phone} Call</a>
            <a class="btn btn-gold" href="${waLink()}" target="_blank" rel="noopener">${I.wa}<span> WhatsApp</span></a>
            <button class="nav-toggle" data-nav aria-label="Menu">${I.menu}</button>
          </div>
        </div>
      </header>`;
  },

  footer() {
    return `
      <footer class="site-footer">
        <div class="wrap footer-grid">
          <div>
            <a class="logo light" href="index.html">
              <span class="logo-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40"><path d="M8 28V16L20 8l12 8v12h-6V20h-12v8H8z"/></svg>
              </span>
              <span>
                <strong>Dream Properties</strong>
                <em>And Construction</em>
              </span>
            </a>
            <p class="footer-lead">${SITE.tagline} Led by ${SITE.owner}, Swaroop Nagar.</p>
          </div>
          <div>
            <p class="foot-title">Visit</p>
            <p>${SITE.address}<br>${SITE.city}</p>
            <a class="text-link gold" href="${SITE.maps}" target="_blank" rel="noopener">Open in Google Maps</a>
          </div>
          <div>
            <p class="foot-title">Talk to us</p>
            <p><a href="${telLink()}">${SITE.phoneDisplay}</a><br>${SITE.hours}</p>
            <p>Ask for ${SITE.owner}</p>
          </div>
          <div>
            <p class="foot-title">Explore</p>
            <a href="properties.html">Work</a>
            <a href="reviews.html">Reviews</a>
            <a href="about.html">About</a>
            <a href="contact.html">Contact</a>
          </div>
        </div>
        <div class="wrap footer-base">
          <p>© ${new Date().getFullYear()} ${SITE.legal}. Kanpur.</p>
          <p>Transparent dealings. No high-pressure close.</p>
        </div>
      </footer>
      <div class="float-cta">
        <a class="float-btn call" href="${telLink()}" aria-label="Call">${I.phone}<span>Call now</span></a>
        <a class="float-btn wa" href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.wa}<span>WhatsApp</span></a>
      </div>
      <div class="mobile-bar">
        <a href="${telLink()}">${I.phone} Call</a>
        <a class="wa" href="${waLink()}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>
        <a href="contact.html">Contact</a>
      </div>`;
  },

  bindChrome() {
    document.getElementById("site-header").innerHTML = this.header();
    document.getElementById("site-footer").innerHTML = this.footer();

    document.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-nav]");
      if (toggle) document.body.classList.toggle("nav-open");
    });

    document.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-enquire]");
      if (!form) return;
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const property = form.dataset.enquire;
      const lines = [
        `Hello ${SITE.owner}, I am ${data.name}.`,
        `Phone: ${data.phone}`,
        `Need: ${data.need}`,
        data.note ? `Details: ${data.note}` : "",
        property && property !== "general" && property !== "modal" && property !== "contact" ? `About your work: ${property}` : "",
        "Please call me when you can.",
      ]
        .filter(Boolean)
        .join("\n");
      const leads = JSON.parse(localStorage.getItem("dp-leads") || "[]");
      leads.push({ ...data, property, at: Date.now() });
      localStorage.setItem("dp-leads", JSON.stringify(leads));
      this.toast("Opening WhatsApp…");
      window.open(waLink(lines), "_blank", "noopener");
      form.reset();
    });
  },
};
