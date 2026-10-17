/* CampusHub application bootstrap.
   Keep dependency order explicit. Do not add feature logic here. */
(() => {
  'use strict';
  window.CampusHub ||= {};
  const root='/js/';
  const load = (src) => new Promise((resolve,reject)=>{
    const s=document.createElement('script'); s.src=root+src; s.async=false;
    s.onload=resolve; s.onerror=()=>reject(new Error(`CampusHub failed to load ${src}`));
    document.body.appendChild(s);
  });
  const services=['services/supabase.js','services/auth.js','services/storage.js','services/sync.js','services/weather.js'];
  const ui=['ui/modal.js','ui/toast.js','ui/dropdown.js','ui/tabs.js','ui/icons.js'];
  const features=['features/dashboard/dashboard.js','features/planner/planner.js','features/assignments/assignments.js','features/exams/exams.js','features/quick-notes/quick-notes.js','features/files/files.js','features/search/search.js','features/settings/settings.js','features/notes/editor.js','features/notes/subjects.js','features/notes/topics.js','features/calendar/calendar.js','features/notes/notes.js'];
  const boot=async()=>{
    for(const src of services) await load(src);
    for(const src of ui) await load(src);
    for(const src of features) await load(src);
    window.CampusHub.emit('app:ready',{version:'93'});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
