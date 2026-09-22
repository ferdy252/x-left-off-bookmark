// X Left-Off Bookmark - plain and simple.
// Saves ONE bookmark per page-type (Notifications, Home, etc.)
// Bookmark = the tweet ID. Stays in Firefox even after restart.
(function () {
  'use strict';

  const STORE_KEY = 'x-left-off-bookmarks-v1';

  function pageKey() {
    const p = location.pathname || '/';
    if (p.startsWith('/notifications')) return 'notifications';
    if (p.startsWith('/home')) return 'home';
    if (p.startsWith('/i/bookmarks')) return 'bookmarks';
    return 'page:' + p.split('/').slice(0, 3).join('/');
  }

  // ---- storage (Firefox storage API, fallback to localStorage) ----
  function getStoreAPI() {
    try {
      const b = window.browser || window.chrome;
      if (b && b.storage && b.storage.local) return b.storage.local;
    } catch (e) {}
    return null;
  }
  async function loadAll() {
    const api = getStoreAPI();
    if (api) {
      return new Promise((resolve) => {
        try {
          api.get([STORE_KEY], (res) => resolve(res[STORE_KEY] || {}));
        } catch (e) { resolve(readLocal()); }
      });
    }
    return readLocal();
  }
  async function saveAll(obj) {
    const api = getStoreAPI();
    if (api) {
      return new Promise((resolve) => {
        try {
          api.set({ [STORE_KEY]: obj }, () => resolve(true));
        } catch (e) { writeLocal(obj); resolve(true); }
      });
    }
    writeLocal(obj);
    return true;
  }
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function writeLocal(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) {}
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
    const timeEl = article.querySelector('time');
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
      // top of screen area, below X header (~60px)
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

  // ---- UI: floating panel ----
  let panel, snippetEl, titleEl;
  function buildPanel() {
    if (document.getElementById('x-leftoff-panel')) return;
    panel = document.createElement('div');
    panel.id = 'x-leftoff-panel';
    panel.innerHTML =
      '<div class="x-leftoff-title">📖 Left-off bookmark</div>' +
      '<div class="x-leftoff-snippet">No mark on this page yet.</div>' +
      '<div><button data-act="mark">Mark here</button>' +
      '<button data-act="jump" class="x-leftoff-secondary">Go to mark</button>' +
      '<button data-act="clear" class="x-leftoff-secondary">Clear</button></div>';
    document.documentElement.appendChild(panel);
    snippetEl = panel.querySelector('.x-leftoff-snippet');
    titleEl = panel.querySelector('.x-leftoff-title');
    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'mark') await markTop();
      if (act === 'jump') await jumpToMark(true);
      if (act === 'clear') await clearMark();
    });
  }

  async function refreshPanel() {
    if (!snippetEl) return;
    const all = await loadAll();
    const mark = all[pageKey()];
    const label = pageKey() === 'notifications' ? 'Notifications'
      : pageKey() === 'home' ? 'Home' : pageKey();
    titleEl.textContent = '📖 ' + label + ' — left off';
    if (mark && mark.id) {
      snippetEl.textContent = (mark.author ? mark.author + ': ' : '') + (mark.snippet || mark.id);
    } else {
      snippetEl.textContent = 'No mark on this page yet.';
    }
    // highlight per-tweet buttons
    document.querySelectorAll('.x-leftoff-tweet-btn.x-leftoff-active')
      .forEach(b => b.classList.remove('x-leftoff-active'));
    if (mark && mark.id) {
      const art = findTweetById(mark.id);
      if (art) {
        const b = art.querySelector('.x-leftoff-tweet-btn');
        if (b) b.classList.add('x-leftoff-active');
      }
    }
  }

  async function markTweet(article, silent) {
    const meta = getTweetMeta(article);
    if (!meta) {
      if (!silent) toast('Could not find that post. Try another one.');
      return false;
    }
    const all = await loadAll();
    all[pageKey()] = meta;
    await saveAll(all);
    await refreshPanel();
    placeDivider();
    if (!silent) toast('Bookmarked here ✓ — I’ll show it when you come back.');
    return true;
  }

  async function markTop() {
    const top = topVisibleTweet();
    if (!top) { toast('Scroll a little first, then mark.'); return; }
    await markTweet(top);
  }

  async function clearMark() {
    const all = await loadAll();
    delete all[pageKey()];
    await saveAll(all);
    document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
    await refreshPanel();
    toast('Mark cleared.');
  }

  async function jumpToMark(withMsg) {
    const all = await loadAll();
    const mark = all[pageKey()];
    if (!mark) { if (withMsg) toast('No mark on this page yet — hit Mark here.'); return; }
    const el = findTweetById(mark.id);
    if (!el) {
      if (withMsg) toast('Haven’t found it yet — new posts pushed it down. Scroll down slowly and I’ll catch it.');
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

  // ---- the visible "YOU LEFT OFF HERE" line ----
  async function placeDivider() {
    const all = await loadAll();
    const mark = all[pageKey()];
    document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
    if (!mark) return;
    const art = findTweetById(mark.id);
    if (!art || art.parentElement.querySelector(':scope > .x-leftoff-divider')) return;
    const div = document.createElement('div');
    div.className = 'x-leftoff-divider';
    div.textContent = '▼ YOU LEFT OFF HERE ▼';
    art.parentElement.insertBefore(div, art);
  }

  // ---- per-tweet little bookmark button ----
  function tagTweets() {
    for (const art of allTweetArticles()) {
      if (art.dataset.leftoffTagged) continue;
      art.dataset.leftoffTagged = '1';
      try {
        const cs = window.getComputedStyle(art);
        if (cs.position === 'static') art.style.position = 'relative';
      } catch (e) {}
      const btn = document.createElement('button');
      btn.className = 'x-leftoff-tweet-btn';
      btn.textContent = '🔖 mark';
      btn.title = 'Remember this spot';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        markTweet(art);
      });
      art.appendChild(btn);
    }
  }

  // ---- watch X load more posts as you scroll ----
  let debounce = null;
  function observe() {
    const obs = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        tagTweets();
        placeDivider();
        refreshPanel();
      }, 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // X is a single-page app — page "changes" without reload
  let lastKey = pageKey() + '|' + location.href;
  setInterval(() => {
    const now = pageKey() + '|' + location.href;
    if (now !== lastKey) {
      lastKey = now;
      document.querySelectorAll('.x-leftoff-divider').forEach(d => d.remove());
      placeDivider();
      refreshPanel();
    }
  }, 1000);

  // start
  buildPanel();
  tagTweets();
  refreshPanel();
  placeDivider();
  observe();
  // after first load, offer to jump back
  setTimeout(() => {
    loadAll().then((all) => {
      const mark = all[pageKey()];
      if (mark && mark.id) {
        const el = findTweetById(mark.id);
        if (el) {
          placeDivider();
          refreshPanel();
          // gentle: don't yank them, just let the blue line + panel show.
          // Uncomment to auto-jump:
          // jumpToMark(false);
        }
      }
    });
  }, 2500);
})();
