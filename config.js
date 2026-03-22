// config.js - FIXED VERSION
// Creates BOTH window.supabase AND window.supabaseClient for compatibility

window.CONFIG = {
  SUPABASE_URL: 'https://vvlgaisfhhjvchequmhh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bGdhaXNmaGhqdmNoZXF1bWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0Njc0MjcsImV4cCI6MjA4NjA0MzQyN30.k6AspRRmTibrLVDX8tBtc_mpt4CdTlBB4w3r6l55VlA'
};

// Initialize Supabase with BOTH variable names
(function() {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('❌ Supabase library not loaded! Add script tag first.');
    return;
  }

  const client = window.supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_ANON_KEY
  );

  // Create BOTH names for maximum compatibility
  window.supabase = client;
  window.supabaseClient = client;
  
  console.log('✅ Supabase initialized (both window.supabase and window.supabaseClient available)');
})();
