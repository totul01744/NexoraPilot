/* হোম পেজের ৩-স্লাইড ভিডিও ব্যানার: autoplay, dots, arrows, swipe। শুধু সক্রিয় স্লাইডের ভিডিও চলে (পারফরম্যান্স) */
(function(){
  var root=document.getElementById('heroSlider'); if(!root) return;
  var slides=[].slice.call(root.querySelectorAll('.hs-slide')), dots=[].slice.call(root.querySelectorAll('.hs-dot'));
  var cur=0, timer=null, DUR=6500, reduce=false;
  try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  root.style.setProperty('--hs-t',DUR+'ms');
  function play(v){ if(!v||reduce) return; try{ var p=v.play(); if(p&&p.catch)p.catch(function(){}); }catch(e){} }
  function go(n){
    cur=(n+slides.length)%slides.length;
    slides.forEach(function(s,i){
      var on=i===cur; s.classList.toggle('on',on); s.setAttribute('aria-hidden',on?'false':'true');
      var v=s.querySelector('video'); if(v){ if(on){ if(v.preload!=='auto')v.preload='auto'; try{v.currentTime=0;}catch(e){} play(v);} else { try{v.pause();}catch(e){} } }
    });
    dots.forEach(function(d,i){ d.classList.remove('on'); if(i===cur){ void d.offsetWidth; d.classList.add('on'); } d.setAttribute('aria-selected',i===cur); });
    restart();
  }
  function restart(){ clearTimeout(timer); if(reduce) return; timer=setTimeout(function(){go(cur+1);},DUR); }
  root.querySelector('.hs-prev').addEventListener('click',function(){go(cur-1);});
  root.querySelector('.hs-next').addEventListener('click',function(){go(cur+1);});
  dots.forEach(function(d,i){d.addEventListener('click',function(){go(i);});});
  root.addEventListener('mouseenter',function(){root.classList.add('paused');clearTimeout(timer);});
  root.addEventListener('mouseleave',function(){root.classList.remove('paused');restart();});
  var sx=null; root.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
  root.addEventListener('touchend',function(e){ if(sx==null) return; var dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>50) go(cur+(dx<0?1:-1)); },{passive:true});
  document.addEventListener('visibilitychange',function(){ if(document.hidden){clearTimeout(timer);slides.forEach(function(s){var v=s.querySelector('video');if(v)v.pause();});} else go(cur); });
  /* ভিডিও লোড ব্যর্থ হলে poster/gradient থেকে যাবে */
  slides.forEach(function(s){var v=s.querySelector('video'); if(v) v.addEventListener('error',function(){v.style.display='none';});});
  go(0);
})();
