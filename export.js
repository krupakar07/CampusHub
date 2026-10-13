(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let modal = null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
  function slug(v){return String(v||'CampusHub').replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,90)||'CampusHub';}
  function collectPages(scope, snapshot){
    const pages=[];
    const s=snapshot.subjects.find(x=>x.name===snapshot.activeSubject);
    if(!s)return pages;
    if(scope==='current'){
      const t=s.topics.find(x=>x.name===snapshot.activeTopic);
      const p=t?.pages.find(x=>x.name===snapshot.activePage);
      if(p)pages.push({subject:s.name,topic:t.name,...p});
    } else if(scope==='all'){
      s.topics.forEach(t=>t.pages.forEach(p=>pages.push({subject:s.name,topic:t.name,...p})));
    } else {
      const selected=new Set([...modal.querySelectorAll('input[data-page-check]:checked')].map(x=>x.dataset.key));
      s.topics.forEach(t=>t.pages.forEach(p=>{
        const key=`${t.name}::${p.name}`;
        if(selected.has(key))pages.push({subject:s.name,topic:t.name,...p});
      }));
    }
    return pages;
  }
  function makeHtml(pages,opts){
    let html='<article class="ch-export-doc">';
    if(opts.includeSubject)html+=`<h1>${esc(opts.subject)}</h1>`;
    let lastTopic='';
    pages.forEach((p,i)=>{
      if(opts.topicBreak&&lastTopic&&lastTopic!==p.topic)html+='<div class="ch-page-break"></div>';
      if(opts.includeTopic&&lastTopic!==p.topic)html+=`<h2>${esc(p.topic)}</h2>`;
      if(opts.pageBreak&&i)html+='<div class="ch-page-break"></div>';
      html+=`<section class="ch-note-page"><h3>${esc(p.name)}</h3>${p.content||'<p></p>'}</section>`;
      lastTopic=p.topic;
    });
    return html+'</article>';
  }
  function textFromHtml(html){
    const wrap=document.createElement('div');wrap.innerHTML=html||'';
    const lines=[];
    const walk=(node,depth=0)=>{
      if(node.nodeType===3){const t=node.nodeValue.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ');if(t.trim())lines.push(t.trim());return;}
      if(node.nodeType!==1)return;
      const tag=node.tagName.toLowerCase();
      if(tag==='br'){lines.push('');return;}
      if(['li'].includes(tag)){const txt=node.textContent.replace(/\u00a0/g,' ').trim();if(txt)lines.push('• '+txt);return;}
      if(['p','div','section','blockquote','h1','h2','h3','h4','h5','h6','tr'].includes(tag)){
        const before=lines.length;node.childNodes.forEach(n=>walk(n,depth+1));if(lines.length>before)lines.push('');return;
      }
      if(tag==='td'||tag==='th'){const txt=node.textContent.replace(/\u00a0/g,' ').trim();if(txt)lines.push(txt+' | ');return;}
      node.childNodes.forEach(n=>walk(n,depth));
    };
    wrap.childNodes.forEach(n=>walk(n));
    return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function buildBlocks(pages,opts){
    const blocks=[]; let lastTopic='';
    if(opts.includeSubject)blocks.push({type:'title',text:opts.subject});
    pages.forEach((p,i)=>{
      if(opts.topicBreak&&lastTopic&&lastTopic!==p.topic)blocks.push({type:'pagebreak'});
      if(opts.includeTopic&&lastTopic!==p.topic)blocks.push({type:'h2',text:p.topic});
      if(opts.pageBreak&&i)blocks.push({type:'pagebreak'});
      blocks.push({type:'h3',text:p.name});
      const text=textFromHtml(p.content);
      text.split('\n').forEach(line=>{if(line.trim())blocks.push({type:line.startsWith('• ')?'bullet':'p',text:line.trim()});});
      lastTopic=p.topic;
    });
    return blocks;
  }
  function marginMm(opts){return opts.margins==='narrow'?13:opts.margins==='wide'?25:20;}

  // ---------- PDF: self-contained, no CDN/network dependency ----------
  function cp1252Bytes(str){
    const map={'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8a,'‹':0x8b,'Œ':0x8c,'Ž':0x8e,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9a,'›':0x9b,'œ':0x9c,'ž':0x9e,'Ÿ':0x9f};
    const out=[]; for(const ch of String(str)){const c=ch.charCodeAt(0); if(c<256)out.push(c); else if(map[ch]!=null)out.push(map[ch]); else out.push(0x3f);} return new Uint8Array(out);
  }
  function pdfEscape(s){return s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r?\n/g,' ');}
  function makePdf(blocks,opts){
    const landscape=opts.orientation==='landscape';
    const PW=landscape?841.89:595.28, PH=landscape?595.28:841.89;
    const mmToPt=72/25.4, m=marginMm(opts)*mmToPt, usableW=PW-2*m;
    const fs={title:22,h2:15,h3:12,p:10,bullet:10}, leading={title:29,h2:20,h3:17,p:14,bullet:14};
    const pages=[]; let current=[], y=PH-m;
    const wrap=(text,size)=>{
      const maxChars=Math.max(20,Math.floor(usableW/(size*0.48))); const words=String(text).split(/\s+/);const lines=[];let line='';
      words.forEach(w=>{const next=line?line+' '+w:w;if(next.length>maxChars&&line){lines.push(line);line=w;}else line=next;});if(line||!lines.length)lines.push(line);return lines;
    };
    const ensure=(height)=>{if(y-height<m){pages.push(current);current=[];y=PH-m;}};
    const addText=(text,size,lead,bold=false)=>{const lines=wrap(text,size);ensure(lines.length*lead+4);lines.forEach(line=>{current.push({text:line,size,lead,bold,y});y-=lead;});y-=4;};
    blocks.forEach(b=>{
      if(b.type==='pagebreak'){pages.push(current);current=[];y=PH-m;return;}
      if(b.type==='title'){addText(b.text,fs.title,leading.title,true);y-=5;}
      else if(b.type==='h2'){addText(b.text,fs.h2,leading.h2,true);}
      else if(b.type==='h3'){addText(b.text,fs.h3,leading.h3,true);}
      else addText(b.text,fs[b.type]||fs.p,leading[b.type]||leading.p,b.type!=='p');
    });
    if(current.length||!pages.length)pages.push(current);
    const objs=[]; const addObj=x=>{objs.push(x);return objs.length;};
    const font=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pageIds=[]; const contentIds=[];
    pages.forEach((items,pi)=>{
      let stream='BT\n';
      items.forEach(it=>{stream+=`/${it.bold?'F2':'F1'} ${it.size} Tf 1 0 0 1 ${m.toFixed(2)} ${it.y.toFixed(2)} Tm (${pdfEscape(it.text)}) Tj\n`;});
      stream+='ET';
      const bytes=cp1252Bytes(stream); const content=Array.from(bytes,b=>String.fromCharCode(b)).join('');
      contentIds.push(addObj(`<< /Length ${bytes.length} >>\nstream\n${content}\nendstream`));
      pageIds.push(0);
    });
    const pagesObj=addObj('');
    pageIds.forEach((_,i)=>{pageIds[i]=addObj(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PW.toFixed(2)} ${PH.toFixed(2)}] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);});
    objs[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
    const catalog=addObj(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
    let pdf='%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';const offsets=[0];
    for(let i=0;i<objs.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
    const xref=pdf.length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const out=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)out[i]=pdf.charCodeAt(i)&255;return new Blob([out],{type:'application/pdf'});
  }

  // ---------- DOCX: self-contained minimal OOXML ZIP writer ----------
  const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function u16(v){return new Uint8Array([v&255,(v>>>8)&255]);}
  function u32(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);}
  function concat(parts){let n=0;parts.forEach(p=>n+=p.length);const out=new Uint8Array(n);let o=0;parts.forEach(p=>{out.set(p,o);o+=p.length;});return out;}
  function zipStore(files){
    const local=[],central=[];let offset=0;
    files.forEach(f=>{const name=new TextEncoder().encode(f.name),data=new TextEncoder().encode(f.data),crc=crc32(data);const lh=concat([new Uint8Array([0x50,0x4b,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);local.push(lh);const ch=concat([new Uint8Array([0x50,0x4b,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);central.push(ch);offset+=lh.length;});
    const cd=concat(central),body=concat(local);const end=concat([new Uint8Array([0x50,0x4b,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)]);return new Blob([body,cd,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  function docxParagraph(text,style='Normal',bullet=false){return `<w:p><w:pPr>${style!=='Normal'?`<w:pStyle w:val="${style}"/>`:''}${bullet?'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>':''}</w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;}
  function makeDocx(blocks,opts){
    const body=[];blocks.forEach(b=>{if(b.type==='pagebreak')body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');else if(b.type==='title')body.push(docxParagraph(b.text,'Title'));else if(b.type==='h2')body.push(docxParagraph(b.text,'Heading2'));else if(b.type==='h3')body.push(docxParagraph(b.text,'Heading3'));else body.push(docxParagraph(b.text,'Normal',b.type==='bullet'));});
    body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>');
    const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`;
    const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
    const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const docRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
    const numbering=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
    // Add numbering relationship only when bullet paragraphs are present.
    return zipStore([{'name':'[Content_Types].xml','data':types},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:documentXml},{name:'word/styles.xml',data:styles},{name:'word/_rels/document.xml.rels',data:docRels},{name:'word/numbering.xml',data:numbering}]);
  }
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function runExport(pages,opts){const blocks=buildBlocks(pages,opts);if(opts.format==='pdf')download(`${slug(opts.subject)}_Notes.pdf`,makePdf(blocks,opts));else download(`${slug(opts.subject)}_Notes.docx`,makeDocx(blocks,opts));}

  function renderPagePicker(snapshot){
    const s=snapshot.subjects.find(x=>x.name===snapshot.activeSubject);const host=$('exportPagePicker');if(!host)return;
    host.innerHTML=(s?.topics||[]).map(t=>`<div class="export-topic-group"><strong>${esc(t.name)}</strong>${t.pages.map(p=>{const key=`${t.name}::${p.name}`;return `<label><input type="checkbox" data-page-check data-key="${esc(key)}" checked><span>${esc(p.name)}</span></label>`}).join('')}</div>`).join('')||'<div class="export-empty">No pages in this subject.</div>';
  }
  function updatePreview(snapshot){const scope=$('exportScope')?.value||'all';const pages=collectPages(scope,snapshot);const summary=$('exportSummary');if(summary)summary.textContent=`${pages.length} ${pages.length===1?'page':'pages'} · A4 · ${$('exportFormat')?.value?.toUpperCase()||'PDF'}`;const picker=$('exportPagePicker');if(picker)picker.classList.toggle('hidden',scope!=='selected');}
  function open(){
    const snapshot=window.CampusNotes?.getExportSnapshot?.();if(!snapshot)return;
    if(!modal){
      modal=document.createElement('dialog');modal.id='campusExportModal';modal.className='campus-export-modal';modal.innerHTML=`<div class="export-shell"><div class="export-head"><div><span class="export-kicker">EXPORT CENTER</span><h2>Export subject notes</h2><p>Create a clean A4 PDF or editable Word document.</p></div><button type="button" class="export-close" data-export-close>×</button></div><div class="export-body"><div class="export-grid"><label><span>Scope</span><select id="exportScope"><option value="all">Entire subject</option><option value="selected">Selected pages</option><option value="current">Current page</option></select></label><label><span>Format</span><select id="exportFormat"><option value="pdf">PDF</option><option value="docx">DOCX</option></select></label><label><span>Orientation</span><select id="exportOrientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label><span>Margins</span><select id="exportMargins"><option value="normal">Normal · 2 cm</option><option value="narrow">Narrow · 1.3 cm</option><option value="wide">Wide · 2.5 cm</option></select></label></div><div class="export-toggles"><label><input id="exportSubjectTitle" type="checkbox" checked><span>Subject title</span></label><label><input id="exportTopicNames" type="checkbox" checked><span>Topic headings</span></label><label><input id="exportPageBreaks" type="checkbox" checked><span>Each page starts on a new page</span></label><label><input id="exportTopicBreaks" type="checkbox"><span>New page for each topic</span></label></div><div id="exportPagePicker" class="export-page-picker hidden"></div><div class="export-summary" id="exportSummary"></div></div><div class="export-foot"><button type="button" class="secondary-button" data-export-close>Cancel</button><button type="button" class="primary-button" id="exportRun">Export</button></div></div>`;document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target.matches('[data-export-close]'))modal.close();});
      ['exportScope','exportFormat','exportOrientation','exportMargins','exportSubjectTitle','exportTopicNames','exportPageBreaks','exportTopicBreaks'].forEach(id=>$(id)?.addEventListener('change',()=>updatePreview(window.CampusNotes.getExportSnapshot())));
      $('exportRun').addEventListener('click',async()=>{const snap=window.CampusNotes.getExportSnapshot();const opts={subject:snap.activeSubject,scope:$('exportScope').value,format:$('exportFormat').value,orientation:$('exportOrientation').value,margins:$('exportMargins').value,includeSubject:$('exportSubjectTitle').checked,includeTopic:$('exportTopicNames').checked,pageBreak:$('exportPageBreaks').checked,topicBreak:$('exportTopicBreaks').checked};const pages=collectPages(opts.scope,snap);if(!pages.length){alert('Select at least one page to export.');return;}const btn=$('exportRun');btn.disabled=true;btn.textContent='Preparing…';try{await runExport(pages,opts);modal.close();}catch(err){console.error(err);alert(`Export failed: ${err.message||err}`);}finally{btn.disabled=false;btn.textContent='Export';}});
    }
    renderPagePicker(snapshot);updatePreview(snapshot);modal.showModal();
  }
  function injectButton(){const actions=document.querySelector('.subject-workspace-top .subject-workspace-actions');if(!actions||actions.querySelector('[data-open-export]'))return;const b=document.createElement('button');b.type='button';b.className='secondary-button';b.dataset.openExport='1';b.textContent='⇩ Export';b.addEventListener('click',open);actions.insertBefore(b,actions.firstChild);}
  window.CampusHubExport={open,injectButton};window.addEventListener('campushub-notes-workspace-rendered',injectButton);document.addEventListener('DOMContentLoaded',()=>setTimeout(injectButton,300));
})();
