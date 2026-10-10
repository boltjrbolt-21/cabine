# Écriture de Suse — contexte projet

PWA statique (HTML/CSS/JS vanilla, aucune dépendance, aucun build) pour chiffrer des messages
et les afficher en signes inspirés de l'écriture proto-élamite (tablettes de Suse, ~3100 av. J.-C.).

## Fichiers
- `index.html` — toute l'appli (UI + logique). Vues : accueil (liste des conversations), conversation
  (fil de bulles), formulaire (création / changement de mot de passe), déverrouillage, et
  « sans conversation » (anciens onglets Graver / Lire).
- `manifest.json`, `sw.js` — installation PWA et cache hors ligne (incrémenter `CACHE` dans sw.js à chaque modif).
- `icon-180/192/512.png` — icônes (glyphe hexagone barré, lapis sur argile).

## Format des tablettes (ne pas casser la compatibilité)
- Octets : `[0x01 version][sel 16][iv 12][ciphertext AES-256-GCM + tag]`.
- Clé : PBKDF2-SHA256, 310 000 itérations, depuis le mot de passe.
- Chaque octet → 2 quartets → 2 signes. 16 signes, ordre fixe :
  `○ ‖ ◇ ▣ △ ◈ ⊙ Ш T ☾ ⬡ ✱ 8 ⊓ ▽ Ψ` (index 0 à 15). Tableau `T` dans index.html.
- Les dessins des signes sont décrits dans le tableau `S` (même ordre que `T`), repère 40 × 56 :
  `w` traits de stylet (tête → pointe, rendus en coin effilé par `wedge()`), `o` empreintes rondes
  profondes (nombres), `r` grands cercles. `G` est généré depuis `S`. Modèle : tablettes du Louvre
  (J. L. Dahl, *Tablettes et fragments proto-élamites*) : traits droits, peu de courbes.
  Rendu incisé : `svg()` dessine un liseré `.hl` décalé sous le signe.
  Changer `S` ne casse rien ; changer `T` casserait toutes les tablettes.
- Affichage de droite à gauche (`flex-direction: row-reverse`), comme les tablettes.

## Conversations (stockage local)
- localStorage `suse-convs` : `[{id, name, salt, data, updated, pw?}]`.
- `data` = base64 de `[iv 12][historique JSON chiffré AES-256-GCM]`, clé PBKDF2 (310 000 it.) depuis le
  mot de passe de la conversation et `salt`. Historique : `[{me, t, text, code}]` (`code` = la tablette).
- Le nom et la date de la conversation sont en clair ; le contenu jamais.
- `pw` n'existe que si l'utilisateur a coché « Mémoriser ».
- Les tablettes restent transportées à la main (WhatsApp, SMS…) : graver copie, « Coller » ou un
  collage dans le champ de message ajoute un message reçu (doublons ignorés via `code`).
- La clé de la tablette suivante est dérivée à l'avance (`prep`) pour que copie et partage gardent le
  geste utilisateur exigé par Safari.

## Contraintes
- Web Crypto exige HTTPS (ou localhost). Tester avec `npx serve .` ou `python3 -m http.server`.
- Rien ne doit partir vers un serveur : tout reste dans le navigateur.
- Mot de passe mémorisé seulement si l'utilisateur coche l'option (localStorage `suse-pw` en mode sans conversation, champ `pw` d'une conversation).
- Langue de l'interface : français.

## Hébergement
Prévu sur Netlify Drop ou GitHub Pages.
