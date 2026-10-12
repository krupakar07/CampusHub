(() => {
  'use strict';
  const state = { timers: new Map(), revisions: new Map(), channel: null, uid: null };
  function startRealtime(){
    const c=client(), uid=userId();
    if(!c||!uid||state.uid===uid)return;
    if(state.channel) try{c.removeChannel(state.channel)}catch(_){}
    state.uid=uid;
    state.channel=c.channel(`campushub-data-${uid}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'campus_user_data',filter:`user_id=eq.${uid}`},payload=>{
        const row=payload.new||payload.old||{}; if(!row.namespace||payload.eventType==='DELETE')return;
        if(payload.eventType==='UPDATE'||payload.eventType==='INSERT'){
          localSet(row.namespace,row.data);
          window.dispatchEvent(new CustomEvent('campus-cloud-changed',{detail:{namespace:row.namespace,data:row.data}}));
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
      const {error}=await c.from('campus_user_data').upsert(record,{onConflict:'user_id,namespace'});
      if(error) throw error;
    };
    if(opts.immediate){try{await run()}catch(error){console.warn(`CampusHub cloud save failed for ${namespace}`,error)}}
    else { clearTimeout(state.timers.get(namespace)); state.timers.set(namespace,setTimeout(()=>run().catch(error=>console.warn(`CampusHub cloud save failed for ${namespace}`,error)),350)); }
  }
  async function remove(namespace){const uid=userId(),c=client();localStorage.removeItem(key(namespace));if(!uid||!c)return;const {error}=await c.from('campus_user_data').delete().eq('user_id',uid).eq('namespace',namespace);if(error)console.warn(`CampusHub cloud delete failed for ${namespace}`,error);}
  window.CampusCloudSync={hydrate,save,remove,localGet,localSet,startRealtime};
  window.addEventListener('campushub-auth',e=>{ if(e.detail?.user) startRealtime(); });
})();
