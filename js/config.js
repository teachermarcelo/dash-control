// js/config.js
// Grupo BNC RH - Supabase config
window.BNC_SUPABASE_URL = 'https://rvgcniaowzmsudzliozf.supabase.co';
window.BNC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2NuaWFvd3ptc3Vkemxpb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxNzQsImV4cCI6MjA5MTQwMDE3NH0.uwwKFLuK-XyPoXPrB6_CseRTiD9d-iyMQSPWrFw-l-I';

if (!window.supabase) {
  console.error('Supabase CDN não carregou.');
} else {
  window.bncSupabase = window.supabase.createClient(window.BNC_SUPABASE_URL, window.BNC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'bnc-rh-auth-v3'
    }
  });
  console.log('BNC Supabase configurado.');
}
