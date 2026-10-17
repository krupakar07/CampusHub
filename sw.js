const CACHE='campushub-shell-v89';
const CORE=[
  './','./index.html','./styles.css','./styles-glass.css?v=89','./styles-notes.css?v=89',
  './supabase-config.js','./cloud-sync.js','./assignments.js','./exams.js','./quick-notes.js','./app.js',
  './manifest.webmanifest','./icon.svg','./assets/background/campushub-wismar-dusk.webp','./assets/background/campushub-wismar-dusk.png',
  './files.js','./search.js','./settings.js','./export.js','./notes-ui.js'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('campushub-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  const request=new Request(event.request,{cache:'no-store'});
  event.respondWith(
    fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html')))
  );
});
