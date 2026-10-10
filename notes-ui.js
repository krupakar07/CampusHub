(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE = 'campushub-notes-v1';
  let activeSubject = 'Academic Research & Writing';
  let activePage = 'Lecture Notes';
  let activeTab = 'Home';
  let zoom = 100;
  let bound = false;
  let saveTimer = null;
  let currentRange = null;

  const defaultSubjects = [
    ['Academic Research & Writing', 'purple'],
    ['International Management', 'blue'],
    ['Finance', 'green'],
    ['German', 'orange']
  ];

  const homeTools = [
    {group:'Clipboard', tools:[['Paste','📋','paste'],['Undo','↶','undo'],['Redo','↷','redo']]},
    {group:'Font', tools:[['Font','Aa','fontName','select'],['Size','14','fontSize','select'],['Bold','B','bold'],['Italic','I','italic'],['Underline','U','underline'],['Strike','S','strikeThrough'],['Highlight','▰','hilite'],['Font color','A','foreColor']]},
    {group:'Paragraph', tools:[['Bullets','•','insertUnorderedList'],['Numbering','1.','insertOrderedList'],['To Do','☐','todo'],['Outdent','←','outdent'],['Indent','→','indent'],['Align left','≡','justifyLeft'],['Center','≡','justifyCenter'],['Align right','≡','justifyRight'],['Justify','≡','justifyFull']]},
    {group:'Styles', tools:[['Style','Normal','formatBlock','select'],['Clear','⌫','removeFormat'],['Superscript','x²','superscript'],['Subscript','x₂','subscript']]},
    {group:'Tags', tools:[['To Do','☐','tag-todo'],['Important','!','tag-important'],['Question','?','tag-question'],['Remember','★','tag-remember']]},
    {group:'Dictate', tools:[['Dictate','🎙','dictate'],['Language','EN','dictation-language','select']]}
  ];

  const insertTools = [
    {group:'Pages', tools:[['Page break','↵','pagebreak'],['Date','📅','date'],['Date & time','◷','datetime']]},
    {group:'Tables', tools:[['Table','▦','table']]},
    {group:'Files', tools:[['Picture','🖼','picture'],['File','📎','file'],['Audio','🎵','audio'],['Video','🎬','video']]},
    {group:'Links', tools:[['Link','🔗','link'],['Symbol','Ω','symbol'],['Emoji','😊','emoji']]},
    {group:'Text', tools:[['Horizontal line','―','hr'],['Equation','∑','equation'],['Quote','❝','quote'],['Code','<>','code'],['To Do','☐','todo'],['Sticker','★','sticker']]},
    {group:'View', tools:[['Full screen','⛶','fullscreen']]}
  ];

  function getUserKey() {
    const user = window.CampusHubAuth?.user;
    return user?.id ? `${STORE}:${user.id}` : `${STORE}:local`;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(getUserKey());
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const subjects = {};
    defaultSubjects.forEach(([name]) => {
      subjects[name] = { pages: { 'Lecture Notes': defaultContent(name) } };
    });
    return { subjects };
  }

  function saveData(data) {
    try { localStorage.setItem(getUserKey(), JSON.stringify(data)); } catch (_) {}
    const state = $('saveState');
    if (state) state.textContent = 'Saved locally';
  }

  function defaultContent(subject) {
    return `<h1>${escapeHtml(subject)}</h1><p>Start typing your lecture notes here. Everything saves automatically on this device.</p><p><strong>Tip:</strong> Use the <strong>Home</strong> ribbon for formatting and <strong>Insert</strong> for tables, pictures, files, links and more.</p>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function getData() { return loadData(); }
  function currentPageObject(data) {
    data.subjects[activeSubject] ||= {pages:{}};
    data.subjects[activeSubject].pages[activePage] ||= defaultContent(activeSubject);
    return data.subjects[activeSubject].pages;
  }

  function renderSubjects() {
    const wrap = $('notesSubjectList');
    if (!wrap) return;
    const data = getData();
    const names = [...new Set([...defaultSubjects.map(x => x[0]), ...Object.keys(data.subjects)])];
    wrap.innerHTML = names.map((name, i) => {
      const color = defaultSubjects.find(x => x[0] === name)?.[1] || ['purple','blue','green','orange'][i % 4];
      return `<button class="notes-subject ${name === activeSubject ? 'active' : ''}" data-subject="${escapeHtml(name)}"><span class="notes-dot ${color}"></span>${escapeHtml(name)}</button>`;
    }).join('');
  }

  function renderPages() {
    const wrap = $('notesPageList');
    if (!wrap) return;
    const data = getData();
    const pages = Object.keys(currentPageObject(data));
    if (!pages.includes(activePage)) activePage = pages[0] || 'Lecture Notes';
    wrap.innerHTML = pages.map(p => `<button class="notes-page-link ${p === activePage ? 'active' : ''}" data-note-page="${escapeHtml(p)}">📄 <span>${escapeHtml(p)}</span></button>`).join('');
  }

  function restoreEditor() {
    const data = getData();
    const pages = currentPageObject(data);
    const editor = $('editor');
    const title = $('noteTitle');
    if (!editor) return;
    editor.innerHTML = pages[activePage] || defaultContent(activeSubject);
    if (title) title.value = activePage === 'Lecture Notes' ? `${activeSubject} — Lecture Notes` : activePage;
    updateWordCount();
  }

  function rememberSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && $('editor')?.contains(sel.anchorNode)) currentRange = sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    if (!currentRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(currentRange);
  }

  function exec(command, value = null) {
    const editor = $('editor');
    if (!editor) return;
    editor.focus();
    restoreSelection();
    try { document.execCommand(command, false, value); } catch (_) {}
    rememberSelection();
    scheduleSave();
    updateWordCount();
  }

  function buildRibbon() {
    const ribbon = $('ribbon');
    if (!ribbon) return;
    const groups = activeTab === 'Home' ? homeTools : insertTools;
    ribbon.innerHTML = groups.map(group => `<div class="ribbon-group"><div class="group-label">${group.group}</div>${group.tools.map(tool => {
      const [label, icon, action, type] = tool;
      if (type === 'select') {
        if (action === 'fontName') return `<select class="ribbon-select" data-action="fontName" title="Font"><option value="Arial">Arial</option><option value="Calibri">Calibri</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option></select>`;
        if (action === 'fontSize') return `<select class="ribbon-select" data-action="fontSize" title="Font size"><option value="2">10</option><option value="3" selected>14</option><option value="4">18</option><option value="5">24</option><option value="6">32</option><option value="7">48</option></select>`;
        if (action === 'formatBlock') return `<select class="ribbon-select" data-action="formatBlock" title="Style"><option value="p">Normal</option><option value="h1">Title</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="blockquote">Quote</option><option value="pre">Code</option></select>`;
        return `<select class="ribbon-select" data-action="dictation-language" title="Dictation language"><option>EN</option><option>DE</option></select>`;
      }
      return `<button type="button" class="ribbon-tool" data-action="${action}" title="${label}"><span class="big">${icon}</span><span>${label}</span></button>`;
    }).join('')}</div>`).join('');
  }

  function insertHtml(html) {
    const editor = $('editor');
    if (!editor) return;
    editor.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    rememberSelection();
    scheduleSave();
    updateWordCount();
  }

  function insertTable() {
    const rows = Math.max(1, Number(prompt('Rows?', '3')) || 3);
    const cols = Math.max(1, Number(prompt('Columns?', '3')) || 3);
    let html = '<table><tbody>';
    for (let r=0;r<rows;r++){html += '<tr>'; for(let c=0;c<cols;c++) html += '<td>&nbsp;</td>'; html += '</tr>';}
    html += '</tbody></table><p></p>';
    insertHtml(html);
  }

  function handleAction(action) {
    if (action === 'paste') { navigator.clipboard?.readText?.().then(t => insertHtml(escapeHtml(t).replace(/\n/g,'<br>'))).catch(()=>notify('Paste is blocked by the browser. Use ⌘V / Ctrl+V in the editor.')); return; }
    if (['undo','redo','bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','outdent','indent','justifyLeft','justifyCenter','justifyRight','justifyFull','removeFormat','superscript','subscript'].includes(action)) return exec(action);
    if (action === 'hilite') return exec('hiliteColor', '#fff2a8');
    if (action === 'foreColor') { const c=prompt('Font color (CSS color):','#5b4cc4'); if(c) exec('foreColor',c); return; }
    if (action === 'todo') return insertHtml('<div class="todo-line"><input type="checkbox"> <span>To-do item</span></div>');
    if (action.startsWith('tag-')) { const labels={'tag-todo':'☐ To Do','tag-important':'⚠ Important','tag-question':'? Question','tag-remember':'★ Remember for Later'}; return insertHtml(`<span class="tag-chip">${labels[action]}</span>&nbsp;`); }
    if (action === 'dictate') return dictate();
    if (action === 'pagebreak') return insertHtml('<div style="page-break-after:always;border-top:1px dashed #bbb;margin:24px 0"></div>');
    if (action === 'date') return insertHtml(`<span>${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date())}</span>`);
    if (action === 'datetime') return insertHtml(`<span>${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date())}</span>`);
    if (action === 'table') return insertTable();
    if (action === 'picture') return $('notesImageInput')?.click();
    if (action === 'file') return $('notesFileInput')?.click();
    if (action === 'audio') return $('notesAudioInput')?.click();
    if (action === 'video') return $('notesVideoInput')?.click();
    if (action === 'link') { const url=prompt('Enter URL:','https://'); if(url) exec('createLink',url); return; }
    if (action === 'symbol') return insertHtml('<span>Ω α β γ π ∑ √ ≈ ≤ ≥ → ⇒ ∞</span>&nbsp;');
    if (action === 'emoji') return insertHtml('😊 👍 🎓 📚 ⭐ ✅ ❗ 💡 ');
    if (action === 'hr') return insertHtml('<hr><p></p>');
    if (action === 'equation') { const eq=prompt('Enter equation (plain text):','E = mc²'); if(eq) insertHtml(`<span class="equation">${escapeHtml(eq)}</span>&nbsp;`); return; }
    if (action === 'quote') return insertHtml('<blockquote>Quote</blockquote><p></p>');
    if (action === 'code') return insertHtml('<pre>Code</pre><p></p>');
    if (action === 'sticker') return insertHtml('<span class="tag-chip">⭐ Sticker</span>&nbsp;');
    if (action === 'fullscreen') { $('editorApp')?.requestFullscreen?.(); return; }
  }

  function dictate() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { notify('Speech-to-text is not supported in this browser. Try Chrome.'); return; }
    const r = new SR();
    const lang = document.querySelector('[data-action="dictation-language"]')?.value === 'DE' ? 'de-DE' : 'en-US';
    r.lang = lang; r.interimResults = false;
    r.onresult = e => insertHtml(escapeHtml(e.results[0][0].transcript) + ' ');
    r.onerror = e => notify(`Dictation: ${e.error}`);
    r.start();
    notify(`Listening (${lang === 'de-DE' ? 'German' : 'English'})…`);
  }

  function handleSelect(action, value) {
    if (action === 'fontName') return exec('fontName', value);
    if (action === 'fontSize') return exec('fontSize', value);
    if (action === 'formatBlock') return exec('formatBlock', value);
  }

  function handleFiles(input, kind) {
    const file = input.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (kind === 'picture') insertHtml(`<img src="${reader.result}" alt="${escapeHtml(file.name)}"><p></p>`);
      else if (kind === 'audio') insertHtml(`<p>🎵 <strong>${escapeHtml(file.name)}</strong></p><audio controls src="${reader.result}"></audio><p></p>`);
      else if (kind === 'video') insertHtml(`<p>🎬 <strong>${escapeHtml(file.name)}</strong></p><video controls style="max-width:100%" src="${reader.result}"></video><p></p>`);
      else insertHtml(`<p>📎 <strong>${escapeHtml(file.name)}</strong> — attached to this page.</p>`);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    $('saveState').textContent = 'Saving…';
    saveTimer = setTimeout(() => {
      const data = getData();
      currentPageObject(data)[activePage] = $('editor')?.innerHTML || '';
      saveData(data);
    }, 250);
  }

  function updateWordCount() {
    const text = $('editor')?.innerText?.trim() || '';
    const words = text ? text.split(/\s+/).length : 0;
    if ($('wordCount')) $('wordCount').textContent = `${words} words`;
  }

  function switchSubject(name) {
    if (!name) return;
    scheduleSave();
    activeSubject = name;
    activePage = Object.keys(currentPageObject(getData()))[0] || 'Lecture Notes';
    renderSubjects(); renderPages(); restoreEditor();
  }

  function switchPage(name) {
    if (!name) return;
    scheduleSave(); activePage = name; renderPages(); restoreEditor();
  }

  function addSubject() {
    const name = prompt('Subject name:');
    if (!name?.trim()) return;
    const data = getData();
    const clean = name.trim();
    data.subjects[clean] ||= {pages:{'Lecture Notes':defaultContent(clean)}};
    saveData(data); activeSubject = clean; activePage = 'Lecture Notes'; renderSubjects(); renderPages(); restoreEditor();
  }

  function addPage() {
    const name = prompt('Page name:','Lecture Notes');
    if (!name?.trim()) return;
    const data = getData();
    const pages = currentPageObject(data);
    const clean = name.trim();
    pages[clean] ||= defaultContent(activeSubject);
    saveData(data); activePage = clean; renderPages(); restoreEditor();
  }

  function notify(message) {
    const t=$('toast'); if(!t) return; t.textContent=message; t.classList.add('show'); clearTimeout(window.__campusNoteToast); window.__campusNoteToast=setTimeout(()=>t.classList.remove('show'),2200);
  }

  function bind() {
    if (bound) return; bound = true;
    $('editor')?.addEventListener('input', () => { updateWordCount(); scheduleSave(); });
    $('editor')?.addEventListener('mouseup', rememberSelection);
    $('editor')?.addEventListener('keyup', rememberSelection);
    $('editor')?.addEventListener('focus', rememberSelection);
    $('noteTitle')?.addEventListener('change', () => {
      const title = $('noteTitle').value.trim() || activePage;
      if (title !== activePage) {
        const data=getData(), pages=currentPageObject(data), content=pages[activePage];
        delete pages[activePage]; pages[title]=content; activePage=title; saveData(data); renderPages();
      }
    });
    $('notesSubjectList')?.addEventListener('click', e => { const b=e.target.closest('[data-subject]'); if(b) switchSubject(b.dataset.subject); });
    $('notesPageList')?.addEventListener('click', e => { const b=e.target.closest('[data-note-page]'); if(b) switchPage(b.dataset.notePage); });
    $('notesAddSubject')?.addEventListener('click', addSubject);
    $('notesNewPage')?.addEventListener('click', addPage);
    $('editorApp')?.addEventListener('click', e => {
      const tab=e.target.closest('[data-tab]');
      if(tab){ activeTab=tab.dataset.tab; document.querySelectorAll('.editor-tabs [data-tab]').forEach(x=>x.classList.toggle('selected',x===tab)); buildRibbon(); return; }
      const tool=e.target.closest('[data-action]'); if(tool && tool.tagName==='BUTTON') handleAction(tool.dataset.action);
    });
    $('editorApp')?.addEventListener('change', e => { const s=e.target.closest('select[data-action]'); if(s) handleSelect(s.dataset.action,s.value); });
    $('notesImageInput')?.addEventListener('change', e=>handleFiles(e.target,'picture'));
    $('notesFileInput')?.addEventListener('change', e=>handleFiles(e.target,'file'));
    $('notesAudioInput')?.addEventListener('change', e=>handleFiles(e.target,'audio'));
    $('notesVideoInput')?.addEventListener('change', e=>handleFiles(e.target,'video'));
    $('zoomOut')?.addEventListener('click',()=>{zoom=Math.max(60,zoom-10); applyZoom();});
    $('zoomIn')?.addEventListener('click',()=>{zoom=Math.min(180,zoom+10); applyZoom();});
    document.addEventListener('selectionchange', rememberSelection);
  }

  function applyZoom(){ if($('editor')) $('editor').style.fontSize=`${15*zoom/100}px`; if($('zoomLabel')) $('zoomLabel').textContent=`${zoom}%`; }

  function activate() {
    bind();
    const data=getData();
    data.subjects ||= {};
    defaultSubjects.forEach(([name]) => data.subjects[name] ||= {pages:{'Lecture Notes':defaultContent(name)}});
    saveData(data);
    renderSubjects(); renderPages(); buildRibbon(); restoreEditor(); applyZoom();
  }

  window.CampusNotes = { activate };
  if (document.readyState !== 'loading') setTimeout(activate, 0);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(activate, 0));
})();
