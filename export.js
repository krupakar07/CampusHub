(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let modal = null;
  let depsPromise = null;

  function loadScript(src, test){
    return new Promise((resolve,reject)=>{
      if(test()) return resolve();
      const s=document.createElement('script'); s.src=src; s.async=true;
      s.onload=()=>test()?resolve():reject(new Error('Library loaded but was not available.'));
      s.onerror=()=>reject(new Error('Could not load export library.'));
      document.head.appendChild(s);
    });
  }
  function ensureDeps(){
    if(depsPromise)return depsPromise;
    depsPromise=Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF),
      loadScript('https://unpkg.com/docx@9.5.1/build/index.js',()=>!!window.docx)
    ]);
    return depsPromise;
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function slug(v){return String(v||'CampusHub').replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,90)||'CampusHub';}
  function collectPages(scope, snapshot){
    const pages=[];
    if(scope==='current'){
      const s=snapshot.subjects.find(x=>x.name===snapshot.activeSubject);
      const t=s?.topics.find(x=>x.name===snapshot.activeTopic);
      const p=t?.pages.find(x=>x.name===snapshot.activePage);
      if(p)pages.push({subject:s.name,topic:t.name,...p});
    } else {
      const s=snapshot.subjects.find(x=>x.name===snapshot.activeSubject);
      if(!s)return pages;
      if(scope==='all'){
        s.topics.forEach(t=>t.pages.forEach(p=>pages.push({subject:s.name,topic:t.name,...p})));
      } else {
        const selected=[...modal.querySelectorAll('input[data-page-check]:checked')].map(x=>x.dataset.key);
        s.topics.forEach(t=>t.pages.forEach(p=>{const key=`${t.name}\\u0000${p.name}`;if(selected.includes(key))pages.push({subject:s.name,topic:t.name,...p});}));
      }
    }
    return pages;
  }
  function makeHtml(pages, opts){
    let html=`<article class="ch-export-doc">`;
    if(opts.includeSubject)html+=`<h1>${esc(opts.subject)}</h1>`;
    let lastTopic='';
    pages.forEach((p,i)=>{
      if(opts.topicBreak && lastTopic && lastTopic!==p.topic)html+='<div class="ch-page-break"></div>';
      if(opts.includeTopic && lastTopic!==p.topic)html+=`<h2>${esc(p.topic)}</h2>`;
      if(opts.pageBreak && i)html+='<div class="ch-page-break"></div>';
      html+=`<section class="ch-note-page"><h3>${esc(p.name)}</h3>${p.content||'<p></p>'}</section>`;
      lastTopic=p.topic;
    });
    html+='</article>';return html;
  }
  function textRuns(node, inherited={}){
    const D=window.docx, out=[];
    if(node.nodeType===3){
      const text=node.nodeValue.replace(/\s+/g,' '); if(text)out.push(new D.TextRun({text,bold:!!inherited.bold,italics:!!inherited.italics,underline:inherited.underline?'single':undefined}));
      return out;
    }
    if(node.nodeType!==1)return out;
    const tag=node.tagName.toLowerCase(), style={...inherited,bold:inherited.bold||['strong','b'].includes(tag),italics:inherited.italics||['em','i'].includes(tag),underline:inherited.underline||tag==='u'};
    node.childNodes.forEach(n=>out.push(...textRuns(n,style)));return out;
  }
  function htmlToDocx(html){
    const D=window.docx, wrap=document.createElement('div');wrap.innerHTML=html||'';const children=[];
    const walk=(node)=>{
      if(node.nodeType!==1)return;
      const tag=node.tagName.toLowerCase();
      if(/^h[1-6]$/.test(tag)){
        const level=Math.min(6,Number(tag[1]));children.push(new D.Paragraph({heading:level===1?D.HeadingLevel.HEADING_1:level===2?D.HeadingLevel.HEADING_2:level===3?D.HeadingLevel.HEADING_3:D.HeadingLevel.HEADING_4,children:textRuns(node)}));return;
      }
      if(tag==='p'||tag==='blockquote'){
        children.push(new D.Paragraph({children:textRuns(node),indent:tag==='blockquote'?{left:720}:undefined,spacing:{after:160}}));return;
      }
      if(tag==='ul'||tag==='ol'){
        [...node.children].forEach(li=>children.push(new D.Paragraph({children:textRuns(li),bullet:tag==='ul'?{level:0}:undefined,numbering:tag==='ol'?{reference:'campushub-numbering',level:0}:undefined,spacing:{after:80}})));return;
      }
      if(tag==='table'){
        const rows=[...node.querySelectorAll('tr')].map(tr=>new D.TableRow({children:[...tr.children].map(cell=>new D.TableCell({children:[new D.Paragraph({children:textRuns(cell)})]}))}));
        if(rows.length)children.push(new D.Table({rows,width:{size:10000,type:D.WidthType.DXA}}));return;
      }
      if(tag==='hr'){children.push(new D.Paragraph({border:{bottom:{color:'999999',style:D.BorderStyle.SINGLE,size:6,space:1}}}));return;}
      if(tag==='div'||tag==='section'||tag==='article')node.childNodes.forEach(walk);
      else if(tag==='br')children.push(new D.Paragraph({children:[new D.TextRun('')]}));
      else if(node.childNodes.length)node.childNodes.forEach(walk);
    };
    wrap.childNodes.forEach(walk);return children.length?children:[new D.Paragraph({children:[new D.TextRun('')]})];
  }
  async function exportDocx(pages,opts){
    const D=window.docx;const children=[];
    children.push(new D.Paragraph({text:opts.subject,heading:D.HeadingLevel.TITLE,spacing:{after:240}}));
    let lastTopic='';
    pages.forEach((p,i)=>{
      if(opts.topicBreak&&lastTopic&&lastTopic!==p.topic)children.push(new D.Paragraph({pageBreakBefore:true}));
      if(opts.includeTopic&&lastTopic!==p.topic)children.push(new D.Paragraph({text:p.topic,heading:D.HeadingLevel.HEADING_2}));
      if(opts.pageBreak&&i)children.push(new D.Paragraph({pageBreakBefore:true}));
      children.push(new D.Paragraph({text:p.name,heading:D.HeadingLevel.HEADING_3}));
      children.push(...htmlToDocx(p.content));lastTopic=p.topic;
    });
    const doc=new D.Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children}],numbering:{config:[{reference:'campushub-numbering',levels:[{level:0,format:D.LevelFormat.DECIMAL,text:'%1.',alignment:D.AlignmentType.START}]}]}});
    const blob=await D.Packer.toBlob(doc);download(`${slug(opts.subject)}_Notes.docx`,blob);
  }
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  async function exportPdf(pages,opts){
    const D=window.jspdf.jsPDF;const pdf=new D({orientation:opts.orientation==='landscape'?'landscape':'portrait',unit:'mm',format:'a4'});
    const box=document.createElement('div');box.innerHTML=makeHtml(pages,opts);box.style.cssText=`position:fixed;left:-10000px;top:0;width:${opts.orientation==='landscape'?257:190}mm;background:#fff;color:#222;padding:0;font:11pt Georgia,serif;line-height:1.55;`;
    box.querySelectorAll('h1').forEach(x=>x.style.cssText='font:700 24pt Arial;margin:0 0 16px;color:#29264a;');box.querySelectorAll('h2').forEach(x=>x.style.cssText='font:700 17pt Arial;margin:18px 0 9px;color:#4b3c86;');box.querySelectorAll('h3').forEach(x=>x.style.cssText='font:700 14pt Arial;margin:0 0 12px;color:#333;');
    box.querySelectorAll('.ch-page-break').forEach(x=>x.style.pageBreakBefore='always');document.body.appendChild(box);
    await new Promise((resolve,reject)=>pdf.html(box,{x:10,y:10,width:opts.orientation==='landscape'?277:190,windowWidth:1000,autoPaging:'text',margin:[10,10,10,10],callback:doc=>{doc.save(`${slug(opts.subject)}_Notes.pdf`);box.remove();resolve();}}).catch(e=>{box.remove();reject(e)}));
  }
  function renderPagePicker(snapshot){
    const s=snapshot.subjects.find(x=>x.name===snapshot.activeSubject);const host=$('exportPagePicker');if(!host)return;
    host.innerHTML=(s?.topics||[]).map(t=>`<div class="export-topic-group"><strong>${esc(t.name)}</strong>${t.pages.map(p=>{const key=`${t.name}::${p.name}`;return `<label><input type="checkbox" data-page-check data-key="${esc(key)}" checked><span>${esc(p.name)}</span></label>`}).join('')}</div>`).join('')||'<div class="export-empty">No pages in this subject.</div>';
  }
  function updatePreview(snapshot){
    const scope=$('exportScope')?.value||'all';const pages=collectPages(scope,snapshot);const summary=$('exportSummary');if(summary)summary.textContent=`${pages.length} ${pages.length===1?'page':'pages'} · A4 · ${$('exportFormat')?.value?.toUpperCase()||'PDF'}`;
    const picker=$('exportPagePicker');if(picker)picker.classList.toggle('hidden',scope!=='selected');
  }
  function open(){
    const snapshot=window.CampusNotes?.getExportSnapshot?.();if(!snapshot)return;
    if(!modal){
      modal=document.createElement('dialog');modal.id='campusExportModal';modal.className='campus-export-modal';modal.innerHTML=`<div class="export-shell"><div class="export-head"><div><span class="export-kicker">EXPORT CENTER</span><h2>Export subject notes</h2><p>Create a clean A4 PDF or editable Word document.</p></div><button type="button" class="export-close" data-export-close>×</button></div><div class="export-body"><div class="export-grid"><label><span>Scope</span><select id="exportScope"><option value="all">Entire subject</option><option value="selected">Selected pages</option><option value="current">Current page</option></select></label><label><span>Format</span><select id="exportFormat"><option value="pdf">PDF</option><option value="docx">DOCX</option></select></label><label><span>Orientation</span><select id="exportOrientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label><span>Margins</span><select id="exportMargins"><option value="normal">Normal · 2 cm</option><option value="narrow">Narrow · 1.3 cm</option><option value="wide">Wide · 2.5 cm</option></select></label></div><div class="export-toggles"><label><input id="exportSubjectTitle" type="checkbox" checked><span>Subject title</span></label><label><input id="exportTopicNames" type="checkbox" checked><span>Topic headings</span></label><label><input id="exportPageBreaks" type="checkbox" checked><span>Each page starts on a new page</span></label><label><input id="exportTopicBreaks" type="checkbox"><span>New page for each topic</span></label></div><div id="exportPagePicker" class="export-page-picker hidden"></div><div class="export-summary" id="exportSummary"></div></div><div class="export-foot"><button type="button" class="secondary-button" data-export-close>Cancel</button><button type="button" class="primary-button" id="exportRun">Export</button></div></div>`;document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target.matches('[data-export-close]'))modal.close();});
      ['exportScope','exportFormat','exportOrientation','exportMargins','exportSubjectTitle','exportTopicNames','exportPageBreaks','exportTopicBreaks'].forEach(id=>$(id)?.addEventListener('change',()=>updatePreview(window.CampusNotes.getExportSnapshot())));
      $('exportRun').addEventListener('click',async()=>{const snap=window.CampusNotes.getExportSnapshot();const opts={subject:snap.activeSubject,scope:$('exportScope').value,format:$('exportFormat').value,orientation:$('exportOrientation').value,margins:$('exportMargins').value,includeSubject:$('exportSubjectTitle').checked,includeTopic:$('exportTopicNames').checked,pageBreak:$('exportPageBreaks').checked,topicBreak:$('exportTopicBreaks').checked};const pages=collectPages(opts.scope,snap);if(!pages.length){alert('Select at least one page to export.');return;}const btn=$('exportRun');btn.disabled=true;btn.textContent='Preparing…';try{await ensureDeps();if(opts.format==='pdf')await exportPdf(pages,opts);else await exportDocx(pages,opts);modal.close();}catch(err){console.error(err);alert(`Export failed: ${err.message||err}`);}finally{btn.disabled=false;btn.textContent='Export';}});
    }
    renderPagePicker(snapshot);updatePreview(snapshot);modal.showModal();
  }
  function injectButton(){
    const actions=document.querySelector('.subject-workspace-top .subject-workspace-actions');if(!actions||actions.querySelector('[data-open-export]'))return;
    const b=document.createElement('button');b.type='button';b.className='secondary-button';b.dataset.openExport='1';b.textContent='⇩ Export';b.addEventListener('click',open);actions.insertBefore(b,actions.firstChild);
  }
  window.CampusHubExport={open,injectButton};
  window.addEventListener('campushub-notes-workspace-rendered',injectButton);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(injectButton,300));
})();
