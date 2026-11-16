/* Écran Libre — interface. */
(function () {
  const $ = s => document.querySelector(s);
  const view = $('#view');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = EL.tmdb, IA = EL.ia, S = EL.store, L = EL.lists;
  const today = new Date().toISOString().slice(0, 10);
  let renderToken = 0;

  /* ---------- Utilitaires d'affichage ---------- */
  const spinner = '<div class="spin" role="status" aria-label="Chargement"></div>';
  const errorBox = e => `<div class="note ${e.code === 'NOKEY' ? 'warn' : 'err'}">${esc(e.message || e)}${e.code === 'NOKEY' ? ' <a href="#reglages">Ouvrir les réglages</a>' : ''}</div>`;
  const accessPill = { free: 'Gratuit sans pub', ads: 'Gratuit + pub', mysub: 'Mon abonnement', sub: 'Abonnement', paid: 'Payant', 'free-unverified': 'Gratuit ?' };

  function tmdbItem(x, kindHint) {
    const kind = x.media_type || kindHint || (x.title ? 'movie' : 'tv');
    const date = x.release_date || x.first_air_date || '';
    return { key: `${kind}:${x.id}`, kind, id: x.id, title: x.title || x.name || '', year: date.slice(0, 4),
      poster: T.img(x.poster_path), backdrop: T.img(x.backdrop_path, 'w1280'), vote: x.vote_average, votes: x.vote_count, overview: x.overview };
  }
  function card(it, pill) {
    const img = it.poster ? `<img loading="lazy" src="${esc(it.poster)}" alt="">` : '';
    const v = it.votes > 20 && it.vote ? `<span class="vote">★ ${it.vote.toFixed(1)}</span>` : '';
    const p = it.kind === 'ia' ? '<span class="pill free">Domaine public</span>' : pill ? `<span class="pill ${pill}">${accessPill[pill]}</span>` : '';
    return `<button class="card" data-open="${esc(it.key)}" data-item="${esc(JSON.stringify(slim(it)))}">
      <div class="poster"><span class="ph">${esc(it.title)}</span>${img}${v}${p}</div>
      <span class="t">${esc(it.title)}</span><span class="m">${esc([it.year, it.kind === 'tv' ? 'Série' : it.kind === 'ia' ? 'Film · domaine public' : 'Film'].filter(Boolean).join(' · '))}</span></button>`;
  }
  const slim = it => ({ key: it.key, kind: it.kind, id: it.id, title: it.title, year: it.year, poster: it.poster });
  const grid = (items, pill) => items.length ? `<div class="grid">${items.map(i => card(i, pill)).join('')}</div>` : '<p class="empty">Aucun résultat pour ces critères.</p>';
  const row = (items, pill) => items.length ? `<div class="row">${items.map(i => card(i, pill)).join('')}</div>` : '<p class="empty">Rien à afficher.</p>';
  // Le onerror inline est bloqué par la CSP : on gère les images cassées globalement.
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

  async function section(el, title, sub, loader, asRow = true, pill) {
    const box = document.createElement('section');
    box.innerHTML = `<h2>${esc(title)} ${sub ? `<small>${esc(sub)}</small>` : ''}</h2>${spinner}`;
    el.appendChild(box);
    try { const items = await loader(); box.lastElementChild.outerHTML = asRow ? row(items, pill) : grid(items, pill); }
    catch (e) { box.lastElementChild.outerHTML = errorBox(e); }
  }

  /* ---------- Requêtes catalogue (TMDB discover) ---------- */
  async function discover(kind, f, page = 1) {
    const p = { page, watch_region: EL.config.region, include_adult: 'false' };
    const dateKey = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
    p.sort_by = f.sort === 'top' ? 'vote_average.desc' : f.sort === 'new' ? `${dateKey}.desc` : 'popularity.desc';
    if (f.sort === 'top') p['vote_count.gte'] = kind === 'movie' ? 500 : 200;
    if (f.sort === 'new') { p[`${dateKey}.lte`] = today; p['vote_count.gte'] = 5; }
    if (f.genre) p.with_genres = f.genre;
    if (f.yearFrom) p[`${dateKey}.gte`] = `${f.yearFrom}-01-01`;
    if (f.yearTo) p[`${dateKey}.lte`] = f.yearTo >= +today.slice(0, 4) ? today : `${f.yearTo}-12-31`;
    if (f.lang === 'fr') p.with_original_language = 'fr';
    const subs = S.get('subs', []);
    if (f.access === 'free') {
      const ids = await T.verifiedNoAdsProviderIds(kind);
      if (!ids.length) return [];
      p.with_watch_providers = ids.join('|'); p.with_watch_monetization_types = 'free|flatrate';
    } else if (f.access === 'ads') p.with_watch_monetization_types = 'ads';
    else if (f.access === 'anyfree') p.with_watch_monetization_types = 'free|ads';
    else if (f.access === 'paid') p.with_watch_monetization_types = 'rent|buy';
    else if (f.access === 'mysub' || f.access === 'freeOrSub') {
      let ids = [...subs];
      if (f.access === 'freeOrSub') ids = ids.concat(await T.verifiedNoAdsProviderIds(kind));
      if (!ids.length) throw new Error('Choisissez d\'abord vos abonnements dans Réglages.');
      p.with_watch_providers = ids.join('|'); p.with_watch_monetization_types = 'flatrate|free|ads';
    }
    const d = await T.get(`/discover/${kind}`, p);
    return (d.results || []).map(x => tmdbItem(x, kind));
  }

  /* ---------- Pages ---------- */
  const pages = {
    async accueil(el) {
      if (!T.ready()) {
        el.innerHTML = `<h1>Bienvenue sur Écran Libre</h1>
          <p class="lead">Trouvez où regarder légalement films et séries, avec la priorité au gratuit sans publicité.</p>
          <div class="note warn"><b>Catalogue complet désactivé :</b> ajoutez votre clé TMDB gratuite pour voir toutes les plateformes (Netflix, Arte, france.tv…). En attendant, les films du domaine public ci-dessous fonctionnent déjà et se regardent directement ici. <a href="#reglages">Ajouter ma clé</a></div>`;
      } else {
        el.innerHTML = `<div id="hero"></div>`;
        T.get('/trending/all/day').then(d => {
          const h = (d.results || []).map(x => tmdbItem(x)).find(x => x.backdrop);
          if (h) $('#hero').innerHTML = `<div class="hero"><img class="bd" src="${esc(h.backdrop)}" alt=""><div class="in"><h1>${esc(h.title)}</h1><p>${esc(h.overview)}</p><button class="btn primary" data-open="${esc(h.key)}" data-item="${esc(JSON.stringify(slim(h)))}">Voir la fiche et où regarder</button></div></div>`;
        }).catch(() => {});
      }
      const recos = recoSeeds();
      if (T.ready() && recos.length) section(el, 'Recommandé pour vous', `d'après « ${recos[0].title} »`, async () => {
        const d = await T.get(`/${recos[0].kind}/${recos[0].id}/recommendations`); return (d.results || []).map(x => tmdbItem(x, recos[0].kind));
      });
      const hist = L.all('historique').filter(x => x.kind === 'ia' && S.get('resume.' + x.id, 0) > 30);
      if (hist.length) section(el, 'Reprendre la lecture', '', async () => hist.slice(0, 12));
      if (T.ready()) {
        section(el, 'Gratuit et sans publicité', 'vérifié', () => discover('movie', { access: 'free' }), true, 'free');
        section(el, 'Tendances de la semaine', '', async () => ((await T.get('/trending/all/week')).results || []).map(x => tmdbItem(x)));
      }
      section(el, 'Domaine public — à regarder ici', 'Internet Archive, sans publicité', async () => (await IA.search({ rows: 24 })).items);
      if (T.ready()) {
        section(el, 'Séries populaires', '', () => discover('tv', {}));
        section(el, 'Nouveautés films', '', () => discover('movie', { sort: 'new' }));
      }
    },
    films(el) { return catalogPage(el, 'movie'); },
    series(el) { return catalogPage(el, 'tv'); },
    async tendances(el) {
      el.innerHTML = '<h1>Tendances</h1><p class="lead">Ce qui est le plus regardé et discuté cette semaine.</p>';
      section(el, 'Films', 'cette semaine', async () => ((await T.get('/trending/movie/week')).results || []).map(x => tmdbItem(x, 'movie')), false);
      section(el, 'Séries', 'cette semaine', async () => ((await T.get('/trending/tv/week')).results || []).map(x => tmdbItem(x, 'tv')), false);
    },
    async gratuit(el) {
      el.innerHTML = `<h1>Gratuit et sans publicité</h1>
        <p class="lead">Uniquement des contenus dont la gratuité <b>et</b> l'absence de publicité sont vérifiées : plateformes contrôlées à la main (Arte…) et films du domaine public lisibles ici.</p>`;
      if (T.ready()) {
        section(el, 'Films', 'plateformes vérifiées sans pub', () => discover('movie', { access: 'free' }), true, 'free');
        section(el, 'Séries', 'plateformes vérifiées sans pub', () => discover('tv', { access: 'free' }), true, 'free');
        section(el, 'Documentaires', '', () => discover('movie', { access: 'free', genre: 99 }), true, 'free');
      } else el.insertAdjacentHTML('beforeend', '<div class="note warn">Ajoutez votre clé TMDB pour inclure Arte et les autres plateformes vérifiées. <a href="#reglages">Réglages</a></div>');
      const box = document.createElement('section'); el.appendChild(box);
      iaBrowser(box);
    },
    async recherche(el, q0) {
      el.innerHTML = `<h1>Recherche</h1>
        <form class="search" role="search"><input id="q" type="search" placeholder="Titre, acteur, réalisateur…" autocomplete="off" enterkeyhint="search" aria-label="Rechercher"><button class="btn primary">Chercher</button></form><div id="res"></div>`;
      const input = $('#q'); input.value = q0 || S.get('lastQ', ''); input.focus();
      let timer;
      const run = async () => {
        const q = input.value.trim(); S.set('lastQ', q);
        const res = $('#res'); if (!q) { res.innerHTML = '<p class="empty">Tapez un titre, un acteur ou un réalisateur.</p>'; return; }
        res.innerHTML = '';
        if (T.ready()) {
          section(res, 'Films et séries', '', async () => {
            const d = await T.get('/search/multi', { query: q, include_adult: 'false' });
            return (d.results || []).filter(x => x.media_type !== 'person').map(x => tmdbItem(x));
          }, false);
          const pbox = document.createElement('section'); res.appendChild(pbox);
          T.get('/search/person', { query: q }).then(d => {
            const ps = (d.results || []).filter(p => p.known_for_department).slice(0, 8);
            if (ps.length) pbox.innerHTML = `<h2>Personnes</h2><div class="cast">${ps.map(personBtn).join('')}</div>`;
          }).catch(() => {});
        } else res.insertAdjacentHTML('beforeend', '<div class="note warn">Sans clé TMDB, seule la recherche dans le domaine public est active. <a href="#reglages">Ajouter ma clé</a></div>');
        section(res, 'Domaine public (lecture ici)', 'Internet Archive', async () => (await IA.search({ q, rows: 18 })).items, false);
      };
      $('.search').addEventListener('submit', e => { e.preventDefault(); run(); });
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 450); });
      run();
    },
    assistant(el) {
      el.innerHTML = `<h1>Assistant</h1><p class="lead">Décrivez ce que vous voulez regarder. L'assistant fonctionne sur votre appareil, sans IA payante : il traduit votre phrase en filtres et vous montre ce qu'il a compris.</p>
        <div class="examples">${['Trouve-moi un film de science-fiction gratuit, en français et sans publicité', 'Propose-moi les meilleures séries policières disponibles gratuitement', 'Où puis-je regarder légalement Le Fabuleux Destin d\'Amélie Poulain sans payer davantage ?', 'Un documentaire gratuit sans pub', 'Une comédie des années 80 dans mes abonnements']
          .map(x => `<button class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <form class="search" id="askf"><input id="ask" placeholder="Ex. : un thriller récent gratuit" autocomplete="off" aria-label="Votre demande"><button class="btn primary">Demander</button></form>
        <div class="chat" id="chat"></div>`;
      const ask = async text => {
        const chat = $('#chat');
        chat.insertAdjacentHTML('afterbegin', `<div class="bubble me">${esc(text)}</div><div class="bubble" id="ans">${spinner}</div>`);
        const ans = $('#ans'); ans.removeAttribute('id');
        const r = EL.parseRequest(text);
        try {
          if (r.titleQuery) {
            if (!T.ready()) throw Object.assign(new Error('Pour savoir où regarder un titre précis, ajoutez votre clé TMDB.'), { code: 'NOKEY' });
            const d = await T.get('/search/multi', { query: r.titleQuery });
            const hits = (d.results || []).filter(x => x.media_type !== 'person').slice(0, 6).map(x => tmdbItem(x));
            ans.innerHTML = `<p>Je cherche <b>« ${esc(r.titleQuery)} »</b>. Ouvrez le bon résultat : la fiche liste chaque offre, de la moins chère (gratuit sans pub) à la plus chère, avec ses conditions.</p>${grid(hits)}`;
            return;
          }
          const kind = r.kind || 'movie';
          const f = { genre: r.genre ? r.genre[kind] : null, access: r.access, lang: r.originalFr ? 'fr' : null,
            sort: r.sort === 'vote_average.desc' ? 'top' : r.sort.endsWith('date.desc') ? 'new' : 'pop', yearFrom: r.yearFrom, yearTo: r.yearTo };
          let html = `<p>J'ai compris : <b>${esc(EL.describeRequest({ ...r, kind }))}</b>.</p>`;
          r.notes.forEach(n => html += `<p class="m">ℹ️ ${esc(n)}</p>`);
          if (r.access === 'free') html += '<p class="m">Seules les plateformes vérifiées sans publicité et le domaine public sont inclus.</p>';
          let items = [];
          if (T.ready()) items = await discover(kind, f);
          else html += errorBox(Object.assign(new Error('Sans clé TMDB, je ne cherche que dans le domaine public.'), { code: 'NOKEY' }));
          if (kind === 'movie' && (r.access === 'free' || r.access === 'anyfree' || !T.ready())) {
            try {
              const g = r.genre ? r.genre.label : '';
              const iaRes = await IA.search({ q: g === 'science-fiction' ? 'science fiction' : g, rows: 12, yearFrom: r.yearFrom, yearTo: r.yearTo });
              if (iaRes.items.length) html += `<h2>Domaine public <small>lecture ici</small></h2>${row(iaRes.items)}`;
            } catch {}
          }
          if (T.ready()) html += `<h2>Résultats <small>${items.length}</small></h2>${grid(items, r.access === 'free' ? 'free' : r.access === 'mysub' ? 'mysub' : null)}`;
          ans.innerHTML = html;
        } catch (e) { ans.innerHTML = errorBox(e); }
      };
      $('#askf').addEventListener('submit', e => { e.preventDefault(); const v = $('#ask').value.trim(); if (v) ask(v); });
      el.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $('#ask').value = b.dataset.ex; ask(b.dataset.ex); }));
    },
    favoris(el) { listPage(el, 'favoris', 'Mes favoris', 'Ajoutez des favoris avec le bouton ♥ d\'une fiche.'); },
    liste(el) { listPage(el, 'liste', 'Ma liste à regarder', 'Ajoutez des titres avec « + À regarder » sur une fiche.'); },
    historique(el) { listPage(el, 'historique', 'Mon historique', 'Les fiches que vous ouvrez et les films lus apparaissent ici.', true); },
    plus(el) {
      el.innerHTML = `<h1>Plus</h1><div class="plus-menu">${[['tendances', 'Tendances'], ['assistant', 'Assistant'], ['favoris', 'Mes favoris'], ['liste', 'Ma liste à regarder'], ['historique', 'Mon historique'], ['reglages', 'Réglages']].map(([h, t]) => `<a href="#${h}">${t}</a>`).join('')}</div>`;
    },
    reglages(el) { settingsPage(el); },
  };

  function recoSeeds() { return [...L.all('favoris'), ...L.all('historique')].filter(x => x.kind === 'movie' || x.kind === 'tv'); }

  function listPage(el, name, title, emptyMsg, clearable) {
    const items = L.all(name);
    el.innerHTML = `<h1>${esc(title)}</h1><p class="lead">Enregistré uniquement sur cet appareil.</p>
      ${clearable && items.length ? '<button class="btn small" id="clr">Effacer l\'historique</button>' : ''}
      ${items.length ? grid(items) : `<p class="empty">${esc(emptyMsg)}</p>`}`;
    $('#clr')?.addEventListener('click', () => { L.clear(name); listPage(el, name, title, emptyMsg, clearable); });
  }

  /* Catalogue Films / Séries avec filtres */
  function catalogPage(el, kind) {
    const fk = 'filters.' + kind;
    const f = S.get(fk, { access: '', sort: 'pop', genre: '', lang: '', yearFrom: '', yearTo: '' });
    let page = 1;
    const accessOpts = [['', 'Tout'], ['free', 'Gratuit et sans pub'], ['ads', 'Gratuit avec pub'], ['mysub', 'Mes abonnements'], ['paid', 'Achat / location']];
    const sortOpts = [['pop', 'Populaires'], ['top', 'Meilleures notes'], ['new', 'Nouveautés']];
    const quick = kind === 'movie' ? [[99, 'Documentaires'], [16, 'Animation']] : [[99, 'Documentaires'], [16, 'Animation']];
    const g = EL.genres[kind];
    const y = +today.slice(0, 4);
    const decades = [[y - 1, y, 'Cette année et l\'an dernier'], [2020, y, 'Années 2020'], [2010, 2019, 'Années 2010'], [2000, 2009, 'Années 2000'], [1990, 1999, 'Années 90'], [1980, 1989, 'Années 80'], [1970, 1979, 'Années 70'], [1900, 1969, 'Avant 1970']];
    const draw = () => {
      el.innerHTML = `<h1>${kind === 'movie' ? 'Films' : 'Séries'}</h1>
      <div class="filters" role="group" aria-label="Accès">${accessOpts.map(([v, t]) => `<button class="chip ${v === 'free' ? 'free' : ''} ${f.access === v ? 'on' : ''}" data-f="access" data-v="${v}">${t}</button>`).join('')}</div>
      <div class="filters" role="group" aria-label="Tri et genre">${sortOpts.map(([v, t]) => `<button class="chip ${f.sort === v ? 'on' : ''}" data-f="sort" data-v="${v}">${t}</button>`).join('')}
        <span class="sep"></span>${quick.map(([v, t]) => `<button class="chip ${String(f.genre) === String(v) ? 'on' : ''}" data-f="genre" data-v="${v}">${t}</button>`).join('')}
        <select class="chip" id="genre" aria-label="Genre"><option value="">Tous les genres</option>${Object.entries(g).map(([id, n]) => `<option value="${id}" ${String(f.genre) === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select class="chip" id="years" aria-label="Période"><option value="">Toutes les années</option>${decades.map(([a, b, t]) => `<option value="${a}-${b}" ${f.yearFrom == a && f.yearTo == b ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="filters" role="group" aria-label="Langue et qualité">
        <button class="chip ${f.lang === '' ? 'on' : ''}" data-f="lang" data-v="">Toutes langues</button>
        <button class="chip ${f.lang === 'fr' ? 'on' : ''}" data-f="lang" data-v="fr">Français (langue originale)</button>
        <button class="chip" disabled title="Non fourni par les sources gratuites actuelles">VO sous-titrée</button>
        <button class="chip" disabled title="Non fourni par les sources gratuites actuelles">1080p</button>
        <button class="chip" disabled title="Non fourni par les sources gratuites actuelles">4K</button>
      </div>
      <p class="m" id="hint"></p><div id="list">${spinner}</div><div id="more"></div>`;
      el.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.f; f[k] = (k === 'genre' && String(f.genre) === b.dataset.v) ? '' : b.dataset.v; save();
      }));
      $('#genre').addEventListener('change', e => { f.genre = e.target.value; save(); });
      $('#years').addEventListener('change', e => { const [a, b] = e.target.value.split('-'); f.yearFrom = a || ''; f.yearTo = b || ''; save(); });
      const hint = $('#hint');
      if (f.access === 'free') hint.textContent = 'Plateformes vérifiées sans publicité uniquement. Les VO sous-titrée / 1080p / 4K sont grisés : aucune source gratuite ne fournit ces données de façon fiable.';
      else if (f.access === 'ads') hint.textContent = 'Gratuit, mais avec des coupures publicitaires.';
      else hint.textContent = 'VO sous-titrée, 1080p et 4K sont grisés : ces données ne sont pas fournies par les sources gratuites actuelles.';
      load(true);
    };
    const save = () => { S.set(fk, f); page = 1; draw(); };
    const load = async reset => {
      const list = $('#list'), more = $('#more');
      const tok = ++renderToken;
      try {
        const items = await discover(kind, { ...f, yearFrom: +f.yearFrom || null, yearTo: +f.yearTo || null }, page);
        if (tok !== renderToken) return;
        const pill = f.access === 'free' ? 'free' : f.access === 'ads' ? 'ads' : f.access === 'mysub' ? 'mysub' : f.access === 'paid' ? 'paid' : null;
        if (reset) list.innerHTML = grid(items, pill); else list.querySelector('.grid')?.insertAdjacentHTML('beforeend', items.map(i => card(i, pill)).join(''));
        more.innerHTML = items.length >= 20 ? '<p><button class="btn" id="mb">Afficher plus</button></p>' : '';
        $('#mb')?.addEventListener('click', () => { page++; load(false); });
      } catch (e) { list.innerHTML = errorBox(e); more.innerHTML = ''; }
    };
    draw();
  }

  /* Navigateur Internet Archive avec pagination */
  async function iaBrowser(box) {
    let page = 1;
    box.innerHTML = `<h2>Domaine public <small>Internet Archive · lecture directement ici</small></h2>
      <div class="note">Ces films sont déclarés « domaine public » sur Internet Archive (souvent selon le droit américain). Le statut peut différer en France pour certaines œuvres : la fiche affiche la licence indiquée.</div>
      <div id="iag">${spinner}</div><div id="iam"></div>`;
    const load = async () => {
      try {
        const r = await IA.search({ rows: 36, page });
        const g = $('#iag');
        if (page === 1) g.innerHTML = grid(r.items); else g.querySelector('.grid').insertAdjacentHTML('beforeend', r.items.map(i => card(i)).join(''));
        $('#iam').innerHTML = page * 36 < r.total ? `<p><button class="btn" id="iamb">Afficher plus (${r.total.toLocaleString('fr-FR')} films)</button></p>` : '';
        $('#iamb')?.addEventListener('click', () => { page++; load(); });
      } catch (e) { $('#iag').innerHTML = errorBox(e); }
    };
    load();
  }

  function personBtn(p) {
    const img = p.profile_path ? `<img loading="lazy" src="${esc(T.img(p.profile_path, 'w185'))}" alt="">` : '<span class="ph2"></span>';
    return `<button data-person="${p.id}" data-name="${esc(p.name)}">${img}${esc(p.name)}${p.character ? `<br><span class="m">${esc(p.character)}</span>` : p.job ? `<br><span class="m">${esc(p.job)}</span>` : ''}</button>`;
  }

  async function openPerson(id, name) {
    closeSheet();
    location.hash = 'recherche';
    await new Promise(r => setTimeout(r, 30));
    view.innerHTML = `<h1>${esc(name)}</h1><p class="lead">Filmographie (acteur, réalisateur…), du plus populaire au moins populaire.</p>`;
    section(view, 'Films et séries', '', async () => {
      const d = await T.get(`/person/${id}/combined_credits`);
      const all = [...(d.cast || []), ...(d.crew || []).filter(c => c.job === 'Director')];
      const seen = new Set();
      return all.filter(x => !seen.has(x.media_type + x.id) && seen.add(x.media_type + x.id)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).map(x => tmdbItem(x));
    }, false);
  }

  /* ---------- Fiche détaillée ---------- */
  const sheet = $('#sheet'), body = $('#sheet-body');
  let lastFocus = null;
  function closeSheet() {
    const v = body.querySelector('video'); if (v) v.pause();
    sheet.hidden = true; body.innerHTML = ''; document.body.style.overflow = ''; lastFocus?.focus?.();
  }
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  function actionsHTML(it) {
    return `<div class="d-actions">
      <button class="btn small" data-tog="favoris">${L.has('favoris', it.key) ? '♥ Favori' : '♡ Ajouter aux favoris'}</button>
      <button class="btn small" data-tog="liste">${L.has('liste', it.key) ? '✓ Dans ma liste' : '+ À regarder'}</button>
      <span class="stars" aria-label="Ma note">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${S.get('rating.' + it.key, 0) >= n ? 'on' : ''}" aria-label="${n} sur 5">★</button>`).join('')}</span></div>`;
  }
  function bindActions(it) {
    body.querySelectorAll('[data-tog]').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.tog, on = L.toggle(name, slim(it));
      b.textContent = name === 'favoris' ? (on ? '♥ Favori' : '♡ Ajouter aux favoris') : (on ? '✓ Dans ma liste' : '+ À regarder');
    }));
    body.querySelectorAll('[data-star]').forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.star, cur = S.get('rating.' + it.key, 0), v = cur === n ? 0 : n;
      S.set('rating.' + it.key, v);
      body.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('on', +s.dataset.star <= v));
    }));
  }

  async function openItem(it) {
    lastFocus = document.activeElement;
    sheet.hidden = false; document.body.style.overflow = 'hidden';
    body.innerHTML = spinner;
    sheet.querySelector('.close').focus();
    try { if (it.kind === 'ia') await openIA(it); else await openTMDB(it); }
    catch (e) { body.innerHTML = `<div class="d-main"><div></div><div><h1>${esc(it.title)}</h1>${errorBox(e)}</div></div>`; }
  }

  async function openIA(it) {
    const d = await IA.details(it.id);
    L.push('historique', slim({ ...it, title: d.title || it.title }));
    const resume = S.get('resume.' + it.id, 0);
    body.innerHTML = `<div class="d-main flat" id="iamain"><div class="poster"><img src="${esc(d.poster)}" alt=""></div><div>
      <h1>${esc(d.title)}</h1>
      <div class="d-meta">${d.year ? `<span>${esc(d.year)}</span>` : ''}${d.runtime ? `<span>${esc(d.runtime)}</span>` : ''}${d.language ? `<span>${esc(d.language)}</span>` : ''}</div>
      <div class="offer free"><span class="lg">IA</span><div><div class="n">Internet Archive</div><div class="s free">Gratuit et sans publicité — lecture ici</div><div class="s">Licence déclarée : <a href="${esc(d.license)}" rel="noopener noreferrer" target="_blank">${esc(d.license.replace(/^https?:\/\//, ''))}</a>${d.publicDomain ? '' : ' — non confirmée domaine public, lecture désactivée'}</div></div><a class="btn small" href="${esc(d.page)}" target="_blank" rel="noopener noreferrer">Page source</a></div>
      ${actionsHTML(d)}
    </div></div>
    <div class="d-play">${d.publicDomain && d.video ? `<video controls preload="metadata" playsinline src="${esc(d.video)}"></video>${resume > 30 ? `<p class="m">Reprise à ${fmtTime(resume)}. <button class="btn small" id="restart">Recommencer au début</button></p>` : ''}` : d.publicDomain ? `<iframe class="iaframe" src="${esc(d.embed)}" title="Lecteur Internet Archive" allow="fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe><p class="m">Lecteur officiel d'Internet Archive (pas de fichier MP4 direct : la reprise de lecture n'est pas disponible pour ce film).</p>` : ''}
    ${d.overview ? `<h2>Résumé</h2><p class="lead">${esc(d.overview)}</p>` : ''}</div>`;
    bindActions(d);
    const v = body.querySelector('video');
    if (v) {
      v.addEventListener('loadedmetadata', () => { if (resume > 30 && resume < v.duration - 20) v.currentTime = resume; }, { once: true });
      let last = 0;
      v.addEventListener('timeupdate', () => { if (Math.abs(v.currentTime - last) > 5) { last = v.currentTime; S.set('resume.' + it.id, Math.floor(v.currentTime)); } });
      v.addEventListener('ended', () => S.del('resume.' + it.id));
      v.addEventListener('error', () => { v.insertAdjacentHTML('afterend', `<div class="note err">La vidéo n'a pas pu être chargée. <a href="${esc(d.page)}" target="_blank" rel="noopener noreferrer">Ouvrir sur Internet Archive</a></div>`); v.remove(); });
      $('#restart')?.addEventListener('click', () => { v.currentTime = 0; S.del('resume.' + it.id); v.play().catch(() => {}); });
    }
  }
  const fmtTime = s => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ' h ' : ''}${Math.floor(s / 60) % 60} min`;

  async function openTMDB(it) {
    const d = await T.get(`/${it.kind}/${it.id}`, { append_to_response: 'credits,watch/providers,recommendations,videos', include_video_language: 'fr,en' });
    const full = tmdbItem({ ...d, media_type: it.kind });
    L.push('historique', slim(full));
    const wp = d['watch/providers']?.results?.[EL.config.region];
    const offers = EL.classifyProviders(wp, full.title, S.get('subs', []));
    const genres = (d.genres || []).map(g => g.name).join(', ');
    const runtime = d.runtime ? `${Math.floor(d.runtime / 60)} h ${d.runtime % 60} min` : d.number_of_seasons ? `${d.number_of_seasons} saison${d.number_of_seasons > 1 ? 's' : ''}` : '';
    const directors = (d.credits?.crew || []).filter(c => c.job === 'Director' || c.job === 'Creator').slice(0, 2);
    const creators = (d.created_by || []).map(c => ({ ...c, job: 'Création' }));
    const cast = (d.credits?.cast || []).slice(0, 14);
    const trailer = (d.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');
    const offersHTML = offers.length ? `<div class="offers">${offers.map(o => `
      <div class="offer ${o.access === 'free-unverified' ? '' : o.access}">
        ${o.logo ? `<img src="${esc(T.img(o.logo, 'w92'))}" alt="">` : `<span class="lg">${esc(o.provider.slice(0, 2))}</span>`}
        <div><div class="n">${esc(o.provider)}</div><div class="s ${o.access}">${esc(o.label)}${o.extra ? ' · ' + esc(o.extra) : ''}</div>${o.note ? `<div class="s">${esc(o.note)}</div>` : ''}</div>
        ${o.url ? `<a class="btn small ${o.access === 'free' ? 'go' : ''}" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer" title="${o.isSearch ? 'Ouvre la recherche de ce titre sur la plateforme officielle' : 'Voir les offres (JustWatch)'}">${o.isSearch ? 'Ouvrir' : 'Offres'} ↗</a>` : ''}
      </div>`).join('')}</div>
      <p class="m">« Ouvrir » lance la recherche du titre sur la plateforme officielle. ${wp?.link ? `<a href="${esc(wp.link)}" target="_blank" rel="noopener noreferrer">Toutes les offres et prix (JustWatch via TMDB)</a>` : ''}</p>`
      : `<div class="note">Aucune plateforme française connue ne propose ce titre actuellement (source : JustWatch).</div>`;
    body.innerHTML = `<div class="d-top">${full.backdrop ? `<img class="bd" src="${esc(full.backdrop)}" alt="">` : ''}<div class="fade"></div></div>
      <div class="d-main"><div class="poster">${full.poster ? `<img src="${esc(T.img(d.poster_path, 'w500'))}" alt="">` : ''}</div><div>
        <h1>${esc(full.title)}</h1>
        <div class="d-meta">${full.year ? `<span>${esc(full.year)}</span>` : ''}<span>${it.kind === 'tv' ? 'Série' : 'Film'}</span>${runtime ? `<span>${esc(runtime)}</span>` : ''}${genres ? `<span>${esc(genres)}</span>` : ''}${d.vote_count > 20 ? `<span>★ ${d.vote_average.toFixed(1)}/10 (${d.vote_count.toLocaleString('fr-FR')} votes TMDB)</span>` : ''}${d.original_language ? `<span>VO : ${esc(d.original_language.toUpperCase())}</span>` : ''}</div>
        ${actionsHTML(full)}
        <h2>Où regarder en France</h2>${offersHTML}
        <div id="pd"></div>
        ${trailer ? `<p><a class="btn small" href="https://www.youtube.com/watch?v=${esc(trailer.key)}" target="_blank" rel="noopener noreferrer">▶ Bande-annonce (YouTube)</a></p>` : ''}
        ${d.overview ? `<h2>Résumé</h2><p class="lead">${esc(d.overview)}</p>` : ''}
        ${[...creators, ...directors, ...cast].length ? `<h2>Équipe et distribution</h2><div class="cast">${[...creators, ...directors, ...cast].map(personBtn).join('')}</div>` : ''}
        ${(d.recommendations?.results || []).length ? `<h2>Dans le même esprit</h2>${row(d.recommendations.results.slice(0, 15).map(x => tmdbItem(x, it.kind)))}` : ''}
      </div></div>`;
    bindActions(full);
    // Vieux films : on vérifie s'il existe une copie du domaine public lisible ici.
    if (it.kind === 'movie' && +full.year && +full.year < 1975) {
      try {
        const title = (d.original_title || full.title).replace(/[^\p{L}\p{N}\s]/gu, ' ');
        const r = await IA.search({ q: title, rows: 3, yearFrom: +full.year - 1, yearTo: +full.year + 1 });
        const m = r.items.find(x => norm(x.title).includes(norm(title).slice(0, 12)));
        if (m) $('#pd').innerHTML = `<div class="offer free"><span class="lg">IA</span><div><div class="n">Internet Archive</div><div class="s free">Copie déclarée domaine public — gratuit, sans pub, lecture ici</div><div class="s">Vérifiez que c'est bien la même œuvre (titre et année).</div></div><button class="btn small go" data-open="${esc(m.key)}" data-item="${esc(JSON.stringify(slim(m)))}">Regarder</button></div>`;
      } catch {}
    }
  }
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  /* ---------- Réglages ---------- */
  async function settingsPage(el) {
    const subs = new Set(S.get('subs', []));
    el.innerHTML = `<h1>Réglages</h1>
      <div class="panel"><h3>1. Clé TMDB (gratuite) — catalogue complet</h3>
        <p class="m">Elle est enregistrée <b>uniquement dans ce navigateur</b>, sur cet appareil. Ne la partagez pas.</p>
        <ol class="steps"><li>Créez un compte sur <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer">themoviedb.org/signup</a> et validez l'e-mail.</li>
        <li>Ouvrez <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">Paramètres → API</a>, cliquez <b>Créer</b> puis <b>Developer</b> (usage personnel, non commercial).</li>
        <li>Remplissez le formulaire (type : <i>Personal</i> / <i>Education</i>), acceptez les conditions.</li>
        <li>Copiez la <b>Clé d'API</b> (32 caractères) ou le <b>Jeton d'accès en lecture</b>, et collez-la ici.</li></ol>
        <form class="field" id="kf"><input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="Collez votre clé TMDB" aria-label="Clé TMDB"><button class="btn primary">Enregistrer et tester</button>${T.ready() ? '<button type="button" class="btn" id="delkey">Supprimer</button>' : ''}</form>
        <div id="kmsg">${T.ready() ? '<p class="m">✓ Une clé est enregistrée.</p>' : ''}</div></div>
      <div class="panel"><h3>2. Mes abonnements</h3><p class="m">Cochez ce que vous payez déjà : le filtre « Mes abonnements » et l'assistant s'en servent. Aucun identifiant de plateforme n'est demandé.</p><div id="subs">${T.ready() ? spinner : '<p class="m">Disponible après l\'ajout de la clé TMDB.</p>'}</div></div>
      <div class="panel"><h3>3. Mes données</h3><p class="m">Favoris, liste, historique, notes et reprise de lecture restent sur cet appareil. Aucun compte, aucun traceur, aucune publicité.</p>
        <div class="field"><button class="btn" id="exp">Copier une sauvegarde</button><button class="btn" id="imp">Restaurer une sauvegarde</button><button class="btn" id="purge">Vider le cache</button></div><div id="dmsg"></div></div>
      <div class="panel"><h3>Sources et règles</h3><p class="m">« Gratuit et sans publicité » n'affiche que : les plateformes vérifiées à la main (${EL.providerRules.filter(r => r.noAds).map(r => r.match.source.replace(/[\^\\/i]/g, '')).join(', ')}) et les films du domaine public. Toute autre offre gratuite est marquée « avec publicité » ou « publicité non vérifiée ».</p></div>`;
    $('#kf').addEventListener('submit', async e => {
      e.preventDefault(); const k = $('#key').value.trim(); const msg = $('#kmsg');
      if (!k) return; S.set('tmdbKey', k); EL.purgeCache(); msg.innerHTML = spinner;
      try { await T.get('/configuration'); msg.innerHTML = '<p class="m">✓ Clé valide. Le catalogue complet est activé.</p>'; settingsPage(el); }
      catch (err) { S.del('tmdbKey'); msg.innerHTML = errorBox(err); }
    });
    $('#delkey')?.addEventListener('click', () => { S.del('tmdbKey'); EL.purgeCache(); settingsPage(el); });
    $('#purge').addEventListener('click', () => { EL.purgeCache(); $('#dmsg').innerHTML = '<p class="m">Cache vidé.</p>'; });
    $('#exp').addEventListener('click', async () => {
      const data = {}; ['list.favoris', 'list.liste', 'list.historique', 'subs'].forEach(k => data[k] = S.get(k, null));
      try { Object.keys(localStorage).filter(k => /^el\.(rating|resume)\./.test(k)).forEach(k => data[k.slice(3)] = S.get(k.slice(3))); } catch {}
      const txt = JSON.stringify(data);
      try { await navigator.clipboard.writeText(txt); $('#dmsg').innerHTML = '<p class="m">Sauvegarde copiée (sans la clé TMDB). Collez-la dans Notes pour la garder.</p>'; }
      catch { $('#dmsg').innerHTML = `<p class="m">Copiez ce texte :</p><textarea readonly class="field" rows="4">${esc(txt)}</textarea>`; }
    });
    $('#imp').addEventListener('click', () => {
      $('#dmsg').innerHTML = '<form class="field" id="impf"><input id="impt" placeholder="Collez la sauvegarde ici"><button class="btn primary">Restaurer</button></form>';
      $('#impf').addEventListener('submit', ev => {
        ev.preventDefault();
        try { const o = JSON.parse($('#impt').value); Object.entries(o).forEach(([k, v]) => { if (/^(list\.|subs$|rating\.|resume\.)/.test(k) && v != null) S.set(k, v); }); $('#dmsg').innerHTML = '<p class="m">✓ Restauré.</p>'; }
        catch { $('#dmsg').innerHTML = '<div class="note err">Sauvegarde illisible.</div>'; }
      });
    });
    if (T.ready()) {
      try {
        const [a, b] = await Promise.all([T.providerList('movie'), T.providerList('tv')]);
        const all = new Map(); [...a, ...b].forEach(p => all.set(p.provider_id, p));
        const list = [...all.values()].filter(p => !EL.ruleFor(p.provider_name)?.noAds).slice(0, 60);
        $('#subs').innerHTML = `<div class="checks">${list.map(p => `<label><input type="checkbox" value="${p.provider_id}" ${subs.has(p.provider_id) ? 'checked' : ''}><img src="${esc(T.img(p.logo_path, 'w92'))}" alt="">${esc(p.provider_name)}</label>`).join('')}</div>`;
        $('#subs').addEventListener('change', e => {
          const id = +e.target.value; if (e.target.checked) subs.add(id); else subs.delete(id); S.set('subs', [...subs]);
        });
      } catch (e) { $('#subs').innerHTML = errorBox(e); }
    }
  }

  /* ---------- Routeur ---------- */
  view.addEventListener('click', delegate); body.addEventListener('click', delegate);
  function delegate(e) {
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); try { openItem(JSON.parse(o.dataset.item)); } catch {} return; }
    const p = e.target.closest('[data-person]');
    if (p) { e.preventDefault(); openPerson(p.dataset.person, p.dataset.name); }
  }
  function route() {
    const name = (location.hash || '#accueil').slice(1);
    const fn = pages[name] || pages.accueil;
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (pages[name] ? name : 'accueil')));
    if (!sheet.hidden) closeSheet();
    renderToken++;
    view.innerHTML = '';
    window.scrollTo(0, 0);
    Promise.resolve(fn(view)).catch(e => view.insertAdjacentHTML('beforeend', errorBox(e)));
    document.title = 'Écran Libre';
  }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('online', () => document.body.classList.remove('offline'));
  window.addEventListener('offline', () => view.insertAdjacentHTML('afterbegin', '<div class="note warn">Vous êtes hors ligne : seules les pages déjà chargées sont disponibles.</div>'));
})();
