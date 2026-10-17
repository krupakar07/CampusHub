/* CampusHub Supabase service boundary. This is the only browser-side module that owns Supabase configuration and client creation. Never place a service_role key here. */
// Paste the URL and publishable (anon) key from your Supabase project here.
// This file is loaded by the browser, so never put a service_role or secret key here.
window.CAMPUS_SUPABASE_CONFIG = {
  url: 'https://dbwdppyaizulitospmcu.supabase.co',
  anonKey: 'sb_publishable_GyrbsQHcuaAEOw-TT8XjHQ_04YP7oXa'
};

(() => {
  const config = window.CAMPUS_SUPABASE_CONFIG || {};
  const configured = typeof config.url === 'string' && config.url.startsWith('https://') && typeof config.anonKey === 'string' && config.anonKey.length > 20;
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.url, config.anonKey) : null;
  window.CampusHubServices ||= {};
  window.CampusHubServices.supabase = client;
})();
