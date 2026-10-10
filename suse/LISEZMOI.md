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
1. **Nouvelle conversation** : un nom et un mot de passe. Ton contact fait pareil, avec le même mot de passe.
2. **Écrire** : tape ton message → « Graver et copier », puis colle la tablette dans WhatsApp, SMS…
   (ou « Partager »).
3. **Recevoir** : copie la tablette reçue → « Coller » dans la conversation. Elle s'ajoute au fil.
4. Touche une bulle pour voir sa tablette et la recopier.

L'historique reste sur ton téléphone, chiffré avec le mot de passe de la conversation.
Le menu ⋯ permet de renommer, changer de mot de passe, mémoriser ou oublier le mot de passe,
verrouiller ou supprimer la conversation.

« Graver ou lire sans conversation » garde l'ancien fonctionnement, pour un message isolé.
Les tablettes faites avec la version précédente (artifact) sont compatibles.
