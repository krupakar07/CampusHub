window.CampusHub ||= {};
window.CampusHub.dom = {
  id(id){ return document.getElementById(id); },
  one(selector,root=document){ return root.querySelector(selector); },
  all(selector,root=document){ return [...root.querySelectorAll(selector)]; },
  show(el){ el?.classList.remove('hidden'); },
  hide(el){ el?.classList.add('hidden'); }
};
