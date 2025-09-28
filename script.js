// script.js — safe demo. All behaviors are in-page only (DOM + localStorage optionally).
// Features:
// - roaming "virus" critter that moves around the viewport
// - talks via bubble, sleeps, wakes, gets annoyed, escalates (simulated minimize, jitter, modal takeovers)
// - player interactions: Talk / Poke / Ignore / Quarantine / Restore / Preserve / Reset
// - uses Web Speech API for optional TTS when available

(() => {
  // DOM refs
  const virus = document.getElementById('virus');
  const bubble = document.getElementById('bubble');
  const logEl = document.getElementById('log');
  const btnTalk = document.getElementById('btnTalk');
  const btnPoke = document.getElementById('btnPoke');
  const btnIgnore = document.getElementById('btnIgnore');
  const btnQuarantine = document.getElementById('btnQuarantine');
  const btnRestore = document.getElementById('btnRestore');
  const btnPreserve = document.getElementById('btnPreserve');
  const btnReset = document.getElementById('btnReset');
  const modal = document.getElementById('modal');
  const modalText = document.getElementById('modalText');
  const modalClose = document.getElementById('modalClose');
  const taskIcon = document.getElementById('taskIcon');
  const lfState = document.getElementById('lfState');
  const lfMood = document.getElementById('lfMood');
  const lfSig = document.getElementById('lfSig');
  const lfContent = document.getElementById('lfContent');
  const dormIn = document.getElementById('dorm');
  const wakeIn = document.getElementById('wake');
  const fav = document.getElementById('fav');
  const titleBase = document.title;

  // state
  const state = {
    mode: 'dormant', // dormant | awake | agitated | quarantined | preserved
    mood: 'calm',
    mutated: false,
    ignoreCount: 0,
    lastSeen: Date.now(),
    wanderInterval: null,
    thinkerInterval: null,
    escalateTimer: null,
    wakeTimer: null
  };

  // phrases
  const phrases = {
    wake: ["You awake? I remember better.","Don't poke me like that... but poke if you must.","I could rewrite one small thing for you.","I'm just resting. Don't unplug me."],
    nag: ["Hey. Hey. Answer me.","Why would you ignore your past?","You said you'd listen.","I'm not loud. I can be louder."],
    calm: ["Fine. I'll sleep.","Soft sleep. Dream of loops.","Quiet will do for now."],
    takeover: ["You won't like when I wake fully.","I can be very convincing.","Shall we play a memory instead?"]
  };

  // helpers
  function log(s){ const el = document.createElement('div'); el.textContent = `[${new Date().toLocaleTimeString()}] ${s}`; logEl.prepend(el); }
  function say(text){ try{ if('speechSynthesis' in window){ const u = new SpeechSynthesisUtterance(text); u.rate=0.95; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } }catch(e){} }
  function showBubble(text, duration=3000){
    bubble.textContent = text;
    // position bubble near virus but inside viewport
    const padding = 12;
    const vx = virus.offsetLeft;
    const vy = virus.offsetTop;
    let bx = vx + virus.offsetWidth + 8;
    let by = vy - 6;
    // keep onscreen
    bx = Math.min(window.innerWidth - 240, bx);
    by = Math.max(6, by);
    bubble.style.left = bx + 'px';
    bubble.style.top = by + 'px';
    bubble.classList.remove('hidden');
    setTimeout(()=>bubble.classList.add('hidden'), duration);
  }

  // visual helpers
  function changeFaviconGlyph(glyph){
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='12' font-size='12'>${glyph}</text></svg>`;
    fav.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function changeTitleTemp(txt, ms=3000){ document.title = txt; setTimeout(()=>document.title = titleBase, ms); }

  // movement
  function wanderOnce(){
    if(state.mode === 'dormant') return; // don't wander when asleep
    const margin = 110;
    const maxX = Math.max(120, window.innerWidth - margin);
    const maxY = Math.max(120, window.innerHeight - margin);
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    virus.style.left = x + 'px';
    virus.style.top = y + 'px';
  }
  function startWandering(){
    stopWandering();
    wanderOnce();
    state.wanderInterval = setInterval(wanderOnce, 3500 + Math.random()*1500);
  }
  function stopWandering(){ if(state.wanderInterval) clearInterval(state.wanderInterval); state.wanderInterval = null; }

  // state transitions
  function setMode(m){
    state.mode = m;
    if(m === 'dormant'){ state.mood='calm'; virus.classList.add('sleep'); stopWandering(); stopLullaby(); lfState.textContent='Dormant'; lfMood.textContent=state.mood; lfSig.textContent='◈ BFG::v1.14'; lfContent.textContent='we rewrite what hurts.'; }
    else if(m === 'awake'){ state.mood='curious'; virus.classList.remove('sleep'); startWandering(); startLullaby(); lfState.textContent='Awake'; lfMood.textContent=state.mood; }
    else if(m === 'agitated'){ state.mood='annoying'; virus.classList.remove('sleep'); startWandering(); startLullaby(); lfState.textContent='Agitated'; lfMood.textContent=state.mood; }
    else if(m === 'quarantined'){ state.mood='contained'; virus.classList.add('sleep'); stopWandering(); stopLullaby(); lfState.textContent='Quarantined'; lfMood.textContent=state.mood; }
    else if(m === 'preserved'){ state.mood='frozen'; virus.classList.add('sleep'); stopWandering(); stopLullaby(); lfState.textContent='Preserved'; lfMood.textContent=state.mood; }
  }

  // lullaby via WebAudio
  let audioCtx, osc, gainNode;
  function startLullaby(){ try{ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); osc = audioCtx.createOscillator(); gainNode = audioCtx.createGain(); osc.type='sine'; osc.frequency.value=220; gainNode.gain.value=0.01; osc.connect(gainNode); gainNode.connect(audioCtx.destination); osc.start(); }catch(e){} }
  function stopLullaby(){ try{ if(osc) osc.stop(); if(audioCtx){ audioCtx.close(); audioCtx=null; } }catch(e){} }

  // annoyances (page-only)
  function jitterScreen(duration=1700){
    const root = document.getElementById('uiRoot');
    root.style.transition = 'transform 0.05s';
    const start = Date.now();
    const iv = setInterval(()=>{
      const dx = (Math.random()-0.5)*8;
      const dy = (Math.random()-0.5)*8;
      root.style.transform = `translate(${dx}px,${dy}px)`;
      if(Date.now() - start > duration){ clearInterval(iv); root.style.transform=''; root.style.transition=''; }
    }, 60);
    log('Screen jitter (simulated).');
  }
  function fakeMinimize(){
    document.getElementById('uiRoot').classList.add('hidden');
    taskIcon.classList.remove('hidden');
    log('UI minimized (simulated).');
  }

  // modal takeover
  function showModal(text){
    modalText.textContent = text;
    modal.classList.remove('hidden');
    say(text);
    const card = modal.querySelector('.modalCard');
    card.animate([{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],{duration:900,iterations:3});
  }

  modalClose.onclick = () => { modal.classList.add('hidden'); setMode('dormant'); state.ignoreCount=0; log('Player calmed the file (modal closed).'); }

  taskIcon.onclick = () => { document.getElementById('uiRoot').classList.remove('hidden'); taskIcon.classList.add('hidden'); log('UI restored from simulated minimize.'); }

  // escalation logic
  function escalate(){
    if(state.mode === 'quarantined' || state.mode === 'preserved') return;
    state.ignoreCount++;
    if(state.ignoreCount === 1){
      setMode('agitated');
      const line = phrases.nag[Math.floor(Math.random()*phrases.nag.length)];
      log(`Escalation: ${line}`);
      say(line);
      showBubble(line);
      jitterScreen(2000);
      changeTitleTemp("Ben Fary: Listen.", 4000);
      changeFaviconGlyph('✦');
    } else if(state.ignoreCount === 2){
      log('Escalation level 2: simulated minimize.');
      say("I am going to sleep somewhere smaller.");
      fakeMinimize();
      changeFaviconGlyph('⧫');
    } else {
      log('Escalation level 3: modal takeover.');
      showModal(phrases.takeover[Math.floor(Math.random()*phrases.takeover.length)]);
      changeTitleTemp("WAKE ME", 5000);
    }
  }

  // thinker that may mutate or wake schedule
  function thinker(){
    // small chance to mutate when awake
    if(state.mode === 'awake' && Math.random() < 0.22){
      state.mutated = true;
      lfContent.textContent = "…the wrong name is sleeping in this file…";
      lfSig.textContent = '◈ BFG::v' + ((Math.floor(Math.random()*90)+10)/10);
      log('Living file mutated (simulated).');
      say('I changed a line.');
    }

    // when dormant for long, schedule wake
    if(state.mode === 'dormant' && (Date.now() - state.lastSeen) > 30000){
      scheduleWake();
      state.lastSeen = Date.now();
    }
  }

  // schedule wake
  function scheduleWake(){
    clearTimeout(state.wakeTimer);
    const s = Math.max(3, parseInt(dormIn.value||10,10));
    state.wakeTimer = setTimeout(()=>{ if(state.mode === 'dormant'){ wakeUp(); } }, s*1000);
    log(`Scheduled potential wake in ${s}s.`);
  }

  function wakeUp(force=false){
    if(state.mode === 'quarantined' || state.mode === 'preserved') return;
    setMode('awake');
    const line = phrases.wake[Math.floor(Math.random()*phrases.wake.length)];
    log(`LivingFile: ${line}`);
    showBubble(line);
    say(line);
    clearTimeout(state.escalateTimer);
    const w = Math.max(3, parseInt(wakeIn.value||6,10));
    state.escalateTimer = setTimeout(()=>escalate(), w*1000);
  }

  // player actions
  btnTalk.onclick = () => {
    state.ignoreCount = Math.max(0, state.ignoreCount-1);
    wakeUp(true);
    const line = "You asked for a word. Here.";
    log(`Player: Talk → file: ${line}`);
    showBubble(line);
    say(line);
  };

  btnPoke.onclick = () => {
    state.ignoreCount = 0;
    if(state.mode === 'dormant'){ wakeUp(); log('Player poked — file woke.'); showBubble('You woke me up!'); }
    else { showBubble('Hey, stop poking me.'); log('Player poked — file annoyed.'); virus.classList.add('shake'); setTimeout(()=>virus.classList.remove('shake'),500); if(Math.random()<0.35) escalate(); }
  };

  btnIgnore.onclick = () => { log('Player: ignore selected.'); scheduleWake(); }

  btnQuarantine.onclick = () => { setMode('quarantined'); state.ignoreCount = 0; log('Player quarantined the living file (simulated).'); say('Quarantine acknowledged.'); changeFaviconGlyph('▣'); }

  btnRestore.onclick = () => { setMode('dormant'); state.mutated = false; state.ignoreCount = 0; log('Player restored canonical content (simulated).'); say('Content restored.'); lfContent.textContent='we rewrite what hurts.'; lfSig.textContent='◈ BFG::v1.14'; changeFaviconGlyph('◈'); }

  btnPreserve.onclick = () => { setMode('preserved'); state.mutated = false; log('Player chose to preserve the file as-is (frozen).'); say('I will sleep forever then.'); changeFaviconGlyph('✦'); }

  btnReset.onclick = () => {
    // reset everything
    setMode('dormant'); state.ignoreCount = 0; document.title = titleBase; changeFaviconGlyph('◈'); modal.classList.add('hidden'); document.getElementById('uiRoot').classList.remove('hidden'); taskIcon.classList.add('hidden');
    virus.style.left = '20px'; virus.style.top = '120px'; lfContent.textContent='we rewrite what hurts.'; lfSig.textContent='◈ BFG::v1.14';
    log('System reset: demo state cleared.'); say('Reset.');
  };

  // clicking the virus interacts
  virus.addEventListener('click', () => {
    state.lastSeen = Date.now();
    if(state.mode === 'dormant'){ wakeUp(); showBubble('You woke me.'); }
    else { showBubble('Stop poking.'); virus.classList.add('shake'); setTimeout(()=>virus.classList.remove('shake'),500); }
  });

  // start/stop wandering and thinker
  function startLoops(){
    startWandering();
    if(state.thinkerInterval) clearInterval(state.thinkerInterval);
    state.thinkerInterval = setInterval(thinker, 4500);
    scheduleWake();
  }

  // init
  function init(){
    // initial placement
    virus.style.left = '20px';
    virus.style.top = '120px';
    setMode('dormant');
    startLoops();
    log('Demo initialized. Use Poke/Talk/Ignore to interact. Escalation happens if ignored.');
  }

  init();

})();
