// load-nav.js — Dynamically loads the shared nav into every page
// Usage: <script src="load-nav.js"></script> inside <body>

(async function () {
  // 1. Insert placeholder or find existing one
  let placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.id = 'nav-placeholder';
    document.body.insertBefore(placeholder, document.body.firstChild);
  }

  try {
    const res = await fetch('nav.html?v=20260320a');
    if (!res.ok) throw new Error('nav.html fetch failed: ' + res.status);
    placeholder.outerHTML = await res.text();
  } catch (e) {
    console.error('Could not load nav.html:', e.message);
    document.dispatchEvent(new CustomEvent('navLoaded'));
    return;
  }

  // 2. Mark active nav link based on current page
  const page = window.location.pathname.split('/').pop() || 'map.html';
  document.querySelectorAll('.nav-link[data-page]').forEach(function(link) {
    if (link.dataset.page === page) link.classList.add('active');
  });

  // 3. Init ticker — static items first, then enrich from DB
  const _staticTickerItems = [
    { icon: '🤝', color: 'collab', text: 'stellar_wanderer seeking collaborators for LUM-04 development' },
    { icon: '⚠️', color: 'alert',  text: 'Minister Talha consultation available for LUM-01 owners' },
    { icon: 'ℹ️', color: 'info',   text: '320 units across 20 territories · Join MINALIA today' },
    { icon: '🤝', color: 'collab', text: 'cosmic_trader offering partnership on LUM-09 expansion' },
    { icon: '⚠️', color: 'alert',  text: 'New loan tier available: 40K MINA at 8% for qualified owners' },
    { icon: 'ℹ️', color: 'info',   text: 'Minister alerts now live · Check your dashboard for insights' }
  ];

  function renderTicker(items) {
    const scroll = document.getElementById('ticker-scroll');
    if (!scroll) return;
    const doubled = [...items, ...items];
    scroll.innerHTML = doubled.map(function(i) {
      return '<div class="ticker-item"><span class="ticker-icon ' + i.color + '">' + i.icon + '</span><span>' + i.text + '</span></div>';
    }).join('');
  }

  renderTicker(_staticTickerItems);

  // 4. Enrich ticker from DB (non-blocking)
  async function buildTickerFromDB() {
    try {
      let db = null;
      for (let i = 0; i < 30; i++) {
        if (window.supabaseClient || window.supabase?.from) {
          db = window.supabaseClient || window.supabase;
          break;
        }
        await new Promise(function(r) { setTimeout(r, 100); });
      }
      if (!db) return;

      const [saleRes, auctionRes] = await Promise.all([
        db.from('units').select('unit_code, sale_price').eq('for_sale', true),
        db.from('units').select('unit_code, auction_min_bid, auction_current_bid').eq('auction_active', true)
      ]);

      const liveItems = [];
      if (saleRes.data) {
        saleRes.data.forEach(function(u) {
          const price = parseFloat(u.sale_price || 0).toLocaleString();
          liveItems.push({ icon: '💰', color: 'sale', text: 'Unit ' + u.unit_code + ' listed for sale · ' + price + ' ARKIS' });
        });
      }
      if (auctionRes.data) {
        auctionRes.data.forEach(function(u) {
          const bid = parseFloat(u.auction_current_bid || u.auction_min_bid || 0).toLocaleString();
          const label = u.auction_current_bid ? 'Current bid' : 'Min bid';
          liveItems.push({ icon: '🔨', color: 'auction', text: 'Auction live · ' + u.unit_code + ' · ' + label + ': ' + bid + ' ARKIS' });
        });
      }
      if (liveItems.length > 0) {
        renderTicker([...liveItems, ..._staticTickerItems]);
      }
    } catch (e) {
      console.warn('Ticker DB load failed:', e.message);
    }
  }
  buildTickerFromDB();

  // 5. Dispatch navLoaded so auth_auro.js, nav-audio.js etc. wire up
  document.dispatchEvent(new CustomEvent('navLoaded'));

  // 6. Land dropdown — close on outside click
  document.addEventListener('click', function(e) {
    var menu = document.getElementById('landDropdownMenu');
    var wrap = document.getElementById('landDropdownWrap');
    if (menu && wrap && !wrap.contains(e.target)) menu.classList.remove('open');
  });

  // 7. Load unread alerts badge (after short delay for supabase to be ready)
  setTimeout(loadAlertBadge, 1800);
})();

// ── Copy wallet address ──────────────────────────────────────────────────────
function copyWallet() {
  try {
    var session = JSON.parse(localStorage.getItem('minalia_session') || '{}');
    var addr = session.wallet_address || '';
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(function() {
      var el = document.getElementById('dropdownWallet');
      if (el) {
        var orig = el.textContent;
        el.textContent = 'Copied!';
        el.classList.add('copied');
        setTimeout(function() { el.textContent = orig; el.classList.remove('copied'); }, 1500);
      }
    });
  } catch(e) {}
}

// ── Unread alerts badge ──────────────────────────────────────────────────────
async function loadAlertBadge() {
  try {
    var session = null;
    try { session = JSON.parse(localStorage.getItem('minalia_session') || '{}'); } catch(e) {}
    if (!session || !session.wallet_address) return;

    var db = null;
    for (var i = 0; i < 20; i++) {
      var c = window.supabase || window.supabaseClient;
      if (c && typeof c.from === 'function') { db = c; break; }
      await new Promise(function(r) { setTimeout(r, 200); });
    }
    if (!db) return;

    var userId = session.user && session.user.id;
    if (!userId) {
      var res = await db.from('users').select('id')
        .eq('mina_wallet_address', session.wallet_address).maybeSingle();
      userId = res.data && res.data.id;
    }
    if (!userId) return;

    var result = await db.from('minister_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('read', false)
      .eq('dismissed', false);

    var count = (result.data && result.data.length) || 0;
    if (count > 0) {
      var label = count > 9 ? '9+' : String(count);
      var badge = document.getElementById('navAlertsBadge');
      if (badge) { badge.textContent = label; badge.style.display = 'inline-block'; }
      var dBadge = document.getElementById('dropdownAlertCount');
      if (dBadge) { dBadge.textContent = label; dBadge.style.display = 'inline-block'; }
    }
  } catch(e) {}
}