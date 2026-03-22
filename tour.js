// tour.js — MINALIA New Player Tutorial
// Contextual tooltip walkthrough fired per-page on first visits.
// Tracks progress in users.tutorial_progress (integer step ID) + localStorage backup.
// Load on any page: <script src="tour.js?v=20260320a"></script>
// Each page calls: TourManager.check('pagename') after auth is ready.

(function () {

  // ── Step definitions ──────────────────────────────────────────────────────
  // Each step: { id, page, target (CSS selector or null for centre), title, body, position ('top'|'bottom'|'left'|'right'|'centre') }
  const STEPS = [

    // ── MAP (steps 1–5) ──────────────────────────────────────────────────────
    {
      id: 1, page: 'map',
      target: null, position: 'centre',
      title: 'Welcome to Luminaea 🌍',
      body: 'Luminaea is a living world of 20 territories, each divided into 16 units. Players own units, develop them, tune them, and collaborate to build the world.<br><br>Let\'s show you around.'
    },
    {
      id: 2, page: 'map',
      target: '#map', position: 'centre',
      title: 'The Map',
      body: 'Each hexagonal cluster is a territory. Click any hex to see who owns it, what\'s for sale, and which minister governs it.<br><br>Gold hexes are owned. White are unclaimed. Blue are for sale.'
    },
    {
      id: 3, page: 'map',
      target: '#playerPanel', position: 'left',
      title: 'Active Players',
      body: 'This panel shows all players currently active in Luminaea — their territories, unit counts, and online status. Click a player to view their profile.'
    },
    {
      id: 4, page: 'map',
      target: '#forSaleBox', position: 'bottom',
      title: 'Units For Sale',
      body: 'Units listed for sale appear here. Click to see what\'s available and at what price. Your first unit is how you enter the game.'
    },
    {
      id: 5, page: 'map',
      target: '#ticker-scroll', position: 'top',
      title: 'The Luminaea Feed',
      body: 'Live activity across the world — auctions, sales, developments, and world events scroll here in real time. Keep an eye on it.'
    },

    // ── PROFILE (steps 6–9) ──────────────────────────────────────────────────
    {
      id: 6, page: 'profile',
      target: null, position: 'centre',
      title: 'Your Profile',
      body: 'This is your command centre. Everything you own, earn, and build is tracked here — your units, ARKIS balance, developments, nexus projects, and more.'
    },
    {
      id: 7, page: 'profile',
      target: '#totalFundsDisplay', position: 'bottom',
      title: '$ARKIS — Your Currency',
      body: 'ARKIS is the primary currency of Luminaea. You earn it from unit yields, developments, and collaborations. You spend it buying units and starting builds.<br><br>OG players start with a founding balance.'
    },
    {
      id: 8, page: 'profile',
      target: '#units-section', position: 'top',
      title: 'Your Units',
      body: 'Each unit you own appears here. Click a unit to view it, tune it, start a development, or list it for sale.<br><br>Units generate yield and can be upgraded through 5 building levels.'
    },
    {
      id: 9, page: 'profile',
      target: '#navUserPill', position: 'bottom',
      title: 'You\'re all set ✦',
      body: 'Your $ARKIS balance is always visible here in the nav.<br><br>Head to the <strong>Map</strong> to find your first unit, or visit <strong>Real Estate</strong> to browse what\'s for sale. Good luck in Luminaea.'
    },

  ];

  // Pages that have tour steps
  const TOUR_PAGES = ['map', 'profile'];

  // ── Storage helpers ───────────────────────────────────────────────────────
  const LS_KEY = 'minalia_tour_step';

  function getLocalStep() {
    try { return parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0; } catch(e) { return 0; }
  }
  function setLocalStep(n) {
    try { localStorage.setItem(LS_KEY, n); } catch(e) {}
  }

  async function getDBStep() {
    try {
      const session = JSON.parse(localStorage.getItem('minalia_session') || '{}');
      const userId = session?.user?.id;
      if (!userId) return 0;
      const sb = window.supabaseClient || window.supabase;
      if (!sb) return 0;
      const { data } = await sb.from('users').select('tutorial_progress').eq('id', userId).single();
      return data?.tutorial_progress || 0;
    } catch(e) { return 0; }
  }

  async function saveStep(n) {
    setLocalStep(n);
    try {
      const session = JSON.parse(localStorage.getItem('minalia_session') || '{}');
      const userId = session?.user?.id;
      if (!userId) return;
      const sb = window.supabaseClient || window.supabase;
      if (!sb) return;
      await sb.from('users').update({ tutorial_progress: n }).eq('id', userId);
    } catch(e) {}
  }

  // ── Tooltip renderer ──────────────────────────────────────────────────────
  const OVERLAY_ID  = 'minalia-tour-overlay';
  const TOOLTIP_ID  = 'minalia-tour-tooltip';
  const HIGHLIGHT_ID = 'minalia-tour-highlight';

  function removeTour() {
    [OVERLAY_ID, TOOLTIP_ID, HIGHLIGHT_ID].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function getTargetRect(selector) {
    if (!selector) return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return r;
  }

  function showStep(step, stepIndex, totalSteps, onNext, onSkip) {
    removeTour();

    const isLast  = stepIndex === totalSteps - 1;
    const isFirst = stepIndex === 0;
    const rect    = getTargetRect(step.target);
    const isCentre = step.position === 'centre' || !rect;

    // ── Dim overlay ──
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99998',
      'background:rgba(0,0,0,' + (isCentre ? '0.7' : '0.45') + ')',
      'transition:background .25s'
    ].join(';');
    document.body.appendChild(overlay);

    // ── Highlight ring around target ──
    if (rect && !isCentre) {
      const pad = 8;
      const hl = document.createElement('div');
      hl.id = HIGHLIGHT_ID;
      hl.style.cssText = [
        'position:fixed',
        'z-index:99999',
        'pointer-events:none',
        'border-radius:10px',
        'border:2px solid rgba(255,224,138,0.8)',
        'box-shadow:0 0 0 4px rgba(255,224,138,0.15), 0 0 24px rgba(255,224,138,0.2)',
        'transition:all .25s',
        'top:'    + (rect.top    - pad) + 'px',
        'left:'   + (rect.left   - pad) + 'px',
        'width:'  + (rect.width  + pad*2) + 'px',
        'height:' + (rect.height + pad*2) + 'px',
      ].join(';');
      document.body.appendChild(hl);
    }

    // ── Tooltip ──
    const tip = document.createElement('div');
    tip.id = TOOLTIP_ID;
    tip.style.cssText = [
      'position:fixed',
      'z-index:100000',
      'background:rgba(10,8,20,0.98)',
      'border:1px solid rgba(255,224,138,0.3)',
      'border-radius:14px',
      'padding:22px 24px 18px',
      'max-width:320px',
      'min-width:280px',
      'box-shadow:0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,224,138,0.08)',
      'font-family:inherit',
      'animation:tourFadeIn .2s ease',
    ].join(';');

    // Progress dots
    const dots = Array.from({length: totalSteps}, (_, i) =>
      `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 2px;background:${i === stepIndex ? 'rgba(255,224,138,0.9)' : 'rgba(255,255,255,0.15)'};transition:background .2s;"></span>`
    ).join('');

    tip.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#FFE08A;">${step.title}</div>
        <button id="tourSkipBtn" style="background:none;border:none;color:rgba(255,255,255,0.25);font-size:11px;cursor:pointer;font-family:'Share Tech Mono',monospace;letter-spacing:.06em;padding:0;transition:color .15s;" onmouseover="this.style.color='rgba(255,255,255,0.6)'" onmouseout="this.style.color='rgba(255,255,255,0.25)'">SKIP TOUR</button>
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.65;margin-bottom:18px;">${step.body}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:4px;">${dots}</div>
        <button id="tourNextBtn" style="background:rgba(255,224,138,0.1);border:1px solid rgba(255,224,138,0.3);border-radius:8px;color:#FFE08A;font-family:'Orbitron',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:9px 18px;cursor:pointer;transition:all .15s;" onmouseover="this.style.background='rgba(255,224,138,0.2)'" onmouseout="this.style.background='rgba(255,224,138,0.1)'">${isLast ? 'DONE ✦' : 'NEXT →'}</button>
      </div>`;

    document.body.appendChild(tip);

    // ── Position tooltip ──
    requestAnimationFrame(() => {
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 20;

      let top, left;

      if (isCentre || !rect) {
        top  = (vh - th) / 2;
        left = (vw - tw) / 2;
      } else {
        const pos = step.position;
        if (pos === 'bottom') {
          top  = Math.min(rect.bottom + 16, vh - th - pad);
          left = Math.max(pad, Math.min(rect.left + rect.width/2 - tw/2, vw - tw - pad));
        } else if (pos === 'top') {
          top  = Math.max(pad, rect.top - th - 16);
          left = Math.max(pad, Math.min(rect.left + rect.width/2 - tw/2, vw - tw - pad));
        } else if (pos === 'left') {
          top  = Math.max(pad, Math.min(rect.top + rect.height/2 - th/2, vh - th - pad));
          left = Math.max(pad, rect.left - tw - 16);
        } else if (pos === 'right') {
          top  = Math.max(pad, Math.min(rect.top + rect.height/2 - th/2, vh - th - pad));
          left = Math.min(vw - tw - pad, rect.right + 16);
        } else {
          top  = (vh - th) / 2;
          left = (vw - tw) / 2;
        }
      }

      tip.style.top  = Math.round(top)  + 'px';
      tip.style.left = Math.round(left) + 'px';
    });

    // ── Button events ──
    document.getElementById('tourNextBtn').addEventListener('click', () => {
      removeTour();
      onNext();
    });
    document.getElementById('tourSkipBtn').addEventListener('click', () => {
      removeTour();
      onSkip();
    });
  }

  // ── CSS animation ─────────────────────────────────────────────────────────
  if (!document.getElementById('minalia-tour-style')) {
    const style = document.createElement('style');
    style.id = 'minalia-tour-style';
    style.textContent = `
      @keyframes tourFadeIn {
        from { opacity:0; transform:translateY(6px); }
        to   { opacity:1; transform:translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Tour runner ───────────────────────────────────────────────────────────
  function runSteps(steps, startProgress, onComplete) {
    // Find the index of the first step with id > startProgress
    let idx = steps.findIndex(s => s.id > startProgress);
    if (idx < 0) { onComplete(startProgress); return; } // already done all these

    // Map to local index within this page's steps
    const pageSteps = steps;
    let localIdx = idx;

    function showCurrent() {
      const step = pageSteps[localIdx];
      showStep(
        step,
        localIdx,
        pageSteps.length,
        async () => {
          // Next
          await saveStep(step.id);
          localIdx++;
          if (localIdx < pageSteps.length) {
            showCurrent();
          } else {
            onComplete(step.id);
          }
        },
        async () => {
          // Skip entire tour
          const SKIP_VALUE = 999;
          await saveStep(SKIP_VALUE);
          onComplete(SKIP_VALUE);
        }
      );
    }
    showCurrent();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.TourManager = {

    async check(page) {
      if (!TOUR_PAGES.includes(page)) return;

      // Only show for logged-in players
      let session;
      try { session = JSON.parse(localStorage.getItem('minalia_session') || '{}'); } catch(e) { return; }
      if (!session?.user?.id || session?.mode === 'spectator') return;

      // Wait for Supabase to be ready
      let sb = null;
      for (let i = 0; i < 20; i++) {
        sb = window.supabaseClient || window.supabase;
        if (sb && typeof sb.from === 'function') break;
        await new Promise(r => setTimeout(r, 200));
      }

      // Get progress (prefer DB, fall back to localStorage)
      let progress = await getDBStep();
      if (!progress) progress = getLocalStep();

      // Already completed or skipped
      if (progress >= 999) return;

      const pageSteps = STEPS.filter(s => s.page === page);
      if (!pageSteps.length) return;

      // Check if there are any unseen steps for this page
      const hasUnseen = pageSteps.some(s => s.id > progress);
      if (!hasUnseen) return;

      // Small delay so page content is rendered
      setTimeout(() => {
        runSteps(pageSteps, progress, (finalStep) => {
          // Tour for this page done
        });
      }, 1200);
    },

    // Force restart tour (for settings / help page)
    async restart() {
      await saveStep(0);
      window.location.href = 'map.html';
    },

    // Skip entirely
    async skip() {
      await saveStep(999);
      removeTour();
    }
  };

})();
