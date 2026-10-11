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
- Affichage : un signe par octet (paire de quartets), soit 256 signes. Quartet fort → forme de base `G`,
  quartet faible → variante `M` (pivotée, encadrée, redoublée, empreintes ou traits ajoutés). Voir `sign()`
  et `signsOf()`. Purement visuel : seul le texte en caractères `T` sert au déchiffrement.
- Mise en page (`signsOf()`), d'après la tablette réelle MDP 17, 77+212+226 (CDLI) :
  en-tête de 2 signes sans nombre (composé « M327+M342 » si bit 0), puis entrées « 1 à 3 signes + nombre »
  (bit faible = un signe suit ; bits 1–2 du premier signe → système C, D, S ou C), puis trait pointillé
  (revers) et un total par système, précédé de `SIGNE_TOTAL`.
- Systèmes (`SYS`, rendu par `numeral()` / `mark()`) : D décimal (coin 1, trou 10, cercle 100, cercle pointé
  1000), S sexagésimal (… grand coin 60, grand coin + trou 600, double cercle 3600), C capacité / grain
  (fractions stylisées n30c, n24, n39b, puis coin, trou, cercle). Rapports de C propres à Suse.
- Variante `M` 12 : signe « précisé par une fraction » (comme M36+1(N30d)).
- Aucun module externe : le « proto_elamite_parser » Python évoqué un jour n'existe pas (absent de PyPI).
  Le vrai analyseur Python est dans `../proto-elamite/`.
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

## Verrouillage Face ID (optionnel)
- Clé d'accès WebAuthn (plateforme, vérification obligatoire → Face ID ou code du téléphone).
  localStorage `suse-lock` : `{id, salt, prf}`.
- Si l'extension PRF répond (iOS 18+) : secret PRF → HKDF → clé AES du coffre `suse-vault`
  (`[iv 12][JSON {convs, qpw} chiffré]`), et `suse-convs` / `suse-pw` sont supprimés. Verrouillée,
  l'appli n'a plus rien en clair en mémoire. Sans PRF : simple écran, stockage inchangé.
- Verrouillage : menu ⋯ « Verrouiller », bouton 🔒 de l'accueil, au lancement, et après 60 s en
  arrière-plan. Supprimer la clé d'accès dans les réglages rend le coffre illisible (prévenu à l'activation).
- Test : Chromium + authentificateur virtuel CDP (`WebAuthn.addVirtualAuthenticator`, `hasPrf`).

## Contraintes
- Web Crypto exige HTTPS (ou localhost). Tester avec `npx serve .` ou `python3 -m http.server`.
- Rien ne doit partir vers un serveur : tout reste dans le navigateur.
- Mot de passe mémorisé seulement si l'utilisateur coche l'option (localStorage `suse-pw` en mode sans conversation, champ `pw` d'une conversation).
- Langue de l'interface : français.

## Hébergement
Prévu sur Netlify Drop ou GitHub Pages.
