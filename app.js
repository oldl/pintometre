'use strict';
const categories = {
  biere: {name:'Bière',icon:'🍺',volume:33,abv:8.5,volumes:[25,33,50],hint:'Le volume et le degré sont indiqués sur la bouteille ou la carte.'},
  vin: {name:'Vin',icon:'🍷',volume:15,abv:13,volumes:[10,12.5,15],hint:'Un verre de vin peut être servi plus ou moins généreusement. Ajuste le volume.'},
  cocktail: {name:'Cocktail',icon:'🍸',volume:20,abv:10,volumes:[15,20,25],hint:'Indique le degré du mélange final, pas celui du spiritueux. Exemple : 5 cl de gin à 40 % + 15 cl de tonic ≈ 20 cl à 10 % (hors fonte des glaçons).'},
  shot: {name:'Shot',icon:'🥃',volume:4,abv:40,volumes:[2,4,5],hint:'Le degré est celui du spiritueux. Le volume correspond à la dose servie.'}
};
const examples = [{type:'biere',volume:33,abv:9},{type:'vin',volume:15,abv:14.5},{type:'cocktail',volume:20,abv:10},{type:'biere',volume:50,abv:8.5},{type:'shot',volume:4,abv:40}];
const BUZZ_LABELS=['NET','CHAUD','ÇA BOUGE','ÇA TANGUE','FLOU','🫠'];
const REFERENCE_WINE_GRAMS=10*0.125*0.8*10; // 🍷 = 10 cl à 12,5 % = 10 g

/* ---------- Single source of truth ---------- */
// Session: only source data, every total is derived.
let drinks=[]; // {id,type,name,volumeCl,abv,quantity}
let nextId=1;
let lastId=null;      // target of « LE MÊME »
let editingId=null;   // drink edited live in Doser, null = new drink draft
let pendingEdit=false;
// Draft shown in Doser (and the home example) before it joins the session.
let draft={type:'biere',volume:33,abv:8.5,example:true};
let exampleIndex=0;
let valid=true;

const $=id=>document.getElementById(id);
const format=value=>new Intl.NumberFormat('fr-BE',{minimumFractionDigits:0,maximumFractionDigits:1}).format(value);
const round1=value=>Math.round(value*10)/10;
const alcoholGrams=(volumeCl,abv)=>volumeCl*(abv/100)*0.8*10;
const drinkGrams=d=>alcoholGrams(d.volumeCl,d.abv)*d.quantity;
const sessionGrams=()=>drinks.reduce((sum,d)=>sum+drinkGrams(d),0);
const wineEquivalent=grams=>grams/REFERENCE_WINE_GRAMS;
const buzzLevel=wine=>Math.min(5,Math.floor(round1(wine)));
const findDrink=id=>drinks.find(d=>d.id===id);
const reducedMotion=()=>$('reduce-motion').checked;

/* ---------- Animated numbers ---------- */
const shown=new WeakMap();
function animateNumber(el,to){
  const from=shown.has(el)?shown.get(el):to;shown.set(el,to);
  if(el._raf)cancelAnimationFrame(el._raf);
  if(from===to||reducedMotion()){el.textContent=format(round1(to));return;}
  const start=performance.now(),duration=550;
  el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');
  const tick=now=>{const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);el.textContent=format(round1(from+(to-from)*e));if(t<1)el._raf=requestAnimationFrame(tick);};
  el._raf=requestAnimationFrame(tick);
}

/* ---------- Wine visual ---------- */
function bowlPath(level){
  // Liquid inside the bowl, from its surface (level 0..1) down to the bottom.
  const top=6,bottom=34,y=top+(bottom-top)*(1-level);
  const half=13*Math.sqrt(Math.max(0,(bottom-y)/(bottom-top)))+ (level>0?0.5:0);
  return `M${20-half} ${y}h${half*2}C${20+half} ${(y+bottom)/2+4} ${26} ${bottom} 20 ${bottom}C14 ${bottom} ${20-half} ${(y+bottom)/2+4} ${20-half} ${y}Z`;
}
function glassSVG(level){
  return `<svg viewBox="0 0 40 64" class="wg" aria-hidden="true">`+
  (level>0?`<path d="${bowlPath(level)}" fill="currentColor" opacity=".85"/>`:'')+
  `<path d="M7 6h26c1 14-3 26-13 28C10 32 6 20 7 6Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>`+
  `<path d="M20 34v20M12 57h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
}
function renderWineVisual(el,wine,max=6){
  const rounded=round1(wine);
  if(el.dataset.shown===String(rounded))return;el.dataset.shown=String(rounded);
  el.setAttribute('aria-label',`${format(rounded)} verres de vin de 10 cl, équivalent en alcool pur`);
  if(rounded===0){el.innerHTML=`<span class="wv-glass empty">${glassSVG(0)}</span>`;return;}
  if(rounded>max){el.innerHTML=`<span class="wv-glass">${glassSVG(1)}</span><span class="wv-times">× ${format(rounded)}</span>`;return;}
  const full=Math.floor(rounded),part=round1(rounded-full);let html='';
  for(let i=0;i<full;i++)html+=`<span class="wv-glass" style="--i:${i}">${glassSVG(1)}</span>`;
  if(part>0)html+=`<span class="wv-glass partial" style="--i:${full}">${glassSVG(part)}<small>${format(part)}</small></span>`;
  el.innerHTML=html;
}

/* ---------- Buzz engine ---------- */
// Continuous intensity from the session total; every effect is a CSS variable.
function applyBuzz(wine){
  const k=Math.max(0,Math.min(1,(wine-0.6)/5));      // 0 below ~0,6 🍷, 1 from ~5,6 🍷
  const s=Math.pow(k,1.35);                          // slow start: level 1 barely visible
  // A logarithmic tail keeps every extra equivalent visible without an abrupt ceiling.
  const chaos=Math.log1p(Math.max(0,wine-6)/4);
  window.resultChaos=chaos;
  const resultVars={
    '--chaos-shift':`${(chaos*13).toFixed(3)}px`,
    '--chaos-angle':`${(chaos*3.5).toFixed(3)}deg`,
    '--chaos-skew':`${(chaos*2).toFixed(3)}deg`,
    '--chaos-scale':(1+chaos*.035).toFixed(4),
    '--chaos-color':`${(chaos*5).toFixed(3)}px`,
    '--chaos-blur':`${(chaos*1.6).toFixed(3)}px`
  };
  for(const [name,value] of Object.entries(resultVars))document.documentElement.style.setProperty(name,value);
  document.body.classList.toggle('chaotic',chaos>0);
  window.buzzIntensity=s;                             // read by opart.js
  const root=document.documentElement.style;
  // Extra blur from 3 🍷: +0,6 px per glass, capped at +2,4 px (reached at 7 🍷).
  const extraBlur=Math.min(2.4,Math.max(0,wine-3)*0.6);
  root.setProperty('--blur',`${(Math.max(0,s-0.12)*1.3+extraBlur).toFixed(3)}px`);
  root.setProperty('--ghost',`${(s*6).toFixed(2)}px`);
  root.setProperty('--drift',`${(s*9).toFixed(2)}px`);
  root.setProperty('--tilt',`${(s*0.9).toFixed(3)}deg`);
  root.setProperty('--wobble',`${(s*2.2).toFixed(2)}px`);
  root.setProperty('--inertia',`${Math.round(s*420)}ms`);
  root.setProperty('--ga',(0.1+0.32*s).toFixed(3));
  root.setProperty('--period',`${(8-3.5*s).toFixed(2)}s`);
  document.body.classList.toggle('buzzing',k>0);
  document.body.dataset.buzz=String(buzzLevel(wine));
}
function dotsHTML(level){return Array.from({length:5},(_,i)=>`<i class="${i<level?'on':''}"></i>`).join('');}

/* ---------- Render ---------- */
function renderDraft(){
  const grams=alcoholGrams(draft.volume,draft.abv),wine=wineEquivalent(grams);
  const values={icon:categories[draft.type].icon,volume:format(draft.volume),abv:format(draft.abv),grams:format(round1(grams)),wine:format(round1(wine)),
    drink:`${categories[draft.type].name} · ${format(draft.volume)} cl · ${format(draft.abv)} %`,
    'selection-kind':editingId?'TU MODIFIES CE VERRE':draft.example?'EXEMPLE À EXPLORER':'TA SÉLECTION'};
  document.querySelectorAll('[data-bind]').forEach(el=>{if(el.dataset.bind in values)el.textContent=values[el.dataset.bind];});
  document.querySelectorAll('[data-type]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.type===draft.type)));
  document.querySelectorAll('[data-volume]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.volume)===draft.volume)));
  renderWineVisual($('home-wine'),wine,12);
  document.querySelectorAll('.home-panel,.dose-panel').forEach(el=>el.dataset.drink=draft.type); // drives the generated background
  $('abv-range').value=draft.abv;
  $('category-hint').textContent=categories[draft.type].hint;
  const editing=editingId&&findDrink(editingId);
  $('dose-tag').textContent=editing?`EN MODIF · ×${editing.quantity}`:'NOUVEAU VERRE';
  $('reveal-label').textContent=editing?'C’EST BON':'AJOUTER À CE SOIR';
  $('reveal').lastElementChild.textContent=editing?'✓':'+';
}
function renderSession(highlightId=null){
  const grams=sessionGrams(),wine=wineEquivalent(grams),level=buzzLevel(wine);
  const count=drinks.reduce((n,d)=>n+d.quantity,0),empty=count===0;
  // Totals
  animateNumber($('total-wine'),wine);
  animateNumber($('bar-wine'),wine);
  $('total-grams').textContent=format(round1(grams));
  renderWineVisual($('wine-visual'),wine);
  // Reveal (one drink) vs stack (several)
  const single=count===1;
  $('reveal-drink').hidden=!single;$('stack-wrap').hidden=single||empty;
  $('total-kicker').textContent=empty?'TON COMPTE':single?'TON VERRE':'CE SOIR';
  if(single){const d=drinks.find(x=>x.quantity>0);$('reveal-icon').textContent=categories[d.type].icon;$('reveal-spec').textContent=`${format(d.volumeCl)} CL · ${format(d.abv)} %`;}
  const stack=$('stack');stack.replaceChildren();
  const grouped=count>8;
  drinks.forEach(d=>{
    if(grouped){const s=document.createElement('span');s.className='stack-item group';s.textContent=`${categories[d.type].icon}×${d.quantity}`;if(d.id===highlightId)s.classList.add('pop');stack.append(s);return;}
    for(let i=0;i<d.quantity;i++){const s=document.createElement('span');s.className='stack-item';s.textContent=categories[d.type].icon;if(d.id===highlightId&&i===d.quantity-1)s.classList.add('pop');stack.append(s);}
  });
  // Actions
  $('encore').hidden=empty;$('add-first').hidden=!empty;
  const same=findDrink(lastId)||drinks[drinks.length-1];
  if(same){lastId=same.id;$('same-icon').textContent=categories[same.type].icon;$('add-same').setAttribute('aria-label',`Ajouter le même : ${same.name}, ${format(same.volumeCl)} cl à ${format(same.abv)} %`);}
  // Drink list
  const list=$('drink-list');list.replaceChildren();
  drinks.forEach(d=>{
    const li=document.createElement('li');li.className='drink-card';if(d.id===highlightId)li.classList.add('pop');
    const sub=wineEquivalent(drinkGrams(d));
    li.innerHTML=`<button class="drink-edit" aria-label="Modifier ${d.name}"><span class="drink-icon" aria-hidden="true">${categories[d.type].icon}</span><span><strong>${d.name.toUpperCase()}</strong><small>${format(d.volumeCl)} cl · ${format(d.abv)} % · ${format(round1(sub))} 🍷</small></span></button>`+
      `<div class="qty"><button class="qty-minus" aria-label="${d.quantity===1?'Retirer':'Un de moins'} : ${d.name}">${d.quantity===1?'×':'−'}</button><output aria-live="polite">${d.quantity}</output><button class="qty-plus" aria-label="Un de plus : ${d.name}">+</button></div>`;
    li.querySelector('.drink-edit').addEventListener('click',()=>editDrink(d.id));
    li.querySelector('.qty-minus').addEventListener('click',()=>changeQuantity(d.id,-1));
    li.querySelector('.qty-plus').addEventListener('click',()=>changeQuantity(d.id,1));
    list.append(li);
  });
  $('empty-note').hidden=!empty;
  $('drink-count').textContent=`${count} ${count>1?'VERRES':'VERRE'}`;
  $('buzz-title').textContent=empty?'RIEN ENCORE':BUZZ_LABELS[level];
  // Buzz indicators
  [$('panel-dots'),$('bar-dots')].forEach(el=>el.innerHTML=dotsHTML(level));
  $('panel-buzz-label').textContent=`${level} · ${BUZZ_LABELS[level]}`;
  $('bar-label').textContent=BUZZ_LABELS[level];
  $('session-bar').hidden=empty;document.body.classList.toggle('has-session',!empty);
  $('sim-buzz').textContent=empty?'BUZZ 0 · NET. Ajoute des verres : la cible suit ton compte.':`BUZZ ${level} · ${BUZZ_LABELS[level]}. La cible suit ton compte.`;
  applyBuzz(wine);
  if(highlightId && !reducedMotion())window.resultPulseAt=performance.now();
  if(empty)window.resultPulseAt=null;
}

/* ---------- Session actions ---------- */
function addDrink(source){
  const existing=drinks.find(d=>d.type===source.type&&d.volumeCl===source.volume&&d.abv===source.abv);
  if(existing){existing.quantity++;lastId=existing.id;renderSession(existing.id);return;}
  const d={id:nextId++,type:source.type,name:categories[source.type].name,volumeCl:source.volume,abv:source.abv,quantity:1};
  drinks.push(d);lastId=d.id;renderSession(d.id);
}
function changeQuantity(id,delta){
  const d=findDrink(id);if(!d)return;
  d.quantity+=delta;
  if(d.quantity<=0){drinks=drinks.filter(x=>x.id!==id);if(editingId===id)editingId=null;if(lastId===id)lastId=null;}
  else lastId=id;
  renderSession(delta>0?id:null);renderDraft();
}
function editDrink(id){
  const d=findDrink(id);if(!d)return;
  editingId=id;lastId=id;pendingEdit=true;
  draft={type:d.type,volume:d.volumeCl,abv:d.abv,example:false};
  syncInputs();renderPresets();validate();
  location.hash='doser';
}
function resetSession(){
  drinks=[];editingId=null;lastId=null;
  const main=$('main');main.classList.remove('snap');void main.offsetWidth;
  document.documentElement.classList.add('snapping');
  renderSession();renderDraft();
  if(!reducedMotion())main.classList.add('snap');
  setTimeout(()=>document.documentElement.classList.remove('snapping'),700);
}
// Draft edits flow straight into the drink being edited: totals update live.
function commitDraftToEditing(){
  const d=editingId&&findDrink(editingId);if(!d)return;
  d.type=draft.type;d.name=categories[draft.type].name;d.volumeCl=draft.volume;d.abv=draft.abv;
  renderSession();
}

/* ---------- Doser inputs ---------- */
function syncInputs(){$('volume').value=draft.volume;$('abv').value=draft.abv;}
function renderPresets(){
  $('volume-presets').replaceChildren();
  categories[draft.type].volumes.forEach(volume=>{const button=document.createElement('button');button.dataset.volume=volume;button.textContent=`${format(volume)} cl`;button.addEventListener('click',()=>{draft.volume=volume;draft.example=false;syncInputs();validate();});$('volume-presets').append(button);});
}
function validate(){
  const volume=$('volume').valueAsNumber,abv=$('abv').valueAsNumber;
  const volumeValid=Number.isFinite(volume)&&volume>=1&&volume<=200;
  const abvValid=Number.isFinite(abv)&&abv>=0&&abv<=50;
  valid=volumeValid&&abvValid;
  $('volume').setAttribute('aria-invalid',String(!volumeValid));$('abv').setAttribute('aria-invalid',String(!abvValid));
  $('input-error').textContent=!volumeValid?'Indique un volume entre 1 et 200 cl.':!abvValid?'Indique un degré entre 0 et 50 %.':'';
  $('reveal').disabled=!valid;
  if(valid){draft.volume=volume;draft.abv=abv;renderDraft();commitDraftToEditing();}
  else document.querySelectorAll('.live-result [data-bind]').forEach(el=>el.textContent='—');
  return valid;
}
document.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{const category=categories[button.dataset.type];draft={type:button.dataset.type,volume:category.volume,abv:category.abv,example:false};syncInputs();renderPresets();validate();}));
['volume','abv'].forEach(id=>$(id).addEventListener('input',()=>{draft.example=false;validate();}));
function step(amount){const current=Number.isFinite($('abv').valueAsNumber)?$('abv').valueAsNumber:draft.abv;$('abv').value=Math.round(Math.min(50,Math.max(0,current+amount))*10)/10;draft.example=false;validate();}
$('minus').addEventListener('click',()=>step(-.5));$('plus').addEventListener('click',()=>step(.5));
$('abv-range').addEventListener('input',()=>{$('abv').value=$('abv-range').value;draft.example=false;validate();});
$('surprise').addEventListener('click',()=>{const b=$('surprise');b.classList.remove('spin');void b.offsetWidth;b.classList.add('spin');setTimeout(()=>b.classList.remove('spin'),450);editingId=null;draft={...examples[exampleIndex],example:true};exampleIndex=(exampleIndex+1)%examples.length;syncInputs();renderPresets();validate();});
$('home-try').addEventListener('click',()=>{editingId=null;});
$('reveal').addEventListener('click',()=>{
  if(!validate())return;
  if(editingId&&findDrink(editingId)){editingId=null;renderDraft();location.hash='resultat';return;}
  draft.example=false;addDrink(draft);location.hash='resultat';
});
$('add-same').addEventListener('click',()=>{const d=findDrink(lastId);if(d)changeQuantity(d.id,1);});
$('add-other').addEventListener('click',()=>{editingId=null;renderDraft();location.hash='doser';});
$('add-first').addEventListener('click',()=>{editingId=null;renderDraft();});
$('reset').addEventListener('click',resetSession);

/* ---------- Simulation: the target follows the session Buzz ---------- */
let active=false,hits=0,timer=null,startedAt=0;
const reducedPreference=matchMedia('(prefers-reduced-motion: reduce)');
$('reduce-motion').checked=reducedPreference.matches;
const simBuzz=()=>Math.max(0,Math.min(1,(wineEquivalent(sessionGrams())-0.6)/5));
const moveEvery=()=>Math.round(1050-simBuzz()*330);
const latency=()=>Math.round(simBuzz()*260);
function setReduced(){document.body.classList.toggle('reduced-motion',reducedMotion());if(active){clearInterval(timer);timer=null;if(!reducedMotion())timer=setInterval(moveTarget,moveEvery());else centerTarget();}}
$('reduce-motion').addEventListener('change',setReduced);
reducedPreference.addEventListener('change',event=>{$('reduce-motion').checked=event.matches;setReduced();});
function centerTarget(){$('target').style.left='50%';$('target').style.top='50%';}
function moveTarget(){if(!active)return;const place=()=>{if(!active)return;$('target').style.left=`${20+Math.random()*60}%`;$('target').style.top=`${23+Math.random()*52}%`;};const delay=latency();delay?setTimeout(place,delay):place();}
function stopSimulation(completed=false){
  active=false;clearInterval(timer);timer=null;$('target').disabled=true;centerTarget();
  const level=buzzLevel(wineEquivalent(sessionGrams()));
  $('sim-status').textContent=completed?'EXPÉRIENCE TERMINÉE':'EXPÉRIENCE EN PAUSE';
  $('sim-toggle').innerHTML='REJOUER L’EXPÉRIENCE <span>↻</span>';
  $('sim-feedback').textContent=completed?`Cinq touches en ${format(round1((performance.now()-startedAt)/1000))} s, avec BUZZ ${level}. Un score de jeu, rien de plus : il ne dit rien de ton aptitude à conduire.`:'Simulation arrêtée. Tu peux recommencer quand tu veux.';
}
$('sim-toggle').addEventListener('click',()=>{if(active){stopSimulation();return;}active=true;hits=0;startedAt=performance.now();$('sim-progress').textContent='0 / 5';$('sim-status').textContent='SIMULATION EN COURS';$('target').disabled=false;$('sim-toggle').innerHTML='ARRÊTER LA SIMULATION <span>■</span>';$('sim-feedback').textContent='Touche la cible cinq fois. Le mouvement est généré par l’interface.';centerTarget();if(!reducedMotion())timer=setInterval(moveTarget,moveEvery());});
$('target').addEventListener('click',()=>{if(!active)return;const register=()=>{if(!active)return;hits++;$('sim-progress').textContent=`${hits} / 5`;if(hits===5)stopSimulation(true);else if(!reducedMotion())moveTarget();};const delay=latency();delay?setTimeout(register,delay):register();});

/* ---------- Routing & dialogs ---------- */
function route(focus=true){
  let page=location.hash.slice(1)||'accueil';
  if(!['accueil','doser','resultat','simulation'].includes(page)){page='accueil';history.replaceState(null,'','#accueil');}
  document.body.dataset.page=page;
  if(page==='doser'){if(!pendingEdit&&editingId){editingId=null;renderDraft();}pendingEdit=false;}
  if(active)stopSimulation();
  document.querySelectorAll('.screen').forEach(el=>el.hidden=el.id!==page);
  document.querySelectorAll('[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  document.title=`PINTOMÈTRE — ${ {accueil:'Ton verre, décrypté',doser:'Compose ton verre',resultat:'Ce soir',simulation:'La simulation'}[page]}`;
  if(focus){window.scrollTo({top:0,behavior:'instant'});$(page).querySelector('h1').focus({preventScroll:true});}
}
window.addEventListener('hashchange',()=>route());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stopSimulation();});
for(const [trigger,dialog] of [['info-open','info-dialog'],['return-open','return-dialog']]){$(trigger).addEventListener('click',()=>{if(active)stopSimulation();$(dialog).showModal();});$(dialog).querySelector('.dialog-close').addEventListener('click',()=>$(dialog).close());$(dialog).addEventListener('click',event=>{if(event.target===$(dialog)){const rect=$(dialog).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(dialog).close();}});}
document.querySelector('.dialog-done').addEventListener('click',()=>$('return-dialog').close());
syncInputs();renderPresets();renderDraft();renderSession();setReduced();route(false);
// Exposed for manual checks in the console.
window.pintometre={get drinks(){return drinks.map(d=>({...d}));},sessionGrams,wineEquivalent,alcoholGrams};
