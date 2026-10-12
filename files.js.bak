(() => {
  'use strict';
  const KEY='campushub-files-v1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const auth=()=>window.CampusHubAuth?.user||null;
  const client=()=>window.CampusHubAuth?.client||null;
  const uid=()=>auth()?.id||null;
  function getAll(){try{return JSON.parse(localStorage.getItem(`${KEY}:${uid()||'local'}`)||'[]')}catch{return[]}}
  function setAll(v){localStorage.setItem(`${KEY}:${uid()||'local'}`,JSON.stringify(v))}
  function bytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`;return `${(n/1073741824).toFixed(1)} GB`}
  function icon(name,type=''){const x=(type||name).toLowerCase();if(x.includes('pdf'))return '📕';if(x.includes('presentation')||x.includes('powerpoint')||/\.pptx?$/i.test(name))return '📊';if(x.includes('spreadsheet')||x.includes('excel')||/\.(xlsx?|csv)$/i.test(name))return '📈';if(x.startsWith('image/')||/\.(png|jpe?g|gif|webp)$/i.test(name))return '🖼️';if(x.startsWith('video/')||/\.(mp4|mov|webm)$/i.test(name))return '🎥';if(x.startsWith('audio/')||/\.(mp3|wav|m4a)$/i.test(name))return '🎧';if(x.includes('word')||/\.docx?$/i.test(name))return '📘';return '📄'}
  async function syncMeta(list){
    const cloud=window.CampusCloudSync;
    if(cloud?.save && uid()) await cloud.save('files',list,{immediate:true});
  }
  async function hydrate(){
    const cloud=window.CampusCloudSync;
    if(!cloud?.hydrate||!uid())return;
    const local=getAll();
    await cloud.hydrate('files',local,v=>{if(Array.isArray(v))setAll(v);render();});
  }
  function currentSubject(){return window.CampusNotes?.activeSubject?.() || window.__campusActiveSubject || document.getElementById('subjectWorkspaceTitle')?.textContent || 'General'}
  function currentSubjectFallback(){return $('subjectWorkspaceTitle')?.textContent||'General'}
  function list(){const subject=currentSubjectFallback();return getAll().filter(f=>f.subject===subject).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))}
  function render(){
    const root=$('subjectFilesPanel'); if(!root)return;
    const files=list();
    root.innerHTML=`<div class="files-toolbar"><div><span class="subject-panel-kicker">MATERIALS</span><h3>${esc(currentSubjectFallback())} files</h3><p>Keep lecture slides, PDFs, spreadsheets, images and other study material together.</p></div><div class="files-toolbar-actions"><label class="file-upload-button primary-button">＋ Add files<input id="subjectFilesInput" type="file" multiple hidden></label><button type="button" class="secondary-button" id="filesRefresh">↻ Refresh</button></div><div id="filesUploadStatus" class="files-upload-status" data-type="info"></div></div><div class="files-dropzone" id="filesDropzone"><span class="files-drop-icon">＋</span><strong>Drop files here</strong><small>or use Add files · Files stay private to your account</small></div><div class="files-grid">${files.map(f=>`<article class="file-card"><div class="file-card-icon">${icon(f.name,f.type)}</div><div class="file-card-body"><strong title="${esc(f.name)}">${esc(f.name)}</strong><small>${esc(f.type||'File')} · ${bytes(f.size||0)}</small><small>Added ${new Date(f.createdAt).toLocaleDateString()}</small></div><div class="file-card-actions"><button type="button" data-file-open="${esc(f.id)}" title="Open">Open</button><button type="button" data-file-download="${esc(f.id)}" title="Download">↓</button><button type="button" data-file-delete="${esc(f.id)}" title="Delete">×</button></div></article>`).join('')||`<div class="files-empty"><div>📁</div><h4>No materials yet</h4><p>Upload lecture slides, PDFs, case studies, images or any other files for this subject.</p><label class="primary-button file-empty-upload">＋ Add your first file<input id="subjectFilesInputEmpty" type="file" multiple hidden></label></div>`}</div>`;
    const input=$('subjectFilesInput')||$('subjectFilesInputEmpty'); input?.addEventListener('change',e=>handleFiles(e.target.files));
    $('filesRefresh')?.addEventListener('click',()=>{hydrate();render()});
    const dz=$('filesDropzone'); if(dz){['dragenter','dragover'].forEach(x=>dz.addEventListener(x,e=>{e.preventDefault();dz.classList.add('dragover')}));['dragleave','drop'].forEach(x=>dz.addEventListener(x,e=>{e.preventDefault();dz.classList.remove('dragover')}));dz.addEventListener('drop',e=>handleFiles(e.dataTransfer.files));}
    root.querySelectorAll('[data-file-open]').forEach(b=>b.addEventListener('click',()=>openFile(b.dataset.fileOpen)));
    root.querySelectorAll('[data-file-download]').forEach(b=>b.addEventListener('click',()=>downloadFile(b.dataset.fileDownload)));
    root.querySelectorAll('[data-file-delete]').forEach(b=>b.addEventListener('click',()=>deleteFile(b.dataset.fileDelete)));
  }
  function showFileStatus(message, type='info'){
    let el=$('filesUploadStatus');
    if(!el){
      const root=$('subjectFilesPanel');
      if(!root)return;
      const toolbar=root.querySelector('.files-toolbar');
      if(!toolbar)return;
      el=document.createElement('div');
      el.id='filesUploadStatus';
      el.className='files-upload-status';
      toolbar.appendChild(el);
    }
    el.textContent=message;
    el.dataset.type=type;
  }

  async function handleFiles(fileList){
    const user=auth(), c=client();
    if(!user||!c){showFileStatus('Please sign in before uploading files.','error');return;}

    const files=Array.from(fileList||[]);
    if(!files.length)return;

    const subject=currentSubjectFallback();
    const existing=getAll();
    let uploaded=0, failed=0;

    showFileStatus(`Preparing ${files.length} file${files.length===1?'':'s'}…`,'info');

    // Verify the bucket is reachable before starting the batch. This produces
    // a much more useful error than a generic upload failure when the bucket
    // or Storage policies have not been installed.
    try{
      const {data,error}=await c.storage.listBuckets();
      if(error)throw error;
      const bucketExists=(data||[]).some(b=>b.id==='campushub-files');
      if(!bucketExists){
        throw new Error('The Supabase Storage bucket "campushub-files" does not exist. Run files-migration.sql first.');
      }
    }catch(error){
      console.error('CampusHub Storage check failed:',error);
      showFileStatus(`Storage setup error: ${error?.message||String(error)}`,'error');
      return;
    }

    for(const file of files){
      const id=crypto.randomUUID();
      const safe=file.name.replace(/[^a-zA-Z0-9._ -]/g,'_');
      const path=`${user.id}/${id}-${safe}`;
      const contentType=file.type||(
        /\.pdf$/i.test(file.name)?'application/pdf':
        /\.docx?$/i.test(file.name)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        /\.pptx?$/i.test(file.name)?'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        /\.xlsx?$/i.test(file.name)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'application/octet-stream'
      );

      try{
        const {error}=await c.storage.from('campushub-files').upload(path,file,{
          upsert:false,
          contentType,
          cacheControl:'3600'
        });
        if(error)throw error;

        existing.push({
          id,
          name:file.name,
          type:contentType,
          size:file.size,
          subject,
          storagePath:path,
          createdAt:new Date().toISOString()
        });
        uploaded++;
        showFileStatus(`Uploaded ${uploaded}/${files.length}: ${file.name}`,'success');
      }catch(error){
        failed++;
        console.error(`CampusHub upload failed for ${file.name}:`,error);
        const detail=error?.message||error?.error_description||String(error);
        showFileStatus(`Upload failed: ${file.name} — ${detail}`,'error');

        // Give the user the actionable cause when Supabase Storage RLS is
        // blocking the upload.
        if(/row-level security|policy|permission|not authorized|unauthorized/i.test(detail)){
          showFileStatus(
            `Upload blocked by Supabase Storage policy for ${file.name}. Run the corrected files-migration.sql, then try again.`,
            'error'
          );
        }
      }
    }

    setAll(existing);

    try{
      await syncMeta(existing);
    }catch(error){
      console.error('CampusHub file metadata sync failed:',error);
      if(uploaded){
        showFileStatus(
          `${uploaded} file${uploaded===1?'':'s'} uploaded, but metadata cloud sync failed: ${error?.message||String(error)}`,
          'error'
        );
      }
    }

    let finalMessage='', finalType='info';
    if(uploaded && !failed){
      finalMessage=`${uploaded} file${uploaded===1?'':'s'} uploaded successfully.`;
      finalType='success';
    }else if(uploaded && failed){
      finalMessage=`${uploaded} uploaded, ${failed} failed. Check the Supabase Storage policies.`;
      finalType='error';
    }else if(failed){
      finalMessage='No files were uploaded. Check the Supabase Storage setup and policies.';
      finalType='error';
    }
    render();
    if(finalMessage) showFileStatus(finalMessage,finalType);
  }
  function find(id){return getAll().find(f=>f.id===id)}
  async function openFile(id){const f=find(id);if(!f)return;const c=client();if(!c)return;const {data,error}=await c.storage.from('campushub-files').createSignedUrl(f.storagePath,3600);if(error){alert('Could not open this file.');return}window.open(data.signedUrl,'_blank','noopener')}
  async function downloadFile(id){const f=find(id);if(!f)return;const c=client();if(!c)return;const {data,error}=await c.storage.from('campushub-files').download(f.storagePath);if(error){alert('Could not download this file.');return}const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function deleteFile(id){const f=find(id);if(!f||!confirm(`Delete “${f.name}”?`))return;const c=client();if(c)await c.storage.from('campushub-files').remove([f.storagePath]);const next=getAll().filter(x=>x.id!==id);setAll(next);await syncMeta(next);render()}
  window.CampusHubFiles={render,hydrate,refresh:render,currentSubjectChanged:render};
  window.addEventListener('campushub-auth',()=>hydrate());
  document.addEventListener('campushub-files-refresh',()=>render());
})();
