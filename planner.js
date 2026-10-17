/* Planner feature boundary. The existing planner renderer lives in the calendar
   controller for compatibility; this facade is the future extraction point. */
window.CampusHubFeatures ||= {};
window.CampusHubFeatures.planner = {
  refresh(){ window.CampusHubNavigation?.open?.('planner'); }
};
