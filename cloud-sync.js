(() => {
  'use strict';
  const state = { timers: new Map(), revisions: new Map(), pending: new Map(), channel: null, uid: null, clientId: null };
  function startRealtime(){
    const c=client(), uid=userId();
    if(!c||!uid||state.uid===uid)return;
    if(state.channel) try{c.removeChannel(state.channel)}catch(_){}
    state.uid=uid;
    try { state.clientId = sessionStorage.getItem('campushub-client-id') || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)); sessionStorage.setItem('campushub-client-id', state.clientId); } catch(_) { state.clientId = Math.random().toString(36).slice(2); }
    state.channel=c.channel(`campushub-data-${uid}`)
      .on('broadcast', {event:'notes-editor'}, payload => {
        const msg = payload?.payload || {};
        if (!msg || msg.source === state.clientId || msg.namespace !== 'notes') return;
        window.dispatchEvent(new CustomEvent('campus-cloud-live-edit', {detail: msg}));
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'campus_user_data',filter:`user_id=eq.${uid}`},payload=>{
        const row=payload.new||payload.old||{}; if(!row.namespace||payload.eventType==='DELETE')return;
        if(payload.eventType==='UPDATE'||payload.eventType==='INSERT'){
          // Supabase Realtime also echoes writes made by this browser. If we
          // immediately hydrate those echoes, the Notes UI re-renders and
          // hides the editor while the user is typing. Only notify the app
          // when the incoming cloud value is actually different from the
          // local cache.
          // A Realtime UPDATE does not tell us whether it originated in this
          // browser. Track the exact payload we just sent so our own echo is
          // ignored. The app's local cache uses its own key, so comparing only
          // against localGet() is not reliable.
          let incoming = '';
          try { incoming = JSON.stringify(row.data); } catch(_) {}
          const pending = state.pending.get(row.namespace);
          const sameAsOwnWrite = pending && pending === incoming;
          if (sameAsOwnWrite) {
            state.pending.delete(row.namespace);
            localSet(row.namespace,row.data);
            return;
          }
          const current = localGet(row.namespace, undefined);
          let same = false;
          try { same = JSON.stringify(current) === incoming; } catch(_) {}
          localSet(row.namespace,row.data);
          if(!same){
            window.dispatchEvent(new CustomEvent('campus-cloud-changed',{detail:{namespace:row.namespace,data:row.data}}));
          }
        }
      }).subscribe();
  }
  function client(){ return window.CampusHubAuth?.client || null; }
  function userId(){ return window.CampusHubAuth?.user?.id || null; }
  function key(namespace){ return `campushub-cloud:${namespace}:${userId()||'local'}`; }
  function localGet(namespace, fallback){ try { const raw=localStorage.getItem(key(namespace)); return raw===null?fallback:JSON.parse(raw); } catch { return fallback; } }
  function localSet(namespace, value){ try { localStorage.setItem(key(namespace), JSON.stringify(value)); } catch(_){} }
  async function hydrate(namespace, localValue, apply){
    const c=client(), uid=userId();
    if(!c||!uid) return {value:localValue, source:'local'};
    try {
      const {data,error}=await c.from('campus_user_data').select('data,updated_at').eq('user_id',uid).eq('namespace',namespace).maybeSingle();
      if(error) throw error;
      if(data && data.data!==undefined){ localSet(namespace,data.data); apply?.(data.data); return {value:data.data,source:'cloud'}; }
      await save(namespace,localValue,{immediate:true});
      return {value:localValue,source:'local'};
    } catch(error){ console.warn(`CampusHub cloud hydration failed for ${namespace}`,error); return {value:localValue,source:'local',error}; }
  }
  async function save(namespace,value,opts={}){
    const uid=userId(),c=client();
    localSet(namespace,value);
    if(!uid||!c) return;
    const run=async()=>{
      const revision=(state.revisions.get(namespace)||0)+1; state.revisions.set(namespace,revision);
      const record={user_id:uid,namespace,data:value,updated_at:new Date().toISOString()};
      try { state.pending.set(namespace, JSON.stringify(value)); } catch(_) {}
      const {error}=await c.from('campus_user_data').upsert(record,{onConflict:'user_id,namespace'});
      if(error) throw error;
    };
    if(opts.immediate){try{await run()}catch(error){console.warn(`CampusHub cloud save failed for ${namespace}`,error)}}
    else { clearTimeout(state.timers.get(namespace)); state.timers.set(namespace,setTimeout(()=>run().catch(error=>console.warn(`CampusHub cloud save failed for ${namespace}`,error)),350)); }
  }
  async function remove(namespace){const uid=userId(),c=client();localStorage.removeItem(key(namespace));if(!uid||!c)return;const {error}=await c.from('campus_user_data').delete().eq('user_id',uid).eq('namespace',namespace);if(error)console.warn(`CampusHub cloud delete failed for ${namespace}`,error);}
  async function broadcastNotesEdit(message){
    const c=client(), uid=userId();
    if(!c||!uid||!state.channel) return;
    try { await state.channel.send({type:'broadcast',event:'notes-editor',payload:{...message,namespace:'notes',source:state.clientId}}); } catch(_) {}
  }
  window.CampusCloudSync={hydrate,save,remove,localGet,localSet,startRealtime,broadcastNotesEdit};
  window.addEventListener('campushub-auth',e=>{ if(e.detail?.user) startRealtime(); });
})();
