/* Storage service boundary: local-first persistence helpers. */
window.CampusHubServices ||= {};
window.CampusHubServices.storage = {
  get(key, fallback=null){ try { const v=localStorage.getItem(key); return v===null?fallback:JSON.parse(v); } catch { return fallback; } },
  set(key,value){ try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } },
  remove(key){ try { localStorage.removeItem(key); } catch {} }
};
