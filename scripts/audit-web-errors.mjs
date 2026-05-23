// Audit exhaustif des erreurs web au boot. Ne navigue pas, juste charge
// la page et collecte TOUT (page errors, console errors/warnings, network
// 4xx/5xx) pendant 10 secondes pour laisser le wasm SQLite charger.

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  const networkFails = [];

  page.on('pageerror', (e) => pageErrors.push({ msg: e.message, stack: (e.stack || '').split('\n').slice(0, 3).join(' | ') }));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
    if (m.type() === 'warning') consoleWarnings.push(m.text());
  });
  page.on('requestfailed', (r) => networkFails.push(`${r.method()} ${r.url().slice(0, 80)}: ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) networkFails.push(`${r.status()} ${r.url().slice(0, 100)}`);
  });

  console.log('→ Loading http://localhost:8083');
  await page.goto('http://localhost:8083', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('→ Wait 10s pour le boot complet (wasm SQLite, seeds, ...)');
  await page.waitForTimeout(10000);

  // Compte les lots affichés (preuve que les seeds ont tourné).
  await page.getByText('Plus').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText('Lots').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  const bodyAfterLots = await page.locator('body').textContent();
  const lotNames = ['Thon rouge', 'Filets', 'Tartare', 'Veau Charolais', 'Entrec', 'Lait cru', 'Comt', 'Tomates', 'Baguette'];
  const found = lotNames.filter((n) => bodyAfterLots.includes(n));

  console.log('\n=========== RAPPORT BOOT WEB ===========');
  console.log(`Page errors           : ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log(`  ✗ ${e.msg}`));
  console.log(`\nConsole errors        : ${consoleErrors.length}`);
  consoleErrors.slice(0, 15).forEach((e) => console.log(`  ✗ ${e.slice(0, 200)}`));
  if (consoleErrors.length > 15) console.log(`  ... (+${consoleErrors.length - 15} omitted)`);
  console.log(`\nConsole warnings      : ${consoleWarnings.length}`);
  consoleWarnings.slice(0, 5).forEach((w) => console.log(`  ! ${w.slice(0, 150)}`));
  console.log(`\nNetwork 4xx/5xx       : ${networkFails.length}`);
  networkFails.slice(0, 5).forEach((n) => console.log(`  ✗ ${n}`));
  console.log(`\nLots seedés trouvés   : ${found.length} / 9 attendus`);
  console.log(`  ${found.join(', ') || '(aucun — seeds non exécutés)'}`);
  console.log('========================================');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
