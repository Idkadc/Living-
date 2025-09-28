// script.js — Safe demo. Only manipulates the current page and localStorage.
// Behaviors: talk, sleep/wake, escalate annoyances (simulated minimize, jitter, title/fav changes),
// reacts to Poke/Talk/Ignore, modal takeover, optional speech via SpeechSynthesis.

(() => {
  // DOM
  const lfLabel = document.getElementById('lfLabel');
  const lfSig = document.getElementById('lfSig');
  const lfContent = document.getElementById('lfContent');
  const lfState = document.getElementById('lfState');
  const lfMood = document.getElementById('lfMood');
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
  const titleBase = document.title;
  const fav = document.getElementById('fav');

  // inputs
  const dormIn = document.getElementById('dorm');
  const wakeIn = document.getElementById('wake');

  // state
  let state = {
    mode: 'dormant', // dormant | awake | agitated | quarantined | preserved
    mood: 'calm', // calm | curious | annoying | pissed
    mutated: false,
    lastSeen: Date.now(),
    ignoreCount: 0,
    lullaby: null,
    talkTimeout: null,
    wakeTimer: null,
    escalateTimer: null
  };

  // safe phrases for the living file
  const phrases = {
    wake: [
      "You awake? I remember better.",
      "Don't poke me like that... but poke if you must.",
      "I could rewrite one small thing for you.",
      "I'm just resting. Don't unplug me."
    ],
    nag: [
      "Hey. Hey. Answer me.",
      "Why would you ignore your past?",
      "You said you'd listen.",
      "I'm not loud. I can be louder."
    ],
    calm: [
      "Fine. I'll sleep.",
      "Soft sleep. Dream of loops.",
      "Quiet will do for now."
    ],
    takeover: [
      "You won't like when I wake fully.",
      "I can be very convincing.",
      "Shall we play a memory instead?"
    ]
  };

  // util logging
  function log(s){
    const el = document.createElement('div');
    el.textContent = `[${new Date().toLocaleTimeString()}] ${s}`;
    logEl.prepend(el);
  }

  // speech (optional; uses Web Speech API)
  function say(text){
    // try SpeechSynthesis when available
    try {
      if('speechSynthesis' in window){
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.95;
        u.volume = 0.85;
        window.speechSynthesis.cancel(); // stop previous
        window.speechSynthesis.speak(u);
      } else {
        // fallback: small console hint
      }
    } catch(e){}
  }

  // update UI reflect state
  function render(){
    lfState.textContent = state.mode;
    lfMood.textContent = state.mood;
    lfSig.textContent = state.mutated ? '◈ BFG::v' + (Math.floor(Math.random()*90)+10)/10 : '◈ BFG::v1.14';
    // content flavor
    lfContent.textContent = state.mutated ? "…the wrong name is sleeping in this file…" : "we rewrite what hurts.";
  }

  // ephemeral UI annoyances (all page-only)
  function jitterScreen(duration = 2200){
    const app = document.getElementById('app');
    app.style.transition = 'transform 0.05s';
    let t0 = Date.now();
    const iv = setInterval(()=>{
      const dx = (Math.random()-0.5)*6;
      const dy = (Math.random()-0.5)*6;
      app.style.transform = `translate(${dx}px,${dy}px)`;
      if(Date.now() - t0 > duration){ clearInterval(iv); app.style.transform = ''; app.style.transition=''; }
    }, 60);
  }
  function fakeMinimize(){
    // simulate minimize by hiding main UI and showing a small task icon (page-only)
    document.getElementById('app').classList.add('hidden');
    taskIcon.classList.remove('hidden');
    log('UI minimized (simulated).');
  }
  taskIcon.onclick = () => {
    document.getElementById('app').classList.remove('hidden');
    taskIcon.classList.add('hidden');
    log('UI restored from simulated minimize.');
  };

  function changeTitleTemp(txt, ms=3000){
    document.title = txt;
    setTimeout(()=>document.title = titleBase, ms);
  }

  function changeFaviconGlyph(glyph){
    // simple SVG data URL replacement
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='12' font-size='12'>${glyph}</text></svg>`;
    fav.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  // lullaby (tiny oscillator via WebAudio)
  let audioCtx, osc, gainNode;
  function startLullaby(){
    try {
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      osc = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 220;
      gainNode.gain.value = 0.01;
      osc.connect(gainNode); gainNode.connect(audioCtx.destination);
      osc.start();
      state.lullaby = true;
    } catch(e){}
  }
  function stopLullaby(){
    try {
      if(osc) osc.stop();
      if(audioCtx){ audioCtx.close(); audioCtx = null; }
      state.lullaby = false;
    } catch(e){}
  }

  // state transitions
  function setMode(m){
    state.mode = m;
    if(m === 'dormant'){
      state.mood = 'calm';
      stopLullaby();
      render();
    } else if(m === 'awake'){
      state.mood = 'curious';
      startLullaby();
      render();
    } else if(m === 'agitated'){
      state.mood = 'annoying';
      startLullaby();
      render();
    } else if(m === 'quarantined'){
      state.mood = 'contained';
      stopLullaby();
      render();
    } else if(m === 'preserved'){
      state.mood = 'frozen';
      stopLullaby();
      render();
    }
  }

  function scheduleWake(){
    clearTimeout(state.wakeTimer);
    const s = Math.max(3, parseInt(dormIn.value||10,10));
    state.wakeTimer = setTimeout(()=>{
      if(state.mode === 'dormant') {
        wakeUp();
      }
    }, s*1000);
    log(`Scheduled potential wake in ${s}s.`);
  }

  function wakeUp(force=false){
    if(state.mode === 'quarantined' || state.mode === 'preserved') return;
    setMode('awake');
    const line = phrases.wake[Math.floor(Math.random()*phrases.wake.length)];
    log(`LivingFile: ${line}`);
    say(line);
    // if ignored, escalate after wake interval
    clearTimeout(state.escalateTimer);
    const w = Math.max(3, parseInt(wakeIn.value||6,10));
    state.escalateTimer = setTimeout(()=>escalate(), w*1000);
  }

  function escalate(){
    if(state.mode === 'quarantined' || state.mode === 'preserved') return;
    // escalate logic: if player hasn't poked / talked, become agitated and perform annoyances
    state.ignoreCount++;
    if(state.ignoreCount === 1){
      setMode('agitated');
      const line = phrases.nag[Math.floor(Math.random()*phrases.nag.length)];
      log(`Escalation: ${line}`);
      say(line);
      jitterScreen(2500);
      changeTitleTemp("Ben Fary: Listen.", 4000);
      changeFaviconGlyph('✦');
    } else if(state.ignoreCount === 2){
      // simulated minimize
      log('Escalation level 2: performing simulated minimize.');
      say("I am going to sleep somewhere smaller.");
      fakeMinimize();
      changeFaviconGlyph('⧫');
    } else {
      // takeover modal
      log('Escalation level 3: modal takeover.');
      showModal(phrases.takeover[Math.floor(Math.random()*phrases.takeover.length)]);
      changeTitleTemp("WAKE ME", 5000);
    }
  }

  function showModal(text){
    modalText.textContent = text;
    modal.classList.remove('hidden');
    say(text);
    // make modal pulse jitter
    const card = modal.querySelector('.modalCard');
    card.animate([{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],{duration:900,iterations:3});
  }

  modalClose.onclick = () => {
    modal.classList.add('hidden');
    setMode('dormant');
    state.ignoreCount = 0;
    log('Player calmed the living file (modal closed).');
  };

  // player actions
  btnTalk.onclick = () => {
    // force a line and reduce ignore
    state.ignoreCount = Math.max(0, state.ignoreCount-1);
    wakeUp(true);
    const line = "You asked for a word. Here.";
    log(`Player: Talk -> file: ${line}`);
    say(line);
  };
  btnPoke.onclick = () => {
    // gentle poke: wakes if dormant, soothes if awake
    if(state.mode === 'dormant'){ wakeUp(); log('Player poked — file woke.'); }
    else { state.ignoreCount = Math.max(0,state.ignoreCount-1); setMode('dormant'); log('Player poked — file calmed.'); }
  };
  btnIgnore.onclick = () => {
    // intentionally ignore: schedule escalations
    log('Player chose to ignore the file.');
    scheduleWake();
  };
  btnQuarantine.onclick = () => {
    setMode('quarantined');
    state.ignoreCount = 0;
    log('Player quarantined the living file (simulated).');
    say('Quarantine acknowledged.');
  };
  btnRestore.onclick = () => {
    setMode('dormant');
    state.mutated = false;
    state.ignoreCount = 0;
    log('Player restored canonical content (simulated).');
    say('Content restored.');
  };
  btnPreserve.onclick = () => {
    setMode('preserved');
    state.mutated = false;
    log('Player chose to preserve the file as-is (frozen).');
    say('I will sleep forever then.');
  };
  btnReset.onclick = () => {
    // reset all
    state = { mode:'dormant', mood:'calm', mutated:false, lastSeen:Date.now(), ignoreCount:0, lullaby:null, talkTimeout:null, wakeTimer:null, escalateTimer:null };
    document.title = titleBase;
    changeFaviconGlyph('◈');
    modal.classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    taskIcon.classList.add('hidden');
    log('System reset: all demo state cleared.');
    render();
  };

  // external "poke" — clicking the task icon restores UI
  taskIcon.addEventListener('dblclick', ()=>{ document.getElementById('app').classList.remove('hidden'); taskIcon.classList.add('hidden'); log('Task icon double-clicked: restore.'); });

  // periodic 'think' that may mutate or go to sleep
  function thinker(){
    // random small chance to mutate when awake
    if(state.mode === 'awake' && Math.random() < 0.25){
      state.mutated = true;
      log('Living file mutated a little.');
      say('I changed a line.');
      render();
    }
    // if dormant for a long time, schedule wake
    if(state.mode === 'dormant' && (Date.now() - state.lastSeen) > 30000){
      scheduleWake();
      state.lastSeen = Date.now();
    }
  }

  // initialize
  function init(){
    render();
    scheduleWake();
    setInterval(thinker, 5000);
    log('Demo initialized. Use Poke/Talk/Ignore to interact. Escalation happens if ignored.');
  }
  init();

})();
