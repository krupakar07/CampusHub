/* Single application state boundary. Feature modules may add namespaced state,
   but cross-feature state belongs here. */
window.CampusHub ||= {};
window.CampusHub.state ||= {
  version:'92',
  route:'dashboard',
  auth:{user:null},
  ui:{theme:'glass',contrast:'normal',reduceMotion:false},
  notes:{subject:null,topic:null,page:null},
  calendar:{view:'week',selectedDate:null}
};
