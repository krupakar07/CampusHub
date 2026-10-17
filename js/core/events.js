/* Central event bus. DOM CustomEvents remain supported for compatibility. */
window.CampusHub ||= {};
window.CampusHub.events ||= new EventTarget();
window.CampusHub.emit = (name,detail={}) => window.CampusHub.events.dispatchEvent(new CustomEvent(name,{detail}));
window.CampusHub.on = (name,handler) => { window.CampusHub.events.addEventListener(name,handler); return () => window.CampusHub.events.removeEventListener(name,handler); };
