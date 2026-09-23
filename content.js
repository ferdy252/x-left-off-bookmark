// X Left-Off Bookmark v1.1.0
// ONE bookmark per page-type (Notifications, Home, etc.)
// Panel only — no per-tweet buttons (they clashed with Grok).
// Panel is draggable. Each page can be turned ON/OFF.
(function () {
  'use strict';

  const STORE_KEY = 'x-left-off-bookmarks-v1';
  const ENABLE_KEY = 'x-left-off-enabled-v1';
  const POS_KEY = 'x-left-off-panel-pos-v1';

  function pageKey() {
    const p = location.pathname || '/';
    if (p.startsWith('/notifications')) return 'notifications';
    if (p.startsWith('/home')) return 'home';
    if (p.startsWith('/i/bookmarks')) return 'bookmarks';
    return 'page:' + p.split('/').slice(0, 3).join('/');
  }
  function pageLabel() {
    const k = pageKey();
    if (k === 'notifications') return 'Notifications';
    if (k === 'home') return 'Home';
    if (k === 'bookmarks') return 'Bookmarks';
    return k.replace('page:', '') || 'This page';
  }

  function getStoreAPI() {
    try {
      const b = window.browser || window.chrome;
      if (b && b.storage && b.storage.local) return b.storage.local;
    } catch (e) {}
    return null;
  }
  function readLocal(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function writeLocal(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  async function storeGet(key, fallback) {
    const api = getStoreAPI();
    if (api) {
      return new Promise((resolve) => {
        try { api.get([key], (res) => resolve(res[key] !== undefined ? res[key] : fallback)); }
        catch (e) { resolve(readLocal(key, fallback)); }
      });
    }
    return readLocal(key, fallback);
  }
  async function storeSet(key, val) {
    const api = getStoreAPI();
    if (api) {
      return new Promise((resolve) => {
        try { api.set({ [key]: val }, () => resolve(true)); }
        catch (e) { writeLocal(key, val); resolve(true); }
      });
    }
    writeLocal(key, val);
    return true;
  }

  async function isEnabled() {
    const map = await storeGet(ENABLE_KEY, {});
    // default ON for every page
    if (!(pageKey() in map)) return true;
    return !!map[pageKey()];
  }
  async function setEnabled(on) {
    const map = await storeGet(ENABLE_KEY, {});
    map[pageKey()] = !!on;
    await storeSet(ENABLE_KEY, map);
  }

  // ---- tweet helpers ----
  function getTweetId(article) {
    const a = article.querySelector('a[href*="/status/"]');
    if (!a) return null;
    const m = (a.getAttribute('href') || '').match(/\/status\/(\d+)/);
    return m ? m[1] : null;
  }
  function getTweetMeta(article) {
    const id = getTweetId(article);
    if (!id) return null;
    const textEl = article.querySelector('div[data-testid="tweetText"]');
    let author = '';
    const userEl = article.querySelector('div[data-testid="User-Name"]');
    if (userEl) author = (userEl.innerText || '').split('\n')[0].slice(0, 40);
    return {
      id,
      author,
      snippet: ((textEl ? textEl.innerText : '') || '').slice(0, 80),
      url: location.origin + '/i/status/' + id,
      savedAt: Date.now()
    };
  }
  function allTweetArticles() {
    return Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  }
  function topVisibleTweet() {
    const tweets = allTweetArticles();
    let best = null, bestTop = Infinity;
    for (const t of tweets) {
      const r = t.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.bottom < 80) continue;
      if (r.top < bestTop && r.bottom > 120) { best = t; bestTop = r.top; }
    }
    return best;
  }
  function findTweetById(id) {
    for (const t of allTweetArticles()) {
      if (getTweetId(t) === id) return t;
    }
    return null;
  }

  // ---- UI: floating draggable panel ----
  let panel, snippetEl, titleEl, toggleBtn;
  function buildPanel() {
    if (document.getElementById('x-leftoff-panel')) return;
    // clean up any old per-tweet buttons from v1.0
    document.querySelectorAll('.x-leftoff-tweet-btn').forEach(b => b.remove());

    panel = document.createElement('div');
    panel.id = 'x-leftoff-panel';
    panel.innerHTML =
      '<div class="x-leftoff-title" title="Drag me anywhere">⠿ 📖 Left-off bookmark</div>' +
      '<div class="x-leftoff-snippet">No mark on this page yet.</div>' +
      '<div><button data-act="mark">Mark here</button>' +
      '<button data-act="jump" class="x-leftoff-secondary">Go to mark</button>' +
      '<button data-act="clear" class="x-leftoff-secondary">Clear</button>' +
      '<button data-act="toggle" class="x-leftoff-secondary">Turn off</button></div>';
    document.documentElement.appendChild(panel);
    snippetEl = panel.querySelector('.x-leftoff-snippet');
    titleEl = panel.querySelector('.x-leftoff-title');
    toggleBtn = panel.querySelector('button[data-act="toggle"]');

    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'mark') await markTop();
      if (act === 'jump') await jumpToMark(true);
      if (act === 'clear') await clearMark();
      if (act === 'toggle') await toggleEnabled();
    });

    makeDraggable();
    restorePanelPos();
  }

  function makeDraggable() {
    const handle = panel.querySelector('.x-leftoff-title');
    handle.style.cursor = 'move';
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = ox + 'px';
      panel.style.top = oy + 'px';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const nx = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 120);
      const ny = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 60);
      panel.style.left = nx + 'px';
      panel.style.top = ny + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = panel.getBoundingClientRect();
      storeSet(POS_KEY, { left: r.left, top: r.top });
    });
    // touch support (Android / mobile)
    handle.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      dragging = true; sx = t.clientX; sy = t.clientY;
      const r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      panel.style.left = Math.min(Math.max(0, ox + t.clientX - sx), window.innerWidth - 120) + 'px';
      panel.style.top = Math.min(Math.max(0, oy + t.clientY - sy), window.innerHeight - 60) + 'px';
    }, { passive: true });
    window.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      const r = panel.getBoundingClientRect();
      storeSet(POS_KEY, { left: r.left, top: r.top });
    });
  }

  async function restorePanelPos() {
    const pos = await storeGet(POS_KEY, null);
    if (pos && typeof pos.left === 'number') {
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = Math.min(pos.left, window.innerWidth - 120) + 'px';
      panel.style.top = Math.min(pos.top, window.innerHeight - 60) + 'px';
    }
  }

  async function refreshPanel() {
    if (!snippetEl) return;
    const on = await isEnabled();
    const marks = await storeGet(STORE_KEY, {});
    const mark = marks[pageKey()];
    titleEl.textContent = '⠿ 📖 ' + pageLabel() + ' — ' + (on ? 'on' : 'off');
    panel.classList.toggle('x-leftoff-off', !on);
    toggleBtn.textContent = on ? 'Turn off' : 'Turn on';
    if (!on) {
      snippetEl.textContent = 'Paused on this page. Hit Turn on to resume.';
      return;
    }
    snippetEl.textContent = (mark && mark.id)
      ? ((mark.author ? mark.author + ': ' : '') + (mark.snippet || mark.id))
      : 'No mark on this page yet.';
  }

  async function toggleEnabled() {
    const on = await isEnabled();
    await setEnabled(!on);
    if (!on) {
      // turning back on
      toast('On for ' + pageLabel() + ' ✓');
    } else {
      document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
      toast('Off for ' + pageLabel() + ' — line hidden.');
    }
    await refreshPanel();
    await placeDivider();
  }

  async function markTop() {
    if (!(await isEnabled())) { toast('Turn it on for this page first.'); return; }
    const top = topVisibleTweet();
    if (!top) { toast('Scroll a little first, then mark.'); return; }
    const meta = getTweetMeta(top);
    if (!meta) { toast('Could not find that post. Try another one.'); return; }
    const marks = await storeGet(STORE_KEY, {});
    marks[pageKey()] = meta;
    await storeSet(STORE_KEY, marks);
    await refreshPanel();
    await placeDivider();
    toast('Bookmarked here ✓ — I’ll show it when you come back.');
  }

  async function clearMark() {
    const marks = await storeGet(STORE_KEY, {});
    delete marks[pageKey()];
    await storeSet(STORE_KEY, marks);
    document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
    await refreshPanel();
    toast('Mark cleared.');
  }

  async function jumpToMark(withMsg) {
    if (!(await isEnabled())) { if (withMsg) toast('It’s off for this page — hit Turn on.'); return; }
    const marks = await storeGet(STORE_KEY, {});
    const mark = marks[pageKey()];
    if (!mark) { if (withMsg) toast('No mark on this page yet — hit Mark here.'); return; }
    const el = findTweetById(mark.id);
    if (!el) {
      if (withMsg) toast('Haven’t found it yet — new posts pushed it down. Scroll slowly and I’ll catch it.');
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('x-leftoff-flash');
    setTimeout(() => el.classList.add('x-leftoff-flash'), 50);
    setTimeout(() => el.classList.remove('x-leftoff-flash'), 2500);
    placeDivider();
  }

  function toast(msg) {
    let t = document.getElementById('x-leftoff-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'x-leftoff-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#000;color:#fff;padding:8px 14px;border-radius:9999px;font-size:13px;z-index:1000000;opacity:0;transition:opacity .3s;font-family:sans-serif;';
      document.documentElement.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  }

  async function placeDivider() {
    document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
    if (!(await isEnabled())) return;
    const marks = await storeGet(STORE_KEY, {});
    const mark = marks[pageKey()];
    if (!mark) return;
    const art = findTweetById(mark.id);
    if (!art) return;
    const div = document.createElement('div');
    div.className = 'x-leftoff-divider';
    div.textContent = '▼ YOU LEFT OFF HERE ▼';
    art.parentElement.insertBefore(div, art);
  }

  let debounce = null;
  function observe() {
    const obs = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { placeDivider(); refreshPanel(); }, 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  let lastKey = pageKey() + '|' + location.href;
  setInterval(() => {
    const now = pageKey() + '|' + location.href;
    if (now !== lastKey) {
      lastKey = now;
      document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
      // remove any stale v1.0 buttons if X kept DOM
      document.querySelectorAll('.x-leftoff-tweet-btn').forEach(b => b.remove());
      placeDivider();
      refreshPanel();
    }
  }, 1000);

  buildPanel();
  refreshPanel();
  placeDivider();
  observe();
  setTimeout(() => { placeDivider(); refreshPanel(); }, 2500);
})();
