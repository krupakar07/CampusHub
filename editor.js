/* Notes editor boundary. Kept intentionally thin until the current editor is
   extracted function-by-function; this avoids duplicating a 1,000+ line editor. */
window.CampusHubFeatures ||= {};
window.CampusHubFeatures.notes ||= {};
window.CampusHubFeatures.notes.editor = {
  open(subject,topic,page){ return window.CampusNotes?.openLocation?.(subject,topic,page); },
  snapshot(){ return window.CampusNotes?.getExportSnapshot?.() || null; }
};
