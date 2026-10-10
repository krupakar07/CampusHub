(function(){
  const editor=document.getElementById('editor'), ribbon=document.getElementById('ribbon'), toast=document.getElementById('toast');
  const title=document.getElementById('noteTitle'), state=document.getElementById('saveState'), wordCount=document.getElementById('wordCount');
  let currentTab='Home', zoom=100, recognition=null;
  const KEY='campus-notes-standalone-v1';
  const icon=(s)=>`<span class="big">${s}</span>`;
  const tool=(label,visual,fn)=>`<button type="button" class="ribbon-tool" title="${label}" data-action="${fn}">${visual}<span>${label}</span></button>`;
  function group(html,label){return `<div class="ribbon-group">${html}<span class="group-label">${label}</span></div>`}
  const homeGroups=[
    group(tool('Undo',icon('↶'),'undo')+tool('Redo',icon('↷'),'redo'),'Clipboard'),
    group(`<div class="mini-stack"><select id="fontFamily" class="ribbon-select"><option>Arial</option><option>Calibri</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select><select id="fontSize" class="ribbon-select"><option value="1">8</option><option value="2">10</option><option value="3">12</option><option value="4" selected>14</option><option value="5">18</option><option value="6">24</option><option value="7">32</option></select></div>`+tool('Bold','<b class="big">B</b>','bold')+tool('Italic','<i class="big">I</i>','italic')+tool('Underline','<u class="big">U</u>','underline')+tool('Strike','<s class="big">S</s>','strikeThrough')+tool('Highlight',icon('🖍'),'highlight')+tool('Font color',icon('A'),'fontColor')+tool('Clear',icon('⌫'),'clear'),'Font'),
    group(tool('Bullets',icon('•'),'insertUnorderedList')+tool('Numbering',icon('1.'),'insertOrderedList')+tool('To Do',icon('☐'),'todo')+tool('Decrease indent',icon('⇤'),'outdent')+tool('Increase indent',icon('⇥'),'indent'),'Paragraph'),
    group(tool('Align left',icon('≡'),'justifyLeft')+tool('Center',icon('≡'),'justifyCenter')+tool('Align right',icon('≡'),'justifyRight')+tool('Justify',icon('☰'),'justifyFull'),'Alignment'),
    group(`<select id="styleSelect" class="ribbon-select"><option value="p">Normal</option><option value="h1">Title</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="blockquote">Quote</option><option value="pre">Code</option></select>`+tool('Superscript',icon('x²'),'superscript')+tool('Subscript',icon('x₂'),'subscript'),'Styles'),
    group(tool('Tags',icon('🏷'),'tags')+tool('Find Tags',icon('🔎'),'findTags')+tool('Dictate',icon('🎙'),'dictate')+`<select id="dictLang" class="ribbon-select"><option value="en-US">EN</option><option value="de-DE">DE</option></select>`,'Tags & Dictate')
  ].join('');
  const insertGroups=[
    group(tool('Page break',icon('↵'),'pageBreak')+tool('Date',icon('📅'),'date')+tool('Date & time',icon('🕒'),'datetime'),'Pages'),
    group(tool('Table',icon('▦'),'table')+tool('Picture',icon('🖼'),'picture')+tool('File',icon('📎'),'file')+tool('Audio',icon('🔊'),'audio')+tool('Video',icon('🎬'),'video'),'Media'),
    group(tool('Link',icon('🔗'),'link')+tool('Symbol',icon('Ω'),'symbol')+tool('Emoji',icon('😊'),'emoji')+tool('Horizontal line',icon('―'),'hr'),'Links & Symbols'),
    group(tool('Equation',icon('∑'),'equation')+tool('Quote',icon('❝'),'quote')+tool('Code',icon('{ }'),'code')+tool('To Do',icon('☐'),'todo')+tool('Sticker',icon('⭐'),'sticker'),'Text'),
    group(tool('Screen clipping',icon('✂'),'clipping')+tool('Full screen',icon('⛶'),'fullscreen'),'Tools')
  ].join('');
  function renderRibbon(){ribbon.innerHTML=currentTab==='Home'?homeGroups:insertGroups; bindRibbon();}
  function toastMsg(m){toast.textContent=m;toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('show'),1800)}
  function focus(){editor.focus()}
  function exec(cmd,arg=null){focus();document.execCommand(cmd,false,arg);emit()}
  function emit(){updateCount();save()}
  function updateCount(){const t=editor.innerText.trim();const n=t?t.split(/\s+/).length:0;wordCount.textContent=n+' '+(n===1?'word':'words')}
  function insertHTML(html){focus();document.execCommand('insertHTML',false,html);emit()}
  function bindRibbon(){
    ribbon.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('mousedown',e=>{e.preventDefault();action(b.dataset.action)}));
    const fs=ribbon.querySelector('#fontSize'); if(fs) fs.onchange=()=>exec('fontSize',fs.value);
    const ff=ribbon.querySelector('#fontFamily'); if(ff) ff.onchange=()=>exec('fontName',ff.value);
    const st=ribbon.querySelector('#styleSelect'); if(st) st.onchange=()=>exec('formatBlock',st.value==='p'?'p':st.value);
  }
  function action(a){
    if(['undo','redo','bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','outdent','indent','justifyLeft','justifyCenter','justifyRight','justifyFull','superscript','subscript'].includes(a)) return exec(a);
    if(a==='highlight'){exec('hiliteColor','#fff59d');return}
    if(a==='fontColor'){const c=prompt('Enter a color (e.g. #6b5bc6 or red):','#5b4bb7');if(c)exec('foreColor',c);return}
    if(a==='clear'){exec('removeFormat');return}
    if(a==='todo'){insertHTML('<div class="todo-line"><input type="checkbox"><span>To Do</span></div>');return}
    if(a==='tags'){showTags();return}
    if(a==='findTags'){const q=prompt('Find a tag (e.g. IMPORTANT):');if(q) findTag(q);return}
    if(a==='dictate'){toggleDictate();return}
    if(a==='pageBreak'){insertHTML('<div style="page-break-after:always;border-top:1px dashed #bbb;margin:24px 0;height:1px"></div>');return}
    if(a==='date'){insertHTML(new Date().toLocaleDateString());return}
    if(a==='datetime'){insertHTML(new Date().toLocaleString());return}
    if(a==='table'){showTablePicker();return}
    if(a==='picture'){document.getElementById('imageInput').click();return}
    if(a==='file'){document.getElementById('fileInput').click();return}
    if(a==='audio'){document.getElementById('audioInput').click();return}
    if(a==='video'){document.getElementById('videoInput').click();return}
    if(a==='link'){const url=prompt('URL:','https://');if(url)exec('createLink',url);return}
    if(a==='symbol'){showSymbolPicker(false);return}
    if(a==='emoji'){showSymbolPicker(true);return}
    if(a==='hr'){insertHTML('<hr>');return}
    if(a==='equation'){insertHTML('<span contenteditable="true"><em>x² + y² = z²</em></span>&nbsp;');return}
    if(a==='quote'){insertHTML('<blockquote>Quote</blockquote>');return}
    if(a==='code'){insertHTML('<pre>code</pre>');return}
    if(a==='sticker'){insertHTML('<span class="tag-chip">⭐ Study this</span>&nbsp;');return}
    if(a==='clipping'){toastMsg('Screen clipping works with macOS Screenshot (⌘⇧4). Paste the result here with ⌘V.');return}
    if(a==='fullscreen'){toggleFullscreen();return}
  }
  function showTags(){closePopups();const m=document.createElement('div');m.className='symbol-menu';m.style.gridTemplateColumns='1fr';m.style.padding='7px';['To Do','IMPORTANT','Question','Remember for Later','Definition','Critical','Contact','Address','Phone','Website'].forEach(x=>{const b=document.createElement('button');b.textContent='🏷 '+x;b.style.textAlign='left';b.onclick=()=>{insertHTML(`<span class="tag-chip">${x}</span>&nbsp;`);m.remove()};m.appendChild(b)});document.body.appendChild(m);positionPopup(m);}
  function findTag(q){const all=editor.querySelectorAll('.tag-chip');let count=0;all.forEach(x=>{if(x.textContent.toLowerCase().includes(q.toLowerCase())){x.style.outline='2px solid #ffb000';count++}else x.style.outline=''});toastMsg(count?count+' matching tag(s) highlighted':'No matching tags');}
  function showTablePicker(){closePopups();const p=document.createElement('div');p.className='table-picker';p.innerHTML='<div class="picker-label">Insert table</div><div class="table-grid"></div>';const grid=p.querySelector('.table-grid');for(let r=1;r<=6;r++)for(let c=1;c<=6;c++){const b=document.createElement('button');b.className='table-cell';b.title=`${r} × ${c}`;b.onmouseenter=()=>{grid.querySelectorAll('.table-cell').forEach((x,i)=>{const rr=Math.floor(i/6)+1,cc=i%6+1;x.classList.toggle('active',rr<=r&&cc<=c)})};b.onclick=()=>{insertTable(r,c);p.remove()};grid.appendChild(b)}document.body.appendChild(p);positionPopup(p)}
  function insertTable(rows,cols){let h='<table><tbody>';for(let r=0;r<rows;r++){h+='<tr>';for(let c=0;c<cols;c++)h+='<td>&nbsp;</td>';h+='</tr>'}h+='</tbody></table><p></p>';insertHTML(h)}
  const symbols=['Ω','±','≈','≠','≤','≥','∞','π','√','∑','∫','∆','→','←','↔','©','®','™','€','£','¥','§','°','µ','α','β','γ','δ','λ','θ','✦','✓','★','•','…','—','–','“','”','‘','’'];
  const emojis=['😀','😂','😊','😍','😎','🤔','😴','👍','👎','❤️','🔥','⭐','🎓','📚','📝','💡','❗','❓','✅','📌','📎','🎯','🚀','☕','🧠','💻','📅','🔔','✨','👏','🙌','🤝','😅','😮','😢','😡','🥳','🤓'];
  function showSymbolPicker(emoji){closePopups();const p=document.createElement('div');p.className='symbol-menu';(emoji?emojis:symbols).forEach(s=>{const b=document.createElement('button');b.textContent=s;b.onclick=()=>{insertHTML(s);p.remove()};p.appendChild(b)});document.body.appendChild(p);positionPopup(p)}
  function positionPopup(p){p.style.right='110px';p.style.top='150px'}
  function closePopups(){document.querySelectorAll('.symbol-menu,.table-picker').forEach(x=>x.remove())}
  function toggleDictate(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toastMsg('Dictation is not supported in this browser. Try Chrome and allow microphone access.');return}if(recognition){recognition.stop();recognition=null;toastMsg('Dictation stopped');return}recognition=new SR();recognition.lang=(ribbon.querySelector('#dictLang')||{}).value||'en-US';recognition.continuous=true;recognition.interimResults=false;recognition.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)s+=e.results[i][0].transcript+' ';if(s)insertHTML(s.replace(/&/g,'&amp;').replace(/</g,'&lt;'))};recognition.onerror=e=>{toastMsg('Dictation error: '+e.error);recognition=null};recognition.onend=()=>{if(recognition){try{recognition.start()}catch(_){}}};recognition.start();toastMsg('Dictation started — speak now')}
  function toggleFullscreen(){const el=document.querySelector('.onenote-editor');if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()}
  function save(){const data={title:title.value,html:editor.innerHTML,updated:Date.now()};try{localStorage.setItem(KEY,JSON.stringify(data));state.textContent='Saved locally • '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}catch(e){state.textContent='Local save unavailable'}}
  function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d){title.value=d.title||title.value;editor.innerHTML=d.html||editor.innerHTML;state.textContent='Saved locally';}}catch(e){}updateCount()}
  let saveTimer;editor.addEventListener('input',()=>{clearTimeout(saveTimer);state.textContent='Saving…';saveTimer=setTimeout(save,350);updateCount()});title.addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(save,350)});
  document.querySelectorAll('.editor-tabs button').forEach(b=>b.addEventListener('click',()=>{currentTab=b.dataset.tab;document.querySelectorAll('.editor-tabs button').forEach(x=>x.classList.toggle('selected',x===b));renderRibbon()}));
  document.getElementById('saveBtn').onclick=()=>{save();toastMsg('Saved to this Mac/browser')};document.getElementById('printBtn').onclick=()=>window.print();document.getElementById('fullscreenBtn').onclick=toggleFullscreen;
  document.getElementById('newPage').onclick=()=>{if(confirm('Create a new blank page?')){title.value='New Lecture Notes';editor.innerHTML='<p><br></p>';save();toastMsg('New page created')}};
  document.getElementById('addSubject').onclick=()=>{const s=prompt('Subject name:');if(s){const el=document.createElement('div');el.className='subject';el.innerHTML='<span class="dot purple"></span>'+s;document.querySelector('.add-subject').before(el)}};
  document.getElementById('zoomIn').onclick=()=>{zoom=Math.min(150,zoom+10);editor.style.fontSize=(15*zoom/100)+'px';document.getElementById('zoomLabel').textContent=zoom+'%'};document.getElementById('zoomOut').onclick=()=>{zoom=Math.max(70,zoom-10);editor.style.fontSize=(15*zoom/100)+'px';document.getElementById('zoomLabel').textContent=zoom+'%'};
  document.getElementById('imageInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>insertHTML(`<img src="${r.result}" alt="${f.name}"><p></p>`);r.readAsDataURL(f);e.target.value=''};
  document.getElementById('fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>insertHTML(`<p>📎 <a href="${r.result}" download="${f.name}">${f.name}</a></p>`);r.readAsDataURL(f);e.target.value=''};
  document.getElementById('audioInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>insertHTML(`<p>🔊 <audio controls src="${r.result}"></audio></p>`);r.readAsDataURL(f);e.target.value=''};
  document.getElementById('videoInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>insertHTML(`<p>🎬 <video controls style="max-width:100%" src="${r.result}"></video></p>`);r.readAsDataURL(f);e.target.value=''};
  document.addEventListener('click',e=>{if(!e.target.closest('.symbol-menu,.table-picker,[data-action="table"],[data-action="symbol"],[data-action="emoji"],[data-action="tags"]'))closePopups()});
  // ---------------- University workspace + calendar ----------------
  const STORE='campus-notes-university-v2';
  let appData={events:[],tasks:[],exams:[],subjects:['Academic Research & Writing','International Management','Finance','German']};
  let calDate=new Date(); let calMode='month';
  function loadWorkspace(){try{const d=JSON.parse(localStorage.getItem(STORE)||'null');if(d) appData={...appData,...d};}catch(e){} renderCalendar();renderDashboard();renderTasks();renderExams();renderSubjects();}
  function saveWorkspace(){localStorage.setItem(STORE,JSON.stringify(appData));}
  function fmtDate(d){return d.toISOString().slice(0,10)}
  function dateLabel(d){return d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
  function startOfWeek(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x}
  function eventFor(date){return appData.events.filter(e=>e.date===fmtDate(date)).sort((a,b)=>(a.start||'').localeCompare(b.start||''))}
  function renderCalendar(){
    const titleEl=document.getElementById('calendarTitle'), grid=document.getElementById('calendarGrid');
    if(!titleEl||!grid)return;
    if(calMode==='month') titleEl.textContent=calDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    if(calMode==='week'){const s=startOfWeek(calDate),e=new Date(s);e.setDate(e.getDate()+6);titleEl.textContent=s.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' – '+e.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}
    if(calMode==='day') titleEl.textContent=dateLabel(calDate);
    if(calMode==='month'){
      const first=new Date(calDate.getFullYear(),calDate.getMonth(),1), start=new Date(first);start.setDate(1-first.getDay());
      let h='<div class="month-grid">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="weekday">${x}</div>`).join('');
      for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ev=eventFor(d);const today=fmtDate(d)===fmtDate(new Date());h+=`<div class="day-cell" data-date="${fmtDate(d)}"><div class="day-number ${today?'today':''}">${d.getDate()}</div>${ev.map(e=>`<div class="cal-event" data-event="${e.id}" title="${e.title}">${e.start||''} ${e.title}</div>`).join('')}</div>`}
      h+='</div>';grid.innerHTML=h;
    } else if(calMode==='week'){
      const s=startOfWeek(calDate), days=[...Array(7)].map((_,i)=>{const d=new Date(s);d.setDate(d.getDate()+i);return d});
      let h='<div class="week-grid"><div class="week-head"></div>'+days.map(d=>`<div class="week-head">${d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'})}</div>`).join('');
      for(let hr=7;hr<=21;hr++){h+=`<div class="time-cell">${String(hr).padStart(2,'0')}:00</div>`+days.map(d=>{const ev=eventFor(d).filter(e=>(parseInt((e.start||'00:00').split(':')[0],10)===hr));return `<div class="week-day" data-date="${fmtDate(d)}">${ev.map(e=>`<div class="week-event" data-event="${e.id}">${e.start||''} ${e.title}</div>`).join('')}</div>`}).join('')}
      grid.innerHTML=h+'</div>';
    } else {
      let h='<div class="day-view">';for(let hr=7;hr<=22;hr++){const ev=eventFor(calDate).filter(e=>parseInt((e.start||'00:00').split(':')[0],10)===hr);h+=`<div class="day-slot"><div class="time-cell">${String(hr).padStart(2,'0')}:00</div><div class="slot-content">${ev.map(e=>`<div class="cal-event" data-event="${e.id}">${e.start||''} ${e.title}${e.room?' · '+e.room:''}</div>`).join('')}</div></div>`}grid.innerHTML=h+'</div>';
    }
    grid.querySelectorAll('[data-event]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openEventModal(appData.events.find(x=>x.id===el.dataset.event))}));
    grid.querySelectorAll('[data-date]').forEach(el=>el.addEventListener('dblclick',()=>{const d=el.dataset.date;openEventModal({date:d})}));
  }
  function renderDashboard(){
    const now=new Date();document.getElementById('todayText').textContent=dateLabel(now);
    const upcoming=appData.events.filter(e=>e.date>=fmtDate(now)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    const n=document.getElementById('nextEventCard');n.innerHTML=upcoming[0]?`<strong>${upcoming[0].title}</strong><br><span style="font-size:12px;color:#888">${upcoming[0].date} · ${upcoming[0].start||''}${upcoming[0].room?' · '+upcoming[0].room:''}</span>`:'<span style="color:#999">No upcoming events. Add your first class or appointment.</span>';
    const todays=eventFor(now);document.getElementById('todayEvents').innerHTML=todays.length?todays.map(e=>`<div class="event-mini"><span class="event-time">${e.start||''}</span><span class="event-name">${e.title}</span></div>`).join(''):'<span style="color:#999;font-size:12px">Nothing scheduled today.</span>';
    const open=appData.tasks.filter(t=>!t.done).slice(0,4);document.getElementById('taskSummary').innerHTML=open.length?open.map(t=>`<div class="task-row">☐ <span>${t.title}</span></div>`).join(''):'<span style="color:#999;font-size:12px">No open tasks.</span>';
  }
  function renderSubjects(){document.getElementById('subjectsCards').innerHTML=appData.subjects.map((s,i)=>`<div class="subject-card"><h3>${s}</h3><p>Lecture notes · Quick notes · Assignments · Files</p></div>`).join('')}
  function renderTasks(){document.getElementById('tasksList').innerHTML=appData.tasks.length?appData.tasks.map(t=>`<div class="task-item"><input type="checkbox" data-task="${t.id}" ${t.done?'checked':''}><div class="grow"><strong style="${t.done?'text-decoration:line-through;color:#999':''}">${t.title}</strong><br><small>${t.due?'Due '+t.due:''}</small></div><button class="danger-btn" data-delete-task="${t.id}">Delete</button></div>`).join(''):'<div class="dashboard-card">No tasks yet.</div>';document.querySelectorAll('[data-task]').forEach(x=>x.onchange=()=>{const t=appData.tasks.find(t=>t.id===x.dataset.task);if(t){t.done=x.checked;saveWorkspace();renderTasks();renderDashboard()}});document.querySelectorAll('[data-delete-task]').forEach(x=>x.onclick=()=>{appData.tasks=appData.tasks.filter(t=>t.id!==x.dataset.deleteTask);saveWorkspace();renderTasks();renderDashboard()})}
  function renderExams(){document.getElementById('examsList').innerHTML=appData.exams.length?appData.exams.map(e=>`<div class="task-item"><div class="grow"><strong>${e.title}</strong><br><small>${e.date}${e.time?' · '+e.time:''}${e.room?' · '+e.room:''}</small></div><button class="danger-btn" data-delete-exam="${e.id}">Delete</button></div>`).join(''):'<div class="dashboard-card">No exams added yet.</div>';document.querySelectorAll('[data-delete-exam]').forEach(x=>x.onclick=()=>{appData.exams=appData.exams.filter(e=>e.id!==x.dataset.deleteExam);saveWorkspace();renderExams()})}
  function switchView(view){document.querySelectorAll('.app-view').forEach(x=>x.classList.add('hidden'));document.getElementById(view+'View').classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));if(view==='calendar')renderCalendar()}
  document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));document.querySelectorAll('[data-view-target]').forEach(b=>b.onclick=()=>switchView(b.dataset.viewTarget));
  document.getElementById('calPrev').onclick=()=>{if(calMode==='month')calDate.setMonth(calDate.getMonth()-1);else if(calMode==='week')calDate.setDate(calDate.getDate()-7);else calDate.setDate(calDate.getDate()-1);renderCalendar()};
  document.getElementById('calNext').onclick=()=>{if(calMode==='month')calDate.setMonth(calDate.getMonth()+1);else if(calMode==='week')calDate.setDate(calDate.getDate()+7);else calDate.setDate(calDate.getDate()+1);renderCalendar()};document.getElementById('calToday').onclick=()=>{calDate=new Date();renderCalendar()};document.getElementById('calMode').onchange=e=>{calMode=e.target.value;renderCalendar()};
  document.getElementById('addEventBtn').onclick=()=>openEventModal({date:fmtDate(calDate)});document.getElementById('dashboardAddEvent').onclick=()=>openEventModal({date:fmtDate(new Date())});
  document.getElementById('addTaskBtn').onclick=()=>{const title=prompt('Task name:');if(title){appData.tasks.push({id:crypto.randomUUID(),title,due:'',done:false});saveWorkspace();renderTasks();renderDashboard()}};
  document.getElementById('addExamBtn').onclick=()=>{const title=prompt('Exam name:');if(title){const date=prompt('Exam date (YYYY-MM-DD):',fmtDate(new Date()));appData.exams.push({id:crypto.randomUUID(),title,date});saveWorkspace();renderExams()}};
  document.getElementById('subjectsAdd').onclick=document.getElementById('addSubject').onclick=function(){const s=prompt('Subject name:');if(s){appData.subjects.push(s);saveWorkspace();renderSubjects();const el=document.createElement('button');el.className='subject';el.dataset.subject=s;el.innerHTML='<span class="dot purple"></span> '+s;document.getElementById('subjectList').appendChild(el)}};
  function openEventModal(ev){
    const root=document.getElementById('modalRoot'), editing=!!ev.id;root.innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${editing?'Edit event':'Add event'}</h2><div class="form-grid"><label class="form-field full">Title<input id="mTitle" value="${ev.title||''}" autofocus></label><label class="form-field">Date<input id="mDate" type="date" value="${ev.date||fmtDate(calDate)}"></label><label class="form-field">Start<input id="mStart" type="time" value="${ev.start||'09:00'}"></label><label class="form-field">End<input id="mEnd" type="time" value="${ev.end||'10:00'}"></label><label class="form-field">Room<input id="mRoom" value="${ev.room||''}" placeholder="Room / building"></label><label class="form-field">Professor<input id="mProf" value="${ev.prof||''}"></label><label class="form-field">Subject<input id="mSubject" value="${ev.subject||''}"></label><label class="form-field">Type<select id="mType"><option>Lecture</option><option>Seminar</option><option>Exam</option><option>Assignment</option><option>Personal</option><option>Other</option></select></label><label class="form-field full">Notes<textarea id="mNotes">${ev.notes||''}</textarea></label></div><div class="modal-actions">${editing?'<button class="danger-btn" id="mDelete">Delete</button>':''}<span style="flex:1"></span><button class="secondary-btn" id="mCancel">Cancel</button><button class="primary-btn" id="mSave">Save event</button></div></div></div>`;
    document.getElementById('mType').value=ev.type||'Lecture';document.getElementById('mCancel').onclick=()=>root.innerHTML='';document.querySelector('.modal-backdrop').onclick=e=>{if(e.target.classList.contains('modal-backdrop'))root.innerHTML=''};
    document.getElementById('mSave').onclick=()=>{const obj={id:ev.id||crypto.randomUUID(),title:document.getElementById('mTitle').value.trim()||'Untitled event',date:document.getElementById('mDate').value,start:document.getElementById('mStart').value,end:document.getElementById('mEnd').value,room:document.getElementById('mRoom').value,prof:document.getElementById('mProf').value,subject:document.getElementById('mSubject').value,type:document.getElementById('mType').value,notes:document.getElementById('mNotes').value};const i=appData.events.findIndex(x=>x.id===obj.id);if(i>=0)appData.events[i]=obj;else appData.events.push(obj);saveWorkspace();root.innerHTML='';renderCalendar();renderDashboard();toastMsg('Event saved')};
    if(editing)document.getElementById('mDelete').onclick=()=>{appData.events=appData.events.filter(x=>x.id!==ev.id);saveWorkspace();root.innerHTML='';renderCalendar();renderDashboard();toastMsg('Event deleted')};
  }
  loadWorkspace();
  load();renderRibbon();
})();
