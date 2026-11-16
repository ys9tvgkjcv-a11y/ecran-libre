#!/usr/bin/env node
/* Écran Libre — vérification des sources (maintenance).
   Ne modifie RIEN : produit un rapport et un code de sortie (0 = OK, 1 = problème).
   Usage : node tools/check-sources.mjs            (Internet Archive seulement)
           TMDB_KEY=xxxx node tools/check-sources.mjs  (+ TMDB et noms de plateformes) */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { console }; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/config.js', import.meta.url), 'utf8'), ctx);
const { config, providerRules } = ctx.window.EL;

const problems = [], lines = [];
const log = (ok, msg) => { lines.push(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) problems.push(msg); };
const get = async (url, opt) => { const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(20000) }); return r; };

// 1. Internet Archive : la recherche répond et renvoie des films domaine public
try {
  const p = new URLSearchParams({ q: config.iaBaseQuery, rows: 25, output: 'json' });
  ['identifier', 'licenseurl'].forEach(f => p.append('fl[]', f)); p.append('sort[]', 'downloads desc');
  const r = await get(`${config.iaBase}/advancedsearch.php?${p}`);
  const d = await r.json();
  log(r.ok && d.response.numFound > 1000, `Internet Archive : recherche OK (${d.response.numFound} films domaine public)`);
  // 2. Échantillon : chaque film a une licence domaine public et un fichier MP4
  let noVideo = [];
  for (const doc of d.response.docs.slice(0, 15)) {
    const m = await (await get(`${config.iaBase}/metadata/${encodeURIComponent(doc.identifier)}`)).json();
    const pd = /publicdomain/i.test(m?.metadata?.licenseurl || '');
    const mp4 = (m?.files || []).some(f => /\.mp4$/i.test(f.name));
    if (!m?.metadata || !pd || !mp4) noVideo.push(doc.identifier);
  }
  log(noVideo.length <= 3, `Internet Archive : échantillon de 15 fiches, ${noVideo.length} sans MP4 ou licence${noVideo.length ? ' (' + noVideo.join(', ') + ')' : ''}`);
} catch (e) { log(false, 'Internet Archive injoignable : ' + e.message); }

// 3. TMDB (si clé fournie) : clé valide + les règles de plateformes correspondent toujours à des noms réels
const key = process.env.TMDB_KEY;
if (key) {
  try {
    const auth = key.length > 60 ? { headers: { Authorization: 'Bearer ' + key } } : {};
    const qk = key.length > 60 ? '' : `&api_key=${key}`;
    const r = await get(`${config.tmdbBase}/watch/providers/movie?watch_region=${config.region}${qk}`, auth);
    log(r.ok, `TMDB : clé ${r.ok ? 'valide' : 'refusée (' + r.status + ')'}`);
    if (r.ok) {
      const names = (await r.json()).results.map(p => p.provider_name);
      for (const rule of providerRules.filter(x => x.noAds || x.ads)) {
        const hit = names.filter(n => rule.match.test(n));
        if (/internet archive/i.test(rule.match.source)) continue;
        log(hit.length > 0, `Règle ${rule.match} → ${hit.length ? hit.join(', ') : 'aucune plateforme trouvée (renommée ou disparue ?)'}`);
      }
      const free = names.filter(n => !providerRules.some(rule => rule.match.test(n)));
      lines.push(`ℹ️ ${free.length} plateformes FR sans règle (classées « publicité non vérifiée » si gratuites).`);
    }
  } catch (e) { log(false, 'TMDB injoignable : ' + e.message); }
} else lines.push('ℹ️ TMDB non vérifié (variable TMDB_KEY absente).');

const report = `# Rapport de maintenance — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n\n${lines.join('\n')}\n\n${problems.length ? `**${problems.length} problème(s) à examiner.** Rien n'a été modifié automatiquement.` : '**Tout fonctionne.**'}\n`;
writeFileSync('rapport-maintenance.md', report);
console.log(report);
process.exit(problems.length ? 1 : 0);
