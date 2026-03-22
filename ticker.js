// ticker.js — MINALIA Live Ticker Feed
// Queries Supabase for real game data and populates #ticker-scroll
// Loaded after nav.html is injected. Refreshes every 5 minutes.
// v20260317a

(function () {
  const REFRESH_MS  = 5 * 60 * 1000; // 5 minutes
  const SEP         = '<span style="color:rgba(255,224,138,0.25);margin:0 12px;flex-shrink:0;">◆</span>';

  // ── Helpers ──────────────────────────────────────────────────
  function fmt(n) { return Number(n).toLocaleString(); }

  function timeLeft(isoStr) {
    if (!isoStr) return null;
    const diff = new Date(isoStr) - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 48) return Math.floor(h / 24) + 'd left';
    if (h > 0)  return h + 'h ' + m + 'm left';
    return m + 'm left';
  }

  function timeAgo(isoStr) {
    if (!isoStr) return '';
    const d = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (d < 60)    return 'just now';
    if (d < 3600)  return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  // ── Linked entity helpers ────────────────────────────────────
  function unitLink(code) {
    return `<a href="unit.html?code=${code}" style="color:inherit;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.2);text-underline-offset:2px;">${code}</a>`;
  }
  function userLink(username) {
    if (!username || username === 'Unknown' || username === 'Anonymous') return username;
    return `<a href="profile.html?user=${encodeURIComponent(username)}" style="color:inherit;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.2);text-underline-offset:2px;">${username}</a>`;
  }

  // ── Get Supabase client ──────────────────────────────────────
  function getSB() {
    return window.supabaseClient || window.supabase || null;
  }

  // ── Build ticker item HTML ───────────────────────────────────
  // priority: 'event-negative' | 'event-positive' | 'market' | 'activity' | 'info'
  function item(icon, colorClass, text, link) {
    const inner = link
      ? `<a href="${link}" style="color:inherit;text-decoration:none;">${text}</a>`
      : text;
    return `<span class="ticker-item" style="display:inline-flex;align-items:center;gap:7px;flex-shrink:0;">
      <span class="ticker-icon ${colorClass}" style="flex-shrink:0;">${icon}</span>
      <span>${inner}</span>
    </span>`;
  }

  // ── Fetch all live data in parallel ─────────────────────────
  async function fetchTickerData() {
    const sb = getSB();
    if (!sb) return null;

    const [
      auctionsRes,
      salesRes,
      bidsRes,
      devsRes,
      eventsRes,
      nexusRes
    ] = await Promise.allSettled([
      // Active auctions
      sb.from('units')
        .select('unit_code, area_code, auction_min_bid, auction_current_bid, auction_end_time, users!units_owner_id_fkey(username)')
        .eq('auction_active', true)
        .order('updated_at', { ascending: false })
        .limit(10),

      // Units for sale
      sb.from('units')
        .select('unit_code, area_code, sale_price, users!units_owner_id_fkey(username)')
        .eq('for_sale', true)
        .order('updated_at', { ascending: false })
        .limit(8),

      // Recent bids (last 24h)
      sb.from('bids')
        .select('unit_code, amount, created_at, users!bids_bidder_id_fkey(username)')
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(6),

      // Recent completed developments (last 7 days)
      sb.from('developments')
        .select('unit_code, building_name, completed_at, users!developments_owner_id_fkey(username)')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('completed_at', { ascending: false })
        .limit(6),

      // Active world events
      sb.from('world_events')
        .select('name, icon, polarity, scope_type, affected_territory_codes, started_at, ends_at, status')
        .in('status', ['warning', 'active'])
        .order('created_at', { ascending: false })
        .limit(5),

      // Active nexus collabs (if table exists)
      sb.from('special_building_collaborations')
        .select('territory_code, building_slug, status')
        .eq('status', 'active')
        .limit(4)
    ]);

    return {
      auctions: auctionsRes.status === 'fulfilled' ? (auctionsRes.value.data || []) : [],
      sales:    salesRes.status    === 'fulfilled' ? (salesRes.value.data    || []) : [],
      bids:     bidsRes.status     === 'fulfilled' ? (bidsRes.value.data     || []) : [],
      devs:     devsRes.status     === 'fulfilled' ? (devsRes.value.data     || []) : [],
      events:   eventsRes.status   === 'fulfilled' ? (eventsRes.value.data   || []) : [],
      nexus:    nexusRes.status    === 'fulfilled' ? (nexusRes.value.data    || []) : [],
    };
  }

  // ── Build the full item list ─────────────────────────────────
  function buildItems(data) {
    const items = [];

    // ── World events — highest priority, injected multiple times ──
    data.events.forEach(ev => {
      const isNeg   = ev.polarity === 'negative';
      const cls     = isNeg ? 'auction' : 'sale'; // reuse colours: orange=bad, green=good
      const prefix  = isNeg ? '⚠ ' : '✨ ';
      const scope   = ev.scope_type === 'luminaea' ? 'Luminaea-wide'
                    : ev.scope_type === 'district'  ? (ev.affected_territory_codes || []).join(', ')
                    : (ev.affected_territory_codes || []).join(', ');
      const label   = ev.status === 'warning' ? 'WARNING' : 'EVENT';
      const tl      = timeLeft(ev.ends_at);

      const text = `${prefix}${label} · ${ev.name}${scope ? ' · ' + scope : ''}${tl ? ' · ' + tl : ''}`;

      // Inject negative events 3× for higher rotation frequency
      const repeats = isNeg ? 3 : 2;
      for (let i = 0; i < repeats; i++) {
        items.push(item(ev.icon, cls, text, null));
      }
    });

    // ── Active auctions ──
    data.auctions.forEach(u => {
      const owner   = (u['users!units_owner_id_fkey'] || u.users || {}).username || 'Unknown';
      const curBid  = u.auction_current_bid ? fmt(u.auction_current_bid) + ' ARKIS' : null;
      const minBid  = fmt(u.auction_min_bid) + ' ARKIS min';
      const tl      = timeLeft(u.auction_end_time);
      const bidPart = curBid ? `Current bid: ${curBid}` : `Min bid: ${minBid}`;
      items.push(item(
        '🔨', 'auction',
        `Auction live · ${unitLink(u.unit_code)} · ${bidPart}${tl ? ' · ' + tl : ''}`,
        null
      ));
    });

    // ── Recent bids ──
    data.bids.forEach(b => {
      const bidder = (b['users!bids_bidder_id_fkey'] || b.users || {}).username || 'Anonymous';
      items.push(item(
        '🔨', 'auction',
        `New bid on ${unitLink(b.unit_code)} · ${fmt(b.amount)} ARKIS by ${userLink(bidder)} · ${timeAgo(b.created_at)}`,
        null
      ));
    });

    // ── Units for sale ──
    data.sales.forEach(u => {
      const owner = (u['users!units_owner_id_fkey'] || u.users || {}).username || 'Unknown';
      items.push(item(
        '💰', 'sale',
        `${unitLink(u.unit_code)} listed for sale · ${fmt(u.sale_price)} ARKIS · by ${userLink(owner)}`,
        null
      ));
    });

    // ── Completed developments ──
    data.devs.forEach(d => {
      const owner = (d['users!developments_owner_id_fkey'] || d.users || {}).username || 'Unknown';
      items.push(item(
        '🏗️', 'development',
        `${d.building_name} completed in ${unitLink(d.unit_code)} by ${userLink(owner)} · ${timeAgo(d.completed_at)}`,
        null
      ));
    });

    // ── Active nexus collabs ──
    data.nexus.forEach(n => {
      items.push(item(
        '🤝', 'collab',
        `Nexus collaboration active in <a href="district.html?code=${n.territory_code}" style="color:inherit;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.2);text-underline-offset:2px;">${n.territory_code}</a> · ${n.building_slug.replace(/_/g, ' ')}`,
        null
      ));
    });

    // ── Fallback if no live data yet ──
    if (items.length === 0) {
      items.push(item('ℹ', 'info', '320 units across 20 territories · Connect your wallet to join Luminaea', 'login.html'));
      items.push(item('🗺️', 'info', 'Explore the map to find available units for sale or auction', 'map.html'));
      items.push(item('🔨', 'info', 'Auctions run on Luminaea time — place your bid before time runs out', 'realestate.html'));
    }

    return items;
  }

  // ── Render to DOM ────────────────────────────────────────────
  function render(items) {
    const scroll = document.getElementById('ticker-scroll');
    if (!scroll) return;

    // Duplicate items for seamless infinite scroll
    const html = items.map(i => i).join(SEP) + SEP;
    scroll.innerHTML = html + html; // doubled for seamless loop

    // Adjust animation speed based on item count
    const duration = Math.max(40, items.length * 12); // min 40s, ~12s per item
    scroll.style.animation = 'none';
    scroll.offsetHeight; // force reflow
    scroll.style.animation = `tickerScroll ${duration}s linear infinite`;
  }

  // ── Main load + refresh cycle ────────────────────────────────
  async function loadTicker() {
    try {
      const data  = await fetchTickerData();
      if (!data) {
        // Supabase not ready yet — try again in 3s
        setTimeout(loadTicker, 3000);
        return;
      }
      const items = buildItems(data);
      render(items);
    } catch (e) {
      console.warn('Ticker load error:', e.message);
    }
  }

  // ── Init: wait for nav to be in DOM ─────────────────────────
  function init() {
    // If nav loaded event already fired, go immediately
    if (document.getElementById('ticker-scroll')) {
      loadTicker();
    } else {
      // Wait for load-nav.js to inject nav.html
      document.addEventListener('navLoaded', loadTicker, { once: true });
      // Belt-and-braces fallback
      setTimeout(loadTicker, 2000);
    }

    // Refresh every 5 minutes
    setInterval(loadTicker, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();