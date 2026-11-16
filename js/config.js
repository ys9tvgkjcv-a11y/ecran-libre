/* Écran Libre — configuration et règles de classement des plateformes.
   Toute la logique "gratuit / sans pub" est ici, pour être auditée facilement. */
window.EL = window.EL || {};

EL.config = {
  region: 'FR',
  language: 'fr-FR',
  tmdbBase: 'https://api.themoviedb.org/3',
  tmdbImg: 'https://image.tmdb.org/t/p/',
  iaBase: 'https://archive.org',
  // Requête Internet Archive : uniquement la collection "feature_films"
  // ET une licence déclarée "domaine public" (mark, zero ou publicdomain).
  iaBaseQuery: 'collection:feature_films AND mediatype:movies AND licenseurl:*publicdomain*',
  cacheMinutes: 60 * 6,
};

/* Règles d'accès vérifiées à la main (dernière vérification : 16/11/2026).
   noAds:true  -> peut apparaître dans "Gratuit et sans publicité".
   ads:true    -> gratuit mais financé par la publicité.
   Toute plateforme gratuite ABSENTE de cette liste est affichée
   "Gratuit — publicité non vérifiée", jamais "sans publicité". */
EL.providerRules = [
  { match: /^arte/i, noAds: true, note: 'Sans publicité commerciale ; parrainage possible sur certains programmes.',
    search: q => `https://www.arte.tv/fr/search/?q=${q}` },
  { match: /internet archive/i, noAds: true, note: 'Domaine public, sans publicité.' },
  { match: /france\.?tv|france tv/i, ads: true, note: 'Gratuit, avec coupures publicitaires.',
    search: q => `https://www.france.tv/recherche/?q=${q}` },
  { match: /tf1/i, ads: true, note: 'Gratuit avec inscription et publicité.', search: q => `https://www.tf1.fr/recherche?q=${q}` },
  { match: /^m6|6play/i, ads: true, note: 'Gratuit avec inscription et publicité.', search: q => `https://www.m6.fr/recherche?q=${q}` },
  { match: /pluto/i, ads: true, note: 'Gratuit, financé par la publicité.', search: q => `https://pluto.tv/fr/search/details?query=${q}` },
  { match: /rakuten/i, ads: true, note: 'Section gratuite financée par la publicité.' },
  { match: /plex/i, ads: true, note: 'Gratuit, financé par la publicité.', search: q => `https://watch.plex.tv/fr/search?q=${q}` },
  { match: /samsung tv plus/i, ads: true, note: 'Gratuit, financé par la publicité.' },
  { match: /youtube/i, search: q => `https://www.youtube.com/results?search_query=${q}` },
  { match: /netflix/i, search: q => `https://www.netflix.com/search?q=${q}` },
  { match: /prime video|amazon/i, search: q => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}` },
  { match: /disney/i, search: q => `https://www.disneyplus.com/fr-fr/search?q=${q}` },
  { match: /canal/i, search: q => `https://www.canalplus.com/recherche/?q=${q}` },
  { match: /apple tv/i, search: q => `https://tv.apple.com/fr/search?term=${q}` },
  { match: /max$|hbo/i, search: q => `https://play.max.com/search?q=${q}` },
  { match: /paramount/i, search: q => `https://www.paramountplus.com/fr/search/?q=${q}` },
];

EL.genres = {
  movie: { 28:'Action',12:'Aventure',16:'Animation',35:'Comédie',80:'Policier',99:'Documentaire',18:'Drame',
    10751:'Famille',14:'Fantastique',36:'Histoire',27:'Horreur',10402:'Musique',9648:'Mystère',10749:'Romance',
    878:'Science-fiction',53:'Thriller',10752:'Guerre',37:'Western' },
  tv: { 10759:'Action & aventure',16:'Animation',35:'Comédie',80:'Policier',99:'Documentaire',18:'Drame',
    10751:'Famille',9648:'Mystère',10765:'SF & fantastique',10768:'Guerre & politique',37:'Western',10764:'Téléréalité' },
};

/* Mots reconnus par l'assistant -> genre TMDB (film / série). */
EL.genreWords = [
  { re: /science[- ]?fiction|\bsf\b|sci-?fi|space|espace/, movie: 878, tv: 10765, label: 'science-fiction' },
  { re: /polici|polar|crime|enquête|detective|détective/, movie: 80, tv: 80, label: 'policier' },
  { re: /com[ée]die|drôle|marrant|rire/, movie: 35, tv: 35, label: 'comédie' },
  { re: /horreur|épouvante|peur|flipper/, movie: 27, tv: 9648, label: 'horreur' },
  { re: /drame|dramatique/, movie: 18, tv: 18, label: 'drame' },
  { re: /anim(é|ation)|dessin animé/, movie: 16, tv: 16, label: 'animation' },
  { re: /documentaire|docu\b/, movie: 99, tv: 99, label: 'documentaire' },
  { re: /thriller|suspense/, movie: 53, tv: 9648, label: 'thriller' },
  { re: /romance|romantique|amour/, movie: 10749, tv: 18, label: 'romance' },
  { re: /aventure/, movie: 12, tv: 10759, label: 'aventure' },
  { re: /action/, movie: 28, tv: 10759, label: 'action' },
  { re: /western/, movie: 37, tv: 37, label: 'western' },
  { re: /guerre/, movie: 10752, tv: 10768, label: 'guerre' },
  { re: /fantastique|fantasy/, movie: 14, tv: 10765, label: 'fantastique' },
  { re: /famille|enfant/, movie: 10751, tv: 10751, label: 'famille' },
  { re: /histoire|historique/, movie: 36, tv: 10768, label: 'historique' },
  { re: /musique|musical/, movie: 10402, tv: 18, label: 'musique' },
];
