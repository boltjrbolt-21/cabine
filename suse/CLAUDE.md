# Écriture de Suse — contexte projet

PWA statique (HTML/CSS/JS vanilla, aucune dépendance, aucun build) pour chiffrer des messages
et les afficher en signes inspirés de l'écriture proto-élamite (tablettes de Suse, ~3100 av. J.-C.).

## Fichiers
- `index.html` — toute l'appli (UI + logique). Onglets Graver / Lire.
- `manifest.json`, `sw.js` — installation PWA et cache hors ligne (incrémenter `CACHE` dans sw.js à chaque modif).
- `icon-180/192/512.png` — icônes (glyphe hexagone barré, lapis sur argile).

## Format des tablettes (ne pas casser la compatibilité)
- Octets : `[0x01 version][sel 16][iv 12][ciphertext AES-256-GCM + tag]`.
- Clé : PBKDF2-SHA256, 310 000 itérations, depuis le mot de passe.
- Chaque octet → 2 quartets → 2 signes. 16 signes, ordre fixe :
  `○ ‖ ◇ ▣ △ ◈ ⊙ Ш T ☾ ⬡ ✱ 8 ⊓ ▽ Ψ` (index 0 à 15). Tableau `T` dans index.html.
- Les dessins SVG des signes sont dans le tableau `G` (même ordre), viewBox 0 0 40 56.
- Affichage de droite à gauche (`flex-direction: row-reverse`), comme les tablettes.

## Contraintes
- Web Crypto exige HTTPS (ou localhost). Tester avec `npx serve .` ou `python3 -m http.server`.
- Rien ne doit partir vers un serveur : tout reste dans le navigateur.
- Mot de passe mémorisé seulement si l'utilisateur coche l'option (localStorage `suse-pw`).
- Langue de l'interface : français.

## Hébergement
Prévu sur Netlify Drop ou GitHub Pages.
