const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

const LS_KEY = 'workout_tracker_v3_state';

let DATA = null;
let MUSCLE_LABELS = {};
let MUSCLE_ORDER = [];
let CARDIO_MODES = [];

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
function profile(){ return DATA?.profiles?.[currentProfile]; }
function days(){ return profile()?.days || []; }

function kgFromLbs(lbs){ return (parseFloat(lbs||0) || 0) * 0.45359237; }

function ensureProfileOptions(){
  const sel=$('#profileSelect'); if(!sel) return;
  sel.innerHTML='';
  Object.entries(DATA?.profiles||{}).forEach(([id,p])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=p.label||id; sel.appendChild(o);
  });
  if (!DATA?.profiles?.[currentProfile]) currentProfile = Object.keys(DATA?.profiles||{})[0] || 'luke';
  sel.value=currentProfile;
}
function ensureWeekOptions(){
  const sel=$('#weekSelect'); if(!sel) return;
  sel.innerHTML='';
  const max = profile()?.weeks || 8;
  for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); sel.appendChild(o); }
  if (parseInt(currentWeek,10) > max) currentWeek='1';
  sel.value=currentWeek;
}
function ensureViewTabs(){
  const host=$('#viewTabs'); if(!host) return;
  host.innerHTML='';
  [
    {id:'day',label:'Day'},
    {id:'week',label:'Week'},
    {id:'muscle',label:'Week by muscle'},
    {id:'summary',label:'Summary'}
  ].forEach(v=>{
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
  day.exercises.forEach(ex=>resetExercise(dayId, ex.id, ex.type));
  saveState(); render();
}
function resetExercise(dayId, exId, type){
  const fields = ['notes','done','today'];
  if(type==='sets3'||type==='sets4') fields.push('s1','s2','s3','s4');
  if(type==='weight') fields.push('wt');
  if(type==='cardio') fields.push('c_mode','c_met','c_min','c_dist','c_incline','c_hr','c_rpe');
  if(type==='run') fields.push('dist','time'); // legacy
  fields.forEach(f=>delete state[k(currentProfile,currentWeek,dayId,exId,f)]);
}
function resetWeek(){
  days().forEach(d=>d.exercises.forEach(ex=>resetExercise(d.id, ex.id, ex.type)));
  saveState(); render();
}
function resetAll(){
  state = { _meta: state._meta || {profile:currentProfile,week:currentWeek,view:currentView} };
  saveState(); render();
}

function canonicalMuscle(ex){
  const mus=ex.muscles||[];
  for(const m of MUSCLE_ORDER) if (mus.includes(m)) return m;
  return mus[0]||'other';
}

function countSetsDone(dayId, ex){
  if(!(ex.type==='sets3'||ex.type==='sets4')) return 0;
  const max=ex.type==='sets4'?4:3;
  let c=0;
  for(let i=1;i<=max;i++){
    const v = state[k(currentProfile,currentWeek,dayId,ex.id,`s${i}`)];
    if(v!==undefined && String(v).trim()!=='') c+=1;
  }
  return c;
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
  const addText=(label,field,ph='')=>{
    const lab=document.createElement('label'); lab.textContent=label;
    const inp=document.createElement('input'); inp.type='text'; inp.placeholder=ph;
    const key=k(currentProfile,currentWeek,dayId,ex.id,field);
    inp.value = state[key] ?? '';
    inp.addEventListener('input', ()=>{ state[key]=inp.value; saveState(); });
    lab.appendChild(inp); right.appendChild(lab);
  };
  const addSelect=(label,field,options)=>{
    const lab=document.createElement('label'); lab.textContent=label;
    const sel=document.createElement('select');
    const key=k(currentProfile,currentWeek,dayId,ex.id,field);
    options.forEach(({value,label})=>{
      const o=document.createElement('option'); o.value=value; o.textContent=label; sel.appendChild(o);
    });
    sel.value = state[key] ?? options[0]?.value ?? '';
    sel.addEventListener('change', ()=>{ state[key]=sel.value; saveState(); render(); });
    lab.appendChild(sel); right.appendChild(lab);
  };

  if (ex.type==='sets3'||ex.type==='sets4'){
    const max=ex.type==='sets4'?4:3;
    for(let i=1;i<=max;i++) addNum(`Set ${i}`,`s${i}`);
  } else if (ex.type==='weight'){
    addNum('Weight','wt','0.5');
  } else if (ex.type==='cardio'){
    // Flexible cardio/sprints logging
    const defaults = ex.cardioDefaults || {};
    const modeKey = k(currentProfile,currentWeek,dayId,ex.id,'c_mode');
    const metKey  = k(currentProfile,currentWeek,dayId,ex.id,'c_met');

    const modeOptions = CARDIO_MODES.map(m=>({value:m.id,label:m.label}));
    const defaultMode = defaults.mode || (CARDIO_MODES[0]?.id || 'run');
    if(state[modeKey]===undefined) state[modeKey]=defaultMode;

    addSelect('Mode','c_mode', modeOptions);

    // MET: allow override; auto-fill when mode changes if user hasn't set one
    const mode = state[modeKey];
    const autoMET = defaults.met ?? (CARDIO_MODES.find(m=>m.id===mode)?.defaultMET ?? 6);
    if(state[metKey]===undefined) state[metKey]=autoMET;

    addNum('Minutes','c_min','0.1');
    addNum('Distance (mi)','c_dist','0.01');
    addNum('Incline %','c_incline','0.5');
    addNum('Avg HR','c_hr','1');
    addNum('RPE (1-10)','c_rpe','1');
    addNum('MET (override)','c_met','0.1');
  } else {
    const p=document.createElement('div'); p.style.color='var(--muted)'; p.style.fontSize='12px'; p.textContent='Freestyle (no fields)';
    right.appendChild(p);
  }

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
  const host=$('#app'); if(!host) return;
  host.innerHTML='';
  const dlist = days();
  if (!dlist.length) {
    host.innerHTML = `<div class="card" style="color:var(--muted);font-size:12px;">No days found for profile "${currentProfile}". Check data.json.</div>`;
    return;
  }
  dlist.forEach((day, idx)=>{
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

function renderMuscle(){
  const host=$('#app'); if(!host) return;
  host.innerHTML='';
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

function cardioCaloriesForExercise(dayId, ex){
  if(ex.type!=='cardio') return 0;
  const mins = parseFloat(state[k(currentProfile,currentWeek,dayId,ex.id,'c_min')] || 0) || 0;
  const met  = parseFloat(state[k(currentProfile,currentWeek,dayId,ex.id,'c_met')] || 0) || 0;
  if(mins<=0 || met<=0) return 0;
  const bw = profile()?.settings?.bodyweight_lbs ?? 165;
  const kg = kgFromLbs(bw);
  // kcal/min = MET * 3.5 * kg / 200
  return (met * 3.5 * kg / 200) * mins;
}

function liftingCaloriesEstimate(){
  const perSet = parseFloat(profile()?.settings?.lift_kcal_per_set ?? 10) || 10;
  let sets=0;
  days().forEach(day=>day.exercises.forEach(ex=>{ sets += countSetsDone(day.id, ex); }));
  return { sets, kcal: sets * perSet };
}

function cardioCaloriesSummary(){
  let kcal=0;
  const byMode = new Map(); // mode -> kcal
  days().forEach(day=>day.exercises.forEach(ex=>{
    if(ex.type!=='cardio') return;
    const c = cardioCaloriesForExercise(day.id, ex);
    kcal += c;
    const mode = state[k(currentProfile,currentWeek,day.id,ex.id,'c_mode')] || (ex.cardioDefaults?.mode || 'other');
    byMode.set(mode, (byMode.get(mode)||0) + c);
  }));
  return {kcal, byMode};
}

function setsByMuscle(){
  const map=new Map(); // muscle -> sets
  days().forEach(day=>day.exercises.forEach(ex=>{
    const sets = countSetsDone(day.id, ex);
    if(!sets) return;
    const m = canonicalMuscle(ex);
    map.set(m, (map.get(m)||0) + sets);
  }));
  // stable order
  const ordered=[...new Set([...MUSCLE_ORDER, ...map.keys()])].filter(m=>map.has(m));
  return ordered.map(m=>({muscle:m, sets:map.get(m)}));
}

function renderSummary(){
  const host=$('#app'); if(!host) return;
  host.innerHTML='';

  const c = cardioCaloriesSummary();
  const l = liftingCaloriesEstimate();
  const total = c.kcal + l.kcal;

  const settings = profile()?.settings || {};
  const bw = settings.bodyweight_lbs ?? 165;
  const perSet = settings.lift_kcal_per_set ?? 10;

  const card=document.createElement('div'); card.className='card';
  card.innerHTML = `
    <div style="font-weight:900;margin-bottom:6px;">Weekly Summary</div>
    <div class="kpi">
      <div class="box"><div class="big">${Math.round(total)}</div><div class="small">Total kcal (estimate)</div></div>
      <div class="box"><div class="big">${Math.round(c.kcal)}</div><div class="small">Cardio kcal</div></div>
      <div class="box"><div class="big">${Math.round(l.kcal)}</div><div class="small">Lift kcal (sets × ${perSet})</div></div>
      <div class="box"><div class="big">${l.sets}</div><div class="small">Total lift sets logged</div></div>
    </div>
    <div style="margin-top:10px;color:var(--muted);font-size:12px;line-height:1.35;">
      Calories are estimates. Cardio uses METs (editable per session). Lifting uses a simple per-set estimate you can tune below.
    </div>
  `;
  host.appendChild(card);

  // Settings
  const setCard=document.createElement('div'); setCard.className='card';
  setCard.innerHTML = `<div style="font-weight:900;margin-bottom:6px;">Settings (per profile)</div>`;
  const row=document.createElement('div'); row.style.display='flex'; row.style.gap='10px'; row.style.flexWrap='wrap';

  const bwLab=document.createElement('label'); bwLab.style.color='var(--muted)'; bwLab.style.fontSize='12px'; bwLab.textContent='Bodyweight (lbs)';
  const bwInp=document.createElement('input'); bwInp.type='number'; bwInp.step='0.1'; bwInp.value=bw;
  bwInp.oninput=()=>{
    profile().settings = profile().settings || {};
    profile().settings.bodyweight_lbs = parseFloat(bwInp.value||bw) || bw;
    // Store profile settings inside localStorage too, so you can tweak without editing data.json
    state[`__settings__::${currentProfile}::bodyweight_lbs`] = profile().settings.bodyweight_lbs;
    saveState(); renderSummary();
  };
  bwLab.appendChild(bwInp);

  const psLab=document.createElement('label'); psLab.style.color='var(--muted)'; psLab.style.fontSize='12px'; psLab.textContent='Lift kcal per set';
  const psInp=document.createElement('input'); psInp.type='number'; psInp.step='0.1'; psInp.value=perSet;
  psInp.oninput=()=>{
    profile().settings = profile().settings || {};
    profile().settings.lift_kcal_per_set = parseFloat(psInp.value||perSet) || perSet;
    state[`__settings__::${currentProfile}::lift_kcal_per_set`] = profile().settings.lift_kcal_per_set;
    saveState(); renderSummary();
  };
  psLab.appendChild(psInp);

  row.appendChild(bwLab); row.appendChild(psLab);
  setCard.appendChild(row);

  host.appendChild(setCard);

  // Cardio breakdown
  const cardioCard=document.createElement('div'); cardioCard.className='card';
  cardioCard.innerHTML = `<div style="font-weight:900;margin-bottom:6px;">Cardio calories by mode</div>`;
  const t1=document.createElement('table'); t1.className='table';
  t1.innerHTML = `<thead><tr><th>Mode</th><th>kcal</th></tr></thead><tbody></tbody>`;
  const b1=t1.querySelector('tbody');
  const modeRows=[...c.byMode.entries()].sort((a,b)=>b[1]-a[1]);
  if(!modeRows.length){
    const tr=document.createElement('tr'); tr.innerHTML=`<td colspan="2" style="color:var(--muted);">No cardio logged yet.</td>`; b1.appendChild(tr);
  } else {
    modeRows.forEach(([mode,kcal])=>{
      const label = (CARDIO_MODES.find(m=>m.id===mode)?.label) || mode;
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${label}</td><td>${Math.round(kcal)}</td>`; b1.appendChild(tr);
    });
  }
  cardioCard.appendChild(t1);
  host.appendChild(cardioCard);

  // Sets by muscle
  const setsCard=document.createElement('div'); setsCard.className='card';
  setsCard.innerHTML = `<div style="font-weight:900;margin-bottom:6px;">Lift sets logged by muscle group</div>`;
  const t2=document.createElement('table'); t2.className='table';
  t2.innerHTML = `<thead><tr><th>Muscle group</th><th>Sets</th></tr></thead><tbody></tbody>`;
  const b2=t2.querySelector('tbody');
  const rows=setsByMuscle();
  if(!rows.length){
    const tr=document.createElement('tr'); tr.innerHTML=`<td colspan="2" style="color:var(--muted);">No lift sets logged yet (fill Set 1/2/3 fields).</td>`; b2.appendChild(tr);
  } else {
    rows.forEach(r=>{
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${MUSCLE_LABELS[r.muscle]||r.muscle}</td><td>${r.sets}</td>`;
      b2.appendChild(tr);
    });
  }
  setsCard.appendChild(t2);
  host.appendChild(setsCard);
}

/* Gym mode + rest timer (unchanged except supports cardio fields) */
let gym={dayId:'today', list:[], index:0};
let rest={total:90, remaining:90, running:false, interval:null};
const fmt = s => { s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), r=s%60; return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0'); };
const updateClock=()=>{ const el=$('#restClock'); if(el) el.textContent = fmt(rest.remaining); };
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
  const host=$('#gymExerciseHost'); if(!host) return;
  host.innerHTML='';
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

  // reuse exerciseRow's right-side input logic by creating a temporary row, then plucking the inputs
  const tmp = exerciseRow(dayId, ex);
  const right = tmp.querySelector('.ex-right');
  // replace done toggle (we already have it)
  right.querySelectorAll('label.toggle').forEach(t=>t.remove());
  // Remove duplicate notes at end; keep one at end in gym mode
  // We'll just keep the existing notes input and allow it.
  const body=document.createElement('div'); body.className='exercise';
  body.appendChild(right);
  card.appendChild(body);

  host.appendChild(card);
}

function openGym(){
  const anyToday = days().some(day=>day.exercises.some(ex=>!!state[k(currentProfile,currentWeek,day.id,ex.id,'today')]));
  gym.dayId = anyToday ? 'today' : (days()[0]?.id || 'today');
  $('#gymDaySelect').value = gym.dayId;
  gym.list = buildGymList(gym.dayId);
  gym.index=0;
  $('#gymOverlay').classList.add('open');
  $('#gymOverlay').setAttribute('aria-hidden','false');
  updateClock(); renderGym();
}
function closeGym(){ $('#gymOverlay').classList.remove('open'); $('#gymOverlay').setAttribute('aria-hidden','true'); pauseRest(); }

function initGymUI(){
  const sel=$('#gymDaySelect'); if(!sel) return;
  sel.innerHTML='';
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
  if(currentView==='summary') renderSummary();
}

async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);
  return await res.json();
}

function applyLocalSettingsOverrides(){
  const bw = state[`__settings__::${currentProfile}::bodyweight_lbs`];
  const ps = state[`__settings__::${currentProfile}::lift_kcal_per_set`];
  const p = profile();
  p.settings = p.settings || {};
  if (bw !== undefined) p.settings.bodyweight_lbs = parseFloat(bw) || p.settings.bodyweight_lbs;
  if (ps !== undefined) p.settings.lift_kcal_per_set = parseFloat(ps) || p.settings.lift_kcal_per_set;
}

async function init(){
  try {
    DATA = await loadData();
    MUSCLE_LABELS = DATA.muscleLabels || {};
    MUSCLE_ORDER = DATA.muscleOrder || [];
    CARDIO_MODES = DATA.cardioModes || [
      {id:'run',label:'Run',defaultMET:9.8},
      {id:'walk',label:'Walk',defaultMET:3.5},
      {id:'incline_walk',label:'Incline walk',defaultMET:6.0},
      {id:'bike',label:'Bike',defaultMET:7.0},
      {id:'row',label:'Row',defaultMET:7.0},
      {id:'sprints',label:'Sprints',defaultMET:11.0},
      {id:'other',label:'Other',defaultMET:6.0}
    ];

    if (!DATA.profiles?.[currentProfile]) currentProfile = Object.keys(DATA.profiles || {})[0] || 'luke';
    applyLocalSettingsOverrides();

    ensureProfileOptions();
    ensureWeekOptions();
    ensureViewTabs();

    $('#profileSelect').onchange=()=>{
      currentProfile=$('#profileSelect').value;
      applyLocalSettingsOverrides();
      ensureWeekOptions(); ensureViewTabs(); initGymUI(); saveMeta(); render();
    };
    $('#weekSelect').onchange=()=>{ currentWeek=$('#weekSelect').value; saveMeta(); render(); };

    $('#resetDayBtn').onclick=resetOpenDay;
    $('#resetWeekBtn').onclick=resetWeek;
    $('#resetAllBtn').onclick=resetAll;

    initGymUI();
    render();
  } catch (err) {
    console.error(err);
    const host = $('#app');
    if (host) {
      host.innerHTML = `<div class="card" style="border-color:#7f1d1d;">
        <div style="font-weight:900;">App failed to load workouts</div>
        <div style="color:var(--muted);font-size:12px;margin-top:6px;">
          Open DevTools → Console to see the error.<br/>
          Most common cause: data.json missing or blocked.
        </div>
      </div>`;
    }
  }
}
init();
