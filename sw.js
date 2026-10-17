const CACHE = 'campushub-shell-v94';
const CORE = [
  './','./index.html','./manifest.webmanifest','./assets/icons/icon.svg','./assets/icons/page.png','./assets/icons/topic.png','./assets/background/wismar-dusk.webp',
  ...Array.from({length:14},(_,i)=>`./css/${String(i).padStart(2,'0')}-${['tokens','reset','base','shell','components','pages','notes','files','calendar','exams','planner','settings','responsive','accessibility'][i]}.css?v=94`),
  './js/core/state.js','./js/core/events.js','./js/core/dom.js','./js/core/router.js','./js/core/app.js',
  './js/services/supabase.js','./js/services/auth.js','./js/services/storage.js','./js/services/sync.js','./js/services/weather.js',
  './js/ui/modal.js','./js/ui/toast.js','./js/ui/dropdown.js','./js/ui/tabs.js','./js/ui/icons.js',
  './js/features/dashboard/dashboard.js','./js/features/calendar/calendar.js','./js/features/notes/notes.js','./js/features/notes/editor.js','./js/features/notes/subjects.js','./js/features/notes/topics.js',
  './js/features/files/files.js','./js/features/assignments/assignments.js','./js/features/exams/exams.js','./js/features/planner/planner.js','./js/features/quick-notes/quick-notes.js','./js/features/search/search.js','./js/features/settings/settings.js'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;e.respondWith(fetch(r).then(res=>{if(res.ok)caches.open(CACHE).then(c=>c.put(r,res.clone()));return res}).catch(()=>caches.match(r).then(x=>x||caches.match('./index.html'))))});
