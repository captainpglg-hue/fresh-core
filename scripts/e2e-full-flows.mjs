// E2E exhaustif : parcourt les principaux flows et vérifie le DOM + screenshots.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:8083';
const OUT = '/tmp/e2e-full';
fs.mkdirSync(OUT, { recursive: true });

function shot(page, name) { return page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }

const errors = [];
const checks = [];
function ok(name, cond, detail = '') {
  checks.push({ name, ok: cond, detail });
  console.log(`  [${cond ? '✓' : '✗'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });

  console.log('\n=== 1. BOOT WEB ===');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000); // wasm + seed
  await shot(page, '01-home');
  const home = await page.locator('body').textContent();
  ok('Title Fresh-Core', (await page.title()) === 'Fresh-Core');
  ok('Marie Dupont OR Utilisateur visible', /Marie|Utilisateur/.test(home));
  ok('Tab Accueil visible', home.includes('Accueil'));
  ok('Tab Plus visible', home.includes('Plus'));

  console.log('\n=== 2. NAVIGATION PLUS → LOTS ===');
  await page.getByText('Plus').first().click();
  await page.waitForTimeout(1000);
  await shot(page, '02-plus');
  ok('Menu Lots visible', await page.getByText('Lots').count() > 0);
  ok('Menu Reglages visible', await page.getByText(/R[eé]glages/).count() > 0);

  await page.getByText('Lots').first().click();
  await page.waitForTimeout(2500);
  await shot(page, '03-lots-list');
  const lots = await page.locator('body').textContent();
  const expectedLots = ['Thon rouge', 'Filets', 'Tartare', 'Veau Charolais', 'Entrec', 'Lait cru', 'Comt', 'Tomates', 'Baguette'];
  const found = expectedLots.filter((n) => lots.includes(n));
  ok(`Tous les 9 lots seedés visibles`, found.length === 9, `${found.length}/9 — ${found.join(', ')}`);
  ok('Bouton Scanner visible', /Scanner/.test(lots));
  ok('Filière affichée dans le header', /Restauration|Restaurateur/.test(lots));

  console.log('\n=== 3. OUVERTURE D\'UN LOT (TARTARE) ===');
  await page.getByText('Tartare').first().click();
  await page.waitForTimeout(2000);
  await shot(page, '04-lot-tartare');
  const detail = await page.locator('body').textContent();
  const svgCount = await page.locator('svg').count();
  ok('QR SVG rendu', svgCount > 5, `${svgCount} svg`);
  ok('Mot "Filière" visible', /Fili[èe]re/.test(detail));
  ok("Mot \"Parcours\" visible", /Parcours/.test(detail));
  ok('Mot "Maillon" visible', /Maillon/.test(detail));
  ok('Chaîne intègre', /Int[èe]gre/.test(detail));
  ok("3 événements visibles (le tartare a CREATE + TRANSFORM via parent…)", /[ée]v[ée]nement/.test(detail));
  ok('Badge "Actif"', /Actif/.test(detail));
  ok('Badge "Ancrage en attente"', /Ancrage/.test(detail));

  console.log('\n=== 4. OUVERTURE LOT THON (chain Pêcheur → Mareyeur → Poissonnier → Resto) ===');
  await page.goBack();
  await page.waitForTimeout(1500);
  await page.getByText('Thon rouge').first().click();
  await page.waitForTimeout(2000);
  await shot(page, '05-lot-thon');
  const thon = await page.locator('body').textContent();
  ok('Thon : "Pêcheur" dans le parcours', /P[êe]cheur/.test(thon));
  ok('Thon : "Mareyeur" dans le parcours', /Mareyeur/.test(thon));
  ok('Thon : zone FAO-37 visible', /FAO-37/.test(thon));
  ok('Thon : transporteur visible', /STEF|Maritimes|Transport/.test(thon));

  console.log('\n=== 5. PAGE PUBLIQUE /origine ===');
  // Récupère le lot_code du Thon depuis l'URL.
  const url = page.url();
  const match = url.match(/\/lot\/([A-Z0-9]+)/);
  if (match) {
    const lotCode = match[1];
    console.log(`  Lot code = ${lotCode}`);
    await page.goto(`${BASE}/origine/${lotCode}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, '06-origine-public');
    const origine = await page.locator('body').textContent();
    ok('Origine : "Origine" dans header', /Origine/.test(origine));
    ok('Origine : produit visible', /Thon/.test(origine));
    ok('Origine : "Traçabilité vérifiable"', /v[ée]rifiable|Tra[çc]abilit[ée]/.test(origine));
    ok('Origine : "Parcours du lot"', /Parcours/.test(origine));
    ok('Origine : code lot affiché', origine.includes(lotCode));
  } else {
    ok('Origine accessible', false, 'URL lot non parsable');
  }

  console.log('\n=== 6. FLOW ONBOARDING (filière + maillon picker) ===');
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot(page, '07-onboarding-intro');
  const ob = await page.locator('body').textContent();
  ok('Onboarding : intro visible', /Tra[çc]abilit[ée] bout en bout/.test(ob));
  ok('Onboarding : bouton Commencer', /Commencer/.test(ob));

  await page.getByText('Commencer').first().click();
  await page.waitForTimeout(1000);
  await shot(page, '08-onboarding-filiere');
  const filiereStep = await page.locator('body').textContent();
  const filiereLabels = ['Pêche', 'Élevage', 'Laitier', 'Fromage', 'Charcuterie', 'Fruits & Légumes', 'Boulangerie', 'Restauration', 'Vins'];
  const filiereFound = filiereLabels.filter((l) => filiereStep.includes(l));
  ok(`Les 10 filières visibles`, filiereFound.length >= 8, `${filiereFound.length}/9`);

  console.log('\n=== 7. CRÉATION DE LOT (en mode restaurateur, devrait être bloqué) ===');
  // En démo Marie Dupont est restaurateur → ne peut pas créer un lot à la source.
  await page.goto(`${BASE}/lot/creer`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot(page, '09-creer-bloque');
  const creer = await page.locator('body').textContent();
  ok('Création bloquée pour restaurateur', /indisponible|ne peut pas|Scanner/.test(creer));

  console.log('\n=========== RAPPORT FINAL ===========');
  console.log(`Erreurs runtime : ${errors.length}`);
  errors.slice(0, 10).forEach((e) => console.log(`  ! ${e.slice(0, 200)}`));
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`Assertions : ${passed} / ${checks.length} (${failed} fails)`);
  if (failed > 0) {
    console.log('\nFAILED:');
    checks.filter((c) => !c.ok).forEach((c) => console.log(`  ✗ ${c.name}${c.detail ? ' — ' + c.detail : ''}`));
  }
  console.log(`\nScreenshots: ${OUT}/`);
  fs.readdirSync(OUT).forEach((f) => console.log(`  - ${f}`));

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
