/* CampusHub v87 — scroll smoothness helper.
   While the page is scrolling, hover effects are paused (cards under the cursor would
   otherwise repaint their shadows every frame). Passive listener: never blocks scrolling. */
(function(){
  var root=document.documentElement,timer=0,on=false;
  function stop(){on=false;root.classList.remove('is-scrolling')}
  function onScroll(){
    if(!on){on=true;root.classList.add('is-scrolling')}
    clearTimeout(timer);timer=setTimeout(stop,140);
  }
  window.addEventListener('scroll',onScroll,{passive:true,capture:true});
  window.addEventListener('wheel',onScroll,{passive:true});
  window.addEventListener('touchmove',onScroll,{passive:true});
})();
