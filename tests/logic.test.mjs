/* Tests de la logique critique : classement gratuit/pub et assistant. Lancer : node tests/logic.test.mjs */
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const ctx = { console, URLSearchParams, fetch: () => { throw new Error('pas de réseau en test'); } }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/config.js', 'js/core.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
const EL = ctx.EL; let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };
const P = (id, name) => ({ provider_id: id, provider_name: name, logo_path: '/x.png' });

t('Arte "free" → gratuit et sans publicité', () => {
  const o = EL.classifyProviders({ free: [P(1, 'Arte')] }, 'X'); assert.equal(o[0].access, 'free'); assert.match(o[0].url, /arte\.tv/);
});
t('france.tv "free" → jamais sans pub (règle absolue)', () => {
  assert.equal(EL.classifyProviders({ free: [P(2, 'France TV')] }, 'X')[0].access, 'ads');
});
t('Plateforme gratuite inconnue → "publicité non vérifiée"', () => {
  const o = EL.classifyProviders({ free: [P(3, 'Nouvelle Plateforme')] }, 'X')[0];
  assert.equal(o.access, 'free-unverified'); assert.doesNotMatch(o.label, /sans publicité/);
});
t('Type "ads" → gratuit avec publicité, même pour Arte', () => {
  assert.equal(EL.classifyProviders({ ads: [P(1, 'Arte')] }, 'X')[0].access, 'ads');
});
t('Abonnement coché par l\'utilisateur → "mysub"', () => {
  const o = EL.classifyProviders({ flatrate: [P(8, 'Netflix'), P(9, 'Canal+')] }, 'X', [8]);
  assert.equal(o.find(x => x.id === 8).access, 'mysub'); assert.equal(o.find(x => x.id === 9).access, 'sub');
});
t('Location/achat → payant, jamais gratuit', () => {
  const o = EL.classifyProviders({ rent: [P(10, 'Apple TV')], buy: [P(10, 'Apple TV')] }, 'X');
  assert.equal(o.length, 1); assert.equal(o[0].access, 'paid');
});
t('Tri : gratuit sans pub avant payant', () => {
  const o = EL.classifyProviders({ buy: [P(10, 'Apple TV')], free: [P(1, 'Arte')], flatrate: [P(8, 'Netflix')] }, 'X');
  assert.equal(o.map(x => x.access).join(), 'free,sub,paid');
});
t('Aucune donnée → aucune offre inventée', () => { assert.equal(EL.classifyProviders(undefined, 'X').length, 0); });
t('Assistant : SF gratuit, français, sans pub', () => {
  const r = EL.parseRequest('Trouve-moi un film de science-fiction gratuit, en français et sans publicité.');
  assert.equal(r.kind, 'movie'); assert.equal(r.genre.movie, 878); assert.equal(r.access, 'free'); assert.equal(r.originalFr, true);
});
t('Assistant : meilleures séries policières gratuites', () => {
  const r = EL.parseRequest('Propose-moi les meilleures séries policières disponibles gratuitement.');
  assert.equal(r.kind, 'tv'); assert.equal(r.genre.tv, 80); assert.equal(r.access, 'anyfree'); assert.equal(r.sort, 'vote_average.desc');
});
t('Assistant : où regarder un titre', () => {
  const r = EL.parseRequest('Où puis-je regarder légalement Le Fabuleux Destin d\'Amélie Poulain sans payer davantage ?');
  assert.equal(r.titleQuery, 'Le Fabuleux Destin d\'Amélie Poulain');
});
t('Assistant : comédie des années 80', () => {
  const r = EL.parseRequest('une comédie des années 80'); assert.equal(r.yearFrom, 1980); assert.equal(r.yearTo, 1989); assert.equal(r.genre.movie, 35);
});
t('Assistant : "gratuit" seul n\'implique pas "sans pub"', () => { assert.equal(EL.parseRequest('un film gratuit').access, 'anyfree'); });
console.log(`\n${n} tests réussis.`);
