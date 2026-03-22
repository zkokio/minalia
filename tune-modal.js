// ── Helpers (safe to call even if already defined on page) ──
if (typeof getSupabase === 'undefined') {
  window.getSupabase = function getSupabase() {
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    if (window.supabase && window.supabase.from) return window.supabase;
    return null;
  };
} else { window.getSupabase = getSupabase; }

if (typeof getSessionUser === 'undefined') {
  window.getSessionUser = function getSessionUser() {
    try {
      const raw = localStorage.getItem('minalia_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.mode === 'spectator') return null;
      if (s.user && s.wallet_address && !s.wallet_address.startsWith('DEMO_')) return s.user;
    } catch(e) {}
    return null;
  };
} else { window.getSessionUser = getSessionUser; }

// ── tune-modal.js — shared rhythm tuning modal ──
// Requires: supabase client via getSupabase(), session via getSessionUser()

// ── RHYTHM TUNE MODAL ──
let _tuneModalUnit      = null;
let _tuneRafId          = null;
let _tuneT              = 0;       // raw time counter (frames)
let _tuneLaps           = 0;       // completed laps
let _tuneSpeed          = 0.028;   // current radians/frame (ring) — starts slow
const TUNE_SPEED_START  = 0.030;   // slower start — was 0.048
const TUNE_SPEED_MAX    = 0.072;   // gentler max — was 0.11
const TUNE_ACCEL        = 0.0004;  // slower ramp — was 0.0008
let _tuneHitsDone       = 0;
let _tuneLastQuality    = null;    // 'perfect'|'good' — stored for DB bonus
let _tuneSuccessCallback = null;
let _tuneGameType       = 'ring';  // 'ring'|'figure8'|'ping'|'pendulum'
let _tuneCanvas_addRipple = null;

// Shared hit zones (angular / normalised distance)
// Widened to account for ~100ms human input lag
const ZONE_PERFECT = 0.28;   // was 0.18
const ZONE_GOOD    = 0.52;   // was 0.38

// Tune power bonuses written to last_tuned_at
const BONUS_PERFECT_MS = 24 * 60 * 60 * 1000;  // +24h
const BONUS_GOOD_MS    =  8 * 60 * 60 * 1000;  // +8h

const GAME_NAMES = {
  ring:    'Synchronise the Signal',
  figure8: 'Trace the Lattice',
  ping:    'Catch the Frequency',
  pendulum: 'Ride the Pendulum'
};

function openTuneModal(unitCode, successCb) {
  _tuneModalUnit       = unitCode;
  _tuneT               = 0;
  _tuneLaps            = 0;
  _tuneSpeed           = TUNE_SPEED_START;
  _tuneHitsDone        = 0;
  _tuneLastQuality     = null;
  drawPendulum._amp    = 0.55;  // reset arc width each tune session
  _tuneSuccessCallback = successCb || null;

  // Pick random game type
  const types = ['ring', 'figure8', 'ping', 'pendulum'];
  _tuneGameType = types[Math.floor(Math.random() * types.length)];

  document.getElementById('tuneModalUnit').textContent  = unitCode || '';
  document.getElementById('tuneModalTitle').textContent = GAME_NAMES[_tuneGameType];
  document.getElementById('tuneResult').textContent     = '';
  document.getElementById('tuneResult').className       = 'tune-result';
  document.getElementById('tuneHitBtn').disabled        = false;
  document.getElementById('tuneHitBtn').textContent     = '⚡ TUNE';

  document.getElementById('tuneModalBackdrop').classList.add('open');
  startTuneAnimation();
}

function closeTuneModal() {
  document.getElementById('tuneModalBackdrop').classList.remove('open');
  cancelAnimationFrame(_tuneRafId);
  _tuneModalUnit = null;
  _tuneSuccessCallback = null;
}

document.getElementById('tuneModalBackdrop').addEventListener('click', function(e) {
  if (e.target === this) closeTuneModal();
});

// ── ANIMATION DISPATCHER ──
function startTuneAnimation() {
  cancelAnimationFrame(_tuneRafId);
  const canvas = document.getElementById('tuneCanvas');
  const ctx    = canvas.getContext('2d');
  const ripples = [];
  function addRipple(q) { ripples.push({ prog: 0, quality: q }); }
  _tuneCanvas_addRipple = addRipple;
  canvas._addRipple = addRipple;

  const dispatch = {
    ring:    drawRing,
    figure8: drawFigure8,
    ping:    drawPing,
    pendulum: drawPendulum
  };

  function loop() {
    ctx.clearRect(0, 0, 240, 240);
    // Advance ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].prog += 0.04;
      if (ripples[i].prog >= 1) ripples.splice(i, 1);
    }
    dispatch[_tuneGameType](ctx, ripples);
    _tuneT++;
    _tuneRafId = requestAnimationFrame(loop);
  }
  loop();
}

// ── SHARED RIPPLE DRAW ──
function drawRipples(ctx, ripples, cx, cy, baseR) {
  ripples.forEach(rp => {
    const col = rp.quality === 'perfect' ? '74,222,128'
              : rp.quality === 'good'    ? '255,224,138'
              : '248,113,113';
    const r = baseR + rp.prog * 44;
    const a = (1 - rp.prog) * 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${col},${a})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ── SHARED DOT DRAW ──
function drawDot(ctx, px, py, col = '#FFE08A') {
  const grad = ctx.createRadialGradient(px, py, 0, px, py, 14);
  grad.addColorStop(0,   col === '#FFE08A' ? 'rgba(255,224,138,0.9)' : 'rgba(74,222,128,0.9)');
  grad.addColorStop(0.4, col === '#FFE08A' ? 'rgba(255,224,138,0.3)' : 'rgba(74,222,128,0.3)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
}

// ════════════════════════════════════════
// GAME 1 — RING
// ════════════════════════════════════════
function drawRing(ctx, ripples) {
  const cx = 120, cy = 120, r = 88;
  const TARGET = -Math.PI / 2;

  // Track laps for speed ramp
  const prevPhase = ((_tuneT - 1) * _tuneSpeed) % (Math.PI * 2);
  const currPhase = (_tuneT * _tuneSpeed) % (Math.PI * 2);
  if (prevPhase > currPhase) {   // wrapped around
    _tuneLaps++;
    _tuneSpeed = Math.min(TUNE_SPEED_MAX, _tuneSpeed + TUNE_ACCEL);
  }

  // Track path
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2; ctx.stroke();

  // Target zones
  ctx.beginPath();
  ctx.arc(cx, cy, r, TARGET - ZONE_GOOD, TARGET + ZONE_GOOD);
  ctx.strokeStyle = 'rgba(255,224,138,0.15)';
  ctx.lineWidth = 14; ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, TARGET - ZONE_PERFECT, TARGET + ZONE_PERFECT);
  ctx.strokeStyle = 'rgba(255,224,138,0.4)';
  ctx.lineWidth = 14; ctx.stroke();

  drawRipples(ctx, ripples, cx, cy, r);

  // Speed indicator ticks
  const speedFrac = (_tuneSpeed - TUNE_SPEED_START) / (TUNE_SPEED_MAX - TUNE_SPEED_START);
  ctx.font = '9px monospace';
  ctx.fillStyle = `rgba(255,100,80,${speedFrac * 0.8})`;
  ctx.textAlign = 'center';
  if (speedFrac > 0.15) ctx.fillText('▲ ' + Math.round(speedFrac * 100) + '%', cx, cy + 16);

  const phase = (_tuneT * _tuneSpeed) % (Math.PI * 2);
  const px = cx + r * Math.cos(phase - Math.PI / 2);
  const py = cy + r * Math.sin(phase - Math.PI / 2);
  drawDot(ctx, px, py);
}

// ════════════════════════════════════════
// GAME 2 — FIGURE-8 (Lissajous)
// ════════════════════════════════════════
function drawFigure8(ctx, ripples) {
  const cx = 120, cy = 120;
  const rx = 86, ry = 48;

  const prevT = (_tuneT - 1) * _tuneSpeed;
  const currT = _tuneT * _tuneSpeed;
  if (Math.floor(prevT / Math.PI) < Math.floor(currT / Math.PI)) {
    _tuneLaps++;
    _tuneSpeed = Math.min(TUNE_SPEED_MAX, _tuneSpeed + TUNE_ACCEL);
  }

  const px = cx + rx * Math.sin(currT);
  const py = cy + ry * Math.sin(2 * currT);

  // Draw full figure-8 path
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) {
    const t = (i / 300) * Math.PI * 2;
    const x = cx + rx * Math.sin(t);
    const y = cy + ry * Math.sin(2 * t);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5; ctx.stroke();

  // Glow at target (centre crossing point)
  // Proximity to centre in pixels
  const dxPx = px - cx;
  const dyPx = py - cy;
  const pixDist = Math.sqrt(dxPx*dxPx + dyPx*dyPx);
  const proximity = Math.max(0, 1 - pixDist / 40); // 1 when at centre, 0 when 40px away

  // Static target glow
  const gTarget = ctx.createRadialGradient(cx, cy, 0, cx, cy, 36);
  gTarget.addColorStop(0,   `rgba(255,224,138,${0.15 + proximity * 0.5})`);
  gTarget.addColorStop(0.4, `rgba(255,224,138,${0.08 + proximity * 0.2})`);
  gTarget.addColorStop(1,   'rgba(255,224,138,0)');
  ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fillStyle = gTarget; ctx.fill();

  // Crosshair lines so it's obvious where the target is
  ctx.strokeStyle = `rgba(255,224,138,${0.2 + proximity * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx + 18, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy + 18); ctx.stroke();

  drawRipples(ctx, ripples, cx, cy, 18);

  // Speed indicator
  const speedFrac = (_tuneSpeed - TUNE_SPEED_START) / (TUNE_SPEED_MAX - TUNE_SPEED_START);
  if (speedFrac > 0.15) {
    ctx.font = '9px monospace';
    ctx.fillStyle = `rgba(255,100,80,${speedFrac * 0.8})`;
    ctx.textAlign = 'center';
    ctx.fillText('▲ ' + Math.round(speedFrac * 100) + '%', cx, cy + 108);
  }

  drawDot(ctx, px, py);
}
// ════════════════════════════════════════
// GAME 3 — PING (bounce)
// ════════════════════════════════════════
function drawPing(ctx, ripples) {
  const cx = 120, cy = 120;
  const lineY = cy;
  const lineX1 = 28, lineX2 = 212;
  const lineLen = lineX2 - lineX1;

  // Bounce: pos = sin(t) mapped to lineX1..lineX2
  const prevT = (_tuneT - 1) * _tuneSpeed;
  const currT = _tuneT * _tuneSpeed;
  if (Math.floor(prevT / Math.PI) < Math.floor(currT / Math.PI)) {
    _tuneLaps++;
    _tuneSpeed = Math.min(TUNE_SPEED_MAX, _tuneSpeed + TUNE_ACCEL);
  }
  const raw = Math.sin(currT);  // −1 to +1
  const px  = cx + raw * (lineLen / 2);
  const py  = lineY;

  // Track line
  ctx.beginPath();
  ctx.moveTo(lineX1, lineY); ctx.lineTo(lineX2, lineY);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3; ctx.stroke();

  // End bumpers
  [lineX1, lineX2].forEach(x => {
    ctx.beginPath(); ctx.arc(x, lineY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
  });

  // Target zone (centre window)
  const zoneW = lineLen * ZONE_GOOD;
  const grad = ctx.createLinearGradient(cx - zoneW, 0, cx + zoneW, 0);
  grad.addColorStop(0,   'rgba(255,224,138,0)');
  grad.addColorStop(0.3, 'rgba(255,224,138,0.18)');
  grad.addColorStop(0.5, 'rgba(255,224,138,0.4)');
  grad.addColorStop(0.7, 'rgba(255,224,138,0.18)');
  grad.addColorStop(1,   'rgba(255,224,138,0)');
  ctx.fillRect(cx - zoneW, lineY - 12, zoneW * 2, 24);
  ctx.fillStyle = grad;
  ctx.fillRect(cx - zoneW, lineY - 12, zoneW * 2, 24);

  // Perfect inner zone
  const perfW = lineLen * ZONE_PERFECT;
  ctx.fillStyle = 'rgba(255,224,138,0.2)';
  ctx.fillRect(cx - perfW, lineY - 8, perfW * 2, 16);

  // Tick marks top/bottom of line
  ctx.strokeStyle = 'rgba(255,224,138,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, lineY - 14); ctx.lineTo(cx, lineY - 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, lineY + 14); ctx.lineTo(cx, lineY + 20); ctx.stroke();

  // Ripples as horizontal flashes
  ripples.forEach(rp => {
    const col = rp.quality === 'perfect' ? '74,222,128'
              : rp.quality === 'good'    ? '255,224,138' : '248,113,113';
    const a = (1 - rp.prog) * 0.7;
    const hw = rp.prog * 60 + 10;
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.fillRect(cx - hw, lineY - 4, hw * 2, 8);
  });

  // Speed indicator
  const speedFrac = (_tuneSpeed - TUNE_SPEED_START) / (TUNE_SPEED_MAX - TUNE_SPEED_START);
  if (speedFrac > 0.15) {
    ctx.font = '9px monospace';
    ctx.fillStyle = `rgba(255,100,80,${speedFrac * 0.8})`;
    ctx.textAlign = 'center';
    ctx.fillText('▲ ' + Math.round(speedFrac * 100) + '%', cx, cy + 90);
  }

  drawDot(ctx, px, py);
}

// ════════════════════════════════════════
// GAME 4 — SPIRAL (inward)
// ════════════════════════════════════════
// ════════════════════════════════════════
// GAME 4 — PENDULUM
// Dot swings on arc, speeds up at bottom, slows at peaks.
// Arc widens each swing. Hit at bottom (fastest point).
// ════════════════════════════════════════
function drawPendulum(ctx, ripples) {
  const cx = 120, cy = 38;   // pivot point (top centre)
  const armLen = 110;        // pendulum arm length
  const bottomY = cy + armLen;  // = 148

  // Amplitude grows each half-swing, capped at ~75°
  if (!drawPendulum._amp) drawPendulum._amp = 0.55;  // radians, start ~31°

  const prevT = (_tuneT - 1) * _tuneSpeed;
  const currT = _tuneT * _tuneSpeed;

  // Count half-swings (each π crossing = one swing through bottom)
  const prevHalf = Math.floor(prevT / Math.PI);
  const currHalf = Math.floor(currT / Math.PI);
  if (currHalf > prevHalf) {
    _tuneLaps++;
    _tuneSpeed = Math.min(TUNE_SPEED_MAX, _tuneSpeed + TUNE_ACCEL);
    // Widen arc each swing, cap at 1.28 rad (~73°)
    drawPendulum._amp = Math.min(1.28, drawPendulum._amp + 0.055);
  }

  // Pendulum angle: θ = amp * cos(t)  → realistic deceleration at peaks
  const amp   = drawPendulum._amp;
  const theta = amp * Math.cos(currT);

  // Bob position
  const px = cx + armLen * Math.sin(theta);
  const py = cy + armLen * Math.cos(theta);

  // Draw arm
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, py);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5; ctx.stroke();

  // Pivot dot
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();

  // Draw arc path the pendulum sweeps
  ctx.beginPath();
  ctx.arc(cx, cy, armLen, Math.PI/2 - amp, Math.PI/2 + amp);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2; ctx.stroke();

  // Target zone at bottom (theta ≈ 0)
  // Draw a glowing arc segment around the bottom
  const zoneAngle = ZONE_GOOD;  // matches hit detection dist scale
  const perfAngle = ZONE_PERFECT;  // matches hit detection dist scale

  ctx.beginPath();
  ctx.arc(cx, cy, armLen, Math.PI/2 - zoneAngle, Math.PI/2 + zoneAngle);
  ctx.strokeStyle = 'rgba(255,224,138,0.15)';
  ctx.lineWidth = 14; ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, armLen, Math.PI/2 - perfAngle, Math.PI/2 + perfAngle);
  ctx.strokeStyle = 'rgba(255,224,138,0.4)';
  ctx.lineWidth = 14; ctx.stroke();

  // Pulse glow on target when bob is close
  const closeness = Math.max(0, 1 - Math.abs(theta) / ZONE_GOOD);
  if (closeness > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, armLen, Math.PI/2 - perfAngle, Math.PI/2 + perfAngle);
    ctx.strokeStyle = `rgba(255,224,138,${closeness * 0.5})`;
    ctx.lineWidth = 22; ctx.stroke();
  }

  drawRipples(ctx, ripples, cx, bottomY, 12);

  // Speed/arc indicator
  const speedFrac = (_tuneSpeed - TUNE_SPEED_START) / (TUNE_SPEED_MAX - TUNE_SPEED_START);
  if (speedFrac > 0.15) {
    ctx.font = '9px monospace';
    ctx.fillStyle = `rgba(255,100,80,${speedFrac * 0.8})`;
    ctx.textAlign = 'center';
    ctx.fillText('▲ ' + Math.round(speedFrac * 100) + '%', cx, bottomY + 28);
  }

  drawDot(ctx, px, py);
}

// ════════════════════════════════════════
// HIT DETECTION — works for all game types
// ════════════════════════════════════════
function onTuneHit() {
  let dist = 1;  // 0 = perfect, 1 = total miss

  if (_tuneGameType === 'ring') {
    const phase = (_tuneT * _tuneSpeed) % (Math.PI * 2);
    const TARGET = Math.PI / 2;  // top of circle in our coord system
    let delta = ((phase - TARGET + Math.PI) % (Math.PI * 2)) - Math.PI;
    dist = Math.abs(delta);  // raw radians — same scale as ZONE_PERFECT/ZONE_GOOD

  } else if (_tuneGameType === 'figure8') {
    const cx = 120, cy = 120, rx = 86, ry = 48;
    const dotX = cx + rx * Math.sin(_tuneT * _tuneSpeed);
    const dotY = cy + ry * Math.sin(2 * _tuneT * _tuneSpeed);
    const pixDist = Math.sqrt((dotX-cx)**2 + (dotY-cy)**2);
    // Widened zones to be more forgiving
    if (pixDist <= 28)      dist = 0.1;   // perfect — was 18px
    else if (pixDist <= 65) dist = 0.3;   // good    — was 50px
    else                    dist = 1.0;   // miss

  } else if (_tuneGameType === 'ping') {
    // Visual zone: lineLen(184) * ZONE_GOOD(0.38) = ±70px good, ±33px perfect
    // Hit zone must match what's drawn on screen
    const lineLen = 184;
    const dotX = 120 + Math.sin(_tuneT * _tuneSpeed) * (lineLen / 2);
    const pixDist = Math.abs(dotX - 120);
    if (pixDist <= 45)      dist = 0.1;   // perfect — was 33px
    else if (pixDist <= 90) dist = 0.3;   // good    — was 70px
    else                    dist = 1.0;   // miss

  } else if (_tuneGameType === 'pendulum') {
    const amp   = drawPendulum._amp || 0.55;
    const theta = amp * Math.cos(_tuneT * _tuneSpeed);
    // dist = raw |theta| in radians — same scale as ZONE_PERFECT/ZONE_GOOD
    // target zone drawn at ZONE_GOOD*0.7 = 0.266 rad, so widen zones to match
    dist = Math.abs(theta);
  }

  let quality;
  if (dist <= ZONE_PERFECT)       quality = 'perfect';
  else if (dist <= ZONE_GOOD)     quality = 'good';
  else                            quality = 'miss';

  if (_tuneCanvas_addRipple) _tuneCanvas_addRipple(quality);
  playTuneSound(quality);

  const resultEl = document.getElementById('tuneResult');
  resultEl.className = 'tune-result ' + quality;

  if (quality === 'miss') {
    resultEl.textContent = '✗ Miss — try again';
    const btn = document.getElementById('tuneHitBtn');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 400);
    return;
  }

  _tuneLastQuality = quality;
  resultEl.textContent = quality === 'perfect' ? '✦ Perfect! +24h' : '✓ Good +8h';
  _tuneHitsDone++;

  const hitsNeeded = 1;  // was: quality === 'perfect' ? 1 : 2
  if (_tuneHitsDone < hitsNeeded) {
    resultEl.textContent = '✓ Good — one more!';
    return;
  }

  document.getElementById('tuneHitBtn').disabled = true;
  document.getElementById('tuneHitBtn').textContent = '✓ Synced';

  setTimeout(async () => {
    const unitCode = _tuneModalUnit;
    const quality  = _tuneLastQuality;
    closeTuneModal();
    await commitTuneToDb(unitCode, quality);
    if (_tuneSuccessCallback) _tuneSuccessCallback(unitCode);
  }, 600);
}

// ── DB WRITE with tune power bonus ──
async function commitTuneToDb(unitCode, quality) {
  const user = getSessionUser();
  if (!user?.id || !unitCode) return;

  const sb = getSupabase();
  // Base = now. Bonus shifts last_tuned_at into the future → extends active window
  const bonusMs = quality === 'perfect' ? BONUS_PERFECT_MS
                : quality === 'good'    ? BONUS_GOOD_MS : 0;
  const tunedAt = new Date(Date.now() + bonusMs).toISOString();

  // Compute Monday of current week (for leaderboard grouping)
  const weekStart = (() => {
    const d = new Date();
    const day = d.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = (day === 0) ? -6 : 1 - day; // days back to Monday
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() + diff);
    return mon.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  })();

  // 1. Update unit pulse state
  const { error } = await sb
    .from('units')
    .update({ last_tuned_at: tunedAt, pulse_state: 'active', tune_quality: quality })
    .eq('unit_code', unitCode)
    .eq('owner_id', user.id);

  if (error) { if(typeof showAlert==='function') showAlert('error',`Failed to save ${unitCode}: ${error.message}`); else alert(`Tune failed: ${error.message}`); return; }

  // 2. Write to tune_history for leaderboard (fire-and-forget, don't block UI)
  sb.from('tune_history').insert({
    player_id: user.id,
    unit_code:  unitCode,
    quality:    quality,
    tuned_at:   new Date().toISOString(),
    week_start: weekStart
  }).then(({ error: histErr }) => {
    if (histErr) console.warn('tune_history insert failed:', histErr.message);
  });

  const unit = (typeof allUnits !== 'undefined') ? allUnits.find(u => u.unit_code === unitCode) : null;
  if (unit) { unit.last_tuned_at = tunedAt; unit.computedState = 'active'; }

  const card = document.getElementById(`card-${unitCode}`);
  if (card) {
    card.classList.remove('state-flicker', 'state-forfeited');
    card.classList.add('state-active', 'burst');
    card.dataset.state = 'active';
    setTimeout(() => card.classList.remove('burst', 'just-tuned'), 900);
  }

  if (typeof window.onTuneCommit === 'function') window.onTuneCommit(unitCode, quality);
  if (typeof renderAll === 'function') renderAll();
  if (typeof setFilter === 'function' && typeof currentFilter !== 'undefined') setFilter(currentFilter);
}

// ── WEB AUDIO SOUNDS ──
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTuneSound(quality) {
  try {
    const ctx  = getAudioCtx();
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if (quality === 'perfect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.start(now); osc.stop(now + 0.7);
      const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = 'sine'; osc2.frequency.setValueAtTime(1320, now + 0.05);
      gain2.gain.setValueAtTime(0.15, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.start(now + 0.05); osc2.stop(now + 0.8);
    } else if (quality === 'good') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.45);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    }
  } catch(e) {}
}

// ── TUNE SINGLE UNIT (now opens modal) ──
function tuneUnit(unitCode) {
  openTuneModal(unitCode);
}

// Expose globals
window.openTuneModal  = openTuneModal;
window.closeTuneModal = closeTuneModal;
window.onTuneHit      = onTuneHit;
