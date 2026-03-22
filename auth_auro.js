// auth_auro.js - Simple localStorage-based authentication for MINALIA
// Works with Auro wallet sessions

let currentUser = null;
let fullWalletAddress = '';
let isSpectator = false;

// Check localStorage for session
async function initAuth() {
  console.log('🔐 Checking session...');
  
  const session = localStorage.getItem('minalia_session');
  
  if (!session) {
    console.log('ℹ️ No session found');
    showLoggedOut();
    return;
  }
  
  try {
    const sessionData = JSON.parse(session);
    console.log('📦 Session data:', sessionData);
    
    // Check session expiry
    if (sessionData.expires_at && Date.now() > new Date(sessionData.expires_at).getTime()) {
      console.log('⏰ Session expired — logging out');
      localStorage.removeItem('minalia_session');
      showLoggedOut();
      if (!window.location.pathname.includes('login')) window.location.href = 'login.html';
      return;
    }

    // Spectator mode
    if (sessionData.mode === 'spectator') {
      console.log('👁️ Spectator mode active');
      isSpectator = true;
      showSpectatorMode();
      return;
    }
    
    // Player mode - has wallet
    if (sessionData.wallet_address && sessionData.user) {
      // Block any demo/placeholder wallet addresses
      const DEMO_WALLETS = [
        'DEMO_WALLET_MOONVEIL',
        'DEMO_WALLET_STELLAR_WANDERER',
        'DEMO_WALLET_NIGHTBLOOM_KAI',
        'DEMO_WALLET_GLOWGROVE',
        'DEMO_WALLET_COSMIC_TRADER',
        'DEMO_WALLET_CANOPY_SAGE',
        'DEMO_WALLET_FOREST_DWELLER',
      ];
      // Block any wallet starting with DEMO_ as a catch-all
      if (DEMO_WALLETS.includes(sessionData.wallet_address) || sessionData.wallet_address.startsWith('DEMO_')) {
        console.warn('🚫 Demo wallet in session — clearing and redirecting to login');
        localStorage.removeItem('minalia_session');
        window.location.href = 'login.html';
        return;
      }
      currentUser = sessionData.user;
      fullWalletAddress = sessionData.wallet_address;
      
      // Fetch latest user data from database
      await refreshUserData();
      
      // Check for inactivity penalty BEFORE updating last_login_at
      await notifyInactivityReturn(currentUser.id);
      
      // 🆕 Update last login timestamp
      await updateLastLogin(currentUser.id);
      
      window.currentUser = currentUser; // expose globally
      console.log('✅ Logged in as:', currentUser.username);
      showLoggedIn();
      loadNavArkis(currentUser.id);
    } else {
      showLoggedOut();
    }
    
  } catch (error) {
    console.error('❌ Session parse error:', error);
    localStorage.removeItem('minalia_session');
    showLoggedOut();
  }
}

// 🆕 Update last_login_at
async function updateLastLogin(userId) {
  const client = window.supabaseClient || window.supabase;
  if (!client) return;
  const { error } = await client
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.warn('Could not update last_login:', error.message);
}

// Check for inactivity penalty and fire welcome-back alert if needed
async function notifyInactivityReturn(userId) {
  const client = window.supabaseClient || window.supabase;
  if (!client) return;
  try {
    await client.rpc('notify_inactivity_return', { p_user_id: userId });
  } catch(e) {
    console.warn('notifyInactivityReturn failed:', e.message);
  }
}

// Refresh user data from database
async function refreshUserData() {
  const client = window.supabaseClient || window.supabase;
  if (!client || !fullWalletAddress) return;
  
  try {
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('mina_wallet_address', fullWalletAddress)
      .single();
    
    if (data && !error) {
      currentUser = data;
      
      // Update session
      const session = JSON.parse(localStorage.getItem('minalia_session'));
      session.user = data;
      localStorage.setItem('minalia_session', JSON.stringify(session));
      
      console.log('🔄 User data refreshed');
    }
  } catch (error) {
    console.log('⚠️ Could not refresh user data:', error.message);
  }
}

// Show logged out state
function showLoggedOut() {
  const authLinks = document.getElementById('authLinks');
  const navCenter = document.getElementById('navCenter');
  const userDropdown = document.getElementById('userDropdown');
  if (authLinks) authLinks.style.display = 'flex';
  if (navCenter) navCenter.style.display = 'none';
  if (userDropdown) userDropdown.style.display = "none";
  var _p = document.getElementById("navUserPill"); if (_p) _p.style.display = "none";
}

// Show spectator mode — read-only access, no wallet
function showSpectatorMode() {
  // Allow map, district, unit, dev pages — block profile and trading pages
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const BLOCKED = ['profile.html', 'money.html', 'alerts.html'];
  if (BLOCKED.includes(page)) {
    window.location.replace('login.html');
    return;
  }
  // Show nav in read-only state — no user dropdown, just a guest label
  const authLinks  = document.getElementById('authLinks');
  const navCenter  = document.getElementById('navCenter');
  const userDropdown = document.getElementById('userDropdown');
  if (navCenter)    navCenter.style.display = 'flex';
  if (authLinks)    authLinks.style.display = 'none';
  if (userDropdown) userDropdown.style.display = "none";
  var _p = document.getElementById("navUserPill"); if (_p) _p.style.display = "none";
  // Show a guest badge in the nav
  const audioSlot = document.querySelector('.nav-audio-slot');
  if (audioSlot && !document.getElementById('guestNavBadge')) {
    const badge = document.createElement('div');
    badge.id = 'guestNavBadge';
    badge.style.cssText = 'display:flex;align-items:center;gap:8px;';
    badge.innerHTML = `
      <span style="font-family:'Share Tech Mono',monospace;font-size:10px;
        letter-spacing:.1em;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.1);
        padding:4px 8px;border-radius:4px;">👁 GUEST</span>
      <a href="login.html" style="font-family:'Share Tech Mono',monospace;font-size:10px;
        letter-spacing:.08em;color:#60FFab;border:1px solid rgba(96,255,171,0.3);
        background:rgba(96,255,171,0.06);padding:4px 12px;border-radius:4px;
        text-decoration:none;white-space:nowrap;"
        onmouseover="this.style.background='rgba(96,255,171,0.14)'"
        onmouseout="this.style.background='rgba(96,255,171,0.06)'">
        Connect Wallet →
      </a>`;
    audioSlot.appendChild(badge);
  }
}

// Show logged in state
function showLoggedIn() {
  const authLinks = document.getElementById('authLinks');
  const navCenter = document.getElementById('navCenter');
  const userDropdown = document.getElementById('userDropdown');

  if (authLinks)    authLinks.style.display = 'none';
  if (navCenter)    navCenter.style.display = 'flex';
  var _pill = document.getElementById("navUserPill");
  if (_pill) _pill.style.display = "flex";
  if (userDropdown) userDropdown.style.display = "flex";
  
  // Set user info in dropdown
  const username = document.getElementById('dropdownUsername');
  const wallet = document.getElementById('dropdownWallet');
  const avatarBtn = document.getElementById('userAvatarBtn');
  
  if (username) {
    const name = currentUser.username || `Player ${fullWalletAddress.substring(0, 8)}`;
    username.textContent = name;
    
    // Set avatar image
    // Priority: avatar_url (Supabase Storage upload) > avatar (legacy field) > initials
    if (avatarBtn) {
      const initials = name.substring(0, 2).toUpperCase();
      // avatar_url is the user-uploaded image stored in Supabase Storage bucket — always prefer it
      let avatarUrl = currentUser.avatar_url || currentUser.avatar || null;
      // Resolve legacy filenames stored without a full URL
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('/') && !avatarUrl.startsWith('data:') && !avatarUrl.startsWith('images/')) {
        avatarUrl = 'https://vvlgaisfhhjvchequmhh.supabase.co/storage/v1/object/public/avatars/' + avatarUrl;
      }
      if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl + '?t=' + Date.now();
        img.alt = name;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:0 6px 6px 0;display:block;';
        img.onerror = () => { avatarBtn.innerHTML = `<span>${initials}</span>`; };
        avatarBtn.innerHTML = '';
        avatarBtn.appendChild(img);
      } else {
        avatarBtn.innerHTML = `<span>${initials}</span>`;
      }
    }
  }
  
  if (wallet) {
    const truncate = (addr) => addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
    wallet.textContent = truncate(fullWalletAddress);
  }
  
  setupDropdown();

  // On mobile: inject a visible logout button directly into the nav
  // The dropdown is hard to use on small screens
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && !document.getElementById('mobileLogoutBtn')) {
    const audioSlot = document.querySelector('.nav-audio-slot');
    if (audioSlot) {
      const mobileLogout = document.createElement('button');
      mobileLogout.id = 'mobileLogoutBtn';
      mobileLogout.textContent = 'Logout';
      mobileLogout.style.cssText = [
        'font-family:"Share Tech Mono",monospace',
        'font-size:10px',
        'letter-spacing:.08em',
        'color:rgba(255,100,100,0.7)',
        'border:1px solid rgba(255,100,100,0.25)',
        'background:rgba(255,100,100,0.06)',
        'padding:5px 12px',
        'border-radius:4px',
        'cursor:pointer',
        'white-space:nowrap',
      ].join(';');
      mobileLogout.addEventListener('click', () => {
        localStorage.removeItem('minalia_session');
        window.location.href = 'login.html';
      });
      mobileLogout.addEventListener('mouseover', () => {
        mobileLogout.style.background = 'rgba(255,100,100,0.14)';
      });
      mobileLogout.addEventListener('mouseout', () => {
        mobileLogout.style.background = 'rgba(255,100,100,0.06)';
      });
      audioSlot.insertAdjacentElement('afterend', mobileLogout);
    }
  }
}

// Setup dropdown interactions
function setupDropdown() {
  const avatarBtn = document.getElementById('userAvatarBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  const dropdown = document.getElementById('userDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (avatarBtn && dropdownMenu) {
    const newAvatarBtn = avatarBtn.cloneNode(true);
    if (avatarBtn.parentNode) {
      avatarBtn.parentNode.replaceChild(newAvatarBtn, avatarBtn);
    }
    
    newAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('open');
    });
  }
  
  if (dropdown) {
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && dropdownMenu) {
        dropdownMenu.classList.remove('open');
      }
    });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      console.log('🚪 Logging out...');
      localStorage.removeItem('minalia_session');
      window.location.href = 'login.html';
    });
  }
}

// Copy wallet address to clipboard
function copyWallet() {
  const walletEl = document.getElementById('dropdownWallet');
  if (!walletEl || !fullWalletAddress) return;
  
  navigator.clipboard.writeText(fullWalletAddress).then(() => {
    walletEl.classList.add('copied');
    const originalText = walletEl.textContent;
    walletEl.textContent = 'Copied!';
    
    setTimeout(() => {
      walletEl.classList.remove('copied');
      walletEl.textContent = originalText;
    }, 1500);
  }).catch(err => {
    console.error('Copy failed:', err);
    alert('Failed to copy wallet address');
  });
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
// ── Nav $ARKIS balance ───────────────────────────────────────────────────
async function loadNavArkis(userId) {
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M';
    if (n >= 1000)    return (n/1000).toFixed(1).replace(/\.0$/,'') + 'K';
    return n.toLocaleString();
  }
  window.refreshNavArkis = function(n) {
    var a = document.getElementById('navArkisAmount');
    if (a && typeof n === 'number') {
      a.textContent = fmt(n);
      try { localStorage.setItem('minalia_arkis_cache', JSON.stringify({v:n,t:Date.now()})); } catch(e) {}
    }
  };
  try {
    var client = window.supabaseClient || window.supabase;
    if (!client) return;
    var res = await client.from('user_tokens').select('token_balance').eq('user_id', userId).single();
    if (res.data && res.data.token_balance != null) {
      var n = Number(res.data.token_balance);
      var a = document.getElementById('navArkisAmount');
      var p = document.getElementById('navUserPill');
      if (a) a.textContent = fmt(n);
      if (p) p.style.display = 'flex';
      try { localStorage.setItem('minalia_arkis_cache', JSON.stringify({v:n,t:Date.now()})); } catch(e) {}
    }
  } catch(e) {}
}