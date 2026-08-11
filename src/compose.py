# -*- coding: utf-8 -*-
"""Compose index.html = coquille + moteur (corrige) + couche interface."""
import io, re, sys

shell  = io.open('src/shell.html', encoding='utf-8').read()
ui     = io.open('src/ui.js',   encoding='utf-8').read()
src    = io.open('src/engine.html', encoding='utf-8').read()
engine = re.search(r'<script type="module">(.*?)</script>', src, re.S).group(1)

def sub(s, old, new, n=1):
    got = s.count(old)
    if got != n:
        sys.exit('PATCH RATE (%d/%d) : %s' % (got, n, old[:80].replace('\n', ' ')))
    return s.replace(old, new)

# --- 1. le statut du moteur devient un bandeau ephemere ---------------
engine = sub(engine,
"const statusEl = $('status'), hint = $('hint');",
"""const hint = $('hint');
/* Le moteur pose son statut ici. L'interface le transforme en bandeau
   ephemere plutot qu'en ligne fixe : rien ne doit occuper le miroir. */
const ERRS = /illisible|impossible|refus|interrompu|satur|trop courte|indisponible|echec|Ã©chec/i;
const statusEl = {
  style:{},
  get textContent(){ return ''; },
  set textContent(v){ if(uiToast) uiToast(v, ERRS.test(v)); }
};""")

# --- 2. Recalibrer vit desormais dans la feuille Ajuster --------------
engine = sub(engine, "$('btnRecal').style.display = 'block';",
                     "$('btnRecal').dataset.ready = '1';", 2)

# --- 3. les reglages s'affichent en pourcentage de leur course --------
engine = sub(engine,
"""const bind = (id,key,fmt)=>{
  const el = $(id), out = $('v'+id.slice(1));
  el.oninput = ()=>{ cfg[key] = +el.value; out.textContent = fmt(+el.value); };
};
bind('sWidth','width',   v=>v.toFixed(2)+'×');
bind('sLength','length', v=>v.toFixed(2)+'×');
bind('sOffset','offset', v=>v.toFixed(2));
bind('sShade','shade',   v=>Math.round(v*100)+' %');
bind('sSmooth','smooth', v=>v.toFixed(2));
bind('sOpacity','opacity',v=>Math.round(v*100)+' %');""",
"""/* Un multiplicateur de 1,05x ne dit rien a personne. On affiche la
   position du curseur sur sa course ; la valeur reelle, elle, ne change pas. */
const bind = (id,key)=>{
  const r = $(id), out = $('v'+id.slice(1));
  const show = ()=>{ out.textContent =
    Math.round((r.value - r.min)/(r.max - r.min)*100) + ' %'; };
  r.oninput = ()=>{ cfg[key] = +r.value; show(); };
  show();
};
bind('sWidth','width');   bind('sLength','length');  bind('sOffset','offset');
bind('sShade','shade');   bind('sSmooth','smooth');  bind('sOpacity','opacity');""")

# --- 4. la boucle ne tourne que si le miroir est a l'ecran ------------
engine = sub(engine,
"""  // onglet en arrière-plan : la caméra tourne encore, pas la peine d'inférer
  if(document.hidden) return;""",
"""  // onglet en arrière-plan, ou utilisateur parti sur un autre écran :
  // la caméra tourne encore, mais inférer ne servirait à personne
  if(document.hidden || !liveOn) return;""")

# --- 5. progression de la calibration ---------------------------------
engine = sub(engine,
"  if(measuring && t0 - measuring.t0 > 3000) finishMeasure();",
"""  if(measuring){
    if(uiCalibTick) uiCalibTick(Math.min(1, (t0 - measuring.t0)/3000));
    if(t0 - measuring.t0 > 3000) finishMeasure();
  }""")

# --- 6. guidage : trois etats au lieu d'une phrase technique ----------
engine = sub(engine,
"""    if(!measuring){
      setHint(cropped ? 'Reculez : vos hanches sortent du cadre'
                      : 'Reculez pour cadrer épaules et hanches',
              (cropped || conf <= 0.6) ? '1' : '0');
    }""",
"""    if(!measuring && uiGuide)
      uiGuide(cropped ? 'crop' : conf <= 0.6 ? 'seek' : 'ok');""")

engine = sub(engine,
"    poseInit = false; setHint(null, '1');",
"    poseInit = false; if(uiGuide) uiGuide('seek');")

# --- 7. fin de mesure : l'interface reprend la main -------------------
engine = sub(engine,
"""  statusEl.textContent = 'En direct';
}""",
"""  if(uiMeasured) uiMeasured(sure);
}""")

# --- 8. une calibration aboutie entre au dressing ---------------------
engine = sub(engine,
"""  refreshSlots(slot);
  saveViews();""",
"""  refreshSlots(slot);
  saveViews();
  if(uiCalibrated) uiCalibrated();
  if(uiMode) uiMode('live');""")

# --- 9. le dock suit l'etat des vues ---------------------------------
engine = sub(engine,
"""function refreshSlots(active){
  for(const b of document.querySelectorAll('.vw')){""",
"""function refreshSlots(active){
  if(uiSyncDock) uiSyncDock();
  for(const b of document.querySelectorAll('.vw')){""")

# --- 10. detourage et calibration passent en mode edition -------------
engine = sub(engine,
"""function startCut(cv){
  cut = { orig:cv, work:copyCv(cv) };""",
"""function startCut(cv){
  if(uiMode) uiMode('edit');
  cut = { orig:cv, work:copyCv(cv) };""")

engine = sub(engine,
"""function startCalib(cv){
  calib = { cv, pts:[] };""",
"""function startCalib(cv){
  if(uiMode) uiMode('edit');
  calib = { cv, pts:[] };""")

# --- 11. drapeau d'ouverture camera ----------------------------------
engine = sub(engine,
"""    startEl.style.display='none';
    statusEl.style.color='var(--brass)';""",
"""    startEl.style.display='none';
    booting = true;""")

engine = sub(engine,
"""    statusEl.textContent = 'En direct';
    requestAnimationFrame(loop);""",
"""    booting = false;
    if(uiReady) uiReady();
    requestAnimationFrame(loop);""")

engine = sub(engine,
"""    startEl.style.display='flex';
    statusEl.textContent='Interrompu'; statusEl.style.color='var(--alert)';""",
"""    startEl.style.display='flex';
    booting = false;
    statusEl.textContent='Ouverture interrompue';""")

# --- prelude : etat partage entre le moteur et l'interface ------------
# var et non let : le moteur appelle certaines de ces fonctions pendant
# l'evaluation du module, avant que la couche interface ne soit definie.
prelude = """/* Pont moteur <-> interface. Declare en var : le moteur touche a
   certaines de ces cases pendant l'evaluation du module, donc avant que
   la couche interface plus bas ne soit arrivee a sa ligne. */
var liveOn = false, booting = false;
var uiToast, uiGuide, uiCalibrated, uiSyncDock, uiCalibTick, uiMeasured,
    uiMode, uiReady;

/* Les trois boutons de vue sont fabriques ici : le moteur les cherche
   des son evaluation, ils doivent donc exister avant lui. */
(function(){
  const host = document.getElementById('views');
  for(const [s,l] of [['face','Face'],['profil','Profil'],['dos','Dos']]){
    const b = document.createElement('button');
    b.className = 'vw'; b.dataset.slot = s;
    b.innerHTML = l + '<em>vide</em>';
    host.appendChild(b);
  }
})();

"""

out = shell.replace('/*__ENGINE__*/', prelude + engine).replace('/*__UI__*/', ui)
io.open('index.html', 'w', encoding='utf-8', newline='').write(out)
print('index.html compose :', len(out.splitlines()), 'lignes')
