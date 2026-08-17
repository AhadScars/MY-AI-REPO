const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let niches = [];
let currentLead = null;
let pollTimer = null;

const views = {
  board: ["Leads", "Businesses you can call. Filter to those with no website."],
  search: ["New search", "Find more offices in another city or industry."],
  saved: ["Saved searches", "Re-run or let a search repeat on a schedule."],
};

function showView(name) {
  $$(".view").forEach((el) => el.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  $$(".nav").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
  $("#pageTitle").textContent = views[name][0];
  $("#pageSub").textContent = views[name][1];
}

$$(".nav").forEach((b) => b.addEventListener("click", () => {
  showView(b.dataset.view);
  if (b.dataset.view === "saved") loadSaved();
}));

async function json(url, opts) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function websitePill(flag) {
  if (flag === 0) return '<span class="pill no">No website</span>';
  if (flag === 1) return '<span class="pill yes">Has website</span>';
  return '<span class="pill unk">Not checked</span>';
}

function statusLabel(s) {
  return ({
    new: "New",
    contacted: "Contacted",
    interested: "Interested",
    not_interested: "Not interested",
    closed: "Closed / won",
  })[s] || s || "New";
}

async function loadStats() {
  const s = await json("/api/stats");
  $("#stats").innerHTML = `
    <div class="stat"><b>${s.total}</b><span>Total leads</span></div>
    <div class="stat hot"><b>${s.no_website}</b><span>No website</span></div>
    <div class="stat"><b>${s.new}</b><span>Not contacted yet</span></div>
    <div class="stat"><b>${s.contacted}</b><span>Already contacted</span></div>
  `;
}

async function loadLeads() {
  const params = new URLSearchParams({
    q: $("#q").value,
    niche: $("#fNiche").value,
    borough: $("#fBorough").value,
    website: $("#fWebsite").value,
    status: $("#fStatus").value,
  });
  const rows = await json("/api/leads?" + params);
  const tb = $("#rows");
  tb.innerHTML = rows.map((r) => `
    <tr>
      <td>
        <div class="biz">${esc(r.name)}</div>
        <div class="sub">${esc(r.contact_name || r.niche || "")}</div>
      </td>
      <td>${esc(r.phone || "—")}</td>
      <td>
        ${esc([r.address, r.borough || r.city, r.zip].filter(Boolean).join(" · "))}
      </td>
      <td>${websitePill(r.has_website)}</td>
      <td>${esc(statusLabel(r.status))}</td>
      <td><button class="linkish" data-open="${r.id}">Open</button></td>
    </tr>
  `).join("");
  $("#empty").classList.toggle("hidden", rows.length > 0);
  tb.querySelectorAll("[data-open]").forEach((b) => {
    b.addEventListener("click", () => openLead(rows.find((x) => String(x.id) === b.dataset.open)));
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function openLead(lead) {
  currentLead = lead;
  $("#dName").textContent = lead.name;
  $("#dMeta").textContent = [lead.phone, lead.address, lead.borough || lead.city, lead.zip].filter(Boolean).join(" · ");
  $("#dOnline").textContent = lead.online_presence || "";
  $("#dStatus").value = lead.status || "new";
  $("#dNotes").value = lead.notes || "";
  $("#dEmail").value = lead.email || "";
  $("#drawer").showModal();
}

$("#dSave").addEventListener("click", async () => {
  if (!currentLead) return;
  await json("/api/leads/" + currentLead.id, {
    method: "PATCH",
    body: JSON.stringify({
      status: $("#dStatus").value,
      notes: $("#dNotes").value,
      email: $("#dEmail").value,
    }),
  });
  $("#drawer").close();
  loadLeads();
  loadStats();
});

$("#dDelete").addEventListener("click", async () => {
  if (!currentLead) return;
  if (!confirm("Delete this lead?")) return;
  await json("/api/leads/" + currentLead.id, { method: "DELETE" });
  $("#drawer").close();
  loadLeads();
  loadStats();
});

["q", "fNiche", "fBorough", "fWebsite", "fStatus"].forEach((id) => {
  $("#" + id).addEventListener("input", loadLeads);
  $("#" + id).addEventListener("change", loadLeads);
});

async function loadNiches() {
  niches = await json("/api/niches");
  for (const sel of ["#niche", "#fNiche"]) {
    const el = $(sel);
    const keepFirst = sel === "#fNiche";
    if (!keepFirst) el.innerHTML = "";
    niches.forEach((n) => {
      const o = document.createElement("option");
      o.value = n.id;
      o.textContent = n.label;
      if (n.id === "dentist" && sel === "#niche") o.selected = true;
      el.appendChild(o);
    });
  }
}

$("#searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#btnRun");
  btn.disabled = true;
  btn.textContent = "Starting…";
  try {
    const out = await json("/api/searches", {
      method: "POST",
      body: JSON.stringify({
        niche: $("#niche").value,
        location: $("#location").value,
        max_results: Number($("#maxResults").value || 60),
        no_website_only: $("#noWebsiteOnly").checked,
        schedule_days: $("#scheduleDays").value || null,
      }),
    });
    watchJob(out.job_id);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Start search";
  }
});

function watchJob(id) {
  clearInterval(pollTimer);
  const tick = async () => {
    const job = await json("/api/jobs/" + id);
    $("#jobMsg").textContent = job.message || job.status;
    $("#jobBar").style.width = (job.progress || 0) + "%";
    $("#jobLog").innerHTML = (job.log || []).map((l) => `<li>${esc(l.msg)}</li>`).join("");
    if (job.status === "done" || job.status === "error") {
      clearInterval(pollTimer);
      loadStats();
      loadLeads();
    }
  };
  tick();
  pollTimer = setInterval(tick, 1500);
}

async function loadSaved() {
  const rows = await json("/api/searches");
  $("#savedRows").innerHTML = rows.map((s) => `
    <tr>
      <td>${esc(s.niche)}</td>
      <td>${esc(s.location)}</td>
      <td>${esc((s.last_run || "Never").replace("T", " ").slice(0, 16))}</td>
      <td>${s.no_website ?? 0}</td>
      <td>${s.schedule_days ? "Every " + s.schedule_days + " days" : "Once"}</td>
      <td><button class="btn" data-rerun="${s.id}">Run now</button></td>
    </tr>
  `).join("") || `<tr><td colspan="6">No saved searches yet.</td></tr>`;
  $$("[data-rerun]").forEach((b) => b.addEventListener("click", async () => {
    showView("search");
    const out = await json("/api/searches/" + b.dataset.rerun + "/rerun", { method: "POST" });
    watchJob(out.job_id);
  }));
}

$("#btnExport").addEventListener("click", async () => {
  const out = await json("/api/export", {
    method: "POST",
    body: JSON.stringify({
      q: $("#q").value,
      niche: $("#fNiche").value,
      borough: $("#fBorough").value,
      website: $("#fWebsite").value,
      status: $("#fStatus").value,
    }),
  });
  window.location = "/api/export/download/" + encodeURIComponent(out.file);
});

(async function init() {
  await loadNiches();
  await loadStats();
  await loadLeads();
})();
