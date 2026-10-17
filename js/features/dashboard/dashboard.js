/* Dashboard feature boundary. Calendar currently owns the dashboard data model;
   this facade gives the page a dedicated ownership point without duplicating it. */
window.CampusHubFeatures ||= {};
window.CampusHubFeatures.dashboard = {
  refresh(){ window.CampusHubCalendar?.refresh?.(); }
};
