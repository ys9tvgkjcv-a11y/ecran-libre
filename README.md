# Écran Libre

Une application web installable (Mac, iPhone, iPad) pour **trouver où regarder légalement films et séries**, avec la priorité au **gratuit et sans publicité**.

- Aucune publicité, aucun traceur, aucun compte : tes données restent sur ton appareil.
- Aucun flux piraté, aucun contournement de DRM ou d'abonnement.
- **Règle absolue :** un contenu n'est jamais affiché « gratuit » s'il est payant, ni « sans publicité » si l'absence de pub n'est pas vérifiée.

➡️ Installation pas à pas : [docs/INSTALLATION.md](docs/INSTALLATION.md)
➡️ Guide d'utilisation : [docs/UTILISATION.md](docs/UTILISATION.md)

## Ce qui fonctionne (développé et testé)

| Fonction | État | Comment ça a été testé |
|---|---|---|
| Films du domaine public (Internet Archive) : catalogue, recherche, **lecture intégrée** | ✅ | Avec les données réelles d'Internet Archive |
| Reprise de lecture (films domaine public avec fichier MP4) | ✅ | Navigateur automatisé |
| Pages Accueil, Films, Séries, Tendances, Gratuit sans pub, Recherche, Assistant, Favoris, Liste, Historique, Réglages | ✅ | Navigateur automatisé, ordinateur et iPhone simulé |
| Classement des offres : gratuit sans pub / avec pub / pub non vérifiée / mes abonnements / abonnement / location-achat | ✅ | 13 tests automatiques + navigateur |
| Filtres : accès, genre, période, tri (populaires, meilleures notes, nouveautés), langue originale française | ✅ | Navigateur (avec des réponses TMDB d'exemple) |
| Recherche par titre, acteur, réalisateur | ✅ | Navigateur (avec des réponses TMDB d'exemple) |
| Assistant en langage naturel (gratuit, sur l'appareil) | ✅ | Tests automatiques + navigateur |
| Favoris, liste à regarder, historique, notes ★, sauvegarde et restauration | ✅ | Navigateur |
| Installation comme application, interface disponible hors ligne | ✅ (code) | Le service worker n'est actif qu'en HTTPS, donc une fois l'app en ligne |
| Vérification automatique des sources (chaque semaine, GitHub Actions) | ✅ | Script lancé avec les vraies sources |

⚠️ **À confirmer avec ta clé :** la partie TMDB (catalogue complet, plateformes) a été testée avec des réponses d'exemple, faute de clé dans l'environnement de développement. Le code suit la documentation officielle de TMDB, mais le premier vrai test se fera quand tu entreras ta clé dans Réglages.

## Limites connues (et pourquoi)

1. **Pas de lecture intégrée de Netflix, Arte, france.tv…** Ces plateformes n'autorisent pas l'intégration de leur lecteur. Le bouton « Ouvrir » lance la **recherche du titre sur la plateforme officielle** (les liens directs vers la page exacte demanderaient l'API Streaming Availability : prévu à l'étape suivante).
2. **VO sous-titrée, 1080p, 4K : filtres grisés.** Ces données ne sont pas fournies par TMDB. Elles seraient possibles avec Streaming Availability (gratuit, 100 requêtes par jour).
3. **« En français » = langue originale française.** La présence d'une VF n'est pas connue des sources gratuites.
4. **Domaine public « selon Internet Archive ».** C'est souvent le statut américain. Pour certaines œuvres, il peut différer en France. La licence déclarée s'affiche sur chaque fiche.
5. **Mes abonnements = déclaratif.** Tu coches tes plateformes. L'app ne se connecte jamais à tes comptes.
6. **La clé TMDB est à entrer sur chaque appareil** (elle reste dans le navigateur, elle n'est jamais envoyée ailleurs que chez TMDB).
7. **Données « où regarder » :** elles viennent de JustWatch et peuvent avoir quelques jours de retard.

## Sources et conditions

| Source | Usage | Conditions |
|---|---|---|
| TMDB | Catalogue, images, notes | Gratuit, usage non commercial, attribution obligatoire (en bas de page) |
| JustWatch (via TMDB) | Où regarder en France | Attribution obligatoire (en bas de page) |
| Internet Archive | Films du domaine public, lecture | Gratuit, sans clé |

Les règles « sans publicité » sont dans [`js/config.js`](js/config.js), vérifiées à la main le 16/11/2026 : **Arte** (sans publicité commerciale, parrainage possible) et **Internet Archive**. france.tv, TF1+, M6+, Pluto TV, Rakuten TV, Plex, Samsung TV Plus sont classés **avec publicité**. Toute autre plateforme gratuite est affichée « publicité non vérifiée ».

## Sécurité

- Politique de sécurité du contenu (CSP) stricte : seuls nos propres scripts s'exécutent, et la page ne peut contacter que TMDB et Internet Archive.
- Tout texte venant des API est échappé avant affichage (protection contre l'injection de code).
- Aucune dépendance externe : il n'y a pas de bibliothèque tierce à surveiller.
- Les liens externes s'ouvrent avec `noopener noreferrer`.
- La clé TMDB n'est jamais dans le code ni sur GitHub.

## Structure

```
index.html              page unique de l'application
css/style.css           thème sombre
js/config.js            réglages + règles gratuit/pub (à auditer ici)
js/core.js              stockage, API, classement, assistant
js/app.js               interface et pages
manifest.webmanifest    installation comme app
sw.js                   fonctionnement hors ligne de l'interface
tools/check-sources.mjs vérification des sources (ne modifie rien)
tests/logic.test.mjs    tests de la logique gratuit/pub et de l'assistant
.github/workflows/      maintenance automatique hebdomadaire
```

Lancer les tests : `node tests/logic.test.mjs` · Vérifier les sources : `node tools/check-sources.mjs`
