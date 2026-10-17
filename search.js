(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip = html => { const d=document.createElement('div'); d.innerHTML=String(html||''); return (d.textContent||d.innerText||'').replace(/\s+/g,' ').trim(); };
  const uid = () => window.CampusHubAuth?.user?.id || 'local';
  const key = store => `${store}:${uid()}`;
  let bound=false, timer=null, query='', activeType='all';

  function read(store, fallback){ try { const v=JSON.parse(localStorage.getItem(key(store))||'null'); return v===null?fallback:v; } catch { return fallback; } }
  function notes(){
    const data=read('campushub-notes-v2',{subjects:{}}), out=[];
    Object.entries(data?.subjects||{}).forEach(([subject,s])=>Object.entries(s?.topics||{}).forEach(([topic,t])=>Object.entries(t?.pages||{}).forEach(([page,content])=>out.push({type:'notes',title:page,subtitle:`${subject} · ${topic}`,text:strip(content),subject,topic,page}))));
    return out;
  }
  function assignments(){
    return (read('campushub-assignments-v2',[])||[]).map(a=>({type:'assignments',title:a.title||'Untitled assignment',subtitle:`${a.subject||'No subject'}${a.topic?' · '+a.topic:''}`,text:strip(a.description||'')+' '+strip(a.notes||'')+' '+strip(a.work||''),id:a.id,subject:a.subject,topic:a.topic,page:a.page,dueDate:a.dueDate}));
  }
  function exams(){
    return (read('campushub-exams-v1',[])||[]).map(e=>({type:'exams',title:e.title||'Untitled exam',subtitle:`${e.subject||'No subject'}${e.topic?' · '+e.topic:''}`,text:strip(e.syllabus||'')+' '+strip(e.importantTopics||'')+' '+strip(e.revisionNotes||''),id:e.id,subject:e.subject,topic:e.topic,page:e.page,date:e.date}));
  }
  function quickNotes(){
    return (read('campushub-quick-notes-v1',[])||[]).map(n=>({type:'quick-notes',title:n.title||'Untitled quick note',subtitle:n.subject?`${n.subject}${n.topic?' · '+n.topic:''}`:'Quick Notes',text:strip(n.content),id:n.id,subject:n.subject,topic:n.topic}));
  }
  function files(){
    return (read('campushub-files-v1',[])||[]).map(f=>({type:'files',title:f.name||'Untitled file',subtitle:`${f.subject||'General'} · ${formatBytes(f.size)}`,text:`${f.name||''} ${f.type||''}`,id:f.id,subject:f.subject,storagePath:f.storagePath}));
  }
  function calendar(){
    const events=read('campus-calendar-user-'+uid(),[]);
    return (Array.isArray(events)?events:[]).map(e=>({type:'calendar',title:e.title||'Untitled event',subtitle:`${e.subject||'Calendar'} · ${e.date||''}${e.start?' · '+e.start:''}`,text:`${e.notes||''} ${e.professor||''} ${e.room||''}`,id:e.id,date:e.date}));
  }
  function formatBytes(n){ n=Number(n)||0; if(n<1024)return `${n} B`; if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`; if(n<1024*1024*1024)return `${(n/1024/1024).toFixed(1)} MB`; return `${(n/1024/1024/1024).toFixed(1)} GB`; }
  function all(){ return [...notes(),...assignments(),...exams(),...quickNotes(),...files(),...calendar()]; }
  const labels={notes:'Notes',assignments:'Assignments',exams:'Exams','quick-notes':'Quick Notes',files:'Files',calendar:'Calendar'};
  const icons={notes:'▤',assignments:'✓',exams:'◉','quick-notes':'✎',files:'▱',calendar:'▦'};

  function rank(item,q){
    const title=item.title.toLowerCase(), sub=(item.subtitle||'').toLowerCase(), text=(item.text||'').toLowerCase();
    let score=0;
    if(title===q)score+=100; if(title.startsWith(q))score+=60; if(title.includes(q))score+=40; if(sub.includes(q))score+=20; if(text.includes(q))score+=8;
    return score;
  }
  function results(q){
    const normalized=q.trim().toLowerCase(); if(!normalized)return [];
    return all().map(x=>({...x,_score:rank(x,normalized)})).filter(x=>x._score>0 && (activeType==='all'||x.type===activeType)).sort((a,b)=>b._score-a._score||a.title.localeCompare(b.title)).slice(0,40);
  }
  function highlight(text,q){
    const s=esc(text); if(!q)return s;
    const safe=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return s.replace(new RegExp(`(${safe})`,'ig'),'<mark>$1</mark>');
  }
  function open(){ const modal=$('globalSearchModal'); if(!modal)return; modal.classList.remove('hidden'); $('globalSearchInput').focus(); render(); }
  function close(){ $('globalSearchModal')?.classList.add('hidden'); }
  function render(){
    const input=$('globalSearchInput'), q=(input?.value||query).trim(); query=q;
    const count=$('globalSearchCount'), body=$('globalSearchResults'); if(!body)return;
    document.querySelectorAll('[data-search-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.searchFilter===activeType));
    if(!q){ count.textContent='Search your whole CampusHub'; body.innerHTML=`<div class="search-empty"><span>⌘ K</span><strong>Search everything in one place</strong><small>Find notes, assignments, exams, quick notes, files and calendar events.</small></div>`; return; }
    const r=results(q); count.textContent=`${r.length} result${r.length===1?'':'s'}`;
    if(!r.length){ body.innerHTML=`<div class="search-empty"><span>⌕</span><strong>No results for “${esc(q)}”</strong><small>Try a subject, page name, file name, assignment or keyword.</small></div>`; return; }
    const groups=[]; r.forEach(item=>{let g=groups.find(x=>x.type===item.type);if(!g){g={type:item.type,items:[]};groups.push(g)}g.items.push(item)});
    body.innerHTML=groups.map(g=>`<section class="search-group"><div class="search-group-title"><span>${icons[g.type]||'•'}</span>${labels[g.type]||g.type}<b>${g.items.length}</b></div>${g.items.map(item=>`<button class="search-result" data-search-open="${esc(item.id||item.title)}" data-search-type="${esc(item.type)}"><span class="search-result-icon">${icons[item.type]||'•'}</span><span class="search-result-main"><strong>${highlight(item.title,q)}</strong><small>${highlight(item.subtitle||'',q)}</small>${item.text?`<em>${highlight(item.text.slice(0,150),q)}</em>`:''}</span><span class="search-result-arrow">›</span></button>`).join('')}</section>`).join('');
  }
  function openResult(type,id,title){
    const item=all().find(x=>(x.id||x.title)===id && x.type===type); if(!item)return;
    close();
    if(type==='notes'){
      document.querySelector('[data-page="notes"]')?.click();
      setTimeout(()=>window.CampusNotes?.openLocation(item.subject,item.topic,item.page),60);
    } else if(type==='assignments') window.CampusAssignments?.openWorkspace?.(item.id,item.subject);
    else if(type==='exams') window.CampusExams?.openWorkspace?.(item.id);
    else if(type==='quick-notes') { document.querySelector('[data-page="quick-notes"]')?.click(); setTimeout(()=>window.CampusQuickNotes?.open?.(item.id),60); }
    else if(type==='files') window.CampusHubFiles?.openFile?.(item.id);
    else if(type==='calendar') document.querySelector('[data-page="calendar"]')?.click();
  }
  function bind(){
    if(bound)return; bound=true;
    $('globalSearchButton')?.addEventListener('click',open);
    $('globalSearchClose')?.addEventListener('click',close);
    $('globalSearchModal')?.addEventListener('click',e=>{if(e.target===$('globalSearchModal'))close()});
    $('globalSearchInput')?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,60)});
    document.querySelectorAll('[data-search-filter]').forEach(b=>b.addEventListener('click',()=>{activeType=b.dataset.searchFilter;render()}));
    $('globalSearchResults')?.addEventListener('click',e=>{const b=e.target.closest('[data-search-open]');if(b)openResult(b.dataset.searchType,b.dataset.searchOpen,b.textContent)});
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}else if(e.key==='Escape'&&!$('globalSearchModal')?.classList.contains('hidden'))close()});
    window.addEventListener('campushub-auth',()=>{if(!$('globalSearchModal')?.classList.contains('hidden'))render()});
    window.addEventListener('campus-cloud-changed',e=>{if(['notes','assignments','exams','quick-notes','files'].includes(e.detail?.namespace)&&!$('globalSearchModal')?.classList.contains('hidden'))render()});
  }
  function activate(){bind()}
  window.CampusHubSearch={open,close,render,activate};
  if(document.readyState!=='loading')setTimeout(activate,0);else document.addEventListener('DOMContentLoaded',activate);
})();
