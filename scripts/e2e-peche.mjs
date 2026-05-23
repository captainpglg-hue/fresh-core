// E2E test : ouvre l'app web Fresh-Core, navigue Plus → Lots → ouvre un lot
// Pêche, vérifie la timeline. Capture screenshots à chaque étape.

import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:8083';
const OUT = '/tmp/e2e-screenshots';
fs.mkdirSync(OUT, { recursive: true });

function shot(page, name) { return page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });

  console.log(`→ Open ${BASE}`);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, '01-home');
  console.log(`  Title: "${await page.title()}"`);

  // L'app démarre en mode démo → on doit être redirigé vers l'écran d'accueil
  // ou être encore au chargement. On attend un texte connu de l'app.
  const bodyText = await page.locator('body').textContent({ timeout: 10000 });
  console.log(`  Body preview: ${bodyText.slice(0, 200).replace(/\s+/g, ' ')}...`);

  // Cherche les onglets de navigation (texte "Accueil" ou "Plus").
  const hasAccueil = await page.getByText('Accueil').count();
  const hasPlus = await page.getByText('Plus').count();
  console.log(`  Tab "Accueil" trouvé : ${hasAccueil > 0}, tab "Plus" trouvé : ${hasPlus > 0}`);

  if (hasPlus > 0) {
    console.log(`→ Click sur Plus`);
    await page.getByText('Plus').first().click();
    await page.waitForTimeout(1500);
    await shot(page, '02-plus-menu');

    const hasLots = await page.getByText('Lots').count();
    console.log(`  Menu "Lots" trouvé : ${hasLots > 0}`);

    if (hasLots > 0) {
      console.log(`→ Click sur Lots`);
      await page.getByText('Lots').first().click();
      await page.waitForTimeout(2000);
      await shot(page, '03-lots-list');

      const bodyAfterLots = await page.locator('body').textContent();
      const lotKeywords = ['Thon', 'Veau', 'Tartare', 'Comté', 'Lot', 'Pêche'];
      const found = lotKeywords.filter((k) => bodyAfterLots.includes(k));
      console.log(`  Mots-clés lots trouvés : ${found.join(', ') || '(aucun)'}`);

      // Tente d'ouvrir le premier lot
      const tartareLink = page.getByText(/Tartare|Thon|Filets/i).first();
      if (await tartareLink.count() > 0) {
        console.log(`→ Click sur premier lot Pêche`);
        await tartareLink.click();
        await page.waitForTimeout(2000);
        await shot(page, '04-lot-detail');

        const detailText = await page.locator('body').textContent();
        const detailChecks = {
          'QR code rendu (svg)': await page.locator('svg').count() > 0,
          'Mot "Filière" visible': /Fili[èe]re/i.test(detailText),
          'Mot "Parcours" visible': /Parcours/i.test(detailText),
          'Mot "événement" visible': /[ée]v[ée]nement/i.test(detailText),
          'Mot "Pêche" visible': /p[êe]che/i.test(detailText),
        };
        console.log(`  Checks détail lot:`);
        for (const [k, v] of Object.entries(detailChecks)) {
          console.log(`    [${v ? '✓' : '✗'}] ${k}`);
        }
      }
    }
  }

  console.log(`\n→ Erreurs console détectées : ${errors.length}`);
  errors.slice(0, 10).forEach((e) => console.log(`  - ${e.slice(0, 200)}`));

  console.log(`\n→ Screenshots dans ${OUT}/`);
  fs.readdirSync(OUT).forEach((f) => console.log(`  - ${f}`));

  await browser.close();
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
