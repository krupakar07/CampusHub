/* Topic boundary for Notes. */
window.CampusHubFeatures ||= {};
window.CampusHubFeatures.notes ||= {};
window.CampusHubFeatures.notes.topics = {
  open(subject,topic){ return window.CampusNotes?.openLocation?.(subject,topic); }
};
