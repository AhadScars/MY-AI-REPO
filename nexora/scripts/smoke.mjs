import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:5179';

const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `dist/smoke-${name}.png`, fullPage: false });
}

async function visit(page, path, expectText) {
  const res = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  if (!res || res.status() >= 400) errors.push(`${path} status ${res?.status()}`);
  if (expectText) {
    const found = await page.getByText(expectText).first().isVisible().catch(() => false);
    if (!found) errors.push(`${path} missing "${expectText}"`);
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await visit(page, '/', 'Are you 18 or over');
  await page.getByRole('button', { name: 'I am 18+' }).click();
  await page.getByRole('heading', { name: /sharpest line/i }).waitFor();
  await shot(page, 'home');

  const odds = page.locator('button.odds').first();
  await odds.click();
  await page.getByText('Bet slip').waitFor();
  await shot(page, 'slip');

  for (const [path, text] of [
    ['/live', 'Live betting'],
    ['/sports', 'All sports'],
    ['/sports/football', 'Football'],
    ['/event/epl_ars_liv', 'Match Winner'],
    ['/casino', 'Casino. Visual only'],
    ['/promotions', 'Promotions'],
    ['/results', 'Scores & settlement'],
    ['/leaderboards', 'Leaderboards'],
    ['/help', 'Help Centre'],
    ['/responsible-gambling', 'Responsible gambling'],
    ['/about', 'About Nexora'],
  ]) {
    await visit(page, path, text);
  }

  await visit(page, '/login', 'Log in');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Two-factor').waitFor();
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByText('Hello, Alex').waitFor();
  await shot(page, 'account');

  await visit(page, '/wallet', 'Balances');
  await page.getByRole('button', { name: 'Deposit' }).click();
  await page.getByRole('button', { name: 'Credit wallet' }).click();
  await page.getByText(/Deposit complete|Balances/).first().waitFor();

  await visit(page, '/admin', 'Admin only');

  await page.getByRole('button', { name: 'Log out' }).click().catch(async () => {
    await page.goto(base + '/account');
  });

  await visit(page, '/login', 'Log in');
  await page.locator('input[type="email"]').fill('admin@nexora.demo');
  await page.locator('input[type="password"]').fill('admin1234');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.goto(base + '/admin');
  await page.getByText('Operations').waitFor();
  await shot(page, 'admin');

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  mobile.on('pageerror', (err) => errors.push('mobile pageerror: ' + err.message));
  await mobile.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const gate = mobile.getByRole('button', { name: 'I am 18+' });
  if (await gate.isVisible().catch(() => false)) await gate.click();
  await mobile.getByText('Home').first().waitFor();
  await shot(mobile, 'mobile');
  await mobile.getByRole('button', { name: /Slip/ }).click();
  await mobile.getByText('Bet slip').waitFor();
  await mobile.close();
} catch (err) {
  errors.push(String(err));
} finally {
  await browser.close();
}

if (errors.length) {
  console.error('SMOKE FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('SMOKE OK');
