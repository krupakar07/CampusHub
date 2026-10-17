(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const namespaces = ['notes','assignments','exams','quick-notes','files'];
  let bound = false;
  let activeTab = 'profile';

  function user(){ return window.CampusHubAuth?.user || null; }
  function client(){ return window.CampusHubAuth?.client || null; }
  function notify(msg){ window.CampusHubCalendar?.notify?.(msg); if(window.notify) window.notify(msg); }

  function localPrefs(){
    const u=user(); if(!u) return {};
    try { return JSON.parse(localStorage.getItem(`campushub-calendar-prefs:${u.id}`)||'{}'); } catch { return {}; }
  }

  function fill(){
    const u=user(); if(!u) return;
    const meta=u.user_metadata||{}, prefs=meta.calendar_preferences||localPrefs();
    const name=meta.full_name||u.email?.split('@')[0]||'My studies';
    $('profileSettingsName').value=name;
    $('profileSettingsUniversity').value=['Hochschule Wismar','Hochschule Worms'].includes(meta.university)?meta.university:'Hochschule Wismar';
    $('profileSettingsEmail').value=u.email||'';
    $('prefSettingsView').value=prefs.view||'week';
    $('prefSettingsReminder').value=String(prefs.reminderMinutes??0);
    $('prefSettingsTravel').value=String(prefs.travelBuffer??0);
    $('prefSettingsTheme').value=prefs.theme==='dark'?'dark':'light';
    $('prefSettingsContrast').value=['soft','normal','high'].includes(prefs.contrast)?prefs.contrast:'normal';
    $('prefSettingsReduceMotion').checked=prefs.reduceMotion===true;
    applyUiPrefs({theme:$('prefSettingsTheme').value,contrast:$('prefSettingsContrast').value,reduceMotion:$('prefSettingsReduceMotion').checked});
    $('settingsAccountName').textContent=name;
    $('settingsAccountEmail').textContent=u.email||'';
    $('settingsAccountAvatar').textContent=(name[0]||'S').toUpperCase();
  }

  function applyUiPrefs(p={}){
    const theme=p.theme==='dark'?'dark':'light';
    const contrast=['soft','normal','high'].includes(p.contrast)?p.contrast:'normal';
    const reduceMotion=p.reduceMotion===true;
    const root=document.documentElement;
    root.dataset.campushubTheme=theme;
    root.dataset.campushubContrast=contrast;
    if(reduceMotion)root.dataset.campushubReduceMotion='true';else delete root.dataset.campushubReduceMotion;
    try{localStorage.setItem('campushub-ui-prefs',JSON.stringify({theme,contrast,reduceMotion}));}catch(_){ }
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#0b1330':'#eceff6');
  }

  function showTab(tab){
    activeTab=tab;
    document.querySelectorAll('[data-settings-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.settingsTab===tab));
    document.querySelectorAll('[data-settings-section]').forEach(s=>s.classList.toggle('hidden',s.dataset.settingsSection!==tab));
  }

  async function saveProfile(){
    const u=user(), c=client(); if(!u||!c)return;
    const name=$('profileSettingsName').value.trim();
    const university=$('profileSettingsUniversity').value;
    if(!name){notify('Please enter your name.');return;}
    const {data,error}=await c.auth.updateUser({data:{...(u.user_metadata||{}),full_name:name,university}});
    if(error){notify(error.message||'Could not save your profile.');return;}
    try { await c.from('campus_calendars').update({university}).eq('user_id',u.id); } catch(_){ }
    window.dispatchEvent(new CustomEvent('campushub-profile-changed',{detail:{user:data.user}}));
    fill(); notify('Profile saved');
  }

  async function savePreferences(){
    const u=user(), c=client(); if(!u||!c)return;
    const prefs={view:$('prefSettingsView').value,travelBuffer:Number($('prefSettingsTravel').value),reminderMinutes:Number($('prefSettingsReminder').value),theme:$('prefSettingsTheme').value,contrast:$('prefSettingsContrast').value,reduceMotion:$('prefSettingsReduceMotion').checked,updatedAt:Date.now()};
    applyUiPrefs(prefs);
    localStorage.setItem(`campushub-calendar-prefs:${u.id}`,JSON.stringify(prefs));
    const {data,error}=await c.auth.updateUser({data:{...(u.user_metadata||{}),calendar_preferences:prefs}});
    if(error){notify(error.message||'Could not save preferences.');return;}
    fill(); notify('Preferences saved');
  }

  async function cloudRows(){
    const c=client(),u=user(); if(!c||!u)throw new Error('Please sign in first.');
    const results={};
    for(const ns of namespaces){
      const {data,error}=await c.from('campus_user_data').select('data,updated_at').eq('user_id',u.id).eq('namespace',ns).maybeSingle();
      if(error)throw error;
      results[ns]={data:data?.data ?? null,updated_at:data?.updated_at||null};
    }
    const cal=await c.from('campus_calendars').select('university,events,updated_at').eq('user_id',u.id).maybeSingle();
    if(cal.error)throw cal.error;
    return {calendar:cal.data||{university:u.user_metadata?.university||'Hochschule Wismar',events:[]},namespaces:results};
  }

  function download(name,text,type='application/json'){
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function fullBackup(){
    try{
      const u=user(); if(!u)throw new Error('Please sign in first.');
      const payload=await cloudRows();
      const backup={format:'campushub-full-backup',version:1,exportedAt:new Date().toISOString(),account:{email:u.email||'',name:u.user_metadata?.full_name||'',university:u.user_metadata?.university||''},calendar:payload.calendar,namespaces:payload.namespaces,note:'File contents are stored separately in private Supabase Storage. This JSON contains file metadata only.'};
      download(`campushub-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2));
      localStorage.setItem(`campushub-last-backup:${u.id}`,new Date().toISOString()); notify('Full backup downloaded');
    }catch(e){console.error(e);notify(e.message||'Could not create backup.');}
  }

  function manifest(){
    const u=user(); if(!u)return;
    const files=window.CampusCloudSync?.localGet?.('files',[])||[];
    const rows=Array.isArray(files)?files:[];
    const payload={format:'campushub-file-manifest',version:1,exportedAt:new Date().toISOString(),files:rows.map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,subject:f.subject,storagePath:f.storagePath,createdAt:f.createdAt}))};
    download(`campushub-file-manifest-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2)); notify('File manifest downloaded');
  }

  async function restore(file){
    const u=user(),c=client(); if(!u||!c)throw new Error('Please sign in first.');
    const backup=JSON.parse(await file.text());
    if(backup?.format!=='campushub-full-backup'||backup?.version!==1)throw new Error('This is not a valid CampusHub full backup.');
    if(!confirm('Restore this CampusHub backup? Existing cloud data for your account will be replaced with the backup contents.'))return;
    if(backup.calendar){
      const row={user_id:u.id,university:backup.calendar.university||u.user_metadata?.university||'Hochschule Wismar',events:Array.isArray(backup.calendar.events)?backup.calendar.events:[],updated_at:new Date().toISOString()};
      const r=await c.from('campus_calendars').upsert(row,{onConflict:'user_id'}); if(r.error)throw r.error;
    }
    for(const ns of namespaces){
      if(!backup.namespaces?.[ns]||backup.namespaces[ns].data===null)continue;
      const r=await c.from('campus_user_data').upsert({user_id:u.id,namespace:ns,data:backup.namespaces[ns].data,updated_at:new Date().toISOString()},{onConflict:'user_id,namespace'});
      if(r.error)throw r.error;
    }
    if(backup.account){
      const meta={...(u.user_metadata||{})}; if(backup.account.name)meta.full_name=backup.account.name;if(backup.account.university)meta.university=backup.account.university;
      await c.auth.updateUser({data:meta});
    }
    notify('Backup restored. Reloading CampusHub…');setTimeout(()=>location.reload(),500);
  }

  function bind(){
    if(bound)return;bound=true;
    document.querySelectorAll('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.settingsTab)));
    $('saveProfileSettings')?.addEventListener('click',saveProfile);
    $('savePreferenceSettings')?.addEventListener('click',savePreferences);
    $('fullBackupButton')?.addEventListener('click',fullBackup);
    $('fileManifestButton')?.addEventListener('click',manifest);
    $('fullRestoreButton')?.addEventListener('click',()=>$('fullRestoreInput')?.click());
    $('fullRestoreInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await restore(f);}catch(err){notify(err.message||'Could not restore backup.');}finally{e.target.value='';}});
    $('settingsSignOut')?.addEventListener('click',()=>document.getElementById('signOutButton')?.click());
    window.addEventListener('campushub-auth',e=>{if(e.detail?.user){fill();}else{}});
    window.addEventListener('campushub-profile-changed',fill);
    fill();
  }
  function activate(){bind();fill();showTab(activeTab);}
  window.CampusHubSettings={activate,backup:fullBackup,restore,applyUiPrefs};
  if(document.readyState!=='loading')setTimeout(bind,0);else document.addEventListener('DOMContentLoaded',bind);
})();
