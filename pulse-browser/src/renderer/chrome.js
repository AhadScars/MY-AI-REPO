/* Pulse Browser — chrome UI controller */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let state = { tabs: [], activeTabId: null, bookmarks: [], settings: {} };
let suggestItems = [];
let suggestIndex = -1;
let suggestOpen = false;
let toastTimer = null;

const els = {
  tabs: $('#tabs'),
  btnNewTab: $('#btn-new-tab'),
  btnBack: $('#btn-back'),
  btnForward: $('#btn-forward'),
  btnReload: $('#btn-reload'),
  iconReload: $('#icon-reload'),
  iconStop: $('#icon-stop'),
  btnHome: $('#btn-home'),
  urlInput: $('#url-input'),
  omnibox: $('#omnibox'),
  secureIcon: $('#secure-icon'),
  iconLock: $('#icon-lock'),
  iconInfo: $('#icon-info'),
  btnBookmark: $('#btn-bookmark'),
  btnDownloads: $('#btn-downloads'),
  btnMenu: $('#btn-menu'),
  suggest: $('#suggest'),
  bookmarksBar: $('#bookmarks-bar'),
  progress: $('#progress'),
  toast: $('#toast'),
  chromeRoot: $('#app'),
  tabstrip: $('#tabstrip'),
};

function activeTab() {
  return state.tabs.find((t) => t.id === state.activeTabId) || null;
}

function displayUrl(url) {
  if (!url) return '';
  if (url.startsWith('pulse://newtab')) return '';
  if (url.startsWith('pulse://')) return url;
  try {
    const u = new URL(url);
    return url;
  } catch {
    return url;
  }
}

function reportChromeHeight() {
  let h = els.chromeRoot.getBoundingClientRect().height;
  // Omnibox suggestions sit below the chrome strip — reserve space only for those.
  // Hamburger menu uses a separate overlay window and must not push the page down.
  if (suggestOpen && !els.suggest.classList.contains('hidden')) {
    h = Math.max(h, els.suggest.getBoundingClientRect().bottom + 8);
  }
  if (!els.toast.classList.contains('hidden')) {
    h = Math.max(h, els.toast.getBoundingClientRect().bottom + 8);
  }
  window.pulse.setChromeHeight(Math.ceil(h));
}

function createTabElement(tab) {
  const el = document.createElement('div');
  el.className = 'tab' + (tab.isActive ? ' active' : '');
  el.dataset.id = tab.id;
  el.setAttribute('role', 'tab');
  el.setAttribute('aria-selected', tab.isActive ? 'true' : 'false');
  el.title = tab.title + (tab.url ? '\n' + tab.url : '');

  let favHtml = '';
  if (tab.isLoading) {
    favHtml = '<div class="tab-spinner"></div>';
  } else if (tab.favicon) {
    favHtml = `<img class="tab-favicon" src="${escapeAttr(tab.favicon)}" alt="" onerror="this.style.display='none'" />`;
  } else {
    favHtml = '<div class="tab-favicon placeholder">🌐</div>';
  }

  el.innerHTML = `
    ${favHtml}
    <span class="tab-title">${escapeHtml(tab.title || 'New Tab')}</span>
    <button class="tab-close" title="Close" data-close="${tab.id}" aria-label="Close tab" type="button">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  `;

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return;
    window.pulse.activateTab(tab.id);
  });

  el.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      window.pulse.closeTab(tab.id);
    }
  });

  el.querySelector('[data-close]').addEventListener('click', (e) => {
    e.stopPropagation();
    window.pulse.closeTab(tab.id);
  });

  return el;
}

function renderTabs() {
  // Park the new-tab button outside while we rebuild (keeps its listeners)
  if (els.btnNewTab.parentElement) {
    els.tabstrip.appendChild(els.btnNewTab);
  }

  els.tabs.innerHTML = '';
  let placedNewTab = false;

  state.tabs.forEach((tab) => {
    els.tabs.appendChild(createTabElement(tab));
    // Place + immediately after the active (current) tab
    if (tab.isActive || tab.id === state.activeTabId) {
      els.tabs.appendChild(els.btnNewTab);
      placedNewTab = true;
    }
  });

  if (!placedNewTab) {
    els.tabs.appendChild(els.btnNewTab);
  }

  const active = els.tabs.querySelector('.tab.active');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // Keep + visible too
  els.btnNewTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function renderToolbar() {
  const tab = activeTab();
  if (!tab) {
    els.btnBack.disabled = true;
    els.btnForward.disabled = true;
    els.urlInput.value = '';
    return;
  }

  els.btnBack.disabled = !tab.canGoBack;
  els.btnForward.disabled = !tab.canGoForward;

  // Don't stomp user typing
  if (document.activeElement !== els.urlInput) {
    els.urlInput.value = displayUrl(tab.url);
  }

  // Reload / stop
  if (tab.isLoading) {
    els.iconReload.classList.add('hidden');
    els.iconStop.classList.remove('hidden');
    els.btnReload.title = 'Stop';
    els.progress.classList.remove('hidden');
  } else {
    els.iconReload.classList.remove('hidden');
    els.iconStop.classList.add('hidden');
    els.btnReload.title = 'Reload (Ctrl+R)';
    els.progress.classList.add('hidden');
  }

  // Security icon
  const isHttps = tab.url && tab.url.startsWith('https://');
  const isInternal = tab.isInternal || (tab.url && tab.url.startsWith('pulse://'));
  if (isHttps) {
    els.iconLock.classList.remove('hidden');
    els.iconInfo.classList.add('hidden');
    els.secureIcon.classList.add('secure');
    els.secureIcon.title = 'Connection is secure';
  } else {
    els.iconLock.classList.add('hidden');
    els.iconInfo.classList.remove('hidden');
    els.secureIcon.classList.remove('secure');
    els.secureIcon.title = isInternal ? 'Pulse internal page' : 'Connection is not secure';
  }

  // Bookmark star
  updateBookmarkStar(tab);
  reportChromeHeight();
}

async function updateBookmarkStar(tab) {
  if (!tab || !tab.url || tab.isInternal || tab.url.startsWith('pulse://')) {
    els.btnBookmark.classList.remove('active-star');
    return;
  }
  const bookmarked = await window.pulse.isBookmarked(tab.url);
  els.btnBookmark.classList.toggle('active-star', !!bookmarked);
}

function renderBookmarksBar() {
  const show = state.settings?.showBookmarksBar !== false;
  els.bookmarksBar.classList.toggle('hidden-bar', !show);
  if (!show) {
    reportChromeHeight();
    return;
  }

  const list = state.bookmarks || [];
  els.bookmarksBar.innerHTML = list
    .slice(0, 20)
    .map(
      (b) => `
    <button class="bm-chip" data-url="${escapeAttr(b.url)}" title="${escapeAttr(b.url)}">
      ${b.favicon ? `<img src="${escapeAttr(b.favicon)}" alt="" onerror="this.remove()" />` : ''}
      <span>${escapeHtml(b.title || b.url)}</span>
    </button>
  `
    )
    .join('');

  $$('.bm-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = activeTab();
      if (tab) window.pulse.navigate(tab.id, btn.dataset.url);
      else window.pulse.createTab(btn.dataset.url);
    });
  });
  reportChromeHeight();
}

function applyState(next) {
  if (!next) return;
  state = next;
  renderTabs();
  renderToolbar();
  renderBookmarksBar();
}

/* ——— Suggestions ——— */
async function showSuggest(query) {
  const data = await window.pulse.suggest(query);
  suggestItems = [];

  const q = (query || '').trim();
  if (q) {
    // Search option
    suggestItems.push({
      type: 'search',
      title: `Search Google for "${q}"`,
      url: q,
      icon: '🔍',
    });
    // If looks like URL, offer navigate
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(q) || q.includes('://')) {
      suggestItems.push({
        type: 'url',
        title: q,
        url: q,
        icon: '↗',
      });
    }
  }

  (data.bookmarks || []).forEach((b) => {
    suggestItems.push({
      type: 'bookmark',
      title: b.title,
      url: b.url,
      icon: '⭐',
    });
  });

  (data.history || []).forEach((h) => {
    suggestItems.push({
      type: 'history',
      title: h.title,
      url: h.url,
      icon: '🕐',
    });
  });

  // Dedupe by url
  const seen = new Set();
  suggestItems = suggestItems.filter((item) => {
    const key = item.type + item.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);

  if (!suggestItems.length) {
    hideSuggest();
    return;
  }

  els.suggest.innerHTML = suggestItems
    .map(
      (item, i) => `
    <div class="suggest-item${i === suggestIndex ? ' active' : ''}" data-idx="${i}" role="option">
      <span class="s-icon">${item.icon}</span>
      <div class="s-main">
        <div class="s-title">${escapeHtml(item.title)}</div>
        ${item.type !== 'search' ? `<div class="s-url">${escapeHtml(item.url)}</div>` : ''}
      </div>
      <span class="s-badge">${item.type}</span>
    </div>
  `
    )
    .join('');

  els.suggest.classList.remove('hidden');
  suggestOpen = true;
  requestAnimationFrame(reportChromeHeight);

  $$('.suggest-item').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const idx = Number(el.dataset.idx);
      pickSuggest(idx);
    });
  });
}

function hideSuggest() {
  els.suggest.classList.add('hidden');
  els.suggest.innerHTML = '';
  suggestOpen = false;
  suggestIndex = -1;
  suggestItems = [];
  reportChromeHeight();
}

function pickSuggest(idx) {
  const item = suggestItems[idx];
  if (!item) return;
  const tab = activeTab();
  const target = item.type === 'search' ? item.url : item.url;
  hideSuggest();
  els.urlInput.blur();
  if (tab) window.pulse.navigate(tab.id, target);
  else window.pulse.createTab(target);
}

function navigateFromOmnibox() {
  const value = els.urlInput.value.trim();
  if (!value) return;
  hideSuggest();
  const tab = activeTab();
  els.urlInput.blur();
  if (tab) window.pulse.navigate(tab.id, value);
  else window.pulse.createTab(value);
}

/* ——— Hamburger menu (overlay window — does not push page) ——— */
function openAppMenu() {
  const rect = els.btnMenu.getBoundingClientRect();
  window.pulse.showAppMenu({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  });
}

/* ——— Toast ——— */
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  requestAnimationFrame(reportChromeHeight);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
    reportChromeHeight();
  }, 2800);
}

/* ——— Helpers ——— */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/* ——— Events ——— */
function bindEvents() {
  els.btnNewTab.addEventListener('click', () => window.pulse.createTab('pulse://newtab'));

  els.btnBack.addEventListener('click', () => {
    const t = activeTab();
    if (t) window.pulse.goBack(t.id);
  });

  els.btnForward.addEventListener('click', () => {
    const t = activeTab();
    if (t) window.pulse.goForward(t.id);
  });

  els.btnReload.addEventListener('click', () => {
    const t = activeTab();
    if (!t) return;
    if (t.isLoading) window.pulse.stop(t.id);
    else window.pulse.reload(t.id);
  });

  els.btnHome.addEventListener('click', () => {
    const t = activeTab();
    const home = state.settings?.homePage || 'pulse://newtab';
    if (t) window.pulse.navigate(t.id, home);
  });

  els.btnBookmark.addEventListener('click', async () => {
    const t = activeTab();
    if (!t || !t.url || t.isInternal) return;
    const res = await window.pulse.toggleBookmark({
      title: t.title,
      url: t.url,
      favicon: t.favicon,
    });
    els.btnBookmark.classList.toggle('active-star', res.bookmarked);
    showToast(res.bookmarked ? 'Bookmark added' : 'Bookmark removed');
  });

  els.btnDownloads.addEventListener('click', () => {
    window.pulse.createTab('pulse://downloads');
  });

  els.btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    openAppMenu();
  });

  document.addEventListener('click', (e) => {
    if (!els.suggest.contains(e.target) && e.target !== els.urlInput) {
      hideSuggest();
    }
  });

  els.urlInput.addEventListener('focus', () => {
    els.urlInput.select();
    showSuggest(els.urlInput.value);
  });

  els.urlInput.addEventListener('input', () => {
    suggestIndex = -1;
    showSuggest(els.urlInput.value);
  });

  els.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSuggest();
      els.urlInput.blur();
      const t = activeTab();
      if (t) els.urlInput.value = displayUrl(t.url);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' && suggestOpen) {
      e.preventDefault();
      suggestIndex = Math.min(suggestItems.length - 1, suggestIndex + 1);
      showSuggest(els.urlInput.value).then(() => {
        // re-render keeps index
      });
      // Manual highlight
      $$('.suggest-item').forEach((el, i) => el.classList.toggle('active', i === suggestIndex));
      return;
    }
    if (e.key === 'ArrowUp' && suggestOpen) {
      e.preventDefault();
      suggestIndex = Math.max(-1, suggestIndex - 1);
      $$('.suggest-item').forEach((el, i) => el.classList.toggle('active', i === suggestIndex));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestOpen && suggestIndex >= 0) pickSuggest(suggestIndex);
      else navigateFromOmnibox();
    }
  });

  // Double-click tabstrip empty area → new tab
  $('#tabstrip').addEventListener('dblclick', (e) => {
    if (e.target.id === 'tabstrip' || e.target.classList.contains('tabstrip-spacer')) {
      window.pulse.createTab('pulse://newtab');
    }
  });

  window.addEventListener('resize', () => reportChromeHeight());
}

async function init() {
  bindEvents();
  window.pulse.onState(applyState);
  window.pulse.onToast((data) => showToast(data.message));
  window.pulse.onFocusOmnibox(() => {
    els.urlInput.focus();
    els.urlInput.select();
  });
  window.pulse.onDownload(() => {
    // subtle pulse on downloads button could go here
  });

  const initial = await window.pulse.getState();
  applyState(initial);
  // Measure after first paint
  requestAnimationFrame(() => {
    reportChromeHeight();
    setTimeout(reportChromeHeight, 50);
  });
}

init();
