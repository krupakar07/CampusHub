(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE = 'campushub-notes-v2';
  const LEGACY_STORE = 'campushub-notes-v1';
  const defaultSubjects = [
    ['Academic Research & Writing', 'purple'],
    ['International Management', 'blue'],
    ['Finance', 'green'],
    ['German', 'orange']
  ];

  let activeSubject = defaultSubjects[0][0];
  let activeTopic = 'General';
  let activePage = 'Lecture Notes';
  let activeTab = 'Home';
  let zoom = 100;
  let bound = false;
  let saveTimer = null;
  let savedRange = null;
  let selectionInsideEditor = false;
  let dictation = null;
  // Structural undo fallback for editor operations (notably table insertion).
  // Native contenteditable undo is preferred; this snapshot is used only when
  // the browser reports no usable undo transaction.
  let structuralUndo = null;
  let structuralRedo = null;

  const homeTools = [
    {group:'Clipboard', tools:[['Paste','📋','paste'],['Undo','↶','undo'],['Redo','↷','redo']]},
    {group:'Font', tools:[
      ['Font','Aa','fontName','select'],['Size','14','fontSize','select'],['Bold','B','bold'],['Italic','I','italic'],['Underline','U','underline'],['Strike','S','strikeThrough'],
      ['Highlight','▰','hilite','color'],['Font color','A','foreColor','color']
    ]},
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

  const toggleActions = new Set([
    'bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','superscript','subscript',
    'justifyLeft','justifyCenter','justifyRight','justifyFull'
  ]);

  const tagDefinitions = [
    ['todo','To Do','✓',''],['important','Important','★',''],['question','Question','?',''],['remember','Remember for later','!','remember'],
    ['definition','Definition','▣','definition'],['highlight','Highlight','✎','highlight'],['contact','Contact','♙',''],['address','Address','⌂',''],
    ['phone','Phone number','☎',''],['website','Web site to visit','↗',''],['idea','Idea','💡',''],['password','Password','▢',''],['critical','Critical','!','critical'],
    ['project-a','Project A','■','project-a'],['project-b','Project B','■','project-b'],['movie','Movie to see','▤',''],['book','Book to read','▥','']
  ];

  const tagShortcuts = {'todo':'Ctrl+1','important':'Ctrl+2','question':'Ctrl+3','remember':'Ctrl+4','definition':'Ctrl+5','highlight':'Ctrl+6','contact':'Ctrl+7','address':'Ctrl+8'};

  function getUserKey() {
    const user = window.CampusHubAuth?.user;
    return `${STORE}:${user?.id || 'local'}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function defaultContent(subject) {
    return `<h1>${escapeHtml(subject)}</h1><p>Start typing your lecture notes here. Everything saves automatically on this device.</p><p><strong>Tip:</strong> Use <strong>Home</strong> for formatting and <strong>Insert</strong> for tables, pictures, files, links and more.</p>`;
  }

  function normalizeData(data) {
    data ||= {subjects:{}};
    data.subjects ||= {};
    Object.entries(data.subjects).forEach(([name, subject]) => {
      if (!subject || typeof subject !== 'object') subject = data.subjects[name] = {};
      // Migrate the v22 Subject -> Pages model into Subject -> Topics -> Pages.
      if (!subject.topics) {
        const oldPages = subject.pages && typeof subject.pages === 'object' ? subject.pages : {};
        const topicName = 'General';
        subject.topics = {[topicName]: {pages: Object.keys(oldPages).length ? oldPages : {'Lecture Notes':defaultContent(name)}}};
        delete subject.pages;
      }
      Object.values(subject.topics).forEach(topic => {
        topic ||= {};
        topic.pages ||= {};
      });
      if (!Object.keys(subject.topics).length) subject.topics = {General:{pages:{'Lecture Notes':defaultContent(name)}}};
    });
    return data;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(getUserKey());
      if (raw) return normalizeData(JSON.parse(raw));
      const legacyKey = getUserKey().replace(STORE, LEGACY_STORE);
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) { const migrated = normalizeData(JSON.parse(legacy)); localStorage.setItem(getUserKey(), JSON.stringify(migrated)); return migrated; }
    } catch (_) {}
    const subjects = {};
    defaultSubjects.forEach(([name]) => { subjects[name] = {topics:{'Getting Started':{pages:{'Lecture Notes':defaultContent(name)}}}}; });
    return {subjects};
  }

  function saveData(data) {
    try { localStorage.setItem(getUserKey(), JSON.stringify(data)); } catch (_) {}
    const state = $('saveState');
    if (state) state.textContent = 'Saved locally';
  }

  function getData() { return loadData(); }

  function currentTopics(data) {
    normalizeData(data);
    data.subjects[activeSubject] ||= {topics:{}};
    data.subjects[activeSubject].topics ||= {};
    if (!Object.keys(data.subjects[activeSubject].topics).length) data.subjects[activeSubject].topics = {'Getting Started':{pages:{'Lecture Notes':defaultContent(activeSubject)}}};
    if (!data.subjects[activeSubject].topics[activeTopic]) activeTopic = Object.keys(data.subjects[activeSubject].topics)[0];
    return data.subjects[activeSubject].topics;
  }

  function currentPages(data) {
    const topics=currentTopics(data);
    topics[activeTopic] ||= {pages:{}};
    topics[activeTopic].pages ||= {};
    if (!Object.keys(topics[activeTopic].pages).length) topics[activeTopic].pages['Lecture Notes'] = defaultContent(activeSubject);
    return topics[activeTopic].pages;
  }

  function renderSubjects() {
    const wrap = $('notesSubjectList'); if (!wrap) return;
    const data = getData();
    const names = Object.keys(data.subjects || {});
    wrap.innerHTML = names.map((name,i) => {
      const color = defaultSubjects.find(x=>x[0]===name)?.[1] || ['purple','blue','green','orange'][i%4];
      return `<div class="notes-list-row ${name===activeSubject?'active':''}">` +
        `<button type="button" class="notes-subject ${name===activeSubject?'active':''}" data-subject="${escapeHtml(name)}"><span class="notes-dot ${color}"></span><span class="notes-list-label">${escapeHtml(name)}</span><span class="notes-subject-open" aria-hidden="true">›</span></button>` +
        `<button type="button" class="notes-delete-item" data-delete-subject="${escapeHtml(name)}" aria-label="Delete subject ${escapeHtml(name)}" title="Delete subject">×</button>` +
      `</div>`;
    }).join('');
  }

  function renderPages() {
    const wrap = $('notesPageList'); if (!wrap) return;
    const data=getData(), topics=currentTopics(data);
    const topicNames=Object.keys(topics);
    if(!topicNames.includes(activeTopic)) activeTopic=topicNames[0]||'General';
    const topicHtml=topicNames.map(topicName=>{
      const pages=topics[topicName]?.pages||{};
      const open=topicName===activeTopic;
      const pagesHtml=open?Object.keys(pages).map(p=>`<div class="notes-tree-page ${p===activePage?'active':''}"><button type="button" class="notes-page-link" data-note-page="${escapeHtml(p)}">📄 <span class="notes-list-label">${escapeHtml(p)}</span></button><button type="button" class="notes-delete-item" data-delete-page="${escapeHtml(p)}" aria-label="Delete page ${escapeHtml(p)}" title="Delete page">×</button></div>`).join(''):'';
      return `<div class="notes-tree-topic ${open?'open':''}"><button type="button" class="notes-topic-toggle" data-topic="${escapeHtml(topicName)}"><span class="notes-topic-chevron">${open?'▾':'▸'}</span><span>📂</span><span class="notes-list-label">${escapeHtml(topicName)}</span><small>${Object.keys(pages).length}</small></button>${pagesHtml}</div>`;
    }).join('');
    wrap.innerHTML=topicHtml;
  }

  function restoreEditor() {
    const editor = $('editor'); if (!editor) return;
    const pages = currentPages(getData());
    editor.innerHTML = pages[activePage] || defaultContent(activeSubject);
    const title = $('noteTitle');
    if (title) title.value = activePage === 'Lecture Notes' ? `${activeSubject} — Lecture Notes` : activePage;
    const crumb = $('notesBreadcrumb');
    if (crumb) crumb.innerHTML = `<span>${escapeHtml(activeSubject)}</span><b>›</b><span>${escapeHtml(activeTopic)}</span><b>›</b><strong>${escapeHtml(activePage)}</strong>`;
    savedRange = null;
    updateWordCount();
    refreshToolbarState();
  }

  function isRangeInsideEditor(range) {
    const editor = $('editor');
    return !!(editor && range && editor.contains(range.commonAncestorContainer));
  }

  function captureSelection() {
    const editor = $('editor');
    const sel = window.getSelection();
    if (!editor || !sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!isRangeInsideEditor(range)) return false;
    savedRange = range.cloneRange();
    selectionInsideEditor = true;
    return true;
  }

  function restoreSelection() {
    const editor = $('editor');
    if (!editor) return false;
    if (!savedRange || !isRangeInsideEditor(savedRange)) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange.cloneRange());
    selectionInsideEditor = true;
    return true;
  }

  function focusEditor() {
    $('editor')?.focus({preventScroll:true});
    restoreSelection();
  }

  function fallbackInlineToggle(command) {
    const editor = $('editor');
    const sel = window.getSelection();
    if (!editor || !sel || !sel.rangeCount || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!isRangeInsideEditor(range)) return false;

    const tagMap = {bold:'strong', italic:'em', underline:'u', strikeThrough:'s', superscript:'sup', subscript:'sub'};
    const tagName = tagMap[command];
    if (!tagName) return false;

    const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      try { if (range.intersectsNode(node)) textNodes.push(node); } catch (_) {}
    }
    if (!textNodes.length) return false;

    const fullyTagged = textNodes.every(n => {
      let el = n.parentElement;
      while (el && el !== editor) {
        if (el.tagName.toLowerCase() === tagName) return true;
        el = el.parentElement;
      }
      return false;
    });

    if (fullyTagged) {
      // Remove the matching inline element while preserving its children.
      const elements = [];
      textNodes.forEach(n => {
        let el = n.parentElement;
        while (el && el !== editor) {
          if (el.tagName.toLowerCase() === tagName) { if (!elements.includes(el)) elements.push(el); break; }
          el = el.parentElement;
        }
      });
      elements.forEach(el => unwrap(el));
    } else {
      const wrapper = document.createElement(tagName);
      const fragment = range.extractContents();
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
      range.selectNodeContents(wrapper);
    }
    sel.removeAllRanges(); sel.addRange(range);
    return true;
  }

  function exec(command, value = null) {
    const editor = $('editor'); if (!editor) return false;

    // Toolbar buttons steal focus from contenteditable. Keyboard shortcuts do not,
    // which is why shortcuts can work while ribbon toggles appear dead. Keep the
    // exact selection, return focus to the editor, restore the selection again,
    // then execute the command while the editing host is actually focused.
    if (!savedRange || !isRangeInsideEditor(savedRange)) captureSelection();
    if (!savedRange || !isRangeInsideEditor(savedRange)) return false;

    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.cloneRange());

      // Strike-through is inconsistent across Chromium/WebKit: execCommand can
      // report success while leaving an existing <strike> selection unchanged.
      // Use the deterministic DOM toggle for a real text selection.
      if (command === 'strikeThrough' && !sel.isCollapsed) {
        const ok = fallbackInlineToggle(command);
        captureSelection();
        scheduleSave();
        updateWordCount();
        requestAnimationFrame(() => refreshToolbarState(false));
        return ok;
      }

      // Focus the editing host only after the range has been saved. Some browsers
      // collapse selection on focus, so restore it one more time immediately after.
      editor.focus({preventScroll:true});
      sel.removeAllRanges();
      sel.addRange(savedRange.cloneRange());

      document.execCommand('styleWithCSS', false, false);
      let ok = document.execCommand(command, false, value);
      if (!ok) ok = fallbackInlineToggle(command);

      // Save the new caret/selection produced by the browser.
      captureSelection();
      scheduleSave();
      updateWordCount();

      // Updating toolbar state must happen after the command, but must never
      // steal the editor selection while the command is being executed.
      requestAnimationFrame(() => refreshToolbarState(false));
      return ok;
    } catch (_) {
      return false;
    }
  }

  function refreshToolbarState(refocus = true) {
    const editor = $('editor');
    if (!editor) return;
    const stateButtons = document.querySelectorAll('.editor-ribbon .ribbon-tool[data-action]');
    stateButtons.forEach(btn => {
      const action = btn.dataset.action;
      if (!toggleActions.has(action)) return;
      let active = false;
      try {
        // queryCommandState reads the current selection. Never focus the editor
        // here unless explicitly requested by the caller.
        active = document.queryCommandState(action);
      } catch (_) {}
      btn.classList.toggle('active', !!active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function closeMenus() {
    document.querySelectorAll('.ribbon-color-menu,.ribbon-tag-menu,.table-picker,.symbol-menu').forEach(m => m.hidden = true);
  }

  function positionMenu(menu, anchor, width = 220) {
    const rect = anchor.getBoundingClientRect();
    menu.hidden = false;
    menu.style.display = 'block';
    const measuredWidth = Math.max(width, menu.offsetWidth || width);
    const measuredHeight = menu.offsetHeight || 320;
    const left = Math.max(6, Math.min(window.innerWidth - measuredWidth - 6, rect.left));
    const below = rect.bottom + 4;
    const above = rect.top - measuredHeight - 4;
    const top = (below + measuredHeight <= window.innerHeight - 6 || above < 6)
      ? Math.max(6, below)
      : above;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function buildColorMenu(action) {
    return `<div class="ribbon-dropdown-wrap"><button type="button" class="ribbon-tool ribbon-dropdown-trigger" data-dropdown="${action}" title="${action==='foreColor'?'Font color':'Highlight color'}" aria-haspopup="menu"><span class="big">${action==='foreColor'?'A':'▰'}</span><span>${action==='foreColor'?'Font color':'Highlight'}</span><span class="color-swatch" style="background:${action==='foreColor'?'#5b4cc4':'#fff2a8'}"></span><span class="dropdown-arrow">▾</span></button><div class="ribbon-color-menu" data-menu="${action}" hidden>${colorPalettes[action].map(([color,name])=>`<button type="button" class="color-choice" data-color-action="${action}" data-color="${color}" title="${escapeHtml(name)}"><span style="background:${color==='transparent'?'linear-gradient(135deg,#fff 45%,#e03131 46%,#e03131 54%,#fff 55%)':color}"></span></button>`).join('')}</div></div>`;
  }

  function buildTagMenu() {
    const items = tagDefinitions.map(([id,label,icon,cls]) => `<button type="button" class="tag-menu-item ${cls}" data-tag-id="${id}"><span class="tag-menu-icon">${icon}</span><span>${escapeHtml(label)}</span><kbd>${tagShortcuts[id]||''}</kbd></button>`).join('');
    return `<div class="ribbon-dropdown-wrap"><button type="button" class="ribbon-tool ribbon-dropdown-trigger" data-dropdown="tags" title="Tags" aria-haspopup="menu"><span class="big">✓</span><span>Tags</span><span class="dropdown-arrow">▾</span></button><div class="ribbon-tag-menu" data-menu="tags" hidden><div class="tag-menu-scroll">${items}<button type="button" class="tag-menu-item customize" data-tag-id="customize"><span class="tag-menu-icon">⚙</span><span>Customize Tags...</span><kbd></kbd></button><button type="button" class="tag-menu-item remove-tag" data-tag-id="remove"><span class="tag-menu-icon">⌫</span><span>Remove Tag</span><kbd></kbd></button></div></div></div>`;
  }

  function buildRibbon() {
    const ribbon = $('ribbon'); if (!ribbon) return;
    const groups = activeTab === 'Home' ? homeTools : insertTools;
    ribbon.innerHTML = groups.map(group => `<div class="ribbon-group"><div class="group-label">${group.group}</div>${group.tools.map(([label,icon,action,type]) => {
      if (type === 'select') {
        if (action==='fontName') return `<label class="ribbon-select-wrap"><span class="sr-only">Font</span><select class="ribbon-select" data-action="fontName" title="Font"><option value="Arial">Arial</option><option value="Calibri">Calibri</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option><option value="Courier New">Courier New</option></select></label>`;
        if (action==='fontSize') return `<label class="ribbon-select-wrap"><span class="sr-only">Font size</span><select class="ribbon-select" data-action="fontSize" title="Font size"><option value="1">8</option><option value="2">10</option><option value="3" selected>14</option><option value="4">18</option><option value="5">24</option><option value="6">32</option><option value="7">48</option><option value="8">64</option></select></label>`;
        if (action==='formatBlock') return `<label class="ribbon-select-wrap"><span class="sr-only">Style</span><select class="ribbon-select style-select" data-action="formatBlock" title="Styles"><option value="p">Normal</option><option value="h1">Title</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="h4">Heading 3</option><option value="blockquote">Quote</option><option value="pre">Code</option></select></label>`;
        return `<label class="ribbon-select-wrap"><span class="sr-only">Dictation language</span><select class="ribbon-select" data-action="dictation-language" title="Dictation language"><option value="EN">EN</option><option value="DE">DE</option></select></label>`;
      }
      if (type==='color') return buildColorMenu(action);
      if (type==='tags') return buildTagMenu();
      return `<button type="button" class="ribbon-tool" data-action="${action}" title="${escapeHtml(label)}" aria-pressed="false"><span class="big">${icon}</span><span>${escapeHtml(label)}</span></button>`;
    }).join('')}</div>`).join('');

    const tableButton = ribbon.querySelector('button[data-action="table"]');
    if (tableButton) {
      tableButton.setAttribute('aria-haspopup', 'dialog');
      tableButton.setAttribute('aria-expanded', 'false');
      // Table is deliberately handled through a native dialog, completely outside
      // the ribbon's delegated event system.
      tableButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        captureSelection();
        window.__campusOpenTableDialog?.(tableButton);
      };
      tableButton.onpointerdown = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        captureSelection();
      };
    }
    refreshToolbarState();
  }

  function setupTableDialog() {
    const dialog = $('campusTableDialog');
    if (!dialog || dialog.dataset.ready === 'true') return;
    dialog.dataset.ready = 'true';
    const grid = dialog.querySelector('.campus-table-grid');
    const label = dialog.querySelector('.campus-table-size');
    let hoverRows = 1, hoverCols = 1;
    const paint = (rows, cols) => {
      hoverRows = rows; hoverCols = cols;
      label.textContent = `${rows} × ${cols}`;
      grid.querySelectorAll('.campus-table-cell').forEach(cell => {
        const r=+cell.dataset.r, c=+cell.dataset.c;
        cell.classList.toggle('active', r<=rows && c<=cols);
      });
    };
    grid.addEventListener('mouseover', e => {
      const cell=e.target.closest('.campus-table-cell');
      if(cell) paint(+cell.dataset.r,+cell.dataset.c);
    });
    grid.addEventListener('click', e => {
      const cell=e.target.closest('.campus-table-cell');
      if(!cell) return;
      e.preventDefault();
      e.stopPropagation();
      captureSelection();
      insertTable(+cell.dataset.r,+cell.dataset.c);
      dialog.close();
      const button=document.querySelector('button[data-action="table"]');
      if(button) button.setAttribute('aria-expanded','false');
    });
    dialog.querySelector('[data-table-cancel]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      const button=document.querySelector('button[data-action="table"]');
      if(button) button.setAttribute('aria-expanded','false');
      paint(1,1);
    });
    window.__campusOpenTableDialog = (anchor) => {
      captureSelection();
      paint(1,1);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.setAttribute('open',''); dialog.style.display='block'; }
      anchor?.setAttribute('aria-expanded','true');
    };
  }

  // Insert HTML at the saved editor selection. This is shared by Insert tools
  // (including tables) and must remain present after the table-dialog refactor.
  function insertHtml(html) {
    const editor = $('editor'); if (!editor) return false;
    if (!savedRange || !isRangeInsideEditor(savedRange)) captureSelection();
    if (!savedRange || !isRangeInsideEditor(savedRange)) {
      editor.focus({preventScroll:true});
      const range=document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel=window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      savedRange=range.cloneRange();
    }
    try {
      const sel=window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.cloneRange());
      editor.focus({preventScroll:true});
      sel.removeAllRanges();
      sel.addRange(savedRange.cloneRange());
      let ok=document.execCommand('insertHTML', false, html);
      if (!ok) {
        const range=sel.getRangeAt(0);
        const temp=document.createElement('div');
        temp.innerHTML=html;
        const frag=document.createDocumentFragment();
        while(temp.firstChild) frag.appendChild(temp.firstChild);
        range.deleteContents();
        range.insertNode(frag);
        range.collapse(false);
        sel.removeAllRanges(); sel.addRange(range);
      }
      captureSelection();
      scheduleSave(); updateWordCount();
      requestAnimationFrame(()=>refreshToolbarState(false));
      return true;
    } catch (_) { return false; }
  }

  function insertTable(rows, cols) {
    const editor = $('editor');
    if (!editor) return false;
    rows=Math.max(1,rows||3); cols=Math.max(1,cols||3);

    // Keep a pre-insertion snapshot as a safety net. Most browsers place
    // insertHTML into the native undo stack, but WebKit/Chromium can lose that
    // transaction when focus has moved through a modal dialog.
    const beforeHtml = editor.innerHTML;
    let html='<table><tbody>';
    for(let r=0;r<rows;r++){html+='<tr>';for(let c=0;c<cols;c++)html+='<td>&nbsp;</td>';html+='</tr>';}
    html+='</tbody></table><p></p>';
    const ok = insertHtml(html);
    if (ok) {
      structuralUndo = {beforeHtml, afterHtml: editor.innerHTML};
      structuralRedo = null;
    }
    return ok;
  }

  function restoreEditorHtml(html) {
    const editor = $('editor');
    if (!editor) return false;
    editor.innerHTML = html || '<p><br></p>';
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
    scheduleSave();
    updateWordCount();
    requestAnimationFrame(() => refreshToolbarState(false));
    return true;
  }

  function closestTag(node) {
    let el = node && (node.nodeType===1 ? node : node.parentElement);
    while(el && el.id!=='editor'){ if(el.dataset?.tag) return el; el=el.parentElement; }
    return null;
  }

  function unwrap(el) {
    const parent=el?.parentNode; if(!parent) return;
    while(el.firstChild) parent.insertBefore(el.firstChild,el);
    el.remove();
  }

  function removeTagFromElement(el) { unwrap(el); scheduleSave(); updateWordCount(); refreshToolbarState(); }

  function applyTag(tagId) {
    const editor=$('editor'); if(!editor) return;
    focusEditor();
    const sel=window.getSelection(); if(!sel?.rangeCount) return;
    const range=sel.getRangeAt(0);
    const existing=closestTag(sel.anchorNode);
    if(existing && existing.dataset.tag===tagId && (!sel.toString() || existing.contains(sel.focusNode))){ removeTagFromElement(existing); return; }
    const def=tagDefinitions.find(x=>x[0]===tagId)||[tagId,tagId,'✓',''];
    if(range.collapsed){ insertHtml(`<span class="tag-chip tagged-text ${escapeHtml(def[3])}" data-tag="${escapeHtml(tagId)}" title="Click to remove tag">${escapeHtml(def[2])} ${escapeHtml(def[1])}</span>&nbsp;`); return; }
    const fragment=range.extractContents();
    const wrapper=document.createElement('span');
    wrapper.className=`tagged-text ${def[3]||''}`.trim(); wrapper.dataset.tag=tagId; wrapper.title='Click to remove tag'; wrapper.appendChild(fragment); range.insertNode(wrapper);
    const newRange=document.createRange(); newRange.selectNodeContents(wrapper); sel.removeAllRanges(); sel.addRange(newRange); captureSelection(); scheduleSave(); updateWordCount();
  }

  function handleAction(action) {
    if (action === 'undo') {
      const editor = $('editor');
      if (!editor) return false;
      const before = editor.innerHTML;
      try {
        focusEditor();
        const nativeResult = document.execCommand('undo', false, null);
        const changed = editor.innerHTML !== before;
        if (nativeResult && changed) {
          structuralUndo = null;
          structuralRedo = null;
          captureSelection();
          scheduleSave(); updateWordCount();
          return true;
        }
      } catch (_) {}
      if (structuralUndo) {
        const current = editor.innerHTML;
        structuralRedo = {beforeHtml: structuralUndo.beforeHtml, afterHtml: current};
        const ok = restoreEditorHtml(structuralUndo.beforeHtml);
        structuralUndo = null;
        return ok;
      }
      return false;
    }
    if (action === 'redo') {
      const editor = $('editor');
      if (!editor) return false;
      try {
        focusEditor();
        const nativeResult = document.execCommand('redo', false, null);
        if (nativeResult) {
          structuralRedo = null;
          structuralUndo = null;
          captureSelection();
          scheduleSave(); updateWordCount();
          return true;
        }
      } catch (_) {}
      if (structuralRedo) {
        const ok = restoreEditorHtml(structuralRedo.afterHtml);
        structuralUndo = {beforeHtml: structuralRedo.beforeHtml, afterHtml: structuralRedo.afterHtml};
        structuralRedo = null;
        return ok;
      }
      return false;
    }
    if(['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','outdent','indent','justifyLeft','justifyCenter','justifyRight','justifyFull','removeFormat','superscript','subscript'].includes(action)) return exec(action);
    if(action==='paste'){ navigator.clipboard?.readText?.().then(t=>insertHtml(escapeHtml(t).replace(/\n/g,'<br>'))).catch(()=>notify('Use ⌘V / Ctrl+V to paste into the editor.')); return; }
    if(action==='hilite') return exec('hiliteColor','#fff59d');
    if(action==='foreColor') return exec('foreColor','#5b4cc4');
    if(action==='todo') return applyTag('todo');
    if(action==='dictate') return dictate();
    if(action==='pagebreak') return insertHtml('<div class="page-break" style="page-break-after:always;border-top:1px dashed #bbb;margin:24px 0"></div>');
    if(action==='date') return insertHtml(`<span>${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date())}</span>&nbsp;`);
    if(action==='datetime') return insertHtml(`<span>${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date())}</span>&nbsp;`);
    if(action==='picture') return $('notesImageInput')?.click();
    if(action==='file') return $('notesFileInput')?.click();
    if(action==='audio') return $('notesAudioInput')?.click();
    if(action==='video') return $('notesVideoInput')?.click();
    if(action==='link'){ const url=prompt('Enter URL:','https://'); if(url) exec('createLink',url); return; }
    if(action==='symbol') return openSymbolMenu(document.querySelector('[data-action="symbol"]'));
    if(action==='emoji') return insertHtml('😊 👍 🎓 📚 ⭐ ✅ ❗ 💡 ');
    if(action==='hr') return insertHtml('<hr><p></p>');
    if(action==='equation'){ const eq=prompt('Enter equation:','E = mc²'); if(eq) insertHtml(`<span class="equation">${escapeHtml(eq)}</span>&nbsp;`); return; }
    if(action==='quote') return insertHtml('<blockquote>Quote</blockquote><p></p>');
    if(action==='code') return insertHtml('<pre>Code</pre><p></p>');
    if(action==='sticker') return insertHtml('<span class="tag-chip">⭐ Sticker</span>&nbsp;');
    if(action==='table') return window.__campusOpenTableDialog?.(document.querySelector('button[data-action="table"]'));
    if(action==='fullscreen') return $('editorApp')?.requestFullscreen?.();
  }

  function openSymbolMenu(anchor){
    closeMenus();
    let menu=document.querySelector('.symbol-menu');
    if(!menu){
      menu=document.createElement('div'); menu.className='symbol-menu'; menu.hidden=true;
      const symbols=['Ω','α','β','γ','π','∑','√','≈','≤','≥','→','⇒','∞','≠','±','×','÷','µ','Δ','λ','θ','€','£','¥','§','©','®','™','°','•','…','✓','✗','★','→','←','↑','↓'];
      menu.innerHTML=symbols.map(s=>`<button type="button" data-symbol="${s}">${s}</button>`).join('');
      document.body.appendChild(menu);
      menu.addEventListener('click',e=>{const b=e.target.closest('[data-symbol]');if(b){insertHtml(escapeHtml(b.dataset.symbol)+'&nbsp;');menu.hidden=true;}});
    }
    positionMenu(menu,anchor,285);
  }

  function dictate(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){notify('Speech-to-text is not supported here. Try Chrome.');return;}
    if(dictation){dictation.stop();dictation=null;notify('Dictation stopped.');return;}
    const r=new SR(); const lang=document.querySelector('[data-action="dictation-language"]')?.value==='DE'?'de-DE':'en-US';
    r.lang=lang;r.interimResults=false;r.continuous=true;
    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)insertHtml(escapeHtml(e.results[i][0].transcript)+' ');}};
    r.onerror=e=>{dictation=null;notify(`Dictation: ${e.error}`);};
    r.onend=()=>{dictation=null;document.querySelector('[data-action="dictate"]')?.classList.remove('active');};
    dictation=r;r.start();document.querySelector('[data-action="dictate"]')?.classList.add('active');notify(`Listening (${lang==='de-DE'?'German':'English'}). Click Dictate again to stop.`);
  }

  function handleSelect(action,value){
    if(action==='fontName') return exec('fontName',value);
    if(action==='fontSize') return exec('fontSize',value);
    if(action==='formatBlock') return exec('formatBlock',value);
  }

  function handleFiles(input,kind){
    const file=input.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      if(kind==='picture')insertHtml(`<img src="${reader.result}" alt="${escapeHtml(file.name)}"><p></p>`);
      else if(kind==='audio')insertHtml(`<p>🎵 <strong>${escapeHtml(file.name)}</strong></p><audio controls src="${reader.result}"></audio><p></p>`);
      else if(kind==='video')insertHtml(`<p>🎬 <strong>${escapeHtml(file.name)}</strong></p><video controls style="max-width:100%" src="${reader.result}"></video><p></p>`);
      else insertHtml(`<p class="file-attachment">📎 <strong>${escapeHtml(file.name)}</strong> — attached to this page.</p>`);
    };
    reader.readAsDataURL(file);input.value='';
  }

  function scheduleSave(){
    clearTimeout(saveTimer); if($('saveState'))$('saveState').textContent='Saving…';
    saveTimer=setTimeout(()=>{const data=getData();currentPages(data)[activePage]=$('editor')?.innerHTML||'';saveData(data);},350);
  }

  function updateWordCount(){const text=$('editor')?.innerText?.trim()||'';const words=text?text.split(/\s+/).length:0;if($('wordCount'))$('wordCount').textContent=`${words} words`;}

  function switchSubject(name){if(!name)return;scheduleSave();activeSubject=name;const data=getData();const topics=currentTopics(data);activeTopic=Object.keys(topics)[0]||'General';const pages=currentPages(data);activePage=Object.keys(pages)[0]||'Lecture Notes';renderSubjects();renderPages();restoreEditor();showSubjectWorkspace('overview');}
  function switchTopic(name){if(!name)return;scheduleSave();activeTopic=name;const pages=currentPages(getData());activePage=Object.keys(pages)[0]||'Lecture Notes';renderPages();showTopicWorkspace(name);}
  function switchPage(name){if(!name)return;scheduleSave();activePage=name;renderPages();restoreEditor();showNoteEditor();}

  function getSubjectCalendarEvents(){
    const key=`campus-calendar-user-${window.CampusHubAuth?.user?.id||''}`;
    let events=[];
    try{events=JSON.parse(localStorage.getItem(key)||'[]')}catch(_){events=[]}
    if(!Array.isArray(events))events=[];
    const target=activeSubject.toLowerCase();
    return events.filter(e=>{
      const hay=[e.subject,e.title,e.notes].map(v=>String(v||'').toLowerCase()).join(' ');
      return hay.includes(target);
    }).sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  }

  function subjectDate(value){
    try{return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(_){return value||''}
  }

  function showNoteEditor(){
    const workspace=$('subjectWorkspace'), editorView=$('noteEditorView');
    workspace?.classList.add('hidden');
    editorView?.classList.remove('hidden');
    $('notesSubjectOverview')?.classList.remove('active');
  }

  function showSubjectWorkspace(tab='overview'){
    const workspace=$('subjectWorkspace'), editorView=$('noteEditorView');
    if(!workspace)return;
    editorView?.classList.add('hidden');
    workspace.classList.remove('hidden');
    $('notesSubjectOverview')?.classList.add('active');
    document.querySelectorAll('[data-subject-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.subjectTab===tab));
    renderSubjectWorkspace(tab);
    workspace.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function showTopicWorkspace(topic){
    activeTopic=topic;
    const workspace=$('subjectWorkspace'), editorView=$('noteEditorView');
    if(!workspace)return;
    editorView?.classList.add('hidden');
    workspace.classList.remove('hidden');
    $('notesSubjectOverview')?.classList.remove('active');
    document.querySelectorAll('[data-subject-tab]').forEach(b=>b.classList.remove('selected'));
    renderTopicWorkspace();
    workspace.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function subjectTopicNames(){return Object.keys(currentTopics(getData()));}
  function subjectPageNames(){return Object.keys(currentPages(getData()));}

  function subjectWorkspaceCard(icon,title,value,detail,action=''){
    return `<button type="button" class="subject-stat-card" ${action?`data-workspace-action="${action}"`:''}><span class="subject-stat-icon">${icon}</span><span class="subject-stat-copy"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(title)}</span><small>${escapeHtml(detail)}</small></span><span class="subject-stat-arrow">›</span></button>`;
  }

  function renderTopicWorkspace(){
    const title=$('subjectWorkspaceTitle'),subtitle=$('subjectWorkspaceSubtitle'),content=$('subjectWorkspaceContent');
    if(title)title.innerHTML=`<span class="workspace-breadcrumb-link" data-back-subject="1">${escapeHtml(activeSubject)}</span><span class="workspace-breadcrumb-sep">›</span>${escapeHtml(activeTopic)}`;
    if(subtitle)subtitle.textContent='Pages inside this topic.';
    const pages=subjectPageNames();
    content.innerHTML=`<div class="workspace-breadcrumb"><button type="button" class="secondary-button" data-back-subject="1">← ${escapeHtml(activeSubject)}</button></div>
      <div class="subject-section-intro"><div><span class="subject-panel-kicker">TOPIC</span><h3>${escapeHtml(activeTopic)}</h3><p>${pages.length} ${pages.length===1?'page':'pages'} in this topic.</p></div><div class="subject-workspace-actions"><button type="button" class="secondary-button" id="workspaceNewTopic">＋ New topic</button><button type="button" class="primary-button" id="workspaceCreatePage">＋ New page</button></div></div>
      <div class="subject-notes-grid">${pages.map(p=>`<button type="button" class="subject-note-card" data-open-page="${escapeHtml(p)}"><span>📄</span><strong>${escapeHtml(p)}</strong><small>Open page</small></button>`).join('')||'<div class="subject-empty">No pages yet.</div>'}</div>`;
    content.querySelectorAll('[data-open-page]').forEach(b=>b.addEventListener('click',()=>{activePage=b.dataset.openPage;renderPages();restoreEditor();showNoteEditor();}));
    content.querySelectorAll('[data-back-subject]').forEach(b=>b.addEventListener('click',()=>showSubjectWorkspace('notes')));
    $('workspaceCreatePage')?.addEventListener('click',()=>addPage());
    $('workspaceNewTopic')?.addEventListener('click',()=>addTopic());
  }

  function renderSubjectWorkspace(tab='overview'){
    const title=$('subjectWorkspaceTitle'),subtitle=$('subjectWorkspaceSubtitle'),content=$('subjectWorkspaceContent');
    if(!content)return;
    if(title)title.textContent=activeSubject;
    if(subtitle)subtitle.textContent='Your notes, topics, study material, deadlines and schedule for this subject.';
    const topics=subjectTopicNames(),events=getSubjectCalendarEvents(),today=new Date();today.setHours(0,0,0,0);
    const future=events.filter(e=>new Date(`${e.date}T${e.start||'00:00'}`)>=today);
    const assignments=events.filter(e=>e.type==='assignment'||e.type==='deadline');
    const exams=events.filter(e=>e.type==='exam');
    if(tab==='overview' || tab==='notes'){
      const cards=topics.map(t=>{const count=Object.keys(currentTopics(getData())[t]?.pages||{}).length;return `<button type="button" class="subject-note-card subject-topic-card" data-open-topic="${escapeHtml(t)}"><span>📂</span><strong>${escapeHtml(t)}</strong><small>${count} ${count===1?'page':'pages'} · Open topic ›</small></button>`}).join('');
      content.innerHTML=`<div class="subject-section-intro"><div><span class="subject-panel-kicker">${tab==='notes'?'TOPICS':'SUBJECT NOTES'}</span><h3>${tab==='notes'?'Topics in '+escapeHtml(activeSubject):'Organize your notes by topic'}</h3><p>Each topic contains its own pages, so you always know exactly where you are.</p></div><div class="subject-workspace-actions"><button type="button" class="secondary-button" id="workspaceNewTopic">＋ New topic</button><button type="button" class="primary-button" id="workspaceCreatePage">＋ New page</button></div></div><div class="subject-notes-grid">${cards||'<div class="subject-empty">No topics yet. Create your first topic.</div>'}</div>`;
    } else if(tab==='overview-old') {
      content.innerHTML='';
    } else if(tab==='assignments'){
      const work=window.CampusAssignments?.getForSubject?.(activeSubject)||[];
      const calendarOnly=assignments.filter(e=>!work.some(a=>a.sourceEventId===e.id||a.title===e.title&&a.dueDate===e.date));
      content.innerHTML=`<div class="subject-section-intro"><div><span class="subject-panel-kicker">ASSIGNMENTS</span><h3>Work on ${escapeHtml(activeSubject)} assignments</h3><p>Each assignment has its own workspace for writing, research, checklist, files and submission tracking.</p></div><div class="subject-workspace-actions"><button type="button" class="secondary-button" data-workspace-action="calendar">Open calendar</button><button type="button" class="primary-button" data-create-assignment="1">＋ New assignment</button></div></div>
      <div class="assignment-subject-grid">${work.map(a=>{const st=({'not-started':['Not Started','status-not-started'],'in-progress':['In Progress','status-in-progress'],completed:['Completed','status-completed']})[a.status]||['Not Started','status-not-started'];const done=(a.tasks||[]).filter(t=>t.done).length;const total=(a.tasks||[]).length;return `<button type="button" class="assignment-subject-card" data-open-assignment="${escapeHtml(a.id)}"><div class="assignment-subject-card-top"><span class="assignment-event-badge">✓</span><em class="assignment-status ${st[1]}">${st[0]}</em></div><strong>${escapeHtml(a.title)}</strong><small>Due ${escapeHtml(subjectDate(a.dueDate))} · ${escapeHtml(a.dueTime||'23:59')}</small><div class="assignment-progress"><i style="width:${total?Math.round(done/total*100):0}%"></i></div><span class="assignment-progress-label">${done}/${total} tasks complete · Open workspace ›</span></button>`}).join('')||'<div class="subject-empty">No assignments yet. Create one to get a complete workspace for it.</div>'}</div>
      ${calendarOnly.length?`<div class="assignment-import-note"><strong>Calendar assignments</strong><span>${calendarOnly.length} assignment/deadline event${calendarOnly.length===1?'':'s'} from your calendar can be opened here and converted into a full workspace.</span><button type="button" class="secondary-button" data-import-calendar-assignment="1">Create workspaces from calendar</button></div>`:''}`;
      content.querySelector('[data-create-assignment]')?.addEventListener('click',()=>window.CampusAssignments?.create?.(activeSubject));
      content.querySelector('[data-import-calendar-assignment]')?.addEventListener('click',()=>{window.CampusAssignments?.activate?.();showSubjectWorkspace('assignments')});
      content.querySelectorAll('[data-open-assignment]').forEach(b=>b.addEventListener('click',()=>window.CampusAssignments?.openWorkspace?.(b.dataset.openAssignment)));
    } else if(tab==='exams'){
      const list=exams;
      content.innerHTML=`<div class="subject-section-intro"><div><span class="subject-panel-kicker">EXAMS</span><h3>Subject exams</h3><p>Calendar items linked to ${escapeHtml(activeSubject)} appear here automatically.</p></div><button type="button" class="secondary-button" data-workspace-action="calendar">Open calendar</button></div><div class="subject-list subject-large-list">${list.map(e=>`<div class="subject-list-item readonly"><span class="subject-event-badge">◇</span><span><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(subjectDate(e.date))} · ${escapeHtml(e.start||'')}–${escapeHtml(e.end||'')}${e.room?' · '+escapeHtml(e.room):''}</small></span></div>`).join('')||'<div class="subject-empty">No exams linked to this subject yet.</div>'}</div>`;
    } else if(tab==='calendar'){
      content.innerHTML=`<div class="subject-section-intro"><div><span class="subject-panel-kicker">CALENDAR</span><h3>${escapeHtml(activeSubject)} schedule</h3><p>Events currently associated with this subject.</p></div><button type="button" class="primary-button" data-workspace-action="calendar">Open full calendar</button></div><div class="subject-list subject-large-list">${events.map(e=>`<div class="subject-list-item readonly"><span class="subject-event-dot"></span><span><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(subjectDate(e.date))} · ${escapeHtml(e.start||'')}–${escapeHtml(e.end||'')}${e.room?' · '+escapeHtml(e.room):''}</small></span></div>`).join('')||'<div class="subject-empty">No calendar events linked to this subject.</div>'}</div>`;
    } else if(tab==='quick'){
      content.innerHTML=`<div class="subject-placeholder"><div class="subject-placeholder-icon">⚡</div><span class="subject-panel-kicker">QUICK NOTES</span><h3>Capture lecture thoughts instantly</h3><p>Quick Notes will give you a lightweight scratchpad for this subject, with autosave and a one-click conversion into a proper page.</p><button type="button" class="primary-button" data-workspace-action="notes">Open topics</button></div>`;
    } else {
      content.innerHTML=`<div class="subject-placeholder"><div class="subject-placeholder-icon">${tab==='files'?'□':'⚙'}</div><span class="subject-panel-kicker">${tab.toUpperCase()}</span><h3>${tab==='files'?'Subject files are next':'This section is being built'}</h3><p>${tab==='files'?'A dedicated area for lecture slides, PDFs, assignments and other subject material will be added next.':'The subject workspace foundation is ready.'}</p><button type="button" class="secondary-button" data-workspace-action="overview">Back to overview</button></div>`;
    }
    content.querySelectorAll('[data-open-topic]').forEach(b=>b.addEventListener('click',()=>showTopicWorkspace(b.dataset.openTopic)));
    content.querySelectorAll('[data-open-page]').forEach(b=>b.addEventListener('click',()=>{activePage=b.dataset.openPage;renderPages();restoreEditor();showNoteEditor();}));
    content.querySelectorAll('[data-workspace-action]').forEach(b=>b.addEventListener('click',()=>{const action=b.dataset.workspaceAction;if(action==='notes')showSubjectWorkspace('notes');else if(action==='calendar'){document.querySelector('[data-page="calendar"]')?.click();}else if(action==='overview')showSubjectWorkspace('overview');else if(action==='quick'||action==='assignments'||action==='exams'||action==='files')showSubjectWorkspace(action);}));
    $('workspaceCreatePage')?.addEventListener('click',()=>addPage());
    $('workspaceNewTopic')?.addEventListener('click',()=>addTopic());
  }


  function addSubject(){const name=prompt('Subject name:');if(!name?.trim())return;const clean=name.trim();const data=getData();data.subjects ||= {};if(data.subjects[clean]){notify('That subject already exists.');return;}data.subjects[clean]={topics:{'Getting Started':{pages:{'Lecture Notes':defaultContent(clean)}}}};saveData(data);activeSubject=clean;activeTopic='Getting Started';activePage='Lecture Notes';renderSubjects();renderPages();restoreEditor();showSubjectWorkspace('overview');}
  function addTopic(){const name=prompt('Topic name:');if(!name?.trim())return;const clean=name.trim();const data=getData();const topics=currentTopics(data);if(topics[clean]){notify('That topic already exists.');return;}topics[clean]={pages:{'Lecture Notes':defaultContent(activeSubject)}};saveData(data);activeTopic=clean;activePage='Lecture Notes';renderPages();restoreEditor();showTopicWorkspace(clean);notify(`Topic “${clean}” created`);}
  function addPage(){const name=prompt('Page name:','Lecture Notes');if(!name?.trim())return;const clean=name.trim();const data=getData();const pages=currentPages(data);if(pages[clean]){notify('That page already exists.');return;}pages[clean]=defaultContent(activeSubject);saveData(data);activePage=clean;renderPages();restoreEditor();showNoteEditor();}

  function deletePage(name){
    if(!name)return;
    const data=getData(), pages=currentPages(data), names=Object.keys(pages);
    if(names.length<=1){notify('A topic must keep at least one page.');return;}
    if(!confirm(`Delete the page “${name}”? This cannot be undone.`))return;
    scheduleSave(); delete pages[name]; activePage=activePage===name ? (Object.keys(pages)[0] || '') : activePage;
    saveData(data); renderPages(); restoreEditor(); notify(`Page “${name}” deleted`);
  }

  function deleteSubject(name){
    if(!name)return;
    const data=getData(); const names=Object.keys(data.subjects || {});
    if(names.length<=1){notify('Keep at least one subject in My Notes.');return;}
    if(!data.subjects?.[name])return;
    if(!confirm(`Delete the subject “${name}” and all of its topics and pages? This cannot be undone.`))return;
    scheduleSave(); delete data.subjects[name];
    if(activeSubject===name){activeSubject=Object.keys(data.subjects)[0];activeTopic=Object.keys(data.subjects[activeSubject]?.topics||{})[0]||'General';const pages=currentPages(data);activePage=Object.keys(pages)[0]||'Lecture Notes';}
    saveData(data); renderSubjects(); renderPages(); restoreEditor(); showSubjectWorkspace('overview'); notify(`Subject “${name}” deleted`);
  }
  function notify(message){const t=$('toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(window.__campusNoteToast);window.__campusNoteToast=setTimeout(()=>t.classList.remove('show'),2400);}
  function applyZoom(){if($('editor'))$('editor').style.fontSize=`${15*zoom/100}px`;if($('zoomLabel'))$('zoomLabel').textContent=`${zoom}%`;}

  function handleTagMenu(id){closeMenus();if(id==='remove'){const sel=window.getSelection();const tag=sel?.rangeCount?closestTag(sel.anchorNode):null;if(tag)removeTagFromElement(tag);else notify('Select tagged text first.');return;}if(id==='customize'){notify('Tag customization is planned for a later update.');return;}applyTag(id);}

  function bind(){
    if(bound)return;bound=true;
    const app=$('editorApp'),editor=$('editor');

    editor?.addEventListener('input',()=>{
      // User typing should return undo control to the browser's native history.
      // The structural snapshot is only a fallback for the table/insert flow.
      structuralUndo = null;
      structuralRedo = null;
      updateWordCount();captureSelection();scheduleSave();
    });
    editor?.addEventListener('mouseup',captureSelection); editor?.addEventListener('keyup',captureSelection); editor?.addEventListener('focus',captureSelection);
    editor?.addEventListener('click',e=>{const tag=e.target.closest('[data-tag]');if(tag){e.preventDefault();removeTagFromElement(tag);}});
    editor?.addEventListener('paste',e=>{
      if(!e.clipboardData)return;
      const html=e.clipboardData.getData('text/html'); const text=e.clipboardData.getData('text/plain');
      if(html){e.preventDefault();const clean=html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');insertHtml(clean);}
      else if(text){e.preventDefault();insertHtml(escapeHtml(text).replace(/\n/g,'<br>'));}
    });

    $('notesSubjectList')?.addEventListener('click',e=>{
      const del=e.target.closest('[data-delete-subject]');
      if(del){e.preventDefault();e.stopPropagation();deleteSubject(del.dataset.deleteSubject);return;}
      const b=e.target.closest('[data-subject]');if(b)switchSubject(b.dataset.subject);
    });
    $('notesPageList')?.addEventListener('click',e=>{
      const del=e.target.closest('[data-delete-page]');
      if(del){e.preventDefault();e.stopPropagation();deletePage(del.dataset.deletePage);return;}
      const page=e.target.closest('[data-note-page]');if(page){switchPage(page.dataset.notePage);return;}
      const topic=e.target.closest('[data-topic]');if(topic){switchTopic(topic.dataset.topic);return;}
    });
    $('notesAddSubject')?.addEventListener('click',addSubject);$('notesNewTopic')?.addEventListener('click',addTopic);$('notesNewPage')?.addEventListener('click',addPage);$('notesSubjectOverview')?.addEventListener('click',()=>showSubjectWorkspace('overview'));$('subjectOpenNotes')?.addEventListener('click',()=>showSubjectWorkspace('notes'));$('subjectNewPage')?.addEventListener('click',addPage);document.querySelectorAll('[data-subject-tab]').forEach(b=>b.addEventListener('click',()=>showSubjectWorkspace(b.dataset.subjectTab)));

    $('noteTitle')?.addEventListener('change',()=>{const title=$('noteTitle').value.trim()||activePage;if(title===activePage)return;const data=getData(),pages=currentPages(data),content=pages[activePage];delete pages[activePage];pages[title]=content;activePage=title;saveData(data);renderPages();});

    // Preserve the editor range before any ribbon control takes focus. For formatting
    // buttons, execute on pointer/mousedown so the browser cannot destroy the selection.
    app?.addEventListener('pointerdown',e=>{
      const control=e.target.closest('.editor-ribbon button[data-action]');
      if(!control) return;
      captureSelection();
      // Formatting commands are handled immediately on pointerdown. This is much more
      // reliable with contenteditable on Chrome/Safari than waiting for click.
      const action=control.dataset.action;
      const directToggle=['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','outdent','indent','justifyLeft','justifyCenter','justifyRight','justifyFull','removeFormat','superscript','subscript'];
      if(directToggle.includes(action)){
        e.preventDefault();
        exec(action);
        control.dataset.handledPointer='1';
        setTimeout(()=>delete control.dataset.handledPointer,250);
      }
    });
    app?.addEventListener('mousedown',e=>{
      const control=e.target.closest('.editor-ribbon button,.editor-ribbon select');
      if(control) captureSelection();
    });

    app?.addEventListener('click',e=>{
      const tab=e.target.closest('[data-tab]');
      if(tab){activeTab=tab.dataset.tab;document.querySelectorAll('.editor-tabs [data-tab]').forEach(x=>x.classList.toggle('selected',x===tab));closeMenus();buildRibbon();return;}
      const color=e.target.closest('[data-color-action]');
      if(color){const action=color.dataset.colorAction,value=color.dataset.color;closeMenus();focusEditor();exec(action==='foreColor'?'foreColor':'hiliteColor',value==='transparent'?'transparent':value);return;}
      const tag=e.target.closest('[data-tag-id]');if(tag){handleTagMenu(tag.dataset.tagId);return;}
      const dropdown=e.target.closest('[data-dropdown]');
      if(dropdown){const action=dropdown.dataset.dropdown,menu=document.querySelector(`[data-menu="${action}"]`),wasOpen=menu&&!menu.hidden;closeMenus();if(menu&&!wasOpen)positionMenu(menu,dropdown,action==='tags'?260:210);return;}
      if(!e.target.closest('.ribbon-color-menu,.ribbon-tag-menu,.table-picker,.symbol-menu'))closeMenus();
      const tool=e.target.closest('.editor-ribbon button[data-action]');
      if(tool)handleAction(tool.dataset.action);
    });

    app?.addEventListener('change',e=>{const s=e.target.closest('select[data-action]');if(s)handleSelect(s.dataset.action,s.value);});
    $('notesImageInput')?.addEventListener('change',e=>handleFiles(e.target,'picture'));$('notesFileInput')?.addEventListener('change',e=>handleFiles(e.target,'file'));$('notesAudioInput')?.addEventListener('change',e=>handleFiles(e.target,'audio'));$('notesVideoInput')?.addEventListener('change',e=>handleFiles(e.target,'video'));
    $('zoomOut')?.addEventListener('click',()=>{zoom=Math.max(60,zoom-10);applyZoom();});$('zoomIn')?.addEventListener('click',()=>{zoom=Math.min(180,zoom+10);applyZoom();});

    document.addEventListener('selectionchange',()=>{const sel=window.getSelection();if(sel?.rangeCount&&editor&&editor.contains(sel.anchorNode))captureSelection();});
    document.addEventListener('keydown',e=>{
      const mod=e.metaKey||e.ctrlKey; if(!mod)return;
      const key=e.key.toLowerCase();
      const tagMap={'1':'todo','2':'important','3':'question','4':'remember','5':'definition','6':'highlight','7':'contact','8':'address'};
      if(tagMap[key] && document.activeElement?.closest('#editor')){e.preventDefault();applyTag(tagMap[key]);return;}
      if(key==='k'&&document.activeElement?.closest('#editor')){e.preventDefault();const url=prompt('Enter URL:','https://');if(url)exec('createLink',url);}
    });
    window.addEventListener('resize',closeMenus); window.addEventListener('scroll',closeMenus,true);
  }

  function getStructure(){
    const data=getData();
    return Object.entries(data.subjects||{}).map(([name,subject])=>({
      name,
      topics:Object.entries(subject.topics||{}).map(([topic,entry])=>({name:topic,pages:Object.keys(entry.pages||{})}))
    }));
  }
  function openLocation(subject,topic,page){
    const data=getData();
    if(!data.subjects?.[subject])return;
    activeSubject=subject;
    const topics=currentTopics(data);
    activeTopic=topics?.[topic]?topic:(Object.keys(topics)[0]||'General');
    const pages=currentPages(data);
    activePage=pages?.[page]?page:(Object.keys(pages)[0]||'Lecture Notes');
    renderSubjects();renderPages();restoreEditor();showNoteEditor();
  }

  function activate(){
    bind();
    const data=getData(); normalizeData(data);
    if(!Object.keys(data.subjects).length){defaultSubjects.forEach(([name])=>data.subjects[name]={topics:{'Getting Started':{pages:{'Lecture Notes':defaultContent(name)}}}});saveData(data);}
    if(!data.subjects[activeSubject])activeSubject=Object.keys(data.subjects)[0] || '';
    if(activeSubject){const topics=currentTopics(data);activeTopic=Object.keys(topics)[0] || 'General';const pages=currentPages(data);activePage=Object.keys(pages)[0] || 'Lecture Notes';saveData(data);}
    renderSubjects();renderPages();setupTableDialog();buildRibbon();restoreEditor();applyZoom();
    showSubjectWorkspace('overview');
  }

  function createPage(subject, topic, page, content='') {
    const data=getData();
    if(!data.subjects?.[subject]) return false;
    const topics=currentTopics(data);
    topics[topic] ||= {pages:{}};
    topics[topic].pages ||= {};
    if(topics[topic].pages[page]) return false;
    topics[topic].pages[page]=content || defaultContent(subject);
    saveData(data);
    activeSubject=subject; activeTopic=topic; activePage=page;
    renderSubjects(); renderPages(); restoreEditor(); showNoteEditor();
    return true;
  }

  window.CampusNotes={activate,getStructure,openLocation,createPage};
  if(document.readyState!=='loading')setTimeout(activate,0);else document.addEventListener('DOMContentLoaded',()=>setTimeout(activate,0));
})();
