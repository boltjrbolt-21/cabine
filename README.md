# FitRoom AI

Cabine d'essayage virtuelle **en direct**. Vous ouvrez la caméra, vous chargez
un vêtement, et il apparaît sur votre corps pendant que vous bougez.

Ce n'est pas un générateur d'images : rien n'est envoyé nulle part, rien n'est
calculé après coup. Tout tourne dans le navigateur, image par image.

→ <https://boltjrbolt-21.github.io/cabine/>

## Comment ça marche

Le vêtement est ancré sur ses propres coutures d'épaules, étiré sur votre buste,
déformé sur trois points, éclairé par la lumière de la pièce, et masqué là où
votre peau passe devant.

| Étage | Rôle |
| --- | --- |
| MediaPipe Pose (lite) | 33 points de squelette, une passe par image caméra |
| Selfie Multiclass | masque de peau, pour que le tissu passe derrière les bras |
| Grille WebGL 22×28 | déformation pondérée par os, jonction épaule/manche continue |
| Repli Canvas 2D | même rendu par pièces affines si WebGL est absent |

Sa limite : votre vrai vêtement reste dessous. L'effacer demanderait un modèle
de diffusion qui repeint le torse.

## Fichiers publiés

    index.html            l'application (moteur + interface, composé)
    avatar.html           vue 3D approchée depuis vos proportions
    sw.js                 cache : la coquille, et les ~10 Mo de modèles
    manifest.webmanifest  installation sur l'écran d'accueil
    icon-*.png            icônes

## Modifier l'application

**`index.html` est un fichier composé. Ne l'éditez pas directement** : il serait
écrasé à la prochaine construction. Les sources sont dans `src/`.

    src/shell.html   structure et design de l'interface
    src/ui.js        couche interface : écrans, dressing, feuilles
    src/engine.html  le moteur (caméra, suivi, déformation, calibration)
    src/compose.py   assemble les trois et applique les correctifs de liaison
    src/mpstub.mjs   doublure de MediaPipe, pour tester sans caméra

Après modification :

```bash
python src/compose.py
```

`compose.py` échoue bruyamment si un correctif ne trouve plus sa cible dans le
moteur — c'est voulu : une refonte silencieusement désynchronisée serait pire
qu'une construction cassée.

### Tester sans caméra ni corps

`src/mpstub.mjs` fournit une pose debout articulée et animée. En le branchant à
la place de MediaPipe via un *import map*, tout le chemin suivi → déformation →
rendu s'exécute sur une silhouette synthétique.

## Performance

Le rendu est temps réel : la caméra et le suivi passent avant le design.

- caméra plafonnée à 30 i/s — le réseau de pose tourne une fois par image
- segmentation de la peau à cadence adaptative, espacée quand la machine peine
- luminance calculée dans le nuanceur, pas relue pixel par pixel côté processeur
- aucun `backdrop-filter` au-dessus du miroir : il y coûte 10 à 20 % des images
- la boucle s'arrête dès que le miroir n'est plus à l'écran

## Vie privée

Aucune photo, aucune mesure, aucune capture ne quitte l'appareil. Le dressing et
les looks vivent dans IndexedDB, en local. Les seules requêtes réseau vont
chercher les modèles MediaPipe et la police, une seule fois, puis sont servies
depuis le cache.
