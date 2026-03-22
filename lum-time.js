// lum-time.js — Shared Luminaea time system
// 1 real hour = 1 Luminaea day  |  Epoch: Feb 1 2026 00:00:00 UTC
// All pages load this file; none embed their own clock logic.

const LUM_EPOCH_MS = 1738368000000; // Feb 1 2026 00:00:00 UTC

// Luminaea has 5 seasons of 73 days each (365-day year)
const LUM_SEASONS = [
  { name: 'The Kindling', symbol: '🔥', color: '#FF6B35', startDay: 1,   endDay: 73,
    weather: ['Luminal Storms', 'Crystal Bursts', 'Heat Surges'] },
  { name: 'The Bloom',    symbol: '🌿', color: '#60FFab', startDay: 74,  endDay: 146,
    weather: ['Pollen Haze', 'Spore Rain', 'Gentle Luminance'] },
  { name: 'The Drift',    symbol: '💨', color: '#50B0FF', startDay: 147, endDay: 219,
    weather: ['Vapour Drifts', 'Magnetic Fog', 'Crystal Rain'] },
  { name: 'The Freeze',   symbol: '❄️', color: '#B0E0FF', startDay: 220, endDay: 292,
    weather: ['Crystal Frost', 'Dim Tides', 'Lattice Storms'] },
  { name: 'The Surge',    symbol: '⚡', color: '#FFE08A', startDay: 293, endDay: 365,
    weather: ['Lightning Floods', 'Plasma Winds', 'Thunder Blooms'] }
];

// Returns current Luminaea time object
// Time system: 1 real hour = 1 Luminaea day
//   → 1 Luminaea minute = 1 real second × (60/1440) = 1/24th of a real minute
//   → 1 real minute = 24 Luminaea minutes
const LUM_DAY_MS = 1000 * 60 * 60; // 1 real hour in ms

function getLumTime() {
  const realElapsedMs = Date.now() - LUM_EPOCH_MS;

  // Total Luminaea minutes elapsed (1 lum-minute = real hour / 1440)
  const lumTotalMinutes = Math.floor(realElapsedMs / (LUM_DAY_MS / (24 * 60)));

  const lumMinute    = lumTotalMinutes % 60;
  const lumHour      = Math.floor(lumTotalMinutes / 60) % 24;
  const lumDayTotal  = Math.floor(lumTotalMinutes / (60 * 24)); // total Lum days elapsed
  const lumYear      = Math.floor(lumDayTotal / 365) + 1;
  const lumDayOfYear = (lumDayTotal % 365) + 1; // 1–365

  // Month: 12 months of ~30.4 days
  const lumMonth = Math.min(12, Math.ceil(lumDayOfYear / 30.4167));

  // Season
  const season = LUM_SEASONS.find(s => lumDayOfYear >= s.startDay && lumDayOfYear <= s.endDay)
                 || LUM_SEASONS[0];
  const seasonDay = lumDayOfYear - season.startDay + 1;

  return {
    year:      lumYear,
    month:     lumMonth,
    dayOfYear: lumDayOfYear,
    hour:      lumHour,
    minute:    lumMinute,
    season,
    seasonDay,
    formatted: `YEAR ${String(lumYear).padStart(5,'0')}  ·  MONTH ${lumMonth}  ·  DAY ${lumDayOfYear}  ·  ${String(lumHour).padStart(2,'0')}:${String(lumMinute).padStart(2,'0')}`
  };
}

// Convert a real duration (ms) to a Luminaea time string
// 1 lum-day = 1 real hour = 3,600,000ms
function realMsToLumDuration(ms) {
  const lumDays  = Math.floor(ms / LUM_DAY_MS);
  const remHours = Math.floor((ms % LUM_DAY_MS) / (LUM_DAY_MS / 24));
  const remMins  = Math.floor((ms % (LUM_DAY_MS / 24)) / (LUM_DAY_MS / (24 * 60)));
  if (lumDays > 0)  return `${lumDays}d ${remHours}h`;
  if (remHours > 0) return `${remHours}h ${remMins}m`;
  return `${remMins}m`;
}

// Convert Luminaea build_time_days to real milliseconds
// 1 lum-day = 1 real hour
function lumDaysToRealMs(lumDays) {
  return lumDays * LUM_DAY_MS;
}

// Update all clock elements on the page
function updateLumClock() {
  const t = getLumTime();

  const timeEl = document.getElementById('ticker-clock');
  if (timeEl) {
    timeEl.textContent = `YEAR ${String(t.year).padStart(5,'0')}  ·  MONTH ${t.month}  ·  DAY ${t.dayOfYear}  ·  ${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}`;
  }

  // Hide season label on all pages — season display removed from UI
  const seasonEl = document.getElementById('lum-season');
  if (seasonEl) seasonEl.style.display = 'none';
}

// Start the clock (call once per page)
function startLumClock() {
  updateLumClock();
  setInterval(updateLumClock, 1000);
}
