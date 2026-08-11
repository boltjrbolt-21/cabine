
/* ===================================================================
   FitRoom AI — couche interface.
   Elle est posée AU-DESSUS du moteur, jamais dedans : le moteur garde
   ses identifiants, ses réglages et sa boucle. Tout ce qui suit ne fait
   que router des écrans, ranger des vêtements et habiller le guidage.
   Rien ici ne s'exécute pendant une image de rendu.
   =================================================================== */

/* ---------- petites aides ---------- */
const el = s => document.querySelector(s);
const els = s => [...document.querySelectorAll(s)];
const fmtDate = t => new Date(t).toLocaleDateString('fr-FR',
  { day:'numeric', month:'short', year:'numeric' });

let toastT = 0;
const toastEl = document.createElement('div');
toastEl.style.cssText = 'position:fixed;left:50%;bottom:calc(var(--tab-h) + 16px);'+
  'transform:translate(-50%,14px);z-index:120;padding:11px 20px;border-radius:999px;'+
  'background:rgba(24,21,19,.95);border:1px solid var(--line-2);font-size:13px;'+
  'font-weight:500;opacity:0;transition:opacity .22s,transform .22s;pointer-events:none;'+
  'max-width:82vw;text-align:center';
document.body.appendChild(toastEl);
function toast(msg, bad){
  if(!msg) return;
  toastEl.textContent = msg;
  toastEl.style.color = bad ? 'var(--alert)' : 'var(--text)';
  toastEl.style.opacity = '1';
  toastEl.style.transform = 'translate(-50%,0)';
  clearTimeout(toastT);
  toastT = setTimeout(()=>{
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translate(-50%,14px)';
  }, 2300);
}
uiToast = toast;   // le moteur écrit son statut ici

/* ---------- base locale : dressing et looks ----------
   localStorage plafonne vers 5 Mo et ne stocke que du texte : une photo
   détourée en base64 y tient trois ou quatre fois. IndexedDB accepte les
   blobs bruts, donc un vrai dressing.                                   */
const DB = 'fitroom', GAR = 'garments', LKS = 'looks';
let dbP = null;
function db(){
  if(dbP) return dbP;
  dbP = new Promise((ok,ko)=>{
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if(!d.objectStoreNames.contains(GAR)) d.createObjectStore(GAR, { keyPath:'id' });
      if(!d.objectStoreNames.contains(LKS)) d.createObjectStore(LKS, { keyPath:'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return dbP;
}
async function dbAll(store){
  const d = await db();
  return new Promise((ok,ko)=>{
    const q = d.transaction(store).objectStore(store).getAll();
    q.onsuccess = ()=>ok(q.result || []); q.onerror = ()=>ko(q.error);
  });
}
async function dbPut(store, val){
  const d = await db();
  return new Promise((ok,ko)=>{
    const t = d.transaction(store,'readwrite');
    t.objectStore(store).put(val);
    t.oncomplete = ()=>ok(val); t.onerror = ()=>ko(t.error);
  });
}
async function dbDel(store, id){
  const d = await db();
  return new Promise((ok,ko)=>{
    const t = d.transaction(store,'readwrite');
    t.objectStore(store).delete(id);
    t.oncomplete = ()=>ok(); t.onerror = ()=>ko(t.error);
  });
}

const cvToBlob = cv => new Promise(ok => cv.toBlob(ok, 'image/png'));
function blobToCanvas(blob){
  return new Promise((ok,ko)=>{
    const u = URL.createObjectURL(blob);
    const i = new Image();
    i.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = i.width; c.height = i.height;
      c.getContext('2d',{ willReadFrequently:true }).drawImage(i,0,0);
      URL.revokeObjectURL(u); ok(c);
    };
    i.onerror = e => { URL.revokeObjectURL(u); ko(e); };
    i.src = u;
  });
}
// une vignette légère : le dressing en affiche une douzaine d'un coup
async function makeThumb(cv, side){
  const s = Math.min(1, side/Math.max(cv.width, cv.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1,Math.round(cv.width*s));
  c.height = Math.max(1,Math.round(cv.height*s));
  c.getContext('2d').drawImage(cv,0,0,c.width,c.height);
  return cvToBlob(c);
}

let wardrobe = [], looks = [], currentItem = null;
const urlCache = new Map();
function srcOf(blob){
  if(!blob) return '';
  let u = urlCache.get(blob);
  if(!u){ u = URL.createObjectURL(blob); urlCache.set(blob, u); }
  return u;
}

/* ---------- routeur d'écrans ---------- */
const SCREENS = ['home','cabine','dressing','looks','profil'];
let screenNow = 'home';

function go(name){
  if(!SCREENS.includes(name)) return;
  screenNow = name;
  for(const s of SCREENS) el('#'+s).toggleAttribute('data-on', s === name);
  for(const t of els('.tab')) t.setAttribute('aria-selected', String(t.dataset.go === name));
  el('#tabbar').classList.toggle('hide', name === 'cabine');
  // Le moteur ne calcule que si le miroir est visible : hors cabine, on
  // ne dépense ni processeur ni batterie, tout en gardant le flux ouvert
  // pour que le retour soit instantané.
  liveOn = (name === 'cabine');
  el('#stage').classList.toggle('live', liveOn && !calib && !cut);
  if(name === 'cabine') enterCabine();
  if(name === 'dressing') renderWardrobe();
  if(name === 'looks') renderLooks();
  // après la mise en page : régler avant laisse le navigateur restaurer
  // sa position de défilement par-dessus
  requestAnimationFrame(()=>{ el('#'+name).scrollTop = 0; });
}
for(const t of els('.tab')) t.onclick = ()=>go(t.dataset.go);
el('#goCabine').onclick = ()=>go('cabine');
el('#goDressing2').onclick = ()=>go('dressing');
el('#cabBack').onclick = ()=>go('home');
el('#btnLooks').onclick = ()=>go('looks');
el('#dockAll').onclick = ()=>go('dressing');

function enterCabine(){
  if(!video && !booting){ el('#start').style.display = 'flex'; }
  else el('#start').style.display = 'none';
  el('#liveDot').classList.toggle('on', !!video);
}

/* ---------- feuilles ---------- */
let sheetNow = null;
function sheet(id){
  if(sheetNow) sheetNow.classList.remove('on');
  sheetNow = id ? el(id) : null;
  el('#scrim').classList.toggle('on', !!sheetNow);
  if(sheetNow) sheetNow.classList.add('on');
}
const closeSheet = ()=>sheet(null);
el('#scrim').onclick = closeSheet;
for(const b of els('[data-close]')) b.onclick = closeSheet;

/* ---------- guidage ---------- */
/* Trois états seulement, pour ne pas transformer le miroir en tableau de
   bord : mal cadré, corps non vu, prêt. Le « prêt » s'efface tout seul. */
let guideState = '', okT = 0;
function guide(state){
  if(state === guideState) return;
  guideState = state;
  const h = el('#hint');
  clearTimeout(okT);
  // On passe par setHint du moteur, seul écrivain du bandeau : écrire
  // directement désynchroniserait son cache et figerait le texte.
  if(state === 'ok'){
    h.classList.add('ok');
    setHint('✓ Vous êtes prêt', '1');
    okT = setTimeout(()=>setHint(null, '0'), 1100);
    return;
  }
  h.classList.remove('ok');
  setHint(state === 'crop' ? 'Cadrez vos épaules et vos hanches'
                           : 'Positionnez-vous face à la caméra', '1');
}
uiGuide = guide;

/* Mode édition : pendant le détourage et la calibration, le doigt doit
   viser un pixel précis de la photo. On repasse donc le canvas en
   « contain » et on retire tout le HUD, qui n'aurait aucun sens ici. */
function mode(m){
  const editing = (m === 'edit');
  if(editing && screenNow !== 'cabine') go('cabine');
  el('#stage').classList.toggle('live', !editing && liveOn);
  for(const id of ['#hudTop','#rail','#hudBottom'])
    el(id).style.display = editing ? 'none' : '';
  if(editing) closeSheet();
  else guideState = '';
}
uiMode = mode;

// la caméra est ouverte : le miroir peut prendre toute la place
uiReady = function(){
  el('#start').style.display = 'none';
  el('#liveDot').classList.add('on');
  el('#stage').classList.add('live');
  toast('Cabine ouverte');
};

/* ---------- réglages : affichage en pourcentage + remplissage ---------- */
function paintRange(r){
  const p = (r.value - r.min) / (r.max - r.min) * 100;
  r.style.setProperty('--p', p.toFixed(1) + '%');
}
for(const r of els('input[type=range]')){
  paintRange(r);
  r.addEventListener('input', ()=>paintRange(r), { passive:true });
}

const DEFAULTS = { sWidth:1.05, sLength:1.25, sOffset:0.02,
                   sShade:0.7, sSmooth:0.45, sOpacity:1 };
el('#adjReset').onclick = ()=>{
  for(const [id,v] of Object.entries(DEFAULTS)){
    const r = el('#'+id);
    r.value = v; paintRange(r);
    r.dispatchEvent(new Event('input'));
  }
  toast('Réglages réinitialisés');
};

/* ---------- rail et feuilles de la cabine ---------- */
el('#railAdjust').onclick = ()=>sheet('#shAdjust');
el('#railAdd').onclick    = ()=>sheet('#shAdd');
el('#railCalib').onclick  = ()=>{ resetRing(); sheet('#shCalib'); };
el('#btnViews').onclick   = ()=>sheet('#shViews');
el('#adjCalib').onclick   = ()=>{ resetRing(); sheet('#shCalib'); };
el('#adjMeasures').onclick = ()=>{ closeSheet(); go('profil'); };
el('#profMeasure').onclick = ()=>{
  if(!video){ toast('Ouvrez d’abord votre cabine', true); go('cabine'); return; }
  go('cabine'); resetRing(); sheet('#shCalib');
};

/* ---------- ajout d'un vêtement ---------- */
let pendingCat = 'haut';
el('#addShoot').onclick   = ()=>{ closeSheet(); el('#fileShoot').click(); };
el('#addGallery').onclick = ()=>{ closeSheet(); slot = 'face'; el('#file').click(); };
el('#addWard').onclick    = ()=>{ closeSheet(); go('dressing'); };
el('#addShared').onclick  = ()=>{ closeSheet(); el('#fileJson').click(); };
el('#fileShoot').onchange = e => {
  const f = e.target.files[0]; if(!f) return;
  slot = 'face';
  const dt = new DataTransfer(); dt.items.add(f);
  el('#file').files = dt.files;
  el('#file').dispatchEvent(new Event('change'));
  e.target.value = '';
};
el('#wardAdd1').onclick = el('#wardAdd2').onclick = ()=>{ go('cabine'); sheet('#shAdd'); };

/* ---------- dressing ---------- */
let catFilter = 'tout';
for(const c of els('.chip')) c.onclick = ()=>{
  catFilter = c.dataset.cat;
  for(const o of els('.chip')) o.setAttribute('aria-pressed', String(o === c));
  renderWardrobe();
};

function renderWardrobe(){
  const g = el('#wardGrid'), list = wardrobe.filter(
    i => catFilter === 'tout' || i.cat === catFilter);
  g.textContent = '';
  el('#wardEmpty').hidden = wardrobe.length > 0;
  el('#wardStick').hidden = wardrobe.length === 0;
  for(const it of list){
    const b = document.createElement('button');
    b.className = 'cell contain';
    b.innerHTML = `<img alt="" loading="lazy" src="${srcOf(it.thumb)}">
      <span class="fav" aria-pressed="${!!it.fav}">
      <svg viewBox="0 0 24 24"><path d="M12 20s-7.2-4.5-7.2-9.4A4.1 4.1 0 0 1 12 8.1a4.1 4.1 0 0 1 7.2 2.5C19.2 15.5 12 20 12 20Z"/></svg></span>
      <span class="cap">${it.name}</span>`;
    b.onclick = ev => {
      if(ev.target.closest('.fav')){ toggleFav(it); return; }
      openItem(it);
    };
    g.appendChild(b);
  }
}
async function toggleFav(it){
  it.fav = !it.fav;
  await dbPut(GAR, it);
  renderWardrobe();
  toast(it.fav ? 'Ajouté aux favoris' : 'Retiré des favoris');
}

function openItem(it){
  currentItem = it;
  el('#itemName').textContent = it.name;
  el('#itemImg').src = srcOf(it.thumb);
  el('#itemCat').textContent = it.cat === 'veste' ? 'Veste' : 'Haut';
  el('#itemDate').textContent = fmtDate(it.created);
  const vs = Object.keys(it.views || {});
  el('#itemViews').textContent = vs.length ? vs.join(' · ') : '—';
  const w = el('#itemWarn');
  if(vs.length < 2){
    w.hidden = false;
    w.innerHTML = '<b>Une seule vue calibrée.</b> Le vêtement restera juste de face ; '+
      'ajoutez une photo de profil et de dos pour qu’il suive vos rotations.';
  } else w.hidden = true;
  sheet('#shItem');
}
el('#itemFav').onclick = ()=>{ if(currentItem) toggleFav(currentItem); };
el('#itemDel').onclick = async ()=>{
  if(!currentItem || !confirm('Supprimer « '+currentItem.name+' » du dressing ?')) return;
  await dbDel(GAR, currentItem.id);
  wardrobe = wardrobe.filter(x => x.id !== currentItem.id);
  currentItem = null; closeSheet(); renderWardrobe();
  toast('Vêtement supprimé');
};
el('#itemWear').onclick = ()=>{ if(currentItem) wearItem(currentItem); };

/* Charge un vêtement du dressing dans le moteur : on reconstitue exactement
   la structure qu'il attend, { cv, anch, mirror }, vue par vue. */
async function wearItem(it){
  toast('Préparation du vêtement…');
  try{
    for(const k of ['face','profil','dos']){
      dropView(views[k]);
      views[k] = null;
    }
    for(const k of ['face','profil','dos']){
      const v = it.views && it.views[k];
      if(!v) continue;
      views[k] = { cv: await blobToCanvas(v.img), anch: v.anch, mirror:null };
    }
    if(!views.face){ toast('Ce vêtement n’a pas de vue de face', true); return; }
    currentItem = it;
    refreshSlots('face');
    saveViews();
    closeSheet();
    go('cabine');
    el('#cabFav').setAttribute('aria-pressed', String(!!it.fav));
    el('#cabFav').classList.toggle('on', !!it.fav);
    toast('Essayage LIVE · ' + it.name);
  }catch(e){ toast('Vêtement illisible', true); }
}

/* Appelé par le moteur quand une calibration vient d'aboutir. */
async function onGarmentCalibrated(){
  try{
    const out = {};
    for(const k of ['face','profil','dos']){
      if(!views[k]) continue;
      const p = packView(views[k]);
      const r = await fetch(p.img);
      out[k] = { img: await r.blob(), anch: p.anch };
    }
    if(!out.face) return;
    const thumb = await makeThumb(views.face.cv, 220);
    if(currentItem && wardrobe.some(x => x.id === currentItem.id)){
      currentItem.views = out; currentItem.thumb = thumb;
      await dbPut(GAR, currentItem);
    }else{
      const n = wardrobe.length + 1;
      currentItem = { id:'g'+Date.now(), name:'Vêtement '+n, cat:pendingCat,
                      created:Date.now(), fav:false, thumb, views:out };
      wardrobe.push(currentItem);
      await dbPut(GAR, currentItem);
    }
    syncDock();
    toast('Vêtement prêt · essayage LIVE');
  }catch(e){ toast('Enregistrement impossible', true); }
}
uiCalibrated = onGarmentCalibrated;

/* ---------- dock de la cabine ---------- */
function syncDock(){
  const d = el('#dockList');
  if(!d) return;
  d.textContent = '';
  for(const it of wardrobe){
    const b = document.createElement('button');
    b.className = 'thumb';
    b.setAttribute('aria-pressed', String(!!currentItem && it.id === currentItem.id));
    b.innerHTML = `<img alt="${it.name}" loading="lazy" src="${srcOf(it.thumb)}">`;
    b.onclick = ()=>wearItem(it);
    d.appendChild(b);
  }
  const add = document.createElement('button');
  add.className = 'thumb add';
  add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>';
  add.onclick = ()=>sheet('#shAdd');
  d.appendChild(add);
}
uiSyncDock = syncDock;

el('#cabFav').onclick = ()=>{
  if(!currentItem){ toast('Chargez un vêtement d’abord'); return; }
  toggleFav(currentItem);
  el('#cabFav').setAttribute('aria-pressed', String(!!currentItem.fav));
  el('#cabFav').classList.toggle('on', !!currentItem.fav);
};

/* ---------- calibration guidée ---------- */
const RING = 377;
function resetRing(){
  el('#ring').hidden = true;
  el('#calibState').hidden = true;
  el('#calibH').textContent = 'Tenez-vous face à la caméra';
  el('#btnMeasure').disabled = false;
  el('#btnMeasure').textContent = 'Calibrer mon corps';
  el('.fg') && el('.fg').setAttribute('stroke-dashoffset', RING);
  el('#ringN').textContent = '0 %';
}
function calibTick(p){
  const r = el('#ring');
  if(r.hidden){
    r.hidden = false;
    el('#calibState').hidden = false;
    el('#calibH').textContent = 'Restez immobile';
    el('#btnMeasure').disabled = true;
    el('#btnMeasure').textContent = 'Mesure en cours…';
  }
  el('.fg').setAttribute('stroke-dashoffset', (RING * (1-p)).toFixed(1));
  el('#ringN').textContent = Math.round(p*100) + ' %';
}
uiCalibTick = calibTick;

function onMeasured(sure){
  el('#calibH').textContent = '✓ Cabine calibrée';
  el('#calibState').textContent = sure
    ? 'Mesure d’après votre stature.'
    : 'Chevilles hors cadre : estimation moins fiable.';
  el('#btnMeasure').disabled = false;
  el('#btnMeasure').textContent = 'Recommencer la mesure';
  el('.fg').setAttribute('stroke-dashoffset', 0);
  el('#ringN').textContent = '100 %';
  for(const [a,b] of [['mScale','mScale2'],['mShCm','mShCm2'],
                      ['mChest','mChest2'],['mSize','mSize2']])
    el('#'+b).textContent = el('#'+a).textContent;
}
uiMeasured = onMeasured;

/* ---------- capture ---------- */
let shotBlob = null, shotItem = null;
el('#shutter').onclick = async ()=>{
  if(!video){ toast('Ouvrez d’abord votre cabine', true); return; }
  const blob = await cvToBlob(canvas);
  if(!blob){ toast('Capture impossible', true); return; }
  shotBlob = blob;
  shotItem = { id:'l'+Date.now(), created:Date.now(), fav:false, blob };
  el('#shotImg').src = srcOf(blob);
  el('#shotFav').setAttribute('aria-pressed','false');
  sheet('#shShot');
  await dbPut(LKS, shotItem);
  looks.unshift(shotItem);
};
el('#shotBack').onclick = closeSheet;
el('#shotFav').onclick = async ()=>{
  if(!shotItem) return;
  shotItem.fav = !shotItem.fav;
  await dbPut(LKS, shotItem);
  toast(shotItem.fav ? 'Ajouté aux favoris' : 'Retiré des favoris');
};
el('#shotSave').onclick = ()=>{ el('#btnShot').click(); toast('Image enregistrée'); };
el('#shotShare').onclick = ()=>shareBlob(shotBlob);

async function shareBlob(blob){
  if(!blob) return;
  const f = new File([blob], 'fitroom-'+Date.now()+'.png', { type:'image/png' });
  try{
    if(navigator.canShare && navigator.canShare({ files:[f] }))
      await navigator.share({ files:[f], title:'Mon look FitRoom AI' });
    else { el('#btnShot').click(); toast('Image enregistrée'); }
  }catch(e){ /* partage annulé */ }
}

/* ---------- looks ---------- */
let lookNow = null;
function renderLooks(){
  const g = el('#looksGrid');
  g.textContent = '';
  el('#looksEmpty').hidden = looks.length > 0;
  for(const lk of looks){
    const b = document.createElement('button');
    b.className = 'cell';
    b.innerHTML = `<img alt="" loading="lazy" src="${srcOf(lk.blob)}">
      <span class="fav" aria-pressed="${!!lk.fav}">
      <svg viewBox="0 0 24 24"><path d="M12 20s-7.2-4.5-7.2-9.4A4.1 4.1 0 0 1 12 8.1a4.1 4.1 0 0 1 7.2 2.5C19.2 15.5 12 20 12 20Z"/></svg></span>
      <span class="cap">${fmtDate(lk.created)}</span>`;
    b.onclick = async ev => {
      if(ev.target.closest('.fav')){
        lk.fav = !lk.fav; await dbPut(LKS, lk); renderLooks(); return;
      }
      lookNow = lk;
      el('#lookImg').src = srcOf(lk.blob);
      sheet('#shLook');
    };
    g.appendChild(b);
  }
}
el('#lookFav').onclick = async ()=>{
  if(!lookNow) return;
  lookNow.fav = !lookNow.fav; await dbPut(LKS, lookNow);
  toast(lookNow.fav ? 'Ajouté aux favoris' : 'Retiré des favoris'); renderLooks();
};
el('#lookShare').onclick = ()=>lookNow && shareBlob(lookNow.blob);
el('#lookRetry').onclick = ()=>{ closeSheet(); go('cabine'); };
el('#lookDel').onclick = async ()=>{
  if(!lookNow || !confirm('Supprimer ce look ?')) return;
  await dbDel(LKS, lookNow.id);
  looks = looks.filter(x => x.id !== lookNow.id);
  lookNow = null; closeSheet(); renderLooks(); toast('Look supprimé');
};

/* ---------- profil ---------- */
el('#pShare').onclick  = ()=>el('#btnShare').click();
el('#pExport').onclick = ()=>el('#btnExport').click();
el('#pImport').onclick = ()=>el('#btnImport').click();
el('#p3d').onclick     = ()=>el('#btn3d').click();

/* ---------- démarrage ---------- */
(async function initUI(){
  try{
    wardrobe = (await dbAll(GAR)).sort((a,b)=>b.created-a.created);
    looks    = (await dbAll(LKS)).sort((a,b)=>b.created-a.created);
  }catch(e){ toast('Stockage local indisponible', true); }
  syncDock();
  renderWardrobe();
  renderLooks();
  go('home');
})();
