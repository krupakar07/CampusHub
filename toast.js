window.CampusHubUI ||= {};
window.CampusHubUI.toast = (message) => { const el=document.getElementById('toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(window.__campusHubToast); window.__campusHubToast=setTimeout(()=>el.classList.remove('show'),2200); };
