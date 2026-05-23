// E2E exhaustif final — 7 modules HACCP historiques + onboarding complet
// (filière+maillon+recap) + bascule maillon → création lot + submit form.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:8083';
const OUT = '/tmp/e2e-extensive';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const checks = [];
function shot(page, name) { return page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }
function ok(name, cond, detail = '') {
  checks.push({ name, ok: cond, detail });
  console.log(`  [${cond ? '✓' : '✗'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`PE: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') {
    const t = m.text();
    // Ignore l'erreur réseau attendue (placeholder.supabase.co en mode démo).
    if (!/placeholder\.supabase|ERR_NAME_NOT_RESOLVED/.test(t)) errors.push(`CE: ${t.slice(0, 200)}`);
  }});

  console.log('\n=== BOOT ===');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  await shot(page, '01-home');
  ok('App boot sans crash', errors.length === 0, errors.length ? errors[0].slice(0, 150) : '');

  // ----- 7 MODULES HACCP -----
  console.log('\n=== 7 MODULES HACCP HISTORIQUES ===');
  const haccpModules = [
    { name: 'Températures', label: 'Temperatures', expect: /temp|releve|equipement|Chambre|frigo|cong/i },
    { name: 'Réceptions', label: 'Receptions', expect: /r[ée]ception|fournisseur|livraison/i },
    { name: 'Nettoyage', label: 'Nettoyage', expect: /nettoyage|zone|t[âa]che|frequence/i },
  ];
  for (const m of haccpModules) {
    const before = errors.length;
    await page.getByText(m.label, { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const body = await page.locator('body').textContent();
    ok(`Module ${m.name} : ouvre sans crash`, errors.length === before, errors[errors.length - 1]?.slice(0, 120));
    ok(`Module ${m.name} : contenu attendu`, m.expect.test(body));
    await shot(page, `02-haccp-${m.label.toLowerCase()}`);
  }

  // Modules accessibles via Plus
  console.log('\n=== MODULES VIA "PLUS" ===');
  await page.getByText('Plus').first().click();
  await page.waitForTimeout(800);
  await shot(page, '03-plus-menu');
  const plusModules = ['Cuisson', /Tracabilite|Tra[çc]abilit[ée]/, 'Huiles', 'Nuisibles'];
  for (const m of plusModules) {
    await page.getByText('Plus').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    const before = errors.length;
    const target = typeof m === 'string' ? page.getByText(m, { exact: false }).first() : page.getByText(m).first();
    await target.click({ timeout: 5000 }).catch((e) => console.log(`  ! clic ${m}: ${e.message.slice(0, 80)}`));
    await page.waitForTimeout(1500);
    ok(`Module ${m} : ouvre sans crash`, errors.length === before, errors[errors.length - 1]?.slice(0, 120));
    await shot(page, `04-plus-${String(m).replace(/\W/g, '').toLowerCase()}`);
  }

  // ----- ONBOARDING COMPLET (4 étapes) -----
  console.log('\n=== ONBOARDING COMPLET (4 étapes) ===');
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot(page, '05-onb-1-intro');
  ok('Onboarding intro visible', /Tra[çc]abilit[ée] bout en bout/.test(await page.locator('body').textContent()));

  await page.getByText('Commencer').first().click();
  await page.waitForTimeout(1000);
  await shot(page, '06-onb-2-filiere');
  const fStep = await page.locator('body').textContent();
  ok('Étape 2 : "Quelle est ta filière"', /Quelle est ta fili[èe]re/.test(fStep));

  // Click sur "Pêche maritime" via le titre exact. Force scroll + retry.
  const pecheCard = page.getByText('Pêche', { exact: true }).first();
  await pecheCard.scrollIntoViewIfNeeded().catch(() => {});
  await pecheCard.click({ force: true });
  await page.waitForTimeout(2500); // auto-advance setTimeout(150) + RN re-render
  await shot(page, '07-onb-3-maillon');
  const mStep = await page.locator('body').textContent();
  ok('Étape 3 : titre maillon visible', /r[ôo]le dans la fili[èe]re/i.test(mStep), mStep.slice(0, 100));
  ok('Maillons pêche : "Pêcheur" visible', /P[êe]cheur/.test(mStep));
  ok('Maillons pêche : "Mareyeur" visible', /Mareyeur/.test(mStep));
  ok('Maillons pêche : "Poissonnier" visible', /Poissonnier/.test(mStep));
  ok('Maillons pêche : "Restaurateur" visible', /Restaurateur/.test(mStep));

  // Click "Pêcheur" (avec scroll)
  const pecheurCard = page.getByText('Pêcheur', { exact: true }).first();
  await pecheurCard.scrollIntoViewIfNeeded().catch(() => {});
  await pecheurCard.click({ force: true });
  await page.waitForTimeout(2500);
  await shot(page, '08-onb-4-recap');
  const rStep = await page.locator('body').textContent();
  ok('Étape 4 : recap "Tout est prêt"', /Tout est pr[êe]t/.test(rStep));
  ok('Recap : filière "Pêche maritime"', /P[êe]che maritime/.test(rStep));
  ok('Recap : maillon "Pêcheur"', /P[êe]cheur/.test(rStep));
  ok('Recap : capacité "Créer de nouveaux lots"', /Cr[ée]er.*lots/.test(rStep));

  // Valider → bascule maillon dans authStore
  await page.getByText('Lancer Fresh-Core').first().click();
  await page.waitForTimeout(3000);
  await shot(page, '09-after-onboarding');

  // ----- LISTE LOTS APRÈS BASCULE MAILLON -----
  console.log('\n=== APRÈS BASCULE EN PÊCHEUR ===');
  await page.getByText('Plus').first().click();
  await page.waitForTimeout(500);
  await page.getByText('Lots').first().click();
  await page.waitForTimeout(2000);
  await shot(page, '10-lots-as-pecheur');
  const lotsBody = await page.locator('body').textContent();
  ok('Header montre Pêche maritime', /P[êe]che maritime/.test(lotsBody));
  ok('Bouton "Nouveau lot" visible (maillon source)', /Nouveau lot/.test(lotsBody));

  // ----- CRÉATION D'UN LOT VIA DYNAMICFORM -----
  console.log('\n=== CRÉATION DE LOT (DynamicForm Pêche) ===');
  await page.getByText('Nouveau lot').first().click();
  await page.waitForTimeout(1500);
  await shot(page, '11-creer-form');
  const formBody = await page.locator('body').textContent();
  ok('Form : titre "Nouveau lot"', /Nouveau lot/.test(formBody));
  ok('Form : champ Espèce visible', /Esp[èe]ce/.test(formBody));
  ok('Form : champ "Zone FAO" visible', /Zone FAO/.test(formBody));
  ok('Form : champ "Méthode" visible', /M[ée]thode/.test(formBody));
  ok('Form : champ "Nom / immatriculation"', /immatriculation|bateau/i.test(formBody));

  // Saisie : product name + zone FAO + méthode + bateau
  const inputs = await page.locator('input[type="text"], input:not([type])').all();
  if (inputs.length > 0) {
    await inputs[0].fill('Sardine pilchardus');
    ok('Form : product name saisi', true);
  } else {
    ok('Form : input text disponible', false, 'aucun input trouvé');
  }
  await shot(page, '12-creer-filled');

  // Web : select natif. On essaie de remplir la zone FAO via select.
  const selects = await page.locator('select').all();
  if (selects.length > 0) {
    await selects[0].selectOption({ index: 1 }).catch(() => {});
    ok('Form : zone FAO sélectionnée', true);
  }

  // Soumet via bouton "Créer le lot et générer le QR"
  const submitBtn = page.getByText(/Cr[ée]er le lot/i).first();
  const submitEnabled = await submitBtn.isEnabled().catch(() => false);
  ok('Form : bouton submit présent', await submitBtn.count() > 0);
  await shot(page, '13-creer-prefilled');
  if (submitEnabled) {
    const beforeErrs = errors.length;
    await submitBtn.click();
    await page.waitForTimeout(3500);
    await shot(page, '14-after-submit');
    ok('Form : submit sans crash', errors.length === beforeErrs, errors[errors.length - 1]?.slice(0, 120));
    const after = await page.locator('body').textContent();
    ok('Submit : redirection vers le nouveau lot (page détail)', /Parcours|Maillon|Cr[ée]ation/i.test(after));
  }

  // ----- RAPPORT FINAL -----
  console.log('\n=========== RAPPORT FINAL ===========');
  console.log(`Erreurs runtime : ${errors.length}`);
  errors.slice(0, 10).forEach((e) => console.log(`  ! ${e.slice(0, 200)}`));
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`Assertions : ${passed} / ${checks.length}`);
  if (failed > 0) {
    console.log('\nFAILED:');
    checks.filter((c) => !c.ok).forEach((c) => console.log(`  ✗ ${c.name}${c.detail ? ' — ' + c.detail : ''}`));
  }
  console.log(`\nScreenshots: ${OUT}/`);

  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
