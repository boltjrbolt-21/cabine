/* Doublure de @mediapipe/tasks-vision.
   Elle rend une pose debout, articulée et animée, pour exercer en local
   tout le chemin suivi/déformation/rendu du code réellement composé.
   Aucun modèle n'est téléchargé : seul le pipeline est testé. */

export class FilesetResolver {
  static async forVisionTasks(){ return { stub:true }; }
}

let phase = 0;

/* Rotation du buste, en degrés : 0 de face, 90 de profil, 180 de dos.
   Poser window.__yaw la pilote depuis un test ; sinon elle balaie seule. */
export function currentYaw(){
  return (typeof window !== 'undefined' && window.__yaw !== undefined)
    ? window.__yaw
    : (Math.sin(phase * 0.35) * 0.5 + 0.5) * 180;
}

/* 33 points, convention MediaPipe Pose, coordonnées normalisées.
   Le repère 11 est l'épaule GAUCHE de la personne : filmée de face et sans
   miroir, elle apparaît donc à DROITE de l'image, donc à un x plus grand.
   Se tromper ici inverse l'avant et l'arrière, et le test valide un moteur
   cassé — c'est arrivé. */
function pose(){
  phase += 0.02;
  const sway = Math.sin(phase) * 0.03;
  const armUp = (Math.sin(phase * 0.7) + 1) / 2;      // 0 bras bas, 1 bras levés
  const P = new Array(33).fill(null).map(()=>({ x:0.5, y:0.5, z:0, visibility:0.95 }));

  // de profil, les épaules se rapprochent à l'écran ; de dos, elles se croisent
  const w = Math.cos(currentYaw() * Math.PI / 180);
  const cx = 0.5 + sway;
  /* Le visage cesse d'être vu quand on tourne le dos : c'est ce signal qui
     permet au moteur de vérifier le sens de sa mesure de profondeur. */
  const a = Math.abs(currentYaw());
  const fv = a < 75 ? 0.97 : a < 110 ? 0.55 : 0.12;
  P[0]  = { x:cx,          y:0.13, z:0, visibility:fv };   // nez
  P[2]  = { x:cx+0.03,     y:0.12, z:0, visibility:fv };   // œil gauche
  P[5]  = { x:cx-0.03,     y:0.12, z:0, visibility:fv };   // œil droit
  P[11] = { x:cx+0.115*w,  y:0.29, z:0, visibility:.97 };  // épaule gauche
  P[12] = { x:cx-0.115*w,  y:0.29, z:0, visibility:.97 };  // épaule droite
  P[13] = { x:cx+0.175*w,  y:0.29 + 0.14*(1-armUp*0.7), z:0, visibility:.93 };
  P[14] = { x:cx-0.175*w,  y:0.29 + 0.14*(1-armUp*0.7), z:0, visibility:.93 };
  P[15] = { x:cx+0.205*w,  y:0.29 + 0.27*(1-armUp*0.8), z:0, visibility:.88 };
  P[16] = { x:cx-0.205*w,  y:0.29 + 0.27*(1-armUp*0.8), z:0, visibility:.88 };
  P[23] = { x:cx+0.075*w,  y:0.585, z:0, visibility:.95 }; // hanche gauche
  P[24] = { x:cx-0.075*w,  y:0.585, z:0, visibility:.95 };
  P[25] = { x:cx+0.072*w,  y:0.75,  z:0, visibility:.9 };
  P[26] = { x:cx-0.072*w,  y:0.75,  z:0, visibility:.9 };
  P[27] = { x:cx+0.07*w,   y:0.92,  z:0, visibility:.85 }; // chevilles visibles
  P[28] = { x:cx-0.07*w,   y:0.92,  z:0, visibility:.85 };
  return P;
}

/* Repères 3D. Seule la ligne d'épaules compte pour la rotation du buste.
   MediaPipe : x suit l'image vers la droite, z est la profondeur, et plus
   il est petit plus le point est proche de la caméra. */
function world(){
  const th = currentYaw() * Math.PI / 180, r = 0.18;
  // __invertZ simule un appareil dont la profondeur est de signe opposé
  const k = (typeof window !== 'undefined' && window.__invertZ) ? -1 : 1;
  return [
    ...new Array(11).fill({ x:0, y:0, z:0, visibility:.9 }),
    { x: k*r*Math.cos(th), y:0, z: k*r*Math.sin(th), visibility:.95 },  // épaule gauche
    { x:-k*r*Math.cos(th), y:0, z:-k*r*Math.sin(th), visibility:.95 },  // épaule droite
    ...new Array(21).fill({ x:0, y:0, z:0, visibility:.9 })
  ];
}

export class PoseLandmarker {
  static async createFromOptions(files, opts){
    if(opts.baseOptions.delegate === 'GPU' && PoseLandmarker.failGPU)
      throw new Error('pas de GPU');
    return new PoseLandmarker();
  }
  detectForVideo(){ return { landmarks:[pose()], worldLandmarks:[world()] }; }
  close(){}
}

/* Silhouette complète, comme le vrai modèle la rend : fond 0, peau 2,
   visage 3, vêtements 4. Le torse doit exister en catégorie « vêtements »,
   sans quoi la découpe seconde peau n'aurait rien à quoi se raccrocher. */
function mask(w, h){
  const a = new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const nx = x/w, ny = y/h;
    const face  = ((nx-0.5)**2)/0.0045 + ((ny-0.13)**2)/0.004 < 1;
    const torso = nx > 0.33 && nx < 0.67 && ny > 0.26 && ny < 0.70;
    const arms  = (nx > 0.22 && nx < 0.36 || nx > 0.64 && nx < 0.78)
                  && ny > 0.28 && ny < 0.62;
    const legs  = nx > 0.36 && nx < 0.64 && ny >= 0.70 && ny < 0.97;
    a[y*w+x] = face ? 3 : arms ? 2 : (torso || legs) ? 4 : 0;
  }
  return a;
}

export class ImageSegmenter {
  static async createFromOptions(){ return new ImageSegmenter(); }
  #res(){
    const w = 256, h = 256, arr = mask(w,h);
    return { categoryMask:{ width:w, height:h,
      getAsUint8Array:()=>arr, close(){} } };
  }
  segmentForVideo(){ return this.#res(); }
  segment(){
    // pour le détourage : on déclare « vêtement » (4) un rectangle central
    const w = 256, h = 256, a = new Uint8Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++)
      a[y*w+x] = (x>w*0.18 && x<w*0.82 && y>h*0.1 && y<h*0.9) ? 4 : 0;
    return { categoryMask:{ width:w, height:h, getAsUint8Array:()=>a, close(){} } };
  }
  close(){}
}
