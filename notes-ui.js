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
    {group:'Font', tools:[['Font','Aa','fontName','select'],['Size','14','fontSize','select'],['Bold','B','bold'],['Italic','I','italic'],['Underline','U','underline'],['Strike','S','strikeThrough'],['Highlight','▰','hilite','color'],['Font color','A','foreColor','color']]},
    {group:'Paragraph', tools:[['Bullets','•','insertUnorderedList'],['Numbering','1.','insertOrderedList'],['To Do','☐','todo'],['Outdent','←','outdent'],['Indent','→','indent'],['Align left','≡','justifyLeft'],['Center','≡','justifyCenter'],['Align right','≡','justifyRight'],['Justify','≡','justifyFull']]},
    {group:'Styles', tools:[['Style','Normal','formatBlock','select'],['Clear','⌫','removeFormat'],['Superscript','x²','superscript'],['Subscript','x₂','subscript']]},
    {group:'Tags', tools:[['Tags','✓','tags','tags']]},
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
    refreshToolbarState();
  }

  const colorPalettes = {
    foreColor: [
      ['#000000','Black'],['#434343','Dark gray'],['#666666','Gray'],['#999999','Light gray'],['#ffffff','White'],
      ['#e03131','Red'],['#f08c00','Orange'],['#fcc419','Yellow'],['#2f9e44','Green'],['#1971c2','Blue'],['#6741d9','Purple'],['#d6336c','Pink'],
      ['#c92a2a','Dark red'],['#e67700','Dark orange'],['#5c940d','Dark green'],['#1864ab','Dark blue'],['#5f3dc4','Dark purple'],['#a61e4d','Dark pink']
    ],
    hilite: [
      ['transparent','None'],['#fff59d','Yellow'],['#ffd8a8','Orange'],['#ffc9c9','Red'],['#b2f2bb','Green'],['#a5d8ff','Blue'],['#d0bfff','Purple'],['#fcc2d7','Pink'],
      ['#fff3bf','Light yellow'],['#ffe8cc','Light orange'],['#ffe3e3','Light red'],['#d3f9d8','Light green'],['#d0ebff','Light blue'],['#e5dbff','Light purple'],['#ffdeeb','Light pink']
    ]
  };

  const toggleActions = new Set(['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','superscript','subscript','justifyLeft','justifyCenter','justifyRight','justifyFull','createLink']);

  const tagDefinitions = [
    ['todo','To Do','✓',''],
    ['important','Important','★',''],
    ['question','Question','?',''],
    ['remember','Remember for later','!','remember'],
    ['definition','Definition','▣','definition'],
    ['highlight','Highlight','✎','highlight'],
    ['contact','Contact','♙',''],
    ['address','Address','⌂',''],
    ['phone','Phone number','☎',''],
    ['website','Web site to visit','↗',''],
    ['idea','Idea','💡',''],
    ['password','Password','▢',''],
    ['critical','Critical','!','critical'],
    ['project-a','Project A','■','project-a'],
    ['project-b','Project B','■','project-b'],
    ['movie','Movie to see','▤',''],
    ['book','Book to read','▥','']
  ];

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
        return `<select class="ribbon-select" data-action="dictation-language" title="Dictation language"><option value="EN">EN</option><option value="DE">DE</option></select>`;
      }
      if (type === 'color') {
        const title = action === 'foreColor' ? 'Font color' : 'Highlight color';
        const swatch = action === 'foreColor' ? '#5b4cc4' : '#fff2a8';
        return `<div class="ribbon-dropdown-wrap"><button type="button" class="ribbon-tool ribbon-dropdown-trigger" data-dropdown="${action}" title="${title}"><span class="big">${icon}</span><span>${label}</span><span class="color-swatch" style="background:${swatch}"></span><span class="dropdown-arrow">▾</span></button><div class="ribbon-color-menu" data-menu="${action}" hidden>${colorPalettes[action].map(([color,name]) => `<button type="button" class="color-choice" data-color-action="${action}" data-color="${color}" title="${name}"><span style="background:${color}"></span></button>`).join('')}</div></div>`;
      }
      if (type === 'tags') {
        const menu = tagDefinitions.map(([id,name,ico,cls]) => `<button type="button" class="tag-menu-item ${cls}" data-tag-id="${id}"><span class="tag-menu-icon">${ico}</span><span>${name}</span><kbd>${id==='todo'?'Ctrl+1':id==='important'?'Ctrl+2':id==='question'?'Ctrl+3':id==='remember'?'Ctrl+4':id==='definition'?'Ctrl+5':id==='highlight'?'Ctrl+6':id==='contact'?'Ctrl+7':id==='address'?'Ctrl+8':id==='phone'?'Ctrl+9':''}</kbd></button>`).join('');
        return `<div class="ribbon-dropdown-wrap tags-dropdown-wrap"><button type="button" class="ribbon-tool ribbon-dropdown-trigger" data-dropdown="tags" title="Tags"><span class="big">☑</span><span>Tags</span><span class="dropdown-arrow">▾</span></button><div class="ribbon-tag-menu" data-menu="tags" hidden><div class="tag-menu-scroll">${menu}</div><button type="button" class="tag-menu-item customize" data-tag-id="customize"><span class="tag-menu-icon">⚙</span><span>Customize Tags...</span></button><button type="button" class="tag-menu-item remove-tag" data-tag-id="remove"><span class="tag-menu-icon">⌫</span><span>Remove Tag</span></button></div></div>`;
      }
      return `<button type="button" class="ribbon-tool" data-action="${action}" title="${label}"><span class="big">${icon}</span><span>${label}</span></button>`;
    }).join('')}</div>`).join('');
    refreshToolbarState();
  }

  function refreshToolbarState() {
    document.querySelectorAll('.ribbon-tool[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      if (!toggleActions.has(action)) return;
      let active = false;
      try { active = !!document.queryCommandState(action); } catch (_) {}
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function closeColorMenus() {
    document.querySelectorAll('.ribbon-color-menu,.ribbon-tag-menu').forEach(menu => { menu.hidden = true; });
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
    refreshToolbarState();
  }

  function insertTable() {
    const rows = Math.max(1, Number(prompt('Rows?', '3')) || 3);
    const cols = Math.max(1, Number(prompt('Columns?', '3')) || 3);
    let html = '<table><tbody>';
    for (let r=0;r<rows;r++){html += '<tr>'; for(let c=0;c<cols;c++) html += '<td>&nbsp;</td>'; html += '</tr>';}
    html += '</tbody></table><p></p>';
    insertHtml(html);
  }

  function closestTag(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    while (el && el.id !== 'editor') {
      if (el.dataset?.tag) return el;
      el = el.parentElement;
    }
    return null;
  }

  function removeTagFromElement(el) {
    if (!el) return false;
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
    scheduleSave();
    updateWordCount();
    return true;
  }

  function applyTag(tagId) {
    const editor = $('editor');
    if (!editor) return;
    editor.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const existing = closestTag(sel.anchorNode);
    if (existing && existing.dataset.tag === tagId && (!sel.toString() || existing.contains(sel.focusNode))) {
      removeTagFromElement(existing);
      return;
    }
    if (range.collapsed) {
      const def = tagDefinitions.find(x => x[0] === tagId) || [tagId, tagId, '✓', ''];
      const chip = `<span class="tag-chip tagged-text ${escapeHtml(def[3])}" data-tag="${escapeHtml(tagId)}" title="Click to remove tag">${escapeHtml(def[2])} ${escapeHtml(def[1])}</span>&nbsp;`;
      insertHtml(chip);
      return;
    }
    const fragment = range.extractContents();
    const wrapper = document.createElement('span');
    const def = tagDefinitions.find(x => x[0] === tagId) || [tagId, tagId, '✓', ''];
    wrapper.className = `tagged-text ${def[3] || ''}`.trim();
    wrapper.dataset.tag = tagId;
    wrapper.title = 'Click to remove tag';
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    sel.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(wrapper);
    sel.addRange(after);
    rememberSelection();
    scheduleSave();
    updateWordCount();
  }

  function handleTagMenu(id) {
    closeColorMenus();
    if (id === 'remove') {
      const editor = $('editor');
      const sel = window.getSelection();
      const tag = sel?.rangeCount ? closestTag(sel.anchorNode) : null;
      if (tag) removeTagFromElement(tag);
      else notify('Select a tagged item first.');
      return;
    }
    if (id === 'customize') { notify('Tag customization will be available in a later update.'); return; }
    applyTag(id);
  }

  function handleAction(action) {
    if (action === 'paste') { navigator.clipboard?.readText?.().then(t => insertHtml(escapeHtml(t).replace(/\n/g,'<br>'))).catch(()=>notify('Paste is blocked by the browser. Use ⌘V / Ctrl+V in the editor.')); return; }
    if (['undo','redo','bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','outdent','indent','justifyLeft','justifyCenter','justifyRight','justifyFull','removeFormat','superscript','subscript'].includes(action)) return exec(action);
    if (action === 'hilite') return exec('hiliteColor', '#fff2a8');
    if (action === 'foreColor') return exec('foreColor', '#5b4cc4');
    if (action === 'todo') return applyTag('todo');
    if (action.startsWith('tag-')) return applyTag(action.replace('tag-',''));
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
    $('editor')?.addEventListener('click', e => { const tag=e.target.closest('[data-tag]'); if(tag && tag.closest('#editor')) { removeTagFromElement(tag); e.preventDefault(); } });
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
      if(tab){ activeTab=tab.dataset.tab; document.querySelectorAll('.editor-tabs [data-tab]').forEach(x=>x.classList.toggle('selected',x===tab)); closeColorMenus(); buildRibbon(); return; }

      const colorChoice=e.target.closest('[data-color-action]');
      if(colorChoice){
        const action=colorChoice.dataset.colorAction;
        const color=colorChoice.dataset.color;
        closeColorMenus();
        if(action==='foreColor') exec('foreColor', color);
        if(action==='hilite') exec('hiliteColor', color === 'transparent' ? 'transparent' : color);
        return;
      }

      const tagChoice = e.target.closest('[data-tag-id]');
      if (tagChoice) { handleTagMenu(tagChoice.dataset.tagId); return; }

      const dropdown=e.target.closest('[data-dropdown]');
      if(dropdown){
        const action=dropdown.dataset.dropdown;
        const menu=document.querySelector(`[data-menu="${action}"]`);
        const wasOpen=menu && !menu.hidden;
        closeColorMenus();
        if(menu && !wasOpen){
          menu.hidden=false;
          const rect=dropdown.getBoundingClientRect();
          menu.style.left=`${Math.max(4, Math.min(window.innerWidth-210, rect.left))}px`;
          menu.style.top=`${rect.bottom+4}px`;
        }
        return;
      }

      if(!e.target.closest('.ribbon-color-menu,.ribbon-tag-menu')) closeColorMenus();
      const tool=e.target.closest('[data-action]');
      if(tool && tool.tagName==='BUTTON') handleAction(tool.dataset.action);
    });
    $('editorApp')?.addEventListener('change', e => { const s=e.target.closest('select[data-action]'); if(s) handleSelect(s.dataset.action,s.value); });
    $('notesImageInput')?.addEventListener('change', e=>handleFiles(e.target,'picture'));
    $('notesFileInput')?.addEventListener('change', e=>handleFiles(e.target,'file'));
    $('notesAudioInput')?.addEventListener('change', e=>handleFiles(e.target,'audio'));
    $('notesVideoInput')?.addEventListener('change', e=>handleFiles(e.target,'video'));
    $('zoomOut')?.addEventListener('click',()=>{zoom=Math.max(60,zoom-10); applyZoom();});
    $('zoomIn')?.addEventListener('click',()=>{zoom=Math.min(180,zoom+10); applyZoom();});
    document.addEventListener('selectionchange', () => { rememberSelection(); refreshToolbarState(); });
    document.addEventListener('click', e => { if(!e.target.closest('.ribbon-dropdown-wrap')) closeColorMenus(); });
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
