/* Authentication service boundary. Calendar owns the current auth flow for now;
   new features should read this boundary instead of creating clients themselves. */
window.CampusHubServices ||= {};
window.CampusHubServices.auth = {
  get user(){ return window.CampusHubAuth?.user || null; },
  get client(){ return window.CampusHubAuth?.client || window.CampusHubServices.supabase || null; }
};
