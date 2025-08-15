(function(){
  const $ = s => document.querySelector(s);
  const screens = { start:$('#screen-start'), how:$('#screen-how'), game:$('#screen-game'), over:$('#screen-over') };
  const el = {
    nick:$('#nick'), btnStart:$('#btn-start'), btnHow:$('#btn-how'), btnBack:$('#btn-back'),
    btnPause:$('#btn-pause'), btnLeft:$('#btn-left'), btnRight:$('#btn-right'), btnAgain:$('#btn-again'),
    time:$('#time'), score:$('#score'), best:$('#best'), state:$('#state'),
    stage:$('#stage'), stageWrap:$('#stage-wrap'), turboBadge:$('#turbo'),
    share:$('#btn-share'), shareOver:$('#btn-share-over'),
    finalScore:$('#final-score'), finalBest:$('#final-best'),
  };
  const STORAGE_KEY='lamumu-milk-rush'; const load=()=>JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
  const save=d=>localStorage.setItem(STORAGE_KEY,JSON.stringify({...load(),...d}));
  const ctx = el.stage.getContext('2d'); const W=el.stage.width, H=el.stage.height;

  const assetSrc = { lamumu:'assets/lamumu.png', milk:'assets/milk.svg', hay:'assets/hay.svg', gold:'assets/gold.svg', bucket:'assets/bucket.svg', mud:'assets/mud.svg', bg:'assets/bg.svg' };
  const sprites = {}; for(const k in assetSrc){ const img=new Image(); img.src=assetSrc[k]; sprites[k]=img; }

  let st = { running:false, paused:false, over:false, timeLeft:60, score:0, best:0, nickname:'player',
    turbo:0, milkStreak:0, slow:0, px:W/2, py:H-90, vx:0, items:[], t:0, lastSpawn:0 };
  const VALUES={milk:10, hay:5, gold:20, bucket:-10, mud:-15};
  const SPEEDS={base:220, player:480};

  let left=false,right=false;
  window.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a') left=true;
    if(e.key==='ArrowRight'||e.key.toLowerCase()==='d') right=true; if(e.key===' '){e.preventDefault(); togglePause();}});
  window.addEventListener('keyup',e=>{ if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a') left=false;
    if(e.key==='ArrowRight'||e.key.toLowerCase()==='d') right=false; });
  el.btnLeft.addEventListener('touchstart',()=>left=true); el.btnLeft.addEventListener('touchend',()=>left=false);
  el.btnRight.addEventListener('touchstart',()=>right=true); el.btnRight.addEventListener('touchend',()=>right=false);
    // mouse/pointer support added
    el.btnLeft.addEventListener('pointerdown', ()=> left = true, {passive:true});
    el.btnLeft.addEventListener('pointerup',   ()=> left = false, {passive:true});
    el.btnLeft.addEventListener('pointerleave',()=> left = false, {passive:true});
    el.btnRight.addEventListener('pointerdown', ()=> right = true, {passive:true});
    el.btnRight.addEventListener('pointerup',   ()=> right = false, {passive:true});
    el.btnRight.addEventListener('pointerleave',()=> right = false, {passive:true});


  el.stage.addEventListener('pointerdown',e=>{ const r=el.stage.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*W; st.px=x; });
  el.stage.addEventListener('pointermove',e=>{ if(e.buttons!==1) return; const r=el.stage.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*W; st.px=x; });

  function setScreen(n){ Object.values(screens).forEach(s=>s.classList.remove('active')); screens[n].classList.add('active'); }
  el.btnStart.addEventListener('click', startGame); el.btnHow.addEventListener('click',()=>setScreen('how'));
  el.btnBack.addEventListener('click',()=>setScreen('start')); el.btnPause.addEventListener('click',togglePause);
  el.btnAgain.addEventListener('click',()=>setScreen('start'));

  function startGame(){
    const d=load(); st.best=d.best||0; el.best.textContent=st.best;
    st.nickname=(el.nick.value.trim()||d.nickname||'player'); save({nickname:st.nickname});
    Object.assign(st,{running:true,paused:false,over:false,timeLeft:60,score:0,turbo:0,milkStreak:0,slow:0,px:W/2,py:H-90,vx:0,items:[],t:0,lastSpawn:0});
    updateShare(); el.state.textContent='—'; setScreen('game'); requestAnimationFrame(loop);
  }
  function togglePause(){ if(!st.running) return; st.paused=!st.paused; el.btnPause.textContent=st.paused?'Resume':'Pause'; el.state.textContent=st.paused?'PAUSED':'—'; }
  function spawn(){
    const kinds=[{id:'milk',w:34,h:34,p:.30},{id:'hay',w:36,h:36,p:.23},{id:'gold',w:34,h:34,p:.17},{id:'bucket',w:36,h:36,p:.16},{id:'mud',w:34,h:34,p:.14}];
    let r=Math.random(),acc=0,pick=kinds[0]; for(const k of kinds){ acc+=k.p; if(r<=acc){ pick=k; break; } }
    const x=40+Math.random()*(W-80); const spd=SPEEDS.base+Math.random()*120+(st.t*3); st.items.push({kind:pick.id,x,y:-40,w:pick.w,h:pick.h,vy:spd});
  }
  function collide(a,b){ return (Math.abs(a.x-b.x)<(a.w+b.w)/2)&&(Math.abs(a.y-b.y)<(a.h+b.h)/2); }
  function loop(ts){
    if(!st._lt) st._lt=ts; const dt=Math.min(.033,(ts-st._lt)/1000); st._lt=ts;
    if(!st.running) return; if(st.paused){ requestAnimationFrame(loop); return; }
    st.t+=dt; st.timeLeft-=dt; if(st.timeLeft<=0){ st.running=false; st.over=true; gameOver(); return; }
    const slowFactor=st.slow>0?0.5:1; const speed=SPEEDS.player*slowFactor; if(left) st.px-=speed*dt; if(right) st.px+=speed*dt;
    st.px=Math.max(40,Math.min(W-40,st.px)); if(st.slow>0) st.slow-=dt;
    st.lastSpawn+=dt; const spawnEvery=Math.max(.22,.6-st.t*.01); if(st.lastSpawn>=spawnEvery){ st.lastSpawn=0; spawn(); }
    const mult=st.turbo>0?2:1; let newItems=[];
    for(const it of st.items){
      it.y+=it.vy*dt; const player={x:st.px,y:st.py,w:70,h:70}; const ib={x:it.x,y:it.y,w:it.w,h:it.h};
      if(collide(player,ib)){
        if(it.kind==='milk'){ st.milkStreak+=1; st.score+=VALUES.milk*mult; if(st.milkStreak>=3){ st.turbo=10; st.milkStreak=0; flash('TURBO MILK! ×2'); } }
        else if(it.kind==='hay'){ st.score+=VALUES.hay*mult; st.milkStreak=0; }
        else if(it.kind==='gold'){ st.score+=VALUES.gold*mult; st.milkStreak=0; }
        else if(it.kind==='bucket'){ st.score+=VALUES.bucket; st.milkStreak=0; }
        else if(it.kind==='mud'){ st.score+=VALUES.mud; st.slow=2.5; st.milkStreak=0; flash('SLOWED!!'); }
      } else if(it.y<H+60){ newItems.push(it); }
    }
    st.items=newItems; if(st.turbo>0){ st.turbo-=dt; el.stageWrap.classList.add('turbo-on'); } else { el.stageWrap.classList.remove('turbo-on'); }
    el.time.textContent=Math.ceil(st.timeLeft); el.score.textContent=st.score; if(st.score>st.best){ st.best=st.score; save({best:st.best}); el.best.textContent=st.best; }
    el.turboBadge.style.display=st.turbo>0?'block':'none'; render(); updateShare(); requestAnimationFrame(loop);
  }
  function render(){
    ctx.clearRect(0,0,W,H); drawBG();
    ctx.save(); ctx.translate(st.px, st.py); const wob=Math.sin(st.t*10)*2; ctx.translate(0,wob); drawSprite('lamumu', -35,-38,70,76); ctx.restore();
    for(const it of st.items){ drawSprite(it.kind, it.x-it.w/2, it.y-it.h/2, it.w, it.h); }
    const grd=ctx.createRadialGradient(st.px,H-30,10,st.px,H-30,120); grd.addColorStop(0,'rgba(248,211,74,.25)'); grd.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grd; ctx.fillRect(0,H-160,W,160);
  }
  function drawBG(){ const img=sprites.bg; const w=450,h=270; for(let y=0;y<H;y+=h){ for(let x=0;x<W;x+=w){ ctx.drawImage(img,x,y,w,h);} } }
  function drawSprite(n,x,y,w,h){ const img=sprites[n]; if(img&&img.complete) ctx.drawImage(img,x,y,w,h); else { ctx.fillStyle='#222'; ctx.fillRect(x,y,w,h);} }
  function flash(t){ el.state.textContent=t; setTimeout(()=>{ if(!st.paused) el.state.textContent='—'; },1000); }
  function updateShare(){
  const scoreMsg = `I scored ${st.score} points in Lamumu Milk Rush! 🐄🥛 @traderibo123 @lamumudotxyz #MilkRush`;
  const text = encodeURIComponent(scoreMsg);
  const url = encodeURIComponent('https://lamumu-milk-rush.vercel.app');
  const hashtags = encodeURIComponent('Lamumu,MilkRush');
  const shareUrl = `https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`;
  if (el.share) el.share.setAttribute('href', shareUrl);
  if (el.shareOver) el.shareOver.setAttribute('href', shareUrl);
}
  function gameOver(){ setScreen('over'); el.finalScore.textContent=st.score; el.finalBest.textContent=st.best; }
  (function init(){ const d=load(); if(d.best) el.best.textContent=d.best; if(d.nickname) el.nick.value=d.nickname; })();
})();

// v3: Build X share link on click (English text + tag @traderibo123)
(function(){
  var shareBtn = document.getElementById('btn-share-over');
  if (shareBtn) {
    shareBtn.addEventListener('click', function(e){
      var scoreEl = document.getElementById('final-score');
      var score = scoreEl ? (scoreEl.textContent || '0') : '0';
      var text = `I scored ${score} points in Lamumu Milk Rush! 🐄🥛 @traderibo123 #Lamumu #MilkRush`;
      var url = encodeURIComponent(window.location.href);
      var intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
      this.setAttribute('href', intent);
    });
  }
})();
