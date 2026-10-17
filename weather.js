/* Weather service boundary. Network calls stay feature-owned until needed. */
window.CampusHubServices ||= {};
window.CampusHubServices.weather = { cache:new Map() };
