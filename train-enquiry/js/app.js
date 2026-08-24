const API = "https://traintrack.stupidlabs.lol";

const els = {
  clock: document.getElementById("clock"),
  views: {
    spot: document.getElementById("view-spot"),
    schedule: document.getElementById("view-schedule"),
    between: document.getElementById("view-between"),
  },
  trainQuery: document.getElementById("train-query"),
  suggest: document.getElementById("suggest"),
  startDate: document.getElementById("start-date"),
  spotResult: document.getElementById("spot-result"),
  scheduleQuery: document.getElementById("schedule-query"),
  scheduleSuggest: document.getElementById("schedule-suggest"),
  scheduleResult: document.getElementById("schedule-result"),
  fromStation: document.getElementById("from-station"),
  toStation: document.getElementById("to-station"),
  fromSuggest: document.getElementById("from-suggest"),
  toSuggest: document.getElementById("to-suggest"),
  betweenResult: document.getElementById("between-result"),
};

let selectedTrain = null;
let searchTimer = null;
let activeSuggest = -1;
let liveMap = null;
let lastLiveQuery = null;
let refreshTimer = null;

function tickClock() {
  const now = new Date();
  const text = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  els.clock.textContent = `${text} IST`;
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || body.message || "";
    } catch {
      detail = "";
    }
    if (res.status === 404) throw new Error("Train not found. Check the number and try again.");
    if (res.status >= 500) throw new Error("Railway data is temporarily unavailable. Try again in a moment.");
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showLoading(target, message) {
  if (target === els.spotResult) destroyMap();
  target.innerHTML = `
    <div class="center">
      <div class="loader"></div>
      <p class="muted">${escapeHtml(message)}</p>
    </div>`;
}

function showError(target, message) {
  if (target === els.spotResult) destroyMap();
  target.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

function hideSuggest(list) {
  list.hidden = true;
  list.innerHTML = "";
  activeSuggest = -1;
}

function renderTrainSuggestions(list, trains, onPick) {
  if (!trains.length) {
    hideSuggest(list);
    return;
  }
  list.hidden = false;
  list.innerHTML = trains
    .slice(0, 10)
    .map((train, index) => {
      const from = train.source?.code || train.source || "";
      const to = train.destination?.code || train.destination || "";
      return `<li data-index="${index}">
        <span class="num">${escapeHtml(train.number)}</span>${escapeHtml(train.name)}
        <span class="meta">${escapeHtml(from)} → ${escapeHtml(to)}</span>
      </li>`;
    })
    .join("");
  list.querySelectorAll("li").forEach((item, index) => {
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onPick(trains[index]);
    });
  });
}

function debounceSearch(query, list, onPick) {
  clearTimeout(searchTimer);
  const q = query.trim();
  if (q.length < 2) {
    hideSuggest(list);
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const data = await apiGet(`/api/trains/search?q=${encodeURIComponent(q)}`);
      renderTrainSuggestions(list, data.trains || [], onPick);
    } catch {
      hideSuggest(list);
    }
  }, 220);
}

function preferredDate(instances, fallbackToday) {
  const list = instances || [];
  const running = list.find((item) => Number(item.status) === 1);
  if (running?.start_date) return running.start_date;
  const upcoming = list.find((item) => Number(item.status) === 0);
  if (upcoming?.start_date) return upcoming.start_date;
  return list[0]?.start_date || fallbackToday || todayStamp();
}

function fillDates(instances, fallbackToday) {
  const options = [];
  const seen = new Set();
  const sorted = [...(instances || [])].sort((a, b) => {
    const rank = (status) => (Number(status) === 1 ? 0 : Number(status) === 0 ? 1 : 2);
    return rank(a.status) - rank(b.status);
  });
  sorted.forEach((item) => {
    if (!item.start_date || seen.has(item.start_date)) return;
    seen.add(item.start_date);
    const label = item.position ? `${item.start_date} — ${item.position}` : item.start_date;
    options.push(`<option value="${escapeHtml(item.start_date)}">${escapeHtml(label)}</option>`);
  });
  if (!options.length && fallbackToday) {
    options.push(`<option value="${escapeHtml(fallbackToday)}">${escapeHtml(fallbackToday)}</option>`);
  }
  els.startDate.innerHTML = options.join("") || `<option value="">No dates</option>`;
  const preferred = preferredDate(sorted, fallbackToday);
  if (preferred) els.startDate.value = preferred;
}

function todayStamp() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .replace(/ /g, "-");
}

async function loadTrainMeta(number) {
  const info = await apiGet(`/api/trains/${encodeURIComponent(number)}/info`);
  selectedTrain = info;
  fillDates(info.instances, todayStamp());
  return info;
}

function pickTrain(train, queryInput, suggestList) {
  selectedTrain = train;
  queryInput.value = `${train.number} ${train.name || ""}`.trim();
  hideSuggest(suggestList);
  if (queryInput === els.trainQuery) {
    loadTrainMeta(train.number).catch((err) => showError(els.spotResult, err.message));
  }
}

function delayClass(text) {
  const value = String(text || "").toLowerCase();
  if (!value || value === "on time" || value === "right time") return "ok";
  if (value.includes("delay") || value.includes("late")) return "late";
  return "idle";
}

function stopRowClass(stop, currentCode) {
  if (stop.status === "departed") return "departed";
  if (stop.status === "arrived" || stop.code === currentCode) return "current";
  return "upcoming";
}

function destroyMap() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (liveMap) {
    liveMap.remove();
    liveMap = null;
  }
}

function yearFromStamp(stamp) {
  const match = String(stamp || "").match(/(\d{4})$/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function parseTrainTime(text, yearHint) {
  const match = String(text || "").match(/(\d{1,2}):(\d{2})\s+(\d{1,2})-([A-Za-z]{3})/);
  if (!match) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const month = months[match[4]];
  if (month == null) return null;
  const year = yearHint || new Date().getFullYear();
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}T${String(match[1]).padStart(2, "0")}:${match[2]}:00+05:30`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function latLngOf(point) {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) return [Number(point[0]), Number(point[1])];
  if (point.lat != null && (point.lon != null || point.lng != null)) {
    return [Number(point.lat), Number(point.lon ?? point.lng)];
  }
  return null;
}

function haversine(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const sin = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(sin)));
}

function nearestIndex(route, point) {
  let best = 0;
  let bestDist = Infinity;
  route.forEach((item, index) => {
    const dist = haversine(item, point);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

function pointAlongRoute(route, from, to, progress) {
  if (!from || !to) return from || to || null;
  if (!route.length) {
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
    ];
  }
  let start = nearestIndex(route, from);
  let end = nearestIndex(route, to);
  if (end < start) [start, end] = [end, start];
  const segment = route.slice(start, end + 1);
  if (segment.length < 2) {
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
    ];
  }
  const distances = [0];
  for (let i = 1; i < segment.length; i += 1) {
    distances.push(distances[i - 1] + haversine(segment[i - 1], segment[i]));
  }
  const target = distances[distances.length - 1] * Math.min(0.97, Math.max(0.03, progress));
  for (let i = 1; i < segment.length; i += 1) {
    if (distances[i] >= target) {
      const span = distances[i] - distances[i - 1] || 1;
      const amount = (target - distances[i - 1]) / span;
      return [
        segment[i - 1][0] + (segment[i][0] - segment[i - 1][0]) * amount,
        segment[i - 1][1] + (segment[i][1] - segment[i - 1][1]) * amount,
      ];
    }
  }
  return segment[segment.length - 1];
}

function routeLatLngs(data) {
  return ((data.route_geometry && data.route_geometry.coordinates) || [])
    .map((pair) => [Number(pair[1]), Number(pair[0])])
    .filter((pair) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
}

function estimateTrainLatLng(data) {
  const stops = data.stops || [];
  const route = routeLatLngs(data);
  const current = latLngOf(data.current_position && data.current_position.coordinates);
  const last = stops[stops.length - 1];
  const stillRunning = stops.some((stop) => stop.status === "upcoming");
  if (last && !stillRunning) {
    return latLngOf(last.coordinates) || current || route[route.length - 1] || null;
  }

  const departedIndex = [...stops].map((stop) => stop.status).lastIndexOf("departed");
  const nextIndex = stops.findIndex((stop) => stop.status === "upcoming" || stop.status === "arrived");
  if (departedIndex < 0) {
    return latLngOf(stops[0] && stops[0].coordinates) || current || route[0] || null;
  }

  const fromStop = stops[departedIndex];
  const toStop = nextIndex >= 0 ? stops[nextIndex] : last;
  const from = latLngOf(fromStop && fromStop.coordinates) || current;
  const to = latLngOf(toStop && toStop.coordinates);
  if (!from && !to) return current || route[0] || null;
  if (!to) return from || current;

  const year = yearFromStamp(data.date);
  const startMs = parseTrainTime(fromStop.actual_departure || fromStop.scheduled_departure, year);
  const endMs = parseTrainTime(toStop.actual_arrival || toStop.scheduled_arrival, year);
  let progress = 0.2;
  if (startMs && endMs && endMs > startMs) {
    progress = (Date.now() - startMs) / (endMs - startMs);
  } else if (startMs && Date.now() > startMs) {
    progress = 0.28;
  }
  progress = Math.min(0.95, Math.max(0.05, progress));
  return pointAlongRoute(route, from, to, progress) || from;
}

function liveLocationLabel(data) {
  const stops = data.stops || [];
  const departedIndex = [...stops].map((stop) => stop.status).lastIndexOf("departed");
  const next = stops.find((stop) => stop.status === "upcoming");
  const last = stops[departedIndex];
  if (departedIndex < 0) return "Yet to start · at source";
  if (!next) return `Arrived · ${last ? last.name : "destination"}`;
  return `Between ${last.name} and ${next.name}`;
}

function initLiveMap(data) {
  const box = document.getElementById("live-map");
  if (!box) return;

  if (typeof L === "undefined") {
    box.innerHTML = `<p class="center muted">Map could not load. Check your internet connection and refresh.</p>`;
    return;
  }

  const route = routeLatLngs(data);
  const trainAt = estimateTrainLatLng(data);
  const stations = (data.stops || [])
    .map((stop) => ({ stop, latlng: latLngOf(stop.coordinates) }))
    .filter((item) => item.latlng);

  if (!trainAt && !route.length && !stations.length) {
    box.innerHTML = `<p class="center muted">No map coordinates were returned for this train.</p>`;
    return;
  }

  liveMap = L.map(box, { scrollWheelZoom: true, zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(liveMap);

  const bounds = [];
  if (route.length) {
    L.polyline(route, { color: "#0b3d78", weight: 4, opacity: 0.85 }).addTo(liveMap);
    route.forEach((point) => bounds.push(point));
  }

  stations.forEach(({ stop, latlng }) => {
    const color = stop.status === "departed" ? "#067647" : stop.status === "upcoming" ? "#0b3d78" : "#b54708";
    L.circleMarker(latlng, {
      radius: 6,
      color: "#fff",
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    }).addTo(liveMap).bindPopup(`<strong>${escapeHtml(stop.name)}</strong><br>${escapeHtml(stop.code)} · ${escapeHtml(stop.status)}`);
    bounds.push(latlng);
  });

  if (trainAt) {
    const icon = L.divIcon({
      className: "train-marker",
      html: `<div class="train-dot">🚂</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    L.marker(trainAt, { icon, zIndexOffset: 600 })
      .addTo(liveMap)
      .bindPopup(`<strong>${escapeHtml(data.number)} ${escapeHtml(data.name || "")}</strong><br>${escapeHtml(liveLocationLabel(data))}<br>${escapeHtml((data.current_position && data.current_position.delay) || "")}`)
      .openPopup();
    bounds.push(trainAt);
    liveMap.setView(trainAt, route.length ? 8 : 10);
  }

  if (bounds.length > 1) {
    liveMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
    if (trainAt) liveMap.panTo(trainAt);
  } else if (trainAt) {
    liveMap.setView(trainAt, 10);
  } else {
    liveMap.setView([22.5, 80], 5);
  }

  setTimeout(() => {
    if (liveMap) liveMap.invalidateSize();
  }, 80);
}

function renderLive(data) {
  destroyMap();
  const current = data.current_position || {};
  const delay = current.delay || "—";
  const departed = (data.stops || []).filter((s) => s.status === "departed").length;
  const upcoming = (data.stops || []).filter((s) => s.status === "upcoming").length;
  const trainAt = estimateTrainLatLng(data);
  const mapsUrl = trainAt
    ? `https://www.google.com/maps?q=${trainAt[0]},${trainAt[1]}`
    : "";
  const rows = (data.stops || [])
    .map((stop, index) => {
      const klass = stopRowClass(stop, current.code);
      return `<tr class="${klass}">
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(stop.name)}</strong><div class="muted">${escapeHtml(stop.code)}</div></td>
        <td>${escapeHtml(stop.scheduled_arrival || "—")}</td>
        <td>${escapeHtml(stop.scheduled_departure || "—")}</td>
        <td>${escapeHtml(stop.actual_arrival || "—")}</td>
        <td>${escapeHtml(stop.actual_departure || "—")}</td>
        <td>${escapeHtml(stop.delay_arrival || stop.delay_departure || "—")}</td>
        <td>${escapeHtml(stop.platform || "—")}</td>
        <td>${escapeHtml(stop.distance_km ?? "—")}</td>
        <td><span class="pill ${escapeHtml(stop.status || "upcoming")}">${escapeHtml(stop.status || "—")}</span></td>
      </tr>`;
    })
    .join("");

  els.spotResult.innerHTML = `
    <div class="status-banner">
      <div>
        <h3>${escapeHtml(data.number)} ${escapeHtml(data.name || "")}</h3>
        <p>${escapeHtml(liveLocationLabel(data))}</p>
      </div>
      <div>
        <span class="badge ${delayClass(delay)}">${escapeHtml(delay)}</span>
        <p style="margin-top:8px">Start date ${escapeHtml(data.date || "—")} · last halt ${escapeHtml(current.name || "—")} PF ${escapeHtml(current.platform || "—")}</p>
      </div>
    </div>
    <div class="progress">
      <div class="stat"><span>Last reported halt</span><b>${escapeHtml(current.name || "—")}</b></div>
      <div class="stat"><span>Stops departed</span><b>${departed} / ${data.total_stops || (data.stops || []).length}</b></div>
      <div class="stat"><span>Stops remaining</span><b>${upcoming}</b></div>
    </div>
    <div class="map-card">
      <div class="map-toolbar">
        <div>
          <p><strong>Live location</strong></p>
          <p class="muted">${escapeHtml(liveLocationLabel(data))} · updates every 60s</p>
        </div>
        <div class="map-actions">
          <button type="button" class="map-btn" id="refresh-live">Refresh</button>
          ${mapsUrl ? `<a class="map-btn" id="open-maps" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
        </div>
      </div>
      <div id="live-map"></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Station</th><th>Sch Arr</th><th>Sch Dep</th>
            <th>Act Arr</th><th>Act Dep</th><th>Delay</th><th>PF</th><th>Km</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="10" class="center muted">No stop data</td></tr>`}</tbody>
      </table>
    </div>`;

  requestAnimationFrame(() => initLiveMap(data));

  const refreshBtn = document.getElementById("refresh-live");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (lastLiveQuery) loadAndShowLive(lastLiveQuery.number, lastLiveQuery.date, { silent: false });
    });
  }
  refreshTimer = setInterval(() => {
    if (lastLiveQuery && !document.getElementById("view-spot").classList.contains("hidden")) {
      loadAndShowLive(lastLiveQuery.number, lastLiveQuery.date, { silent: true });
    }
  }, 60000);
}

function renderSchedule(data, meta) {
  const rows = (data.stops || [])
    .map((stop, index) => `<tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(stop.name)}</strong><div class="muted">${escapeHtml(stop.code)}</div></td>
      <td>${escapeHtml(stop.arrival || (index === 0 ? "Source" : "—"))}</td>
      <td>${escapeHtml(stop.departure || (index === data.stops.length - 1 ? "Dest" : "—"))}</td>
      <td>Day ${escapeHtml(stop.day ?? "—")}</td>
      <td>${escapeHtml(stop.distance_km ?? "—")}</td>
    </tr>`)
    .join("");

  els.scheduleResult.innerHTML = `
    <div class="status-banner">
      <div>
        <h3>${escapeHtml(meta.number || data.number)} ${escapeHtml(meta.name || "")}</h3>
        <p>${escapeHtml(meta.source || "")} → ${escapeHtml(meta.destination || "")}</p>
      </div>
      <div>
        <span class="badge">${escapeHtml(data.travel_time || "—")} hrs</span>
        <p style="margin-top:8px">Runs: ${escapeHtml(data.days_of_run || "—")}</p>
      </div>
    </div>
    <div class="table-wrap" style="margin-top:12px">
      <table>
        <thead>
          <tr><th>#</th><th>Station</th><th>Arrival</th><th>Departure</th><th>Day</th><th>Km</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderBetween(data) {
  const rows = (data.trains || [])
    .map((train) => `<tr class="clickable" data-number="${escapeHtml(train.number)}">
      <td><strong>${escapeHtml(train.number)}</strong></td>
      <td>${escapeHtml(train.name)}</td>
      <td>${escapeHtml(train.type || "—")}</td>
      <td>${escapeHtml(train.source?.code || "")} → ${escapeHtml(train.destination?.code || "")}</td>
      <td>${escapeHtml(train.departure || "—")}</td>
      <td>${escapeHtml(train.arrival || "—")}</td>
      <td>${escapeHtml(train.travel_time || "—")}</td>
      <td>${escapeHtml(train.days || "—")}</td>
    </tr>`)
    .join("");

  els.betweenResult.innerHTML = `
    <div class="status-banner">
      <div>
        <h3>${escapeHtml(data.from?.name || data.from?.code)} → ${escapeHtml(data.to?.name || data.to?.code)}</h3>
        <p>${data.count || 0} direct train(s) found</p>
      </div>
    </div>
    <div class="table-wrap" style="margin-top:12px">
      <table>
        <thead>
          <tr><th>No.</th><th>Name</th><th>Type</th><th>Run</th><th>Dep</th><th>Arr</th><th>Duration</th><th>Days</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="8" class="center muted">No trains found</td></tr>`}</tbody>
      </table>
    </div>`;

  els.betweenResult.querySelectorAll("tr[data-number]").forEach((row) => {
    row.addEventListener("click", () => {
      switchView("spot");
      els.trainQuery.value = row.dataset.number;
      loadAndShowLive(row.dataset.number);
    });
  });
}

async function loadAndShowLive(number, date, options = {}) {
  if (!options.silent) showLoading(els.spotResult, "Fetching live location...");
  try {
    const info = selectedTrain?.number === number && selectedTrain.instances
      ? selectedTrain
      : await loadTrainMeta(number);
    fillDates(info.instances, todayStamp());
    const start = date || preferredDate(info.instances, todayStamp());
    if (start) els.startDate.value = start;
    const path = start
      ? `/api/trains/${encodeURIComponent(number)}/live?date=${encodeURIComponent(start)}`
      : `/api/trains/${encodeURIComponent(number)}/live`;
    const live = await apiGet(path);
    lastLiveQuery = { number, date: live.date || start };
    renderLive(live);
  } catch (err) {
    showError(els.spotResult, err.message || "Could not fetch this train.");
  }
}

async function loadAndShowSchedule(number) {
  showLoading(els.scheduleResult, "Fetching train schedule...");
  try {
    const [info, schedule] = await Promise.all([
      apiGet(`/api/trains/${encodeURIComponent(number)}/info`),
      apiGet(`/api/trains/${encodeURIComponent(number)}/schedule`),
    ]);
    renderSchedule(schedule, info);
  } catch (err) {
    showError(els.scheduleResult, err.message || "Could not fetch schedule.");
  }
}

function extractTrainNumber(value) {
  const match = String(value || "").match(/\b(\d{4,5})\b/);
  return match ? match[1].padStart(5, "0") : "";
}

function switchView(name) {
  Object.entries(els.views).forEach(([key, node]) => {
    node.classList.toggle("hidden", key !== name);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

function stationMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return (window.STATIONS || [])
    .filter(([code, name]) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q))
    .slice(0, 10);
}

function renderStationSuggestions(list, input) {
  const matches = stationMatches(input.value);
  if (!matches.length) {
    hideSuggest(list);
    return;
  }
  list.hidden = false;
  list.innerHTML = matches
    .map(([code, name]) => `<li data-code="${escapeHtml(code)}"><span class="num">${escapeHtml(code)}</span>${escapeHtml(name)}</li>`)
    .join("");
  list.querySelectorAll("li").forEach((item) => {
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      input.value = item.dataset.code;
      hideSuggest(list);
    });
  });
}

function stationCodeFromInput(value) {
  const raw = value.trim().toUpperCase();
  const exact = (window.STATIONS || []).find(([code]) => code === raw);
  if (exact) return exact[0];
  const byName = (window.STATIONS || []).find(([, name]) => name === raw || name.toLowerCase() === value.trim().toLowerCase());
  if (byName) return byName[0];
  const first = stationMatches(value)[0];
  return first ? first[0] : raw.replace(/[^A-Z]/g, "");
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

els.trainQuery.addEventListener("input", () => {
  const number = extractTrainNumber(els.trainQuery.value);
  if (/^\d{5}$/.test(els.trainQuery.value.trim()) && number) {
    hideSuggest(els.suggest);
    loadTrainMeta(number).catch(() => {});
    return;
  }
  debounceSearch(els.trainQuery.value, els.suggest, (train) => pickTrain(train, els.trainQuery, els.suggest));
});

els.scheduleQuery.addEventListener("input", () => {
  debounceSearch(els.scheduleQuery.value, els.scheduleSuggest, (train) => {
    els.scheduleQuery.value = `${train.number} ${train.name || ""}`.trim();
    hideSuggest(els.scheduleSuggest);
  });
});

els.trainQuery.addEventListener("blur", () => setTimeout(() => hideSuggest(els.suggest), 150));
els.scheduleQuery.addEventListener("blur", () => setTimeout(() => hideSuggest(els.scheduleSuggest), 150));
els.fromStation.addEventListener("blur", () => setTimeout(() => hideSuggest(els.fromSuggest), 150));
els.toStation.addEventListener("blur", () => setTimeout(() => hideSuggest(els.toSuggest), 150));

els.fromStation.addEventListener("input", () => renderStationSuggestions(els.fromSuggest, els.fromStation));
els.toStation.addEventListener("input", () => renderStationSuggestions(els.toSuggest, els.toStation));

document.getElementById("spot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const number = selectedTrain?.number || extractTrainNumber(els.trainQuery.value);
  if (!number) {
    showError(els.spotResult, "Enter a train number or pick a train from the list.");
    return;
  }
  await loadAndShowLive(number, els.startDate.value);
});

document.getElementById("schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const number = extractTrainNumber(els.scheduleQuery.value);
  if (!number) {
    showError(els.scheduleResult, "Enter a train number or pick a train from the list.");
    return;
  }
  await loadAndShowSchedule(number);
});

document.getElementById("between-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const from = stationCodeFromInput(els.fromStation.value);
  const to = stationCodeFromInput(els.toStation.value);
  if (!from || !to) {
    showError(els.betweenResult, "Enter both From and To station codes.");
    return;
  }
  showLoading(els.betweenResult, "Finding trains between stations...");
  try {
    const data = await apiGet(`/api/trains/between?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    renderBetween(data);
  } catch (err) {
    showError(els.betweenResult, err.message || "Could not fetch trains.");
  }
});

document.getElementById("swap-stations").addEventListener("click", () => {
  const from = els.fromStation.value;
  els.fromStation.value = els.toStation.value;
  els.toStation.value = from;
});

document.querySelectorAll("#view-spot .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    els.trainQuery.value = chip.dataset.train;
    loadAndShowLive(chip.dataset.train);
  });
});

document.querySelectorAll("#view-between .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    els.fromStation.value = chip.dataset.from;
    els.toStation.value = chip.dataset.to;
    document.getElementById("between-form").requestSubmit();
  });
});

tickClock();
setInterval(tickClock, 1000);
