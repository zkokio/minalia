// nav-audio.js — MINALIA shared nav audio control
// Matches the volume control on login.html exactly
// Injected into .nav-audio-slot after nav loads

let masterVolume = parseFloat(localStorage.getItem('minalia_volume') ?? '0');

window.initNavAudio = function () {
  const slot = document.querySelector('.nav-audio-slot');
  if (!slot || slot.dataset.audioReady) return;
  slot.dataset.audioReady = '1';

  // ── Audio element ──
  let audio = document.getElementById('bgAudio');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'bgAudio';
    audio.loop = false;
    audio.preload = 'auto';
    const src = document.createElement('source');
    src.src = 'audio/minalia.mp3';
    src.type = 'audio/mpeg';
    audio.appendChild(src);
    document.body.appendChild(audio);
  }

  // ── Restore saved volume (same keys as login.html) ──
  masterVolume = parseFloat(localStorage.getItem('minalia_volume') ?? '0');
  let isMuted = (masterVolume === 0);
  audio.volume = masterVolume;

  // ── Inject the same control HTML as login.html ──
  slot.innerHTML = `
    <div id="volumeControl" style="display:flex;align-items:center;gap:7px;background:rgba(10,8,18,0.55);border:1px solid rgba(255,224,138,0.2);border-radius:20px;padding:0 12px 0 10px;height:36px;transition:border-color 0.2s;cursor:default;">
      <svg id="volIcon" viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;cursor:pointer;flex-shrink:0;stroke:#FFE08A;">
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path id="volWave1" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path id="volWave2" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <line id="volMuteLine1" x1="23" y1="9" x2="17" y2="15" style="display:none;"/>
        <line id="volMuteLine2" x1="17" y1="9" x2="23" y2="15" style="display:none;"/>
      </svg>
      <input id="volumeSlider" type="range" min="0" max="100" value="${Math.round(masterVolume * 100)}"
        style="-webkit-appearance:none;appearance:none;width:72px;height:3px;background:linear-gradient(to right,#FFE08A ${Math.round(masterVolume*100)}%,rgba(255,255,255,0.15) ${Math.round(masterVolume*100)}%);border-radius:2px;outline:none;cursor:pointer;border:none;"
      />
    </div>
    <style>
      #volumeSlider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;border-radius:50%;background:#FFE08A;cursor:pointer;box-shadow:0 0 4px rgba(255,224,138,0.5);}
      #volumeSlider::-moz-range-thumb{width:13px;height:13px;border-radius:50%;border:none;background:#FFE08A;cursor:pointer;}
      #volumeControl:hover{border-color:rgba(255,224,138,0.45);}
    </style>
  `;

  function updateVolIcon() {
    const w1 = document.getElementById('volWave1');
    const w2 = document.getElementById('volWave2');
    const m1 = document.getElementById('volMuteLine1');
    const m2 = document.getElementById('volMuteLine2');
    const icon = document.getElementById('volIcon');
    if (!w1) return;
    if (isMuted) {
      w1.style.display = 'none'; w2.style.display = 'none';
      m1.style.display = 'block'; m2.style.display = 'block';
      icon.style.stroke = 'rgba(255,255,255,0.4)';
    } else {
      w1.style.display = 'block'; w2.style.display = masterVolume < 0.4 ? 'none' : 'block';
      m1.style.display = 'none'; m2.style.display = 'none';
      icon.style.stroke = '#FFE08A';
    }
  }

  function onVolumeSlide(val) {
    masterVolume = val / 100;
    isMuted = (masterVolume === 0);
    audio.volume = masterVolume;
    localStorage.setItem('minalia_volume', masterVolume);
    updateVolIcon();
    const slider = document.getElementById('volumeSlider');
    if (slider) slider.style.background = `linear-gradient(to right, #FFE08A ${val}%, rgba(255,255,255,0.15) ${val}%)`;
  }

  function toggleVolumeMute() {
    const slider = document.getElementById('volumeSlider');
    if (isMuted) {
      masterVolume = parseFloat(localStorage.getItem('minalia_volume_pre_mute') ?? '0.45');
      if (masterVolume === 0) masterVolume = 0.45;
    } else {
      localStorage.setItem('minalia_volume_pre_mute', masterVolume);
      masterVolume = 0;
    }
    isMuted = !isMuted;
    audio.volume = masterVolume;
    if (slider) {
      slider.value = Math.round(masterVolume * 100);
      const pct = slider.value;
      slider.style.background = `linear-gradient(to right, #FFE08A ${pct}%, rgba(255,255,255,0.15) ${pct}%)`;
    }
    updateVolIcon();
  }

  // Wire up events
  document.getElementById('volIcon').addEventListener('click', toggleVolumeMute);
  document.getElementById('volumeSlider').addEventListener('input', function () { onVolumeSlide(this.value); });

  // Set initial icon state
  updateVolIcon();

  // ── Check user preference before attempting to play ──
  function isMusicEnabled() {
    try {
      const session = JSON.parse(localStorage.getItem('minalia_session') || '{}');
      // Default true if not set
      if (session?.user?.music_enabled === false) return false;
    } catch(e) {}
    return true;
  }

  // Attempt autoplay on first user interaction — single clean listener
  let autoTried = false;
  function tryAutoplay() {
    if (autoTried) return;
    autoTried = true;
    if (audio.paused && isMusicEnabled()) {
      audio.play().catch(() => {});
    }
  }
  document.addEventListener('pointerdown', tryAutoplay, { once: true });
};

// Fire on nav load events
document.addEventListener('navLoaded', window.initNavAudio);
document.addEventListener('headerLoaded', window.initNavAudio);

// ── Nav ARKIS balance widget ─────────────────────────────────────────────
// Fetches the logged-in player's token_balance and populates #navArkisAmount
(function () {
  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return Number(n).toLocaleString();
  }

  async function loadNavArkis() {
    const widget = document.getElementById('navArkisWidget');
    const amtEl  = document.getElementById('navArkisAmount');
    if (!widget || !amtEl) return;

    // Only show when logged in
    let session;
    try { session = JSON.parse(localStorage.getItem('minalia_session') || '{}'); } catch(e) { return; }
    const userId = session?.user?.id;
    if (!userId || session?.mode === 'spectator') return;

    // Wait for Supabase
    let sb = null;
    for (let i = 0; i < 30; i++) {
      sb = window.supabaseClient || window.supabase;
      if (sb && typeof sb.from === 'function') break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (!sb) return;

    try {
      const { data } = await sb.from('user_tokens')
        .select('token_balance')
        .eq('user_id', userId)
        .single();
      if (data) {
        amtEl.textContent = fmt(Number(data.token_balance || 0));
        widget.style.display = 'flex';
      }
    } catch(e) { /* non-fatal */ }
  }

  // Expose so pages can call it after a balance change (e.g. profile.html confirmBuild)
  window.refreshNavArkis = loadNavArkis;

  document.addEventListener('navLoaded',    loadNavArkis, { once: true });
  document.addEventListener('headerLoaded', loadNavArkis, { once: true });
  // Belt-and-braces if nav was already injected
  if (document.readyState !== 'loading') setTimeout(loadNavArkis, 500);
})();

// Fade out audio over 0.4s when navigating to a new page
document.addEventListener('click', function (e) {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript') || link.target === '_blank') return;

  const audio = document.getElementById('bgAudio');
  if (!audio || audio.paused) return;

  e.preventDefault();
  const startVol = audio.volume;
  const steps = 16;
  const interval = 400 / steps;
  let step = 0;
  const fade = setInterval(function () {
    step++;
    audio.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) {
      clearInterval(fade);
      window.location.href = href;
    }
  }, interval);
});

// Fade in audio on page load
window.addEventListener('load', function () {
  const audio = document.getElementById('bgAudio');
  if (!audio || audio.paused) return;
  // Don't fade in if user has disabled music
  try {
    const session = JSON.parse(localStorage.getItem('minalia_session') || '{}');
    if (session?.user?.music_enabled === false) { audio.pause(); return; }
  } catch(e) {}
  const targetVol = masterVolume;
  audio.volume = 0;
  const steps = 20;
  const interval = 800 / steps;
  let step = 0;
  const fade = setInterval(function () {
    step++;
    audio.volume = Math.min(targetVol, targetVol * (step / steps));
    if (step >= steps) clearInterval(fade);
  }, interval);
});