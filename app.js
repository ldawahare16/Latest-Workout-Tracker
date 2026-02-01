import DATA from './data.json' assert { type: 'json' };

const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const LS_KEY = 'workout_tracker_v2_state';
const MUSCLE_LABELS = DATA.muscleLabels;
const MUSCLE_ORDER = DATA.muscleOrder;

let state = loadState();
let currentProfile = state._meta?.profile || 'luke';
let currentWeek = String(state._meta?.week || '1');
let currentView = state._meta?.view || 'day';

function saveMeta() {
  state._meta = { profile: currentProfile, week: currentWeek, view: currentView };
  saveState();
}
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '') || { _meta:{profile:'luke',week:'1',view:'day'} }; }
  catch { return { _meta:{profile:'luke',week:'1',view:'day'} }; }
}
function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }

function k(profile, week, dayId, exId, field){ return `${profile}::w${week}::d${dayId}::${exId}::${field}`; }
function days(){ return DATA.profiles[currentProfile].days; }

function ensureProfileOptions(){
  const sel=$('#profileSelect'); sel.innerHTML='';
  Object.entries(DATA.profiles).forEach(([id,p])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=p.label||id; sel.appendChild(o);
  });
  sel.value=currentProfile;
}
function ensureWeekOptions(){
  const weekSel=$('#weekSelect'); weekSel.innerHTML='';
  const max = DATA.profiles[currentProfile].weeks || 8;
  for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); weekSel.appendChild(o); }
  if (parseInt(currentWeek,10) > max) currentWeek='1';
  weekSel.value=currentWeek;
}
function ensureViewTabs(){
  const host=$('#viewTabs'); host.innerHTML='';
  [{id:'day',label:'Day'},{id:'week',label:'Week'},{id:'muscle',label:'Week by muscle'}].forEach(v=>{
    const b=document.createElement('button');
    b.className='btn small' + (currentView===v.id ? ' primary':'');
    b.textContent=v.label;
    b.addEventListener('click', ()=>{ currentView=v.id; saveMeta(); ensureViewTabs(); render(); });
    host.appendChild(b);
  });
}

function resetOpenDay(){
  const open = $('details.day[open]');
  if (!open) return;
  const dayId=open.dataset.day;
  const day=days().find(d=>d.id===dayId); if(!day) return;
  day.exercises.forEach(ex=>['s1','s2','s3','s4','wt','dist','time','notes','done','today'].forEach(f=>delete state[k(currentProfile,currentWeek,dayId,ex.id,f)]));
  saveState(); render();
}
function resetWeek(){
  days().forEach(d=>d.exercises.forEach(ex=>['s1','s2','s3','s4','wt','dist','time','notes','done','today'].forEach(f=>delete state[k(currentProfile,currentWeek,d.id,ex.id,f)])));
  saveState(); render();
}
function resetAll(){
  state = { _meta: state._meta || {profile:currentProfile,week:currentWeek,view:currentView} };
  saveState(); render();
}

function exerciseRow(dayId, ex){
  const row=document.createElement('div'); row.className='exercise';
  const left=document.createElement('div'); left.className='ex-left';
  left.innerHTML=`<div class="ex-name">${ex.name}</div><div class="ex-meta">${ex.meta||''}</div><div class="tags">${(ex.muscles||[]).map(m=>`<span class="tag">${MUSCLE_LABELS[m]||m}</span>`).join('')}</div>`;
  const right=document.createElement('div'); right.className='ex-right inputs';
  const addNum=(label,field,step='')=>{
    const lab=document.createElement('label'); lab.textContent=label;
    const inp=document.createElement('input'); inp.type='number'; if(step) inp.step=step;
    const key=k(currentProfile,currentWeek,dayId,ex.id,field);
    inp.value = state[key] ?? '';
    inp.addEventListener('input', ()=>{ state[key]=inp.value; saveState(); });
    lab.appendChild(inp); right.appendChild(lab);
  };
  if (ex.type==='sets3'||ex.type==='sets4'){ const max=ex.type==='sets4'?4:3; for(let i=1;i<=max;i++) addNum(`Set ${i}`,`s${i}`); }
  else if (ex.type==='run'){ addNum('Dist (mi)','dist','0.01'); addNum('Time (min)','time','0.1'); }
  else if (ex.type==='weight'){ addNum('Weight','wt'); }
  else { const p=document.createElement('div'); p.style.color='var(--muted)'; p.style.fontSize='12px'; p.textContent='Freestyle (no fields)'; right.appendChild(p); }

  const toggles=document.createElement('div'); toggles.style.display='flex'; toggles.style.gap='10px'; toggles.style.flexWrap='wrap'; toggles.style.alignItems='center';
  const doneKey=k(currentProfile,currentWeek,dayId,ex.id,'done');
  const doneLabel=document.createElement('label'); doneLabel.className='toggle';
  const doneCb=document.createElement('input'); doneCb.type='checkbox'; doneCb.checked=!!state[doneKey];
  doneCb.addEventListener('change', ()=>{ state[doneKey]=doneCb.checked; saveState(); render(); });
  doneLabel.appendChild(doneCb); doneLabel.appendChild(document.createTextNode('Done'));
  toggles.appendChild(doneLabel);
  right.appendChild(toggles);

  const notesKey=k(currentProfile,currentWeek,dayId,ex.id,'notes');
  const notes=document.createElement('input'); notes.type='text'; notes.placeholder='Notes / RPE'; notes.value=state[notesKey]||'';
  notes.addEventListener('input', ()=>{ state[notesKey]=notes.value; saveState(); });
  right.appendChild(notes);

  row.appendChild(left); row.appendChild(right);
  return row;
}

function dayComplete(day){
  const total=day.exercises.length;
  const done=day.exercises.filter(ex=>!!state[k(currentProfile,currentWeek,day.id,ex.id,'done')]).length;
  return {total,done};
}

function renderDay({expandAll=false}={}){
  const host=$('#app'); host.innerHTML='';
  days().forEach((day, idx)=>{
    const det=document.createElement('details'); det.className='card day'; det.dataset.day=day.id;
    det.open = expandAll || idx===0;
    const {total,done}=dayComplete(day);

    const sum=document.createElement('summary');
    sum.innerHTML = `<div class="day-title">${day.title}</div><div class="badge">${done}/${total} done</div>`;
    det.appendChild(sum);
    day.exercises.forEach(ex=>det.appendChild(exerciseRow(day.id, ex)));
    host.appendChild(det);
  });
}

function canonicalMuscle(ex){
  const mus=ex.muscles||[];
  for(const m of MUSCLE_ORDER) if (mus.includes(m)) return m;
  return mus[0]||'other';
}

function renderMuscle(){
  const host=$('#app'); host.innerHTML='';
  const map=new Map();
  days().forEach(day=>day.exercises.forEach(ex=>{
    const m=canonicalMuscle(ex);
    if(!map.has(m)) map.set(m, []);
    map.get(m).push({day,ex});
  }));

  const ordered=[...new Set([...MUSCLE_ORDER, ...map.keys()])];
  ordered.forEach(m=>{
    if(!map.has(m)) return;
    const card=document.createElement('div'); card.className='card';
    card.innerHTML = `<div style="font-weight:900;margin-bottom:6px;">${MUSCLE_LABELS[m]||m}</div>`;
    map.get(m).forEach(({day,ex})=>{
      const row=document.createElement('div'); row.className='exercise';
      const left=document.createElement('div'); left.className='ex-left';
      left.innerHTML = `<div class="ex-name">${ex.name}</div><div class="ex-meta">${day.title} · ${ex.meta||''}</div>`;
      const right=document.createElement('div'); right.className='ex-right';
      const todayKey=k(currentProfile,currentWeek,day.id,ex.id,'today');
      const doneKey=k(currentProfile,currentWeek,day.id,ex.id,'done');

      const tLab=document.createElement('label'); tLab.className='toggle';
      const tCb=document.createElement('input'); tCb.type='checkbox'; tCb.checked=!!state[todayKey];
      tCb.addEventListener('change', ()=>{ state[todayKey]=tCb.checked; saveState(); });
      tLab.appendChild(tCb); tLab.appendChild(document.createTextNode("Today's Lift"));

      const dLab=document.createElement('label'); dLab.className='toggle';
      const dCb=document.createElement('input'); dCb.type='checkbox'; dCb.checked=!!state[doneKey];
      dCb.addEventListener('change', ()=>{ state[doneKey]=dCb.checked; saveState(); });
      dLab.appendChild(dCb); dLab.appendChild(document.createTextNode('Done'));

      right.appendChild(tLab); right.appendChild(dLab);
      row.appendChild(left); row.appendChild(right);
      card.appendChild(row);
    });
    host.appendChild(card);
  });
}

/* Gym mode + rest timer */
let gym={dayId:'today', list:[], index:0};
let rest={total:90, remaining:90, running:false, interval:null};
const fmt = s => { s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), r=s%60; return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0'); };
const updateClock=()=>{ $('#restClock').textContent = fmt(rest.remaining); };
function beep(){ try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.08; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{o.stop(); ctx.close();},180);}catch{} }
function setRest(sec){ rest.total=sec; rest.remaining=sec; rest.running=false; if(rest.interval){clearInterval(rest.interval); rest.interval=null;} updateClock(); }
function startRest(){ if(rest.running) return; rest.running=true; if(rest.interval) clearInterval(rest.interval); rest.interval=setInterval(()=>{ if(!rest.running) return; rest.remaining-=1; updateClock(); if(rest.remaining<=0){ rest.running=false; clearInterval(rest.interval); rest.interval=null; rest.remaining=0; updateClock(); beep(); } },1000); }
function pauseRest(){ rest.running=false; }
function resetRest(){ rest.running=false; rest.remaining=rest.total; updateClock(); }

function buildGymList(dayId){
  const list=[];
  if (dayId==='today'){
    days().forEach(day=>day.exercises.forEach(ex=>{
      const today=!!state[k(currentProfile,currentWeek,day.id,ex.id,'today')];
      if(!today) return;
      const done=!!state[k(currentProfile,currentWeek,day.id,ex.id,'done')];
      if(!done) list.push({dayId:day.id, exId:ex.id});
    }));
    if(list.length===0){
      days().forEach(day=>day.exercises.forEach(ex=>{
        const today=!!state[k(currentProfile,currentWeek,day.id,ex.id,'today')];
        if(today) list.push({dayId:day.id, exId:ex.id});
      }));
    }
    return list;
  }
  const day=days().find(d=>d.id===dayId); if(!day) return [];
  day.exercises.forEach(ex=>{
    const done=!!state[k(currentProfile,currentWeek,day.id,ex.id,'done')];
    if(!done) list.push({dayId:day.id, exId:ex.id});
  });
  if(list.length===0) day.exercises.forEach(ex=>list.push({dayId:day.id, exId:ex.id}));
  return list;
}
function exSpec(dayId, exId){ const day=days().find(d=>d.id===dayId); return day? day.exercises.find(e=>e.id===exId):null; }

function renderGym(){
  const host=$('#gymExerciseHost'); host.innerHTML='';
  $('#gymExerciseCounter').textContent = `${gym.list.length? gym.index+1:0} of ${gym.list.length}`;
  if(!gym.list.length){ host.innerHTML=`<div style="color:var(--muted);font-size:12px;">No exercises selected.</div>`; return; }
  gym.index=Math.max(0,Math.min(gym.index,gym.list.length-1));
  const {dayId, exId}=gym.list[gym.index];
  const ex=exSpec(dayId, exId);
  if(!ex){ host.innerHTML=`<div style="color:var(--muted);font-size:12px;">Missing exercise.</div>`; return; }

  $('#gymDayTitle').textContent = (gym.dayId==='today') ? "Today's Lift" : (days().find(d=>d.id===gym.dayId)?.title||'Gym mode');

  const card=document.createElement('div'); card.className='card'; card.style.margin='0';
  const head=document.createElement('div'); head.style.display='flex'; head.style.justifyContent='space-between'; head.style.alignItems='center'; head.style.gap='10px';
  head.innerHTML = `<div><div style="font-weight:900;">${ex.name}</div><div style="color:var(--muted);font-size:12px;">${ex.meta||''}</div></div>`;

  const doneKey=k(currentProfile,currentWeek,dayId,exId,'done');
  const doneLabel=document.createElement('label'); doneLabel.className='toggle';
  const doneCb=document.createElement('input'); doneCb.type='checkbox'; doneCb.checked=!!state[doneKey];
  doneCb.addEventListener('change', ()=>{ state[doneKey]=doneCb.checked; saveState(); if(doneCb.checked){ gym.list=buildGymList(gym.dayId); gym.index=Math.max(0,Math.min(gym.index,gym.list.length-1)); } renderGym(); render(); });
  doneLabel.appendChild(doneCb); doneLabel.appendChild(document.createTextNode('Done'));
  head.appendChild(doneLabel);
  card.appendChild(head);

  const row=document.createElement('div'); row.className='exercise';
  row.innerHTML = `<div class="ex-left" style="color:var(--muted);font-size:12px;">Log sets</div>`;
  const right=document.createElement('div'); right.className='ex-right inputs';

  const addNum=(label,field,step='')=>{
    const lab=document.createElement('label'); lab.textContent=label;
    const inp=document.createElement('input'); inp.type='number'; if(step) inp.step=step;
    const key2=k(currentProfile,currentWeek,dayId,exId,field);
    inp.value = state[key2] ?? '';
    inp.addEventListener('input', ()=>{ state[key2]=inp.value; saveState(); if(inp.value!==''){ rest.remaining=rest.total; updateClock(); startRest(); } });
    lab.appendChild(inp); right.appendChild(lab);
  };
  if (ex.type==='sets3'||ex.type==='sets4'){ const max=ex.type==='sets4'?4:3; for(let i=1;i<=max;i++) addNum(`Set ${i}`,`s${i}`); }
  else if (ex.type==='run'){ addNum('Dist (mi)','dist','0.01'); addNum('Time (min)','time','0.1'); }
  else if (ex.type==='weight'){ addNum('Weight','wt'); }
  else { const p=document.createElement('div'); p.style.color='var(--muted)'; p.style.fontSize='12px'; p.textContent='Freestyle (no fields)'; right.appendChild(p); }

  const notesKey=k(currentProfile,currentWeek,dayId,exId,'notes');
  const notes=document.createElement('input'); notes.type='text'; notes.placeholder='Notes / RPE'; notes.value=state[notesKey]||'';
  notes.addEventListener('input', ()=>{ state[notesKey]=notes.value; saveState(); });
  right.appendChild(notes);

  row.appendChild(right);
  card.appendChild(row);
  host.appendChild(card);
}

function openGym(){
  const anyToday = days().some(day=>day.exercises.some(ex=>!!state[k(currentProfile,currentWeek,day.id,ex.id,'today')]));
  gym.dayId = anyToday ? 'today' : days()[0].id;
  $('#gymDaySelect').value = gym.dayId;
  gym.list = buildGymList(gym.dayId);
  gym.index=0;
  $('#gymOverlay').classList.add('open');
  $('#gymOverlay').setAttribute('aria-hidden','false');
  updateClock(); renderGym();
}
function closeGym(){ $('#gymOverlay').classList.remove('open'); $('#gymOverlay').setAttribute('aria-hidden','true'); pauseRest(); }

function initGymUI(){
  const sel=$('#gymDaySelect'); sel.innerHTML='';
  const o0=document.createElement('option'); o0.value='today'; o0.textContent="Today's Lift (selected)"; sel.appendChild(o0);
  days().forEach(d=>{ const o=document.createElement('option'); o.value=d.id; o.textContent=d.title; sel.appendChild(o); });
  sel.value='today';
  sel.onchange=()=>{ gym.dayId=sel.value; gym.list=buildGymList(gym.dayId); gym.index=0; renderGym(); };

  $('#gymModeBtn').onclick=openGym;
  $('#gymPrevBtn').onclick=()=>{ gym.index=Math.max(0,gym.index-1); renderGym(); };
  $('#gymNextBtn').onclick=()=>{ gym.index=Math.min(gym.list.length-1,gym.index+1); renderGym(); };
  $('#gymExitBtn').onclick=closeGym;

  $('#restStartBtn').onclick=startRest;
  $('#restPauseBtn').onclick=pauseRest;
  $('#restResetBtn').onclick=resetRest;
  $$('#restPresets button[data-rest]').forEach(b=>b.onclick=()=>{ setRest(parseInt(b.dataset.rest,10)); startRest(); });

  document.onkeydown=(e)=>{ if(e.key==='Escape' && $('#gymOverlay').classList.contains('open')) closeGym(); };
  setRest(90);
}

function render(){
  if(currentView==='day') renderDay({expandAll:false});
  if(currentView==='week') renderDay({expandAll:true});
  if(currentView==='muscle') renderMuscle();
}

function init(){
  ensureProfileOptions(); ensureWeekOptions(); ensureViewTabs();
  $('#profileSelect').onchange=()=>{ currentProfile=$('#profileSelect').value; ensureWeekOptions(); ensureViewTabs(); initGymUI(); saveMeta(); render(); };
  $('#weekSelect').onchange=()=>{ currentWeek=$('#weekSelect').value; saveMeta(); render(); };
  $('#resetDayBtn').onclick=resetOpenDay;
  $('#resetWeekBtn').onclick=resetWeek;
  $('#resetAllBtn').onclick=resetAll;
  initGymUI();
  render();
}
init();
