/* Doublure de @mediapipe/tasks-vision.
   Elle rend une pose debout, articulée et animée, pour exercer en local
   tout le chemin suivi/déformation/rendu du code réellement composé.
   Aucun modèle n'est téléchargé : seul le pipeline est testé. */

export class FilesetResolver {
  static async forVisionTasks(){ return { stub:true }; }
}

let phase = 0;

// 33 points, dans la convention MediaPipe Pose, coordonnées normalisées
function pose(){
  phase += 0.02;
  const sway = Math.sin(phase) * 0.03;
  const armUp = (Math.sin(phase * 0.7) + 1) / 2;      // 0 bras bas, 1 bras levés
  const P = new Array(33).fill(null).map(()=>({ x:0.5, y:0.5, z:0, visibility:0.95 }));

  const cx = 0.5 + sway;
  P[0]  = { x:cx,        y:0.13, z:0, visibility:.98 };  // nez
  P[11] = { x:cx-0.115,  y:0.29, z:0, visibility:.97 };  // épaule gauche
  P[12] = { x:cx+0.115,  y:0.29, z:0, visibility:.97 };  // épaule droite
  P[13] = { x:cx-0.175,  y:0.29 + 0.14*(1-armUp*0.7), z:0, visibility:.93 };
  P[14] = { x:cx+0.175,  y:0.29 + 0.14*(1-armUp*0.7), z:0, visibility:.93 };
  P[15] = { x:cx-0.205,  y:0.29 + 0.27*(1-armUp*0.8), z:0, visibility:.88 };
  P[16] = { x:cx+0.205,  y:0.29 + 0.27*(1-armUp*0.8), z:0, visibility:.88 };
  P[23] = { x:cx-0.075,  y:0.585, z:0, visibility:.95 }; // hanche gauche
  P[24] = { x:cx+0.075,  y:0.585, z:0, visibility:.95 };
  P[25] = { x:cx-0.072,  y:0.75,  z:0, visibility:.9 };
  P[26] = { x:cx+0.072,  y:0.75,  z:0, visibility:.9 };
  P[27] = { x:cx-0.07,   y:0.92,  z:0, visibility:.85 }; // chevilles visibles
  P[28] = { x:cx+0.07,   y:0.92,  z:0, visibility:.85 };
  return P;
}

// repères 3D : servent uniquement au calcul de la rotation du buste
function world(){
  const yaw = Math.sin(phase * 0.35) * 0.9;            // balaie face → profil
  return [
    ...new Array(11).fill({ x:0, y:0, z:0, visibility:.9 }),
    { x:-0.18*Math.cos(yaw), y:0, z:-0.18*Math.sin(yaw), visibility:.95 },
    { x: 0.18*Math.cos(yaw), y:0, z: 0.18*Math.sin(yaw), visibility:.95 },
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
