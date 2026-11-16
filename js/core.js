/* Écran Libre — cœur : stockage local, appels API, classement d'accès, assistant. */
(function () {
  const C = EL.config;

  /* ---------- Stockage local (reste sur l'appareil, jamais envoyé ailleurs) ---------- */
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('el.' + k); return v == null ? d : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { try { localStorage.setItem('el.' + k, JSON.stringify(v)); } catch { mem[k] = v; } },
    del(k) { try { localStorage.removeItem('el.' + k); } catch { delete mem[k]; } },
  };
  // Listes : favoris, à regarder, historique. Un élément = {key, kind, id, title, poster, year}
  const lists = {
    all(name) { return store.get('list.' + name, []); },
    has(name, key) { return lists.all(name).some(x => x.key === key); },
    toggle(name, item) {
      let l = lists.all(name);
      if (l.some(x => x.key === item.key)) l = l.filter(x => x.key !== item.key);
      else l.unshift({ ...item, at: Date.now() });
      store.set('list.' + name, l); return lists.has(name, item.key);
    },
    push(name, item, max = 200) {
      const l = lists.all(name).filter(x => x.key !== item.key);
      l.unshift({ ...item, at: Date.now() }); store.set('list.' + name, l.slice(0, max));
    },
    clear(name) { store.set('list.' + name, []); },
  };

  /* ---------- Cache mémoire + local pour économiser les quotas ---------- */
  async function cachedJSON(url, headers, minutes = C.cacheMinutes) {
    const ck = 'cache.' + url.replace(/api_key=[^&]+/, '');
    const hit = store.get(ck);
    if (hit && Date.now() - hit.t < minutes * 60000) return hit.d;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      const err = new Error(r.status === 401 ? 'Clé TMDB refusée (401). Vérifiez-la dans Réglages.' :
        r.status === 429 ? 'Trop de requêtes, réessayez dans un instant.' : `Erreur ${r.status} sur la source.`);
      err.status = r.status; throw err;
    }
    const d = await r.json();
    try { store.set(ck, { t: Date.now(), d }); } catch { /* quota plein : on ignore le cache */ }
    return d;
  }
  function purgeCache() {
    try { Object.keys(localStorage).filter(k => k.startsWith('el.cache.')).forEach(k => localStorage.removeItem(k)); } catch {}
  }

  /* ---------- TMDB ---------- */
  const tmdb = {
    key() { return (store.get('tmdbKey', '') || '').trim(); },
    ready() { return !!tmdb.key(); },
    async get(path, params = {}) {
      const k = tmdb.key();
      if (!k) throw Object.assign(new Error('Ajoutez votre clé TMDB dans Réglages pour activer le catalogue complet.'), { code: 'NOKEY' });
      const isBearer = k.length > 60; // jeton v4 "API Read Access Token"
      const q = new URLSearchParams({ language: C.language, ...params });
      if (!isBearer) q.set('api_key', k);
      return cachedJSON(`${C.tmdbBase}${path}?${q}`, isBearer ? { Authorization: 'Bearer ' + k } : undefined);
    },
    img(path, size = 'w342') { return path ? C.tmdbImg + size + path : ''; },
    async providerList(kind = 'movie') {
      const d = await tmdb.get(`/watch/providers/${kind}`, { watch_region: C.region });
      return (d.results || []).sort((a, b) => (a.display_priorities?.[C.region] ?? 99) - (b.display_priorities?.[C.region] ?? 99));
    },
    async verifiedNoAdsProviderIds(kind) {
      const list = await tmdb.providerList(kind);
      return list.filter(p => ruleFor(p.provider_name)?.noAds).map(p => p.provider_id);
    },
  };

  /* ---------- Internet Archive (domaine public, sans clé) ---------- */
  const ia = {
    async search({ q = '', rows = 30, page = 1, sort = 'downloads desc', yearFrom, yearTo } = {}) {
      let query = C.iaBaseQuery;
      const clean = q.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
      if (clean) query += ` AND (title:(${clean}) OR description:(${clean}))`;
      if (yearFrom || yearTo) query += ` AND year:[${yearFrom || 1880} TO ${yearTo || 2100}]`;
      const p = new URLSearchParams({ q: query, rows, page, output: 'json' });
      ['identifier', 'title', 'year', 'description', 'licenseurl', 'downloads', 'language'].forEach(f => p.append('fl[]', f));
      p.append('sort[]', sort);
      const d = await cachedJSON(`${C.iaBase}/advancedsearch.php?${p}`);
      return { total: d.response.numFound, items: d.response.docs.map(ia.toItem) };
    },
    toItem(x) {
      const strip = s => String(Array.isArray(s) ? s[0] : s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return { key: 'ia:' + x.identifier, kind: 'ia', id: x.identifier, title: strip(x.title), year: x.year ? String(x.year).slice(0, 4) : '',
        overview: strip(x.description).slice(0, 600), poster: `${C.iaBase}/services/img/${encodeURIComponent(x.identifier)}`,
        license: x.licenseurl || '', language: strip(x.language) };
    },
    async details(id) {
      const d = await cachedJSON(`${C.iaBase}/metadata/${encodeURIComponent(id)}`);
      if (!d || !d.metadata) throw new Error('Ce film n\'est plus disponible sur Internet Archive.');
      const m = d.metadata;
      const lic = String(m.licenseurl || '');
      const files = (d.files || []).filter(f => /\.mp4$/i.test(f.name));
      // Préférence : un MP4 "original" de bonne taille, sinon le plus gros dérivé.
      files.sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0));
      const pick = files.find(f => f.source === 'original') || files[0];
      return {
        ...ia.toItem({ identifier: id, title: m.title, year: m.year || m.date, description: m.description, licenseurl: lic, language: m.language }),
        publicDomain: /publicdomain/i.test(lic),
        runtime: m.runtime || '',
        video: pick ? `${C.iaBase}/download/${encodeURIComponent(id)}/${encodeURIComponent(pick.name)}` : '',
        embed: `${C.iaBase}/embed/${encodeURIComponent(id)}`,
        page: `${C.iaBase}/details/${encodeURIComponent(id)}`,
      };
    },
  };

  /* ---------- Classement des accès (règle absolue : jamais de gratuité/sans-pub supposée) ---------- */
  function ruleFor(name) { return EL.providerRules.find(r => r.match.test(name || '')) || null; }

  // TMDB/JustWatch -> liste d'offres normalisées {provider, logo, access, label, note, url}
  function classifyProviders(wp, title, mySubs = []) {
    if (!wp) return [];
    const q = encodeURIComponent(title || '');
    const seen = new Map();
    const add = (p, type) => {
      const rule = ruleFor(p.provider_name);
      let access, label;
      if (type === 'flatrate') { access = mySubs.includes(p.provider_id) ? 'mysub' : 'sub'; label = mySubs.includes(p.provider_id) ? 'Inclus dans mes abonnements' : 'Abonnement'; }
      else if (type === 'rent' || type === 'buy') { access = 'paid'; label = type === 'rent' ? 'Location' : 'Achat'; }
      else if (type === 'ads') { access = 'ads'; label = 'Gratuit avec publicité'; }
      else if (type === 'free') {
        if (rule?.noAds) { access = 'free'; label = 'Gratuit et sans publicité'; }
        else if (rule?.ads) { access = 'ads'; label = 'Gratuit avec publicité'; }
        else { access = 'free-unverified'; label = 'Gratuit — publicité non vérifiée'; }
      } else return;
      const prev = seen.get(p.provider_id);
      const rank = { free: 0, mysub: 1, 'free-unverified': 2, ads: 3, sub: 4, paid: 5 };
      if (prev && rank[prev.access] <= rank[access]) { if (type === 'rent' || type === 'buy') prev.extra = 'Location / achat'; return; }
      seen.set(p.provider_id, { id: p.provider_id, provider: p.provider_name, logo: p.logo_path, access, label,
        note: rule?.note || '', url: rule?.search ? rule.search(q) : (wp.link || '') , isSearch: !!rule?.search });
    };
    ['free', 'ads', 'flatrate', 'rent', 'buy'].forEach(t => (wp[t] || []).forEach(p => add(p, t)));
    const order = { free: 0, mysub: 1, 'free-unverified': 2, ads: 3, sub: 4, paid: 5 };
    return [...seen.values()].sort((a, b) => order[a.access] - order[b.access]);
  }
  function bestAccess(offers) { return offers.length ? offers[0].access : 'none'; }

  /* ---------- Assistant (analyse de phrase, gratuit, local) ---------- */
  function parseRequest(text) {
    const t = ' ' + text.toLowerCase().normalize('NFC') + ' ';
    const r = { kind: null, genre: null, access: null, originalFr: false, sort: 'popularity.desc', yearFrom: null, yearTo: null, notes: [] };
    if (/\bs[ée]ries?\b|\bfeuilleton/.test(t)) r.kind = 'tv';
    else if (/\bfilms?\b|\bcin[ée]ma\b|\blong[- ]m[ée]trage/.test(t)) r.kind = 'movie';
    const g = EL.genreWords.find(w => w.re.test(t));
    if (g) r.genre = g;
    const noAds = /sans (pub|publicit)/.test(t);
    const free = /gratuit|sans payer|gratos|free\b/.test(t);
    if (free && noAds) r.access = 'free';
    else if (noAds) r.access = 'free';
    else if (free) r.access = 'anyfree';
    if (/abonnement|mes plateformes|j'ai d[ée]j[àa]|sans payer davantage|sans payer plus/.test(t)) r.access = r.access === 'free' ? 'free' : 'freeOrSub';
    if (/en fran[çc]ais|\bvf\b|fran[çc]ais/.test(t)) { r.originalFr = true; r.notes.push('« En français » est appliqué comme « langue originale française » : la disponibilité d\'une VF n\'est pas fournie par les sources gratuites.'); }
    if (/meilleur|mieux not|top|culte|chef[- ]d/.test(t)) r.sort = 'vote_average.desc';
    if (/r[ée]cent|nouveau|nouveaut|derni[eè]re? sorti/.test(t)) r.sort = 'primary_release_date.desc';
    const dec = t.match(/ann[ée]es? ?(19|20)?(\d0)\b/);
    if (dec) { const y = dec[1] ? +(dec[1] + dec[2]) : +dec[2] >= 30 ? 1900 + +dec[2] : 2000 + +dec[2]; r.yearFrom = y; r.yearTo = y + 9; }
    const yr = t.match(/\b(18[89]\d|19\d\d|20[0-3]\d)\b/);
    if (yr && !dec) { r.yearFrom = r.yearTo = +yr[1]; }
    const where = (' ' + text.trim() + ' ').match(/o[ùu] (?:puis-je |je peux |peut-on )?(?:regarder|voir|trouver)(?: l[ée]galement)? (.+?)(?: sans payer| gratuitement| l[ée]galement|\s*\?|\s*$)/i);
    if (where) r.titleQuery = where[1].replace(/^(le film|la s[ée]rie|ce film|cette s[ée]rie)\s+/i, '').replace(/[«»"?]/g, '').trim();
    return r;
  }
  function describeRequest(r) {
    const parts = [];
    parts.push(r.kind === 'tv' ? 'séries' : r.kind === 'movie' ? 'films' : 'films');
    if (r.genre) parts.push(r.genre.label);
    if (r.access === 'free') parts.push('gratuits et sans publicité (vérifiés)');
    if (r.access === 'anyfree') parts.push('gratuits (avec ou sans publicité)');
    if (r.access === 'freeOrSub') parts.push('gratuits ou inclus dans vos abonnements');
    if (r.originalFr) parts.push('en langue originale française');
    if (r.yearFrom) parts.push(r.yearFrom === r.yearTo ? `de ${r.yearFrom}` : `de ${r.yearFrom} à ${r.yearTo}`);
    if (r.sort === 'vote_average.desc') parts.push('les mieux notés d\'abord');
    if (r.sort === 'primary_release_date.desc') parts.push('les plus récents d\'abord');
    return parts.join(', ');
  }

  EL.store = store; EL.lists = lists; EL.tmdb = tmdb; EL.ia = ia; EL.purgeCache = purgeCache;
  EL.ruleFor = ruleFor; EL.classifyProviders = classifyProviders; EL.bestAccess = bestAccess;
  EL.parseRequest = parseRequest; EL.describeRequest = describeRequest;
})();
