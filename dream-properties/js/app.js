function filterWork() {
  const type = qs("type");
  const area = qs("area");
  return WORK.filter((p) => {
    if (type && p.type !== type) return false;
    if (area && p.title !== area && p.id !== area) return false;
    return true;
  });
}

function renderHome() {
  const featured = WORK.filter((p) => p.featured);
  document.getElementById("page").innerHTML = `
    <section class="hero">
      <img class="hero-img" src="assets/images/hero.jpg" alt="A home presented by Dream Properties">
      <div class="hero-veil"></div>
      <div class="wrap hero-copy">
        <p class="eyebrow gold">Dream Properties · Kanpur</p>
        <h1 class="display">How we<br>present a home.</h1>
        <p class="hero-lead">A photo book of work by ${SITE.owner}. Look through the rooms — then call if you want the same eye on yours.</p>
        <div class="row-gap hero-actions">
          <a class="btn btn-gold" href="properties.html">See the work ${I.arrow}</a>
          <a class="btn btn-ghost-light" href="contact.html">Contact</a>
        </div>
        <div class="hero-trust">
          <div><strong>${SITE.experience}</strong><span>years in Kanpur</span></div>
          <div><strong>${SITE.rating}</strong><span>Google reviews</span></div>
          <div><strong>${WORK.length}</strong><span>homes in this book</span></div>
          <div><strong>${SITE.team}</strong><span>people on the desk</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <p class="eyebrow">Showcase</p>
            <h2 class="display">Selected homes.</h2>
          </div>
          <a class="btn btn-line" href="properties.html">All photos ${I.arrow}</a>
        </div>
        <div class="grid cards">
          ${featured.map((p) => workCard(p, true)).join("")}
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap split">
        <div>
          <p class="eyebrow">The practice</p>
          <h2 class="display">No pressure. The right locality.</h2>
          <p class="lede">Clients write about the same things: polite agents, transparent dealings, and a team that knows Kanpur.</p>
          <ul class="ticks">
            <li>Led by ${SITE.owner}, 14+ years, Swaroop Nagar.</li>
            <li>Apartments, houses, penthouses, and plots.</li>
            <li>A luxury flat has been found in a day when the brief is clear.</li>
          </ul>
          <div class="row-gap">
            <a class="btn btn-gold" href="contact.html">Contact the office</a>
            <a class="btn btn-line" href="about.html">About</a>
          </div>
        </div>
        <figure class="frame">
          <img src="assets/images/consult.jpg" alt="Dream Properties, Swaroop Nagar">
          <figcaption>114/94B, Swaroop Nagar — ask for ${SITE.owner}.</figcaption>
        </figure>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <p class="eyebrow">From Google</p>
            <h2 class="display">What clients wrote.</h2>
          </div>
          <a class="btn btn-line" href="reviews.html">All ${REVIEWS.length} reviews</a>
        </div>
        <div class="grid reviews-home">
          ${REVIEWS.slice(0, 3).map(reviewCard).join("")}
        </div>
      </div>
    </section>

    <section class="cta-strip">
      <div class="wrap cta-inner">
        <div>
          <p class="eyebrow gold">The office</p>
          <h2 class="display">${SITE.phoneDisplay}</h2>
          <p>${SITE.hoursShort} · ${SITE.address}</p>
        </div>
        <div class="row-gap">
          <a class="btn btn-gold" href="${telLink()}">${I.phone} Call</a>
          <a class="btn btn-ghost-light" href="${waLink()}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>
        </div>
      </div>
    </section>`;
}

function renderProperties() {
  const list = filterWork();
  const type = qs("type");
  const heading = type || "The book";
  document.getElementById("page").innerHTML = `
    <section class="page-hero slim">
      <img src="assets/images/building.jpg" alt="">
      <div class="wrap page-hero-copy">
        <p class="eyebrow gold">Showcase</p>
        <h1 class="display">${heading}</h1>
      </div>
    </section>
    <section class="section tight">
      <div class="wrap">
        <div class="filter-row">
          <a class="chip ${!type ? "on" : ""}" href="properties.html">All</a>
          ${TYPES.map((t) => `<a class="chip ${type === t ? "on" : ""}" href="properties.html?type=${encodeURIComponent(t)}">${t}</a>`).join("")}
        </div>
        ${
          list.length
            ? `<div class="grid cards">${list.map((p) => workCard(p)).join("")}</div>`
            : `<div class="empty"><p>No photos in this set yet.</p></div>`
        }
      </div>
    </section>`;
}

function renderProperty() {
  const p = WORK.find((x) => x.id === qs("id"));
  if (!p) {
    location.replace("properties.html");
    return;
  }
  const shots = propertyPhotos(p);
  const more = WORK.filter((x) => x.id !== p.id).slice(0, 3);
  document.title = `${p.title} · Dream Properties`;
  document.getElementById("page").innerHTML = `
    <section class="album">
      <div class="wrap">
        <div class="crumbs"><a href="properties.html">Work</a> / ${p.title}</div>
        <p class="card-kicker">${p.type}</p>
        <h1 class="display">${p.title}</h1>
        <div class="album-main" data-gallery>
          <figure class="gallery-main">
            <img src="${shots[0]}" alt="${p.title}" id="gallery-main">
          </figure>
          ${
            shots.length > 1
              ? `<div class="thumbs">
                  ${shots
                    .map(
                      (src, i) =>
                        `<button type="button" class="${i === 0 ? "on" : ""}" data-src="${src}"><img src="${src}" alt=""></button>`
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
      </div>
    </section>
    ${
      more.length
        ? `<section class="section alt">
            <div class="wrap">
              <div class="section-head">
                <div>
                  <p class="eyebrow">More from the book</p>
                  <h2 class="display">Other homes.</h2>
                </div>
              </div>
              <div class="grid cards">${more.map((x) => workCard(x)).join("")}</div>
            </div>
          </section>`
        : ""
    }`;

  document.querySelector("[data-gallery]")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-src]");
    if (!btn) return;
    document.getElementById("gallery-main").src = btn.dataset.src;
    document.querySelectorAll("[data-gallery] .thumbs button").forEach((b) => b.classList.toggle("on", b === btn));
  });
}

function renderAbout() {
  document.getElementById("page").innerHTML = `
    <section class="page-hero">
      <img src="assets/images/consult.jpg" alt="Dream Properties consultation room">
      <div class="wrap page-hero-copy">
        <p class="eyebrow gold">The office</p>
        <h1 class="display">Dream Properties, Swaroop Nagar.</h1>
        <p>Led by ${SITE.owner}. 14+ years in Kanpur.</p>
      </div>
    </section>
    <section class="section">
      <div class="wrap split">
        <div>
          <p class="eyebrow">Who we are</p>
          <h2 class="display">The team people call after the others.</h2>
          <p class="lede">From 114/94B, Swaroop Nagar — near Kanpur Vidyamandir — a team of up to ten people finds and places homes across the city.</p>
          <p>${SITE.owner} is the name clients mention. Reviews talk about transparent dealings, polite agents, and no high-pressure tactics.</p>
          <p>Monday to Saturday, 10:00 AM to 7:00 PM. Walk in, or send a WhatsApp first.</p>
        </div>
        <figure class="frame">
          <img src="assets/images/villa-civil.jpg" alt="">
        </figure>
      </div>
    </section>
    <section class="section alt">
      <div class="wrap stats">
        <div><strong>14+</strong><span>Years in Kanpur</span></div>
        <div><strong>10</strong><span>People on the desk</span></div>
        <div><strong>5.0</strong><span>Recent Google reviews</span></div>
        <div><strong>1 day</strong><span>To a luxury flat, when the brief is clear</span></div>
      </div>
    </section>`;
}

function renderServices() {
  document.getElementById("page").innerHTML = `
    <section class="page-hero slim">
      <img src="assets/images/kitchen.jpg" alt="">
      <div class="wrap page-hero-copy">
        <p class="eyebrow gold">The book</p>
        <h1 class="display">What you will see in the photos.</h1>
      </div>
    </section>
    <section class="section">
      <div class="wrap">
        <div class="grid services">
          ${SERVICES.map(
            (s, i) => `
            <a class="service" href="${s.href}">
              <span class="num">0${i + 1}</span>
              <h3>${s.title}</h3>
              <p>${s.text}</p>
              <span class="text-link">Open photos ${I.arrow}</span>
            </a>`
          ).join("")}
        </div>
      </div>
    </section>`;
}

function renderReviews() {
  document.getElementById("page").innerHTML = `
    <section class="page-hero slim">
      <img src="assets/images/villa-living.jpg" alt="">
      <div class="wrap page-hero-copy">
        <p class="eyebrow gold">Google reviews</p>
        <h1 class="display">${SITE.rating} from people we worked with.</h1>
      </div>
    </section>
    <section class="section">
      <div class="wrap review-list">
        ${REVIEWS.map(reviewCard).join("")}
        <aside class="review-cta">
          <p class="eyebrow">Been here?</p>
          <h2 class="display">Leave the next one on Google.</h2>
          <a class="btn btn-gold" href="${SITE.maps}" target="_blank" rel="noopener">Open our Google listing</a>
        </aside>
      </div>
    </section>`;
}

function renderContact() {
  document.getElementById("page").innerHTML = `
    <section class="page-hero slim">
      <img src="assets/images/street.jpg" alt="Swaroop Nagar">
      <div class="wrap page-hero-copy">
        <p class="eyebrow gold">Visit or write</p>
        <h1 class="display">Swaroop Nagar.</h1>
        <p>${SITE.address}, ${SITE.city}. ${SITE.hours}.</p>
      </div>
    </section>
    <section class="section">
      <div class="wrap contact-grid">
        <div>
          <p class="eyebrow">The office</p>
          <h2 class="display">${SITE.legal}</h2>
          <ul class="contact-facts">
            <li><strong>Address</strong><span>${SITE.address}<br>${SITE.city}</span></li>
            <li><strong>Phone</strong><span><a href="${telLink()}">${SITE.phoneDisplay}</a></span></li>
            <li><strong>Hours</strong><span>${SITE.hours}</span></li>
            <li><strong>Ask for</strong><span>${SITE.owner}</span></li>
          </ul>
          <div class="row-gap">
            <a class="btn btn-gold" href="${telLink()}">Call</a>
            <a class="btn btn-line" href="${SITE.maps}" target="_blank" rel="noopener">Maps</a>
          </div>
          <div class="map-wrap">
            <iframe title="Dream Properties on Google Maps" src="${SITE.mapsEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </div>
        <div class="contact-card">
          <p class="eyebrow">Write</p>
          <h2 class="display">A note to the desk.</h2>
          ${enquireForm("contact")}
        </div>
      </div>
    </section>`;
}

const pages = {
  home: renderHome,
  properties: renderProperties,
  property: renderProperty,
  about: renderAbout,
  services: renderServices,
  reviews: renderReviews,
  contact: renderContact,
};

document.addEventListener("DOMContentLoaded", () => {
  UI.bindChrome();
  const render = pages[document.body.dataset.page];
  if (render) render();
});
