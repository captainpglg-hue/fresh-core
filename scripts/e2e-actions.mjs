// E2E des actions sur un lot : CREATE → TRANSFER → CONTROL → DESTROY.
// Vérifie que chaque action enrichit le timeline et que la hash chain
// reste intègre.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:8083';
const OUT = '/tmp/e2e-actions';
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
  const ctx = await browser.newContext({ viewport: { width: 414, height: 1800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`PE: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!/placeholder\.supabase|ERR_NAME_NOT_RESOLVED/.test(t)) errors.push(`CE: ${t.slice(0, 200)}`);
    }
  });

  console.log('=== BOOT + onboarding rapide en Pêcheur ===');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  await page.goto(`${BASE}/onboarding`);
  await page.waitForTimeout(1500);
  await page.getByText('Commencer').first().click();
  await page.waitForTimeout(800);
  await page.getByText('Pêche', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.getByText('Pêcheur', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.getByText('Lancer Fresh-Core').first().click();
  await page.waitForTimeout(2500);
  ok('Onboarding terminé en Pêcheur', true);

  console.log('\n=== Crée un lot Thon ===');
  await page.getByText('Plus').first().click();
  await page.waitForTimeout(500);
  await page.getByText('Lots').first().click();
  await page.waitForTimeout(2000);
  await page.getByText('Nouveau lot').first().click();
  await page.waitForTimeout(1500);
  await shot(page, '01-creer-form');

  const inputs = await page.locator('input[type="text"], input:not([type])').all();
  if (inputs.length > 0) await inputs[0].fill('Thon E2E action test');
  if (inputs.length > 1) await inputs[1].fill('25').catch(() => {});
  // Sélectionne unit + zone FAO + méthode via les <select> natifs (RN-Web).
  const selects = await page.locator('select').all();
  console.log(`  ${selects.length} select(s) trouvé(s)`);
  // 0 = unit kg/piece/caisse, 1 = zone FAO (required), 2 = méthode (optional)
  if (selects.length > 1) {
    await selects[1].selectOption({ label: 'FAO 27 — Atlantique NE' }).catch((e) => console.log('  fao err:', e.message.slice(0, 80)));
  }
  await page.waitForTimeout(500);

  const submitEnabled = await page.getByText(/Cr[ée]er le lot/i).first().isEnabled();
  console.log(`  submit enabled: ${submitEnabled}`);
  await page.getByText(/Cr[ée]er le lot/i).first().click();
  await page.waitForTimeout(3500);
  await shot(page, '02-lot-detail-create');

  const detail1 = await page.locator('body').textContent();
  ok('Lot créé et visualisé', /Thon E2E|Cr[ée]ation/.test(detail1));
  ok('Timeline : 1 événement (CREATE)', /1 [ée]v[ée]nement/.test(detail1));
  ok('Badge "Actif"', /Actif/.test(detail1));
  ok('Chaîne intègre', /Int[èe]gre/.test(detail1));

  console.log('\n=== Click "Contrôle" → submit CONTROL ===');
  // Le bouton "Contrôle" est dans la card Actions.
  const controlBtn = page.getByText('Contrôle', { exact: true }).last();
  await controlBtn.scrollIntoViewIfNeeded().catch(() => {});
  if (await controlBtn.count() === 0) {
    ok('Bouton Contrôle visible', false, 'pas trouvé sur la page détail');
  } else {
    await controlBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await shot(page, '03-action-control-form');
    const ctlBody = await page.locator('body').textContent();
    ok('Form CONTROL : titre', /Ajouter un contr[ôo]le/.test(ctlBody));
    ok('Form CONTROL : champ "Type de contrôle"', /Type de contr[ôo]le/.test(ctlBody));

    // Sélectionne le type "Température" via le select natif web.
    const selects = await page.locator('select').all();
    if (selects.length > 0) {
      await selects[0].selectOption({ index: 1 }).catch(() => {});  // index 0 = placeholder
    }
    // Remplit la valeur dans le 1er input texte
    const ctlInputs = await page.locator('input[type="text"], input:not([type])').all();
    if (ctlInputs.length > 0) await ctlInputs[0].fill('2.5').catch(() => {});
    await shot(page, '04-action-control-filled');

    await page.getByText(/Enregistrer le contr[ôo]le/i).first().click();
    await page.waitForTimeout(3000);
    await shot(page, '05-after-control');

    const after = await page.locator('body').textContent();
    ok('Après CONTROL : 2 événements visibles', /2 [ée]v[ée]nements/.test(after));
    ok('Après CONTROL : chaîne toujours intègre', /Int[èe]gre/.test(after));
    ok('Après CONTROL : "Contrôle" dans timeline', /Contr[ôo]le/.test(after));
  }

  console.log('\n=== Click "Transférer" → submit TRANSFER ===');
  const transferBtn = page.getByText('Transférer', { exact: true }).last();
  await transferBtn.scrollIntoViewIfNeeded().catch(() => {});
  if (await transferBtn.count() === 0) {
    ok('Bouton Transférer visible', false);
  } else {
    await transferBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await shot(page, '06-action-transfer-form');
    const trBody = await page.locator('body').textContent();
    ok('Form TRANSFER : titre', /Transf[ée]rer le lot/.test(trBody));
    ok('Form TRANSFER : champ "Transporteur"', /Transporteur/.test(trBody));

    const trInputs = await page.locator('input[type="text"], input:not([type])').all();
    // 1er input = T° transport (numeric label)
    if (trInputs.length > 0) await trInputs[0].fill('1').catch(() => {});
    // 3e input = Transporteur (le 2e est durée)
    if (trInputs.length > 2) await trInputs[2].fill('STEF Frigo Atlantique').catch(() => {});
    await shot(page, '07-action-transfer-filled');

    await page.getByText(/Confirmer le transfert/i).first().click();
    await page.waitForTimeout(3000);
    await shot(page, '08-after-transfer');

    const afterTr = await page.locator('body').textContent();
    ok('Après TRANSFER : 3 événements visibles', /3 [ée]v[ée]nements/.test(afterTr));
    ok('Après TRANSFER : "STEF" visible dans timeline', /STEF|Frigo/.test(afterTr));
    ok('Après TRANSFER : chaîne toujours intègre', /Int[èe]gre/.test(afterTr));
  }

  console.log('\n=== Click "Détruire" → submit DESTROY (terminal) ===');
  const destroyBtn = page.getByText('Détruire', { exact: true }).last();
  await destroyBtn.scrollIntoViewIfNeeded().catch(() => {});
  if (await destroyBtn.count() === 0) {
    ok('Bouton Détruire visible', false);
  } else {
    await destroyBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await shot(page, '09-action-destroy-form');
    const dsBody = await page.locator('body').textContent();
    ok('Form DESTROY : titre', /Marquer comme d[ée]truit/.test(dsBody));
    ok('Form DESTROY : avertissement définitif', /d[ée]finitive/.test(dsBody));

    // Choisis motif "Périmé" via le select
    const dsSelects = await page.locator('select').all();
    if (dsSelects.length > 0) await dsSelects[0].selectOption({ index: 1 }).catch(() => {});
    await shot(page, '10-action-destroy-filled');

    await page.getByText(/Confirmer la destruction/i).first().click();
    await page.waitForTimeout(3000);
    await shot(page, '11-after-destroy');

    const afterDs = await page.locator('body').textContent();
    ok('Après DESTROY : 4 événements visibles', /4 [ée]v[ée]nements/.test(afterDs));
    ok('Après DESTROY : badge "Détruit"', /D[ée]truit/.test(afterDs));
    // Le lot n'est plus actif → les boutons d'action doivent disparaître.
    ok('Après DESTROY : section "Actions" cachée', !/^Actions$/m.test(afterDs.replace(/Actions urgentes/g, '')));
  }

  console.log('\n=========== RAPPORT ===========');
  console.log(`Erreurs runtime : ${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.log(`  ! ${e.slice(0, 200)}`));
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`Assertions : ${passed} / ${checks.length}`);
  if (failed > 0) {
    console.log('\nFAILED:');
    checks.filter((c) => !c.ok).forEach((c) => console.log(`  ✗ ${c.name}${c.detail ? ' — ' + c.detail : ''}`));
  }
  console.log(`\nScreenshots: ${OUT}/`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
