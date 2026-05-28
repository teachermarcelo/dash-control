// js/config.js
// Configurações de Conexão com o Supabase

const SUPABASE_URL = 'https://rvgcniaowzmsudzliozf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2NuaWFvd3ptc3Vkemxpb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxNzQsImV4cCI6MjA5MTQwMDE3NH0.uwwKFLuK-XyPoXPrB6_CseRTiD9d-iyMQSPWrFw-l-I';

if (!window.supabase) {
  throw new Error('Biblioteca Supabase não foi carregada. Verifique o script CDN no index.html.');
}

// Cliente único usado por toda a aplicação
window.bncSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Configuração do Supabase carregada.');
