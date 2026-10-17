/* Subject boundary for Notes. The canonical data remains owned by CampusNotes
   until the editor is decomposed into smaller stateful modules. */
window.CampusHubFeatures ||= {};
window.CampusHubFeatures.notes ||= {};
window.CampusHubFeatures.notes.subjects = {
  open(subject){ return window.CampusNotes?.openLocation?.(subject); }
};
