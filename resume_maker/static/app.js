/* Resume Maker — frontend */
(() => {
  "use strict";

  const MONTHS_FULL = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const MONTHS_SHORT = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];

  let state = null;
  let zoom = 1;
  let metaTimer = null;
  let listRebuildLock = false;

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  function getPath(obj, path) {
    return path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), obj);
  }

  function setPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // ---------- Date formatting (mirrors Python) ----------
  function formatDate(year, month, day, style, presentLabel, isPresent) {
    if (isPresent) return presentLabel || "Present";
    if (year == null || year === "") return "";
    const y = String(year).trim();
    let m = month == null || month === "" ? null : parseInt(month, 10);
    if (Number.isNaN(m)) m = null;
    const d = day == null || day === "" ? null : parseInt(day, 10);
    if (style === "year_only" || m == null) return y;
    if (style === "full_month") return `${MONTHS_FULL[m - 1]} ${y}`;
    if (style === "short_month") return `${MONTHS_SHORT[m - 1]} ${y}`;
    if (style === "month_year_dot") return `${MONTHS_SHORT[m - 1]}. ${y}`;
    if (style === "numeric") return `${String(m).padStart(2, "0")}/${y}`;
    if (style === "numeric_day") return `${String(m).padStart(2, "0")}/${String(d || 1).padStart(2, "0")}/${y}`;
    if (style === "iso") return `${y}-${String(m).padStart(2, "0")}`;
    if (style === "iso_day") return `${y}-${String(m).padStart(2, "0")}-${String(d || 1).padStart(2, "0")}`;
    return `${MONTHS_SHORT[m - 1]} ${y}`;
  }

  function formatRange(start, end, style, presentLabel, sep) {
    const s = formatDate(start?.year, start?.month, start?.day, style);
    const e = formatDate(end?.year, end?.month, end?.day, style, presentLabel, !!end?.present);
    if (s && e) return `${s}${sep}${e}`;
    return s || e;
  }

  function monthOptions(selected) {
    let html = `<option value="">—</option>`;
    for (let i = 1; i <= 12; i++) {
      html += `<option value="${i}" ${String(selected) === String(i) ? "selected" : ""}>${MONTHS_SHORT[i - 1]} (${i})</option>`;
    }
    return html;
  }

  // ---------- Bind simple fields ----------
  function bindFields() {
    $$("[data-path]").forEach((el) => {
      const path = el.getAttribute("data-path");
      const val = getPath(state, path);
      if (el.type === "checkbox" || el.hasAttribute("data-bool")) {
        el.checked = !!val;
      } else if (el.type === "range" || el.hasAttribute("data-num")) {
        el.value = val ?? "";
      } else if (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.value = val ?? "";
      }
    });
    $$("[data-val-for]").forEach((span) => {
      const path = span.getAttribute("data-val-for");
      span.textContent = getPath(state, path) ?? "";
    });
    $$("[data-color-for]").forEach((picker) => {
      const path = picker.getAttribute("data-color-for");
      let v = getPath(state, path) || "#000000";
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) v = "#000000";
      picker.value = v.length === 4
        ? "#" + [...v.slice(1)].map((c) => c + c).join("")
        : v;
    });
    renderSectionVisibility();
    renderDatePills();
  }

  function onFieldChange(el) {
    const path = el.getAttribute("data-path");
    if (!path) return;
    let value;
    if (el.type === "checkbox" || el.hasAttribute("data-bool")) {
      value = el.checked;
    } else if (el.hasAttribute("data-num") || el.type === "range" || el.type === "number") {
      value = el.value === "" ? "" : Number(el.value);
    } else {
      value = el.value;
    }
    setPath(state, path, value);
    const span = document.querySelector(`[data-val-for="${path}"]`);
    if (span) span.textContent = value;
    // sync color text/picker
    if (path.startsWith("style.colors.")) {
      const picker = document.querySelector(`[data-color-for="${path}"]`);
      if (picker && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value))) {
        let v = value;
        if (v.length === 4) v = "#" + [...v.slice(1)].map((c) => c + c).join("");
        picker.value = v;
      }
    }
    scheduleRender();
  }

  // ---------- List editors ----------
  function dateFields(prefix, obj, presentable) {
    obj = obj || {};
    const present = !!obj.present;
    return `
      <div class="row">
        <div class="field" style="flex:1.2">
          <label>Start month</label>
          <select data-list="${prefix}.start.month">${monthOptions(obj.start?.month)}</select>
        </div>
        <div class="field">
          <label>Start year</label>
          <input type="number" data-list="${prefix}.start.year" value="${obj.start?.year ?? ""}" placeholder="2020" />
        </div>
        <div class="field" style="flex:1.2">
          <label>End month</label>
          <select data-list="${prefix}.end.month" ${present ? "disabled" : ""}>${monthOptions(obj.end?.month)}</select>
        </div>
        <div class="field">
          <label>End year</label>
          <input type="number" data-list="${prefix}.end.year" value="${obj.end?.year ?? ""}" ${present ? "disabled" : ""} placeholder="2024" />
        </div>
      </div>
      ${presentable ? `<label class="check"><input type="checkbox" data-list="${prefix}.end.present" ${present ? "checked" : ""} /> Present / Current</label>` : ""}
    `;
  }

  function renderExp() {
    const box = $("#expList");
    box.innerHTML = (state.experience || []).map((exp, i) => `
      <div class="card" data-idx="${i}">
        <div class="card-head">
          <span class="card-title">Role #${i + 1}</span>
          <div class="card-actions">
            <button class="btn btn-sm" data-move="exp" data-dir="-1" data-i="${i}">↑</button>
            <button class="btn btn-sm" data-move="exp" data-dir="1" data-i="${i}">↓</button>
            <button class="btn btn-sm btn-danger" data-del="experience" data-i="${i}">✕</button>
          </div>
        </div>
        <div class="row row-2">
          <div class="field"><label>Role / Title</label><input data-list="experience.${i}.role" value="${esc(exp.role)}" /></div>
          <div class="field"><label>Company</label><input data-list="experience.${i}.company" value="${esc(exp.company)}" /></div>
        </div>
        <div class="field"><label>Location</label><input data-list="experience.${i}.location" value="${esc(exp.location)}" /></div>
        ${dateFields(`experience.${i}`, exp, true)}
        <div class="field"><label>Bullet points (one per line)</label>
          <textarea data-list="experience.${i}.bullets" rows="4">${esc((exp.bullets || []).join("\n"))}</textarea>
        </div>
      </div>
    `).join("");
  }

  function renderEdu() {
    const box = $("#eduList");
    box.innerHTML = (state.education || []).map((edu, i) => `
      <div class="card">
        <div class="card-head">
          <span class="card-title">Education #${i + 1}</span>
          <div class="card-actions">
            <button class="btn btn-sm" data-move="edu" data-dir="-1" data-i="${i}">↑</button>
            <button class="btn btn-sm" data-move="edu" data-dir="1" data-i="${i}">↓</button>
            <button class="btn btn-sm btn-danger" data-del="education" data-i="${i}">✕</button>
          </div>
        </div>
        <div class="row row-2">
          <div class="field"><label>Degree</label><input data-list="education.${i}.degree" value="${esc(edu.degree)}" /></div>
          <div class="field"><label>School</label><input data-list="education.${i}.school" value="${esc(edu.school)}" /></div>
        </div>
        <div class="field"><label>Location</label><input data-list="education.${i}.location" value="${esc(edu.location)}" /></div>
        ${dateFields(`education.${i}`, edu, true)}
        <div class="field"><label>Details</label><input data-list="education.${i}.details" value="${esc(edu.details)}" /></div>
      </div>
    `).join("");
  }

  function renderSkills() {
    const box = $("#skillList");
    box.innerHTML = (state.skills || []).map((sk, i) => `
      <div class="card">
        <div class="card-head">
          <span class="card-title">Group #${i + 1}</span>
          <button class="btn btn-sm btn-danger" data-del="skills" data-i="${i}">✕</button>
        </div>
        <div class="field"><label>Category</label><input data-list="skills.${i}.category" value="${esc(sk.category)}" /></div>
        <div class="field"><label>Items (comma separated)</label><input data-list="skills.${i}.items" value="${esc(sk.items)}" /></div>
      </div>
    `).join("");
  }

  function renderProjects() {
    const box = $("#projList");
    box.innerHTML = (state.projects || []).map((p, i) => `
      <div class="card">
        <div class="card-head">
          <span class="card-title">Project #${i + 1}</span>
          <button class="btn btn-sm btn-danger" data-del="projects" data-i="${i}">✕</button>
        </div>
        <div class="row row-2">
          <div class="field"><label>Name</label><input data-list="projects.${i}.name" value="${esc(p.name)}" /></div>
          <div class="field"><label>Link</label><input data-list="projects.${i}.link" value="${esc(p.link)}" /></div>
        </div>
        <div class="field"><label>Description</label><textarea data-list="projects.${i}.description" rows="3">${esc(p.description)}</textarea></div>
        ${dateFields(`projects.${i}`, p, true)}
      </div>
    `).join("");
  }

  function renderCerts() {
    const box = $("#certList");
    box.innerHTML = (state.certifications || []).map((c, i) => `
      <div class="card">
        <div class="card-head">
          <span class="card-title">Cert #${i + 1}</span>
          <button class="btn btn-sm btn-danger" data-del="certifications" data-i="${i}">✕</button>
        </div>
        <div class="field"><label>Name</label><input data-list="certifications.${i}.name" value="${esc(c.name)}" /></div>
        <div class="field"><label>Issuer</label><input data-list="certifications.${i}.issuer" value="${esc(c.issuer)}" /></div>
        <div class="row">
          <div class="field"><label>Month</label><select data-list="certifications.${i}.date.month">${monthOptions(c.date?.month)}</select></div>
          <div class="field"><label>Year</label><input type="number" data-list="certifications.${i}.date.year" value="${c.date?.year ?? ""}" /></div>
        </div>
      </div>
    `).join("");
  }

  function renderLangs() {
    const box = $("#langList");
    box.innerHTML = (state.languages || []).map((l, i) => `
      <div class="card">
        <div class="card-head">
          <span class="card-title">Language #${i + 1}</span>
          <button class="btn btn-sm btn-danger" data-del="languages" data-i="${i}">✕</button>
        </div>
        <div class="row row-2">
          <div class="field"><label>Language</label><input data-list="languages.${i}.name" value="${esc(l.name)}" /></div>
          <div class="field"><label>Level</label><input data-list="languages.${i}.level" value="${esc(l.level)}" placeholder="Native / Fluent / …" /></div>
        </div>
      </div>
    `).join("");
  }

  function renderCustom() {
    const items = state.custom?.items || [];
    const box = $("#customList");
    box.innerHTML = items.map((it, i) => `
      <div class="card">
        <div class="card-head">
          <span class="card-title">Item #${i + 1}</span>
          <button class="btn btn-sm btn-danger" data-del="custom.items" data-i="${i}">✕</button>
        </div>
        <div class="field"><label>Title</label><input data-list="custom.items.${i}.title" value="${esc(it.title)}" /></div>
        <div class="field"><label>Subtitle</label><input data-list="custom.items.${i}.subtitle" value="${esc(it.subtitle)}" /></div>
        <div class="field"><label>Detail</label><input data-list="custom.items.${i}.detail" value="${esc(it.detail)}" /></div>
      </div>
    `).join("");
  }

  function renderAllLists() {
    listRebuildLock = true;
    renderExp();
    renderEdu();
    renderSkills();
    renderProjects();
    renderCerts();
    renderLangs();
    renderCustom();
    listRebuildLock = false;
  }

  function renderSectionVisibility() {
    const box = $("#sectionVisibility");
    if (!box) return;
    const vis = state.style?.sections?.visible || {};
    const keys = ["summary","experience","education","skills","projects","certifications","languages","custom"];
    box.innerHTML = keys.map((k) => `
      <label class="check" style="display:flex;margin:6px 0">
        <input type="checkbox" data-path="style.sections.visible.${k}" data-bool ${vis[k] ? "checked" : ""} />
        Show ${k}
      </label>
    `).join("");
    // re-bind these checkboxes
    $$("[data-path^='style.sections.visible']", box).forEach((el) => {
      el.addEventListener("change", () => onFieldChange(el));
    });
  }

  function renderDatePills() {
    const style = state.style?.layout?.date_style || "short_month";
    const present = state.style?.layout?.present_label || "Present";
    const sep = state.style?.layout?.date_separator || " – ";
    const sample = formatRange(
      { month: 3, year: 2021 },
      { present: true },
      style, present, sep
    );
    const sample2 = formatRange(
      { month: 6, year: 2018 },
      { month: 2, year: 2021 },
      style, present, sep
    );
    const box = $("#datePreviewPills");
    if (box) {
      box.innerHTML = `
        <span class="pill">Current job: ${esc(sample)}</span>
        <span class="pill">Past role: ${esc(sample2)}</span>
        <span class="pill">Cert: ${esc(formatDate(2023, 8, null, style))}</span>
      `;
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- List field updates ----------
  function onListField(el) {
    const path = el.getAttribute("data-list");
    if (!path) return;
    let value = el.type === "checkbox" ? el.checked : el.value;
    // bullets as lines
    if (path.endsWith(".bullets") && el.tagName === "TEXTAREA") {
      value = el.value.split("\n").map((x) => x); // keep empty for editing; filter on render
    }
    // numeric months/years
    if (/\.(month|year|day)$/.test(path) && value !== "" && el.type !== "checkbox") {
      value = Number(value);
    }
    setPath(state, path, value);

    // if present toggled, re-render that list section for disabled fields
    if (path.endsWith(".end.present")) {
      renderAllLists();
    }
    scheduleRender();
  }

  function moveItem(arrKey, index, dir) {
    const map = { exp: "experience", edu: "education" };
    const key = map[arrKey] || arrKey;
    const arr = state[key];
    const j = index + dir;
    if (!arr || j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    renderAllLists();
    scheduleRender();
  }

  function deleteItem(path, index) {
    if (path === "custom.items") {
      state.custom.items.splice(index, 1);
    } else {
      state[path].splice(index, 1);
    }
    renderAllLists();
    scheduleRender();
  }

  // ---------- Preview ----------
  function fontStack(family) {
    if (family === "Times") return 'Times, "Times New Roman", serif';
    if (family === "Courier") return '"Courier New", Courier, monospace';
    return "Helvetica, Arial, sans-serif";
  }

  function weightStyle(bold, italic) {
    return `font-weight:${bold ? 700 : 400};font-style:${italic ? "italic" : "normal"};`;
  }

  function renderPreview() {
    const s = state.style || {};
    const fonts = s.fonts || {};
    const colors = s.colors || {};
    const layout = s.layout || {};
    const page = s.page || {};
    const sections = s.sections || {};
    const labels = sections.labels || {};
    const visible = sections.visible || {};
    const header = state.header || {};

    const pageEl = $("#page");
    const preview = $("#preview");
    pageEl.classList.toggle("letter", page.size === "Letter");

    const ml = page.margin_left ?? 40;
    const mr = page.margin_right ?? 40;
    const mt = page.margin_top ?? 36;
    const mb = page.margin_bottom ?? 36;
    // convert pt ~ 1.333 px at 96dpi: 1pt = 96/72 px
    const pt = (n) => `${(n * 96) / 72}px`;

    preview.style.padding = `${pt(mt)} ${pt(mr)} ${pt(mb)} ${pt(ml)}`;
    preview.style.fontFamily = fontStack(fonts.family);
    preview.style.color = colors.text || "#1a1a1a";
    preview.style.lineHeight = layout.line_height || 1.28;

    const dateStyle = layout.date_style || "short_month";
    const presentLabel = layout.present_label || "Present";
    const sep = layout.date_separator || " – ";
    const bullet = layout.bullet || "•";

    const contactParts = ["email","phone","location","website","linkedin","github","extra"]
      .map((k) => (header[k] || "").trim())
      .filter(Boolean);
    const contact = contactParts.join(layout.contact_separator || "  |  ");
    const align = layout.header_align || "center";
    const headerBg = (colors.header_bg || "").trim();
    const headerText = headerBg ? (colors.header_text || "#fff") : (colors.name || colors.text);

    let html = "";
    html += `<div class="rs-header ${align}${headerBg ? " has-bg" : ""}" style="${headerBg ? `background:${headerBg};color:${headerText};` : ""}">`;
    if (header.full_name) {
      html += `<div class="rs-name" style="font-size:${fonts.name_size}pt;color:${headerBg ? headerText : (colors.name || colors.text)};${weightStyle(fonts.name_bold, fonts.name_italic)}">${esc(header.full_name)}</div>`;
    }
    if (header.title) {
      html += `<div class="rs-title" style="font-size:${fonts.title_size}pt;color:${headerBg ? headerText : (colors.muted || colors.text)};${weightStyle(fonts.title_bold, fonts.title_italic)}">${esc(header.title)}</div>`;
    }
    if (contact) {
      html += `<div class="rs-contact" style="font-size:${fonts.contact_size}pt;color:${headerBg ? headerText : (colors.muted || colors.text)};${weightStyle(fonts.contact_bold, fonts.contact_italic)}">${esc(contact)}</div>`;
    }
    html += `</div>`;

    const order = sections.order || ["summary","experience","education","skills","projects","certifications","languages","custom"];

    function sectionTitle(key, fallback) {
      const label = labels[key] || fallback;
      const text = fonts.section_uppercase ? label.toUpperCase() : label;
      let h = `<div class="rs-section" style="margin-top:${layout.section_spacing || 10}px">`;
      h += `<div class="rs-section-title" style="font-size:${fonts.section_size}pt;color:${colors.heading || colors.text};${weightStyle(fonts.section_bold, fonts.section_italic)}">${esc(text)}</div>`;
      if (layout.show_section_lines !== false) {
        h += `<hr class="rs-section-line" style="border-top-color:${colors.accent || "#2563eb"};border-top-width:${layout.line_thickness || 0.8}pt" />`;
      }
      return h;
    }

    for (const key of order) {
      if (visible[key] === false) continue;

      if (key === "summary" && (state.summary || "").trim()) {
        html += sectionTitle("summary", "Professional Summary");
        html += `<div class="rs-body" style="font-size:${fonts.body_size}pt;${weightStyle(fonts.body_bold, fonts.body_italic)}">${esc(state.summary)}</div></div>`;
      }

      if (key === "experience" && (state.experience || []).length) {
        html += sectionTitle("experience", "Experience");
        for (const exp of state.experience) {
          const left = [exp.role, exp.company].filter(Boolean).join(" · ");
          const dates = formatRange(exp.start, exp.end, dateStyle, presentLabel, sep);
          html += `<div class="rs-item" style="margin-bottom:${layout.item_spacing || 6}px">`;
          html += `<div class="rs-item-head">`;
          html += `<div class="rs-item-left" style="font-size:${fonts.item_title_size}pt;${weightStyle(fonts.item_title_bold, fonts.item_title_italic)}">${esc(left)}</div>`;
          if (dates) html += `<div class="rs-item-right" style="font-size:${fonts.date_size}pt;color:${colors.muted};${weightStyle(fonts.date_bold, fonts.date_italic)}">${esc(dates)}</div>`;
          html += `</div>`;
          if (exp.location) {
            html += `<div class="rs-item-sub" style="font-size:${fonts.item_sub_size}pt;color:${colors.muted};${weightStyle(fonts.item_sub_bold, fonts.item_sub_italic)}">${esc(exp.location)}</div>`;
          }
          const bullets = (exp.bullets || []).map((b) => String(b).trim()).filter(Boolean);
          if (bullets.length) {
            html += `<ul class="rs-bullets" style="font-size:${fonts.body_size}pt;list-style-type:'${esc(bullet)}  ';${weightStyle(fonts.body_bold, fonts.body_italic)}">`;
            for (const b of bullets) html += `<li>${esc(b)}</li>`;
            html += `</ul>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      }

      if (key === "education" && (state.education || []).length) {
        html += sectionTitle("education", "Education");
        for (const edu of state.education) {
          const left = [edu.degree, edu.school].filter(Boolean).join(" · ");
          const dates = formatRange(edu.start, edu.end, dateStyle, presentLabel, sep);
          html += `<div class="rs-item" style="margin-bottom:${layout.item_spacing || 6}px">`;
          html += `<div class="rs-item-head"><div class="rs-item-left" style="font-size:${fonts.item_title_size}pt;${weightStyle(fonts.item_title_bold, fonts.item_title_italic)}">${esc(left)}</div>`;
          if (dates) html += `<div class="rs-item-right" style="font-size:${fonts.date_size}pt;color:${colors.muted};${weightStyle(fonts.date_bold, fonts.date_italic)}">${esc(dates)}</div></div>`;
          else html += `</div>`;
          if (edu.location) html += `<div class="rs-item-sub" style="font-size:${fonts.item_sub_size}pt;color:${colors.muted};${weightStyle(fonts.item_sub_bold, fonts.item_sub_italic)}">${esc(edu.location)}</div>`;
          if (edu.details) html += `<div class="rs-body" style="font-size:${fonts.body_size}pt;${weightStyle(fonts.body_bold, fonts.body_italic)}">${esc(edu.details)}</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      if (key === "skills" && (state.skills || []).length) {
        html += sectionTitle("skills", "Skills");
        for (const sk of state.skills) {
          if (!sk.category && !sk.items) continue;
          html += `<div class="rs-skills-line" style="font-size:${fonts.body_size}pt;${weightStyle(fonts.body_bold, fonts.body_italic)}">`;
          if (sk.category) html += `<strong>${esc(sk.category)}: </strong>`;
          html += `${esc(sk.items || "")}</div>`;
        }
        html += `</div>`;
      }

      if (key === "projects" && (state.projects || []).length) {
        html += sectionTitle("projects", "Projects");
        for (const p of state.projects) {
          const left = p.name + (p.link ? `  (${p.link})` : "");
          const dates = formatRange(p.start, p.end, dateStyle, presentLabel, sep);
          html += `<div class="rs-item" style="margin-bottom:${layout.item_spacing || 6}px">`;
          html += `<div class="rs-item-head"><div class="rs-item-left" style="font-size:${fonts.item_title_size}pt;${weightStyle(fonts.item_title_bold, fonts.item_title_italic)}">${esc(left)}</div>`;
          if (dates) html += `<div class="rs-item-right" style="font-size:${fonts.date_size}pt;color:${colors.muted};${weightStyle(fonts.date_bold, fonts.date_italic)}">${esc(dates)}</div></div>`;
          else html += `</div>`;
          if (p.description) html += `<div class="rs-body" style="font-size:${fonts.body_size}pt;${weightStyle(fonts.body_bold, fonts.body_italic)}">${esc(p.description)}</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      if (key === "certifications" && (state.certifications || []).length) {
        html += sectionTitle("certifications", "Certifications");
        for (const c of state.certifications) {
          const left = [c.name, c.issuer].filter(Boolean).join(" · ");
          const d = formatDate(c.date?.year, c.date?.month, c.date?.day, dateStyle);
          html += `<div class="rs-item" style="margin-bottom:${(layout.item_spacing || 6) * 0.5}px">`;
          html += `<div class="rs-item-head"><div class="rs-item-left" style="font-size:${fonts.item_title_size}pt;${weightStyle(fonts.item_title_bold, fonts.item_title_italic)}">${esc(left)}</div>`;
          if (d) html += `<div class="rs-item-right" style="font-size:${fonts.date_size}pt;color:${colors.muted};${weightStyle(fonts.date_bold, fonts.date_italic)}">${esc(d)}</div></div>`;
          else html += `</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      if (key === "languages" && (state.languages || []).length) {
        html += sectionTitle("languages", "Languages");
        const parts = state.languages.map((l) => {
          if (l.name && l.level) return `${l.name} (${l.level})`;
          return l.name || "";
        }).filter(Boolean);
        html += `<div class="rs-body" style="font-size:${fonts.body_size}pt;${weightStyle(fonts.body_bold, fonts.body_italic)}">${esc(parts.join(", "))}</div></div>`;
      }

      if (key === "custom" && (state.custom?.items || []).length) {
        const title = state.custom.title || labels.custom || "Additional";
        // reuse section title with custom label
        const text = fonts.section_uppercase ? String(title).toUpperCase() : title;
        html += `<div class="rs-section" style="margin-top:${layout.section_spacing || 10}px">`;
        html += `<div class="rs-section-title" style="font-size:${fonts.section_size}pt;color:${colors.heading || colors.text};${weightStyle(fonts.section_bold, fonts.section_italic)}">${esc(text)}</div>`;
        if (layout.show_section_lines !== false) {
          html += `<hr class="rs-section-line" style="border-top-color:${colors.accent || "#2563eb"}" />`;
        }
        for (const it of state.custom.items) {
          const left = [it.title, it.subtitle].filter(Boolean).join(" · ");
          html += `<div class="rs-item">`;
          html += `<div class="rs-item-left" style="font-size:${fonts.item_title_size}pt;${weightStyle(fonts.item_title_bold, fonts.item_title_italic)}">${esc(left)}</div>`;
          if (it.detail) html += `<div class="rs-body" style="font-size:${fonts.body_size}pt">${esc(it.detail)}</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
    }

    preview.innerHTML = html;

    // client-side overflow estimate vs A4/Letter height
    requestAnimationFrame(() => {
      const pageH = page.size === "Letter" ? 1056 : 1123;
      const used = preview.scrollHeight;
      const overflow = used > pageH + 4;
      pageEl.classList.toggle("overflow", overflow);
      const badge = $("#pageBadge");
      if (overflow) {
        badge.textContent = "Over 1 page";
        badge.className = "badge err";
      } else {
        badge.textContent = "Fits 1 page";
        badge.className = "badge ok";
      }
      const fill = Math.min(used / pageH, 1);
      const fillBadge = $("#fillBadge");
      fillBadge.textContent = `Fill ${Math.round(fill * 100)}%`;
      fillBadge.className = fill > 0.98 ? "badge warn" : "badge";
      $("#metaText").textContent = `${page.size || "A4"} · zoom ${Math.round(zoom * 100)}%`;
    });

    renderDatePills();
    scheduleMetaCheck();
  }

  function scheduleRender() {
    if (scheduleRender._t) cancelAnimationFrame(scheduleRender._t);
    scheduleRender._t = requestAnimationFrame(renderPreview);
  }

  function scheduleMetaCheck() {
    clearTimeout(metaTimer);
    metaTimer = setTimeout(async () => {
      try {
        const res = await fetch("/api/preview-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        const meta = await res.json();
        if (meta.overflow) {
          const badge = $("#pageBadge");
          badge.textContent = "PDF overflow";
          badge.className = "badge err";
        }
        const fillBadge = $("#fillBadge");
        if (meta.fill_ratio != null) {
          fillBadge.textContent = `PDF fill ${Math.round(meta.fill_ratio * 100)}%`;
        }
      } catch (_) { /* ignore */ }
    }, 600);
  }

  // ---------- API actions ----------
  async function downloadPdf() {
    toast("Generating PDF…");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "PDF failed");
      }
      const overflow = res.headers.get("X-Resume-Overflow") === "1";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = (state.header?.full_name || "resume").replace(/\s+/g, "_");
      a.href = url;
      a.download = `${name}_resume.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast(overflow ? "PDF downloaded — content may exceed 1 page" : "PDF downloaded");
    } catch (e) {
      toast("Error: " + e.message);
    }
  }

  async function saveResume() {
    const id = (state.header?.full_name || "resume").trim() || "resume";
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data: state }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast(`Saved as ${data.id}.json`);
    } catch (e) {
      toast("Error: " + e.message);
    }
  }

  async function exportJson() {
    const res = await fetch("/api/export-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(state.header?.full_name || "resume").replace(/\s+/g, "_")}_resume.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("JSON downloaded");
  }

  async function openLoadModal() {
    const res = await fetch("/api/list");
    const data = await res.json();
    const list = $("#loadList");
    if (!data.resumes?.length) {
      list.innerHTML = `<p class="hint">No saved resumes yet. Click Save first.</p>`;
    } else {
      list.innerHTML = data.resumes.map((r) => `
        <div class="modal-item">
          <div>
            <strong>${esc(r.name)}</strong>
            <div style="font-size:11px;color:var(--muted)">${esc(r.modified)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-primary" data-load-id="${esc(r.id)}">Open</button>
            <button class="btn btn-sm btn-danger" data-delete-id="${esc(r.id)}">Delete</button>
          </div>
        </div>
      `).join("");
    }
    $("#loadModal").classList.add("show");
  }

  async function loadResume(id) {
    const res = await fetch("/api/load/" + encodeURIComponent(id));
    if (!res.ok) {
      toast("Load failed");
      return;
    }
    state = await res.json();
    // ensure style exists
    if (!state.style) state.style = {};
    bindFields();
    renderAllLists();
    scheduleRender();
    $("#loadModal").classList.remove("show");
    toast("Loaded " + id);
  }


  // ---------- ATS Analyzer ----------
  let lastAtsReport = null;

  function scoreColor(score) {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  }

  function badgeClassForScore(score) {
    if (score >= 80) return "badge ats-high";
    if (score >= 60) return "badge ats-mid";
    return "badge ats-low";
  }

  function updateAtsBadge(score, grade) {
    const el = $("#atsBadge");
    if (!el) return;
    if (score == null) {
      el.textContent = "ATS —";
      el.className = "badge";
      return;
    }
    el.textContent = `ATS ${Math.round(score)} (${grade || ""})`.trim();
    el.className = badgeClassForScore(score);
  }

  async function loadAtsStatus() {
    try {
      const res = await fetch("/api/ats/status");
      const st = await res.json();
      const badge = $("#atsStatusBadge");
      const cb = $("#atsUseAi");
      if (st.available) {
        badge.className = "ats-status on";
        badge.innerHTML = `AI analyzer ready · model <code>${esc(st.model || "grok")}</code>`;
        cb.disabled = false;
      } else {
        badge.className = "ats-status off";
        badge.innerHTML = `Rule-based ATS only · set <code>XAI_API_KEY</code> for SpaceXAI deep analysis`;
        cb.checked = false;
        cb.disabled = true;
      }
    } catch (e) {
      const badge = $("#atsStatusBadge");
      if (badge) {
        badge.className = "ats-status off";
        badge.textContent = "Could not load AI status";
      }
    }
  }

  function renderAtsReport(report) {
    lastAtsReport = report;
    const box = $("#atsReport");
    if (!report) {
      box.className = "ats-report empty";
      box.innerHTML = `<p class="hint" style="margin:0">Click <strong>Analyze ATS Score</strong> to scan this resume.</p>`;
      updateAtsBadge(null);
      return;
    }
    box.className = "ats-report";
    updateAtsBadge(report.score, report.grade);

    const cats = report.categories || {};
    const catHtml = Object.keys(cats).map((k) => {
      const c = cats[k];
      const pct = Math.round((c.score / (c.max || 1)) * 100);
      return `<div class="ats-cat">
        <span class="label">${esc(c.label || k)}</span>
        <span class="pts">${c.score}/${c.max}</span>
        <div class="ats-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join("");

    const kw = report.keywords || {};
    const matched = (kw.matched || []).slice(0, 16);
    const missing = (kw.missing || []).slice(0, 16);
    const kwHtml = `
      <h3 style="margin-top:4px">Keywords ${kw.mode === "job_description" ? "(vs job description)" : "(general)"}</h3>
      <div class="hint" style="margin-bottom:6px">Match rate: <strong>${Math.round((kw.match_rate || 0) * 100)}%</strong> · Words: ${report.stats?.word_count ?? "—"}</div>
      <div class="ats-tags">
        ${matched.map((t) => `<span class="ats-tag ok">${esc(t)}</span>`).join("")}
        ${missing.map((t) => `<span class="ats-tag miss">${esc(t)}</span>`).join("")}
      </div>
      ${matched.length || missing.length ? `<div class="hint" style="margin-top:6px">Green = found · Red = missing from resume</div>` : ""}
    `;

    const issues = report.issues || [];
    // Show priority first, then rest limited
    const priorityIds = new Set((report.priority_fixes || []).map((i) => i.title + i.detail));
    const ordered = [
      ...(report.priority_fixes || []),
      ...issues.filter((i) => !priorityIds.has(i.title + i.detail) && i.severity !== "good"),
    ].slice(0, 14);
    const goods = issues.filter((i) => i.severity === "good").slice(0, 6);

    const issueHtml = (list, heading) => {
      if (!list.length) return "";
      return `<h3>${heading}</h3>` + list.map((i) => `
        <div class="ats-issue">
          <div class="top">
            <span class="title">${esc(i.title)}</span>
            <span class="sev ${esc(i.severity)}">${esc(i.severity)}</span>
          </div>
          <div class="detail">${esc(i.detail)}</div>
          ${i.fix ? `<div class="fix">→ ${esc(i.fix)}</div>` : ""}
        </div>
      `).join("");
    };

    let aiHtml = "";
    const ai = report.ai;
    if (ai) {
      if (ai.ok === false) {
        aiHtml = `<div class="ats-ai-box"><h4>AI analysis</h4>
          <div class="detail" style="color:#fca5a5">${esc(ai.error || "Failed")}</div>
          ${ai.hint ? `<div class="fix">${esc(ai.hint)}</div>` : ""}
          ${ai.detail ? `<div class="detail" style="margin-top:4px">${esc(ai.detail)}</div>` : ""}
        </div>`;
      } else {
        const strengths = (ai.strengths || []).map((s) => `<li>${esc(s)}</li>`).join("");
        const weaknesses = (ai.weaknesses || []).map((s) => `<li>${esc(s)}</li>`).join("");
        const gaps = (ai.keyword_gaps || []).map((s) => `<li>${esc(s)}</li>`).join("");
        const tips = (ai.section_tips || ai.one_page_tips || []).map((s) => `<li>${esc(s)}</li>`).join("");
        const rewrites = (ai.rewrite_examples || []).slice(0, 4).map((r) => `
          <div class="rewrite">
            <div class="o">✗ ${esc(r.original || "")}</div>
            <div class="n">✓ ${esc(r.improved || "")}</div>
          </div>
        `).join("");
        aiHtml = `<div class="ats-ai-box">
          <h4>AI analysis ${ai.model ? "· " + esc(ai.model) : ""}${ai.ats_score != null ? " · AI score " + esc(String(ai.ats_score)) : ""}</h4>
          <p style="margin:0 0 8px;font-size:12px;line-height:1.45">${esc(ai.summary || "")}</p>
          ${strengths ? `<strong style="font-size:11px;color:#86efac">Strengths</strong><ul>${strengths}</ul>` : ""}
          ${weaknesses ? `<strong style="font-size:11px;color:#fcd34d">Weaknesses</strong><ul>${weaknesses}</ul>` : ""}
          ${gaps ? `<strong style="font-size:11px;color:#fca5a5">Keyword gaps</strong><ul>${gaps}</ul>` : ""}
          ${rewrites ? `<strong style="font-size:11px;color:#c4b5fd">Rewrite examples</strong>${rewrites}` : ""}
          ${tips ? `<strong style="font-size:11px">Tips</strong><ul>${tips}</ul>` : ""}
        </div>`;
      }
    }

    const blendNote = (report.score_rule != null && report.score_ai != null)
      ? `<div class="hint">Blended: rule ${report.score_rule} + AI ${report.score_ai}</div>`
      : "";

    box.innerHTML = `
      <div class="ats-score-row">
        <div class="ats-ring" style="--p:${Math.min(100, Math.max(0, report.score))};--c:${scoreColor(report.score)}">
          <div class="ats-ring-inner">
            <div class="num">${Math.round(report.score)}</div>
            <div class="grade">${esc(report.grade || "")}</div>
          </div>
        </div>
        <div class="ats-score-meta">
          <h3>${esc(report.level || "ATS report")}</h3>
          <p>Engine: ${esc(report.engine || "rule-based")}</p>
          <p style="margin-top:4px">Roles: ${report.stats?.experience_count ?? 0} · Bullets: ${report.stats?.bullet_count ?? 0} · Skills groups: ${report.stats?.skill_groups ?? 0}</p>
          ${blendNote}
        </div>
      </div>
      <h3>Category scores</h3>
      <div class="ats-cats">${catHtml}</div>
      ${kwHtml}
      ${issueHtml(ordered, "Issues & fixes")}
      ${issueHtml(goods, "What's working")}
      ${aiHtml}
    `;
  }

  async function runAtsAnalysis() {
    const btn = $("#btnRunAts");
    const useAi = $("#atsUseAi")?.checked;
    const jd = $("#atsJobDesc")?.value || "";
    btn.disabled = true;
    btn.textContent = useAi ? "Analyzing with AI…" : "Analyzing…";
    toast(useAi ? "Running AI ATS analysis…" : "Running ATS analysis…");
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: state,
          job_description: jd,
          use_ai: !!useAi,
        }),
      });
      const report = await res.json();
      if (!res.ok) throw new Error(report.error || "ATS analysis failed");
      renderAtsReport(report);
      // switch to ATS tab
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((p) => p.classList.remove("active"));
      const tab = document.querySelector('.tab[data-tab="ats"]');
      if (tab) tab.classList.add("active");
      $("#panel-ats")?.classList.add("active");
      toast(`ATS score: ${Math.round(report.score)} (${report.grade})`);
    } catch (e) {
      toast("ATS error: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Analyze ATS Score";
    }
  }


  // ---------- Init ----------
  function wireEvents() {
    // tabs
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".tab").forEach((t) => t.classList.remove("active"));
        $$(".panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $(`#panel-${tab.dataset.tab}`).classList.add("active");
      });
    });

    // simple fields (event delegation)
    document.addEventListener("input", (e) => {
      const el = e.target;
      if (el.matches("[data-path]")) onFieldChange(el);
      if (el.matches("[data-list]")) onListField(el);
      if (el.matches("[data-color-for]")) {
        const path = el.getAttribute("data-color-for");
        setPath(state, path, el.value);
        const text = document.querySelector(`[data-path="${path}"]`);
        if (text) text.value = el.value;
        scheduleRender();
      }
    });
    document.addEventListener("change", (e) => {
      const el = e.target;
      if (el.matches("[data-path]")) onFieldChange(el);
      if (el.matches("[data-list]")) onListField(el);
    });

    document.addEventListener("click", (e) => {
      const del = e.target.closest("[data-del]");
      if (del) {
        deleteItem(del.getAttribute("data-del"), Number(del.getAttribute("data-i")));
        return;
      }
      const mv = e.target.closest("[data-move]");
      if (mv) {
        moveItem(mv.getAttribute("data-move"), Number(mv.getAttribute("data-i")), Number(mv.getAttribute("data-dir")));
        return;
      }
      const lid = e.target.closest("[data-load-id]");
      if (lid) {
        loadResume(lid.getAttribute("data-load-id"));
        return;
      }
      const did = e.target.closest("[data-delete-id]");
      if (did) {
        const id = did.getAttribute("data-delete-id");
        fetch("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }).then(() => openLoadModal());
      }
    });

    $("#addExp").onclick = () => {
      state.experience = state.experience || [];
      state.experience.push({
        company: "", role: "", location: "",
        start: { month: 1, year: new Date().getFullYear() },
        end: { present: true },
        bullets: ["Achievement or responsibility"],
      });
      renderAllLists(); scheduleRender();
    };
    $("#addEdu").onclick = () => {
      state.education = state.education || [];
      state.education.push({
        school: "", degree: "", location: "",
        start: { month: 9, year: 2018 },
        end: { month: 5, year: 2022 },
        details: "",
      });
      renderAllLists(); scheduleRender();
    };
    $("#addSkill").onclick = () => {
      state.skills = state.skills || [];
      state.skills.push({ category: "Category", items: "Skill A, Skill B" });
      renderAllLists(); scheduleRender();
    };
    $("#addProj").onclick = () => {
      state.projects = state.projects || [];
      state.projects.push({
        name: "Project", link: "", description: "",
        start: { month: 1, year: new Date().getFullYear() },
        end: { present: true },
      });
      renderAllLists(); scheduleRender();
    };
    $("#addCert").onclick = () => {
      state.certifications = state.certifications || [];
      state.certifications.push({
        name: "", issuer: "",
        date: { month: 1, year: new Date().getFullYear() },
      });
      renderAllLists(); scheduleRender();
    };
    $("#addLang").onclick = () => {
      state.languages = state.languages || [];
      state.languages.push({ name: "", level: "" });
      renderAllLists(); scheduleRender();
    };
    $("#addCustom").onclick = () => {
      state.custom = state.custom || { title: "Additional", items: [] };
      state.custom.items = state.custom.items || [];
      state.custom.items.push({ title: "", subtitle: "", detail: "" });
      // auto-show custom section
      setPath(state, "style.sections.visible.custom", true);
      bindFields();
      renderAllLists(); scheduleRender();
    };

    $("#btnPdf").onclick = downloadPdf;
    $("#btnSave").onclick = saveResume;
    $("#btnExportJson").onclick = exportJson;
    $("#btnLoad").onclick = openLoadModal;
    $("#closeLoad").onclick = () => $("#loadModal").classList.remove("show");
    $("#loadModal").addEventListener("click", (e) => {
      if (e.target.id === "loadModal") $("#loadModal").classList.remove("show");
    });
    $("#btnPrint").onclick = () => window.print();
    $("#btnReset").onclick = async () => {
      if (!confirm("Reset to sample resume?")) return;
      const res = await fetch("/api/default");
      state = await res.json();
      bindFields();
      renderAllLists();
      scheduleRender();
      toast("Reset to sample");
    };

    $("#btnZoomIn").onclick = () => {
      zoom = Math.min(1.4, zoom + 0.05);
      $("#page").style.transform = `scale(${zoom})`;
      $("#metaText").textContent = `${state.style?.page?.size || "A4"} · zoom ${Math.round(zoom * 100)}%`;
    };
    $("#btnZoomOut").onclick = () => {
      zoom = Math.max(0.5, zoom - 0.05);
      $("#page").style.transform = `scale(${zoom})`;
      $("#metaText").textContent = `${state.style?.page?.size || "A4"} · zoom ${Math.round(zoom * 100)}%`;
    };
  }

  async function init() {
    const res = await fetch("/api/default");
    state = await res.json();
    // try localStorage draft
    try {
      const draft = localStorage.getItem("resume_maker_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed && parsed.header) state = parsed;
      }
    } catch (_) {}
    wireEvents();
    bindFields();
    renderAllLists();
    scheduleRender();

    // autosave draft
    setInterval(() => {
      try { localStorage.setItem("resume_maker_draft", JSON.stringify(state)); } catch (_) {}
    }, 4000);
  }

  init();
})();
