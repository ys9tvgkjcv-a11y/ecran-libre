# Installation pas à pas (gratuit)

Objectif : mettre l'application en ligne sur **GitHub Pages** (un hébergement gratuit de GitHub). Tu obtiens une adresse du type `https://TON-PSEUDO.github.io/ecran-libre/`, utilisable à tout moment sur ton Mac, ton iPhone et ton iPad.

Durée : environ 15 minutes. Coût : 0 €.

---

## Étape 1 — Décompresser le projet (Mac)

1. Télécharge `ecran-libre.zip` depuis la conversation.
2. Dans le **Finder**, ouvre **Téléchargements** et double-clique sur `ecran-libre.zip`. Un dossier `ecran-libre` apparaît.
3. Pour voir le dossier caché `.github` (utile pour la maintenance automatique), appuie sur **⌘ + Maj + .** (point) dans le Finder. Appuie à nouveau pour les masquer plus tard.

## Étape 2 — Créer un compte GitHub (si tu n'en as pas)

1. Va sur **https://github.com/signup**.
2. Saisis ton e-mail, un mot de passe solide et un pseudo (il apparaîtra dans l'adresse de l'app).
3. Valide le code reçu par e-mail.
4. 🔐 Recommandé : active la double authentification (**photo de profil → Settings → Password and authentication → Enable two-factor authentication**).

## Étape 3 — Créer le dépôt (le « dossier » en ligne)

1. En haut à droite de GitHub, clique sur **+** puis **New repository**.
2. **Repository name :** `ecran-libre`
3. Choisis **Public**. GitHub Pages est gratuit pour les dépôts publics. Le code sera visible, mais il ne contient aucun secret.
4. Laisse le reste tel quel et clique sur **Create repository**.

## Étape 4 — Envoyer les fichiers

1. Sur la page du dépôt vide, clique sur le lien **uploading an existing file**.
2. Dans le Finder, ouvre le dossier `ecran-libre`, sélectionne **tout son contenu** (⌘ + A), y compris `.github`, et **glisse-le** dans la zone de la page GitHub. Glisse le contenu, pas le dossier lui-même.
3. Vérifie que `index.html` apparaît dans la liste, à la racine.
4. En bas, clique sur **Commit changes**.

## Étape 5 — Activer GitHub Pages

1. Dans le dépôt, clique sur l'onglet **Settings** (⚙️).
2. Dans le menu de gauche, clique sur **Pages**.
3. Sous **Build and deployment → Source**, choisis **Deploy from a branch**.
4. Sous **Branch**, choisis **main**, puis **/ (root)**, et clique sur **Save**.
5. Attends 1 à 2 minutes, puis recharge la page. L'adresse s'affiche en haut : `https://TON-PSEUDO.github.io/ecran-libre/`.

## Étape 6 — Installer l'app sur tes appareils

**iPhone / iPad (Safari) :**
1. Ouvre l'adresse dans **Safari**.
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Touche **Sur l'écran d'accueil**, puis **Ajouter**.

**Mac (Safari, macOS Sonoma ou plus récent) :** ouvre l'adresse, puis menu **Fichier → Ajouter au Dock**.
**Mac (Chrome) :** ouvre l'adresse, puis clique sur l'icône d'installation à droite de la barre d'adresse (écran avec une flèche).

## Étape 7 — Créer et ajouter ta clé TMDB (gratuite)

1. Crée un compte sur **https://www.themoviedb.org/signup** et valide l'e-mail.
2. Ouvre **https://www.themoviedb.org/settings/api** et clique sur **Créer** puis **Developer**.
3. Type d'usage : **Personal** (personnel, non commercial). Remplis le formulaire et accepte les conditions.
4. Copie la **Clé d'API** (32 caractères).
5. Dans Écran Libre, va dans **Réglages**, colle la clé et clique sur **Enregistrer et tester**.
6. Coche tes abonnements (Netflix, Canal+…) dans la même page.

ℹ️ La clé est enregistrée dans le navigateur de l'appareil. Refais l'étape 5 sur chaque appareil (iPhone, iPad, Mac).
🔐 Ne colle jamais ta clé dans un chat, un e-mail ou sur GitHub.

## Étape 8 (facultatif) — Maintenance automatique

Chaque lundi, GitHub vérifie que les sources répondent et t'envoie un e-mail en cas de problème. Rien n'est modifié automatiquement.

Pour qu'il vérifie aussi TMDB :
1. Dépôt → **Settings → Secrets and variables → Actions**.
2. Clique sur **New repository secret**. **Name :** `TMDB_KEY`, **Secret :** ta clé. Clique sur **Add secret**.
3. Pour lancer une vérification tout de suite : onglet **Actions → Maintenance des sources → Run workflow**.

## Mettre à jour l'application plus tard

Refais l'étape 4 avec les nouveaux fichiers (GitHub remplace ceux qui ont le même nom), puis clique sur **Commit changes**. L'app se met à jour au prochain lancement.

## En cas de problème

| Symptôme | Solution |
|---|---|
| Page 404 sur l'adresse | Attends 2 minutes. Vérifie que `index.html` est bien à la racine du dépôt (étape 4). |
| « Clé TMDB refusée (401) » | Recopie la **Clé d'API** sans espace. Le « jeton d'accès en lecture » (très long) fonctionne aussi. |
| Les plateformes n'apparaissent pas | Vérifie qu'une clé est enregistrée dans Réglages. |
| Une vidéo du domaine public ne se lance pas | Utilise le lien **Page source** de la fiche. |
