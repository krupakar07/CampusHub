/* Central route contract. Existing navigation remains compatible through
   CampusHubNavigation; this facade becomes the only new navigation API. */
window.CampusHub ||= {};
window.CampusHub.router = {
  go(route){ window.CampusHubNavigation?.open?.(route); window.CampusHub.state.route=route; window.CampusHub.emit('route:changed',{route}); },
  get current(){ return window.CampusHubNavigation?.current || window.CampusHub.state.route; }
};
