# Écriture de Suse

Appli web (PWA) de messages chiffrés : AES-256-GCM + signes inspirés du proto-élamite.
Fonctionne hors ligne une fois installée. Rien n'est envoyé à un serveur.

## Mettre en ligne (gratuit, 2 minutes)

**Option Netlify Drop (le plus simple)**
1. Va sur https://app.netlify.com/drop
2. Glisse le dossier `ecriture-de-suse` entier.
3. Tu obtiens une adresse en `https://…netlify.app`.

**Option GitHub Pages**
1. Crée un dépôt, mets-y les fichiers du dossier.
2. Settings → Pages → Branch `main` → Save.

HTTPS est obligatoire : le chiffrement du navigateur ne marche pas en `http://` ni en ouvrant `index.html` directement.

## Installer sur le téléphone
- **iPhone (Safari)** : ouvre l'adresse → bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvre l'adresse → menu ⋮ → « Installer l'application ».

## Utilisation
- **Graver** : mot de passe + message → « Graver et copier » (ou « Partager » vers WhatsApp, SMS…).
- **Lire** : « Coller » → le message s'affiche si le mot de passe est bon.

Ton contact doit utiliser la même appli et le même mot de passe.
Les tablettes faites avec la version précédente (artifact) sont compatibles.
