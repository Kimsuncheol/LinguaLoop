import { test, expect, type Page } from '@playwright/test';
async function fixture(page: Page, signedIn = false) {
  await page.addInitScript(() => localStorage.setItem('lingualoop-dismissed-release', '2099-01-01T00:00:00.000Z'));
  await page.route('**/api/auth/me', route => route.fulfill(signedIn ? { json: { id: 'fixture', name: 'Learner' } } : { status: 401, json: { error: 'unauthenticated' } }));
  await page.route('**/api/lessons**', route => {
    const url = new URL(route.request().url());
    const language = url.searchParams.get('language') || url.pathname.split('/')[3];
    const item = { id: 'fixture', language, expression: '歯磨き粉を絞り出す', meaning: '치약을 짜내다', reading: 'はみがきこを しぼりだす', date: '2026-11-16', vocabulary: [], notes: [], expressions: [{ text: '歯磨き粉を絞り出す', meaning: '치약을 짜내다', reading: 'はみがきこを しぼりだす', examples: [] }] };
    return route.fulfill({ json: url.pathname === '/api/lessons' ? { items: [item], nextOffset: null } : item });
  });
}
async function settings(page: Page) {
  await page.locator('.bento-toggle').click();
  await page.locator('.bento-panel button', { hasText: /^(App language|앱 언어)$/ }).click();
  await expect(page.locator('.app-language-view h1')).toBeVisible();
}
test('System follows Korean, explicit English persists, and signed-out settings supports Back', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: 'ko-KR', baseURL });
  const page = await context.newPage(); await fixture(page); await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.getByRole('link', { name: '카카오톡으로 시작하기 →' })).toBeVisible();
  await settings(page); await expect(page.locator('input[value=system]')).toBeChecked();
  await page.locator('input[value=en]').check();
  await expect(page.getByRole('heading', { name: 'App language', exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator('input[value=en]')).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(page.locator('.welcome')).toBeVisible();
  await settings(page); await page.locator('input[value=system]').check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.getByRole('heading', { name: '앱 언어', exact: true })).toBeVisible();
  await context.close();
});
test('unsupported system language falls back to English', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: 'fr-FR', baseURL }); const page = await context.newPage();
  await fixture(page); await page.goto('/'); await settings(page);
  await expect(page.locator('input[value=system]')).toBeChecked(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await context.close();
});
test('UI language preserves course, source text and practice state', async ({ page }) => {
  await fixture(page, true); const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/lessons?')) requests.push(new URL(request.url()).searchParams.get('language')!); });
  await page.goto('/'); await page.getByRole('button', { name: 'Japanese', exact: true }).click();
  await expect(page.locator('.lesson-card')).toBeVisible(); await settings(page); await page.locator('input[value=ko]').check();
  await page.getByRole('button', { name: '← 뒤로', exact: true }).click();
  await expect(page.getByRole('heading', { name: '일본어 표현', exact: true })).toBeVisible();
  await expect(page.locator('.lesson-card h2')).toHaveText('歯磨き粉を絞り出す');
  await expect(page.locator('.lesson-card .reading')).toHaveText('はみがきこを しぼりだす');
  await page.locator('.lesson-card').click(); await expect(page.locator('.reader-content > h1')).toHaveText('歯磨き粉を絞り出す');
  await page.getByRole('button', { name: '이 학습 자료 연습하기 →', exact: true }).click();
  await page.getByRole('button', { name: '뜻 보기', exact: true }).click();
  await settings(page); await page.locator('input[value=en]').check(); await page.goBack();
  await expect(page.getByRole('button', { name: 'Hide meaning', exact: true })).toBeVisible();
  await expect(page.locator('.practice h1')).toHaveText('歯磨き粉を絞り出す');
  await expect(page.locator('#practice-meaning')).toHaveText('치약을 짜내다'); expect(requests).toEqual(['ja']);
  await page.getByRole('link', { name: 'LinguaLoop home', exact: true }).click(); await expect(page.locator('.language-card')).toHaveCount(3);
});
test('System reacts to languagechange and choices synchronize across tabs', async ({ page, context }) => {
  await fixture(page); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(navigator, 'languages', { configurable: true, value: ['ko-KR'] }); window.dispatchEvent(new Event('languagechange')); });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  const other = await context.newPage(); await fixture(other); await other.goto('/'); await settings(other);
  await other.locator('input[value=en]').check(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await other.locator('input[value=ko]').check(); await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
});
test('unavailable storage defaults to System and still allows changing language', async ({ page }) => {
  await fixture(page); await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('Unavailable'); }; Storage.prototype.setItem = () => { throw new Error('Unavailable'); }; });
  await page.goto('/'); await settings(page); await expect(page.locator('input[value=system]')).toBeChecked();
  await page.locator('input[value=ko]').check(); await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.getByRole('button', { name: '← 뒤로', exact: true }).click();
  await expect(page.getByRole('link', { name: '카카오톡으로 시작하기 →' })).toBeVisible();
});
test('Korean loading, errors and release notices use the interface language', async ({ page }) => {
  await fixture(page, true); await page.addInitScript(() => localStorage.setItem('lingualoop-app-language', 'ko'));
  let release = () => {}; const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/lessons?**', async route => { await pending; await route.fulfill({ status: 503, json: { error: 'lessons_unavailable' } }); });
  await page.goto('/'); await page.getByRole('button', { name: '영어', exact: true }).click();
  await expect(page.getByRole('status', { name: '영어 학습 자료 불러오는 중', exact: true })).toBeVisible(); release();
  await expect(page.getByRole('alert')).toContainText('지금은 학습 자료를 불러올 수 없습니다.');
  await page.route('**/app-release.json', route => route.fulfill({ json: { id: '2100-01-01T00:00:00.000Z', message: 'New improvements', messageKo: '새로운 개선 사항' } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('complementary', { name: 'LinguaLoop 업데이트' })).toContainText('새로운 개선 사항');
  await expect(page.getByRole('button', { name: '지금 업데이트', exact: true })).toBeVisible();
});

test('signed-in language settings survive reload and Back/Forward', async ({ page }) => {
  await fixture(page, true); await page.goto('/'); await expect(page.locator('.language-card')).toHaveCount(3);
  await settings(page); await page.locator('input[value=ko]').check(); await page.reload();
  await expect(page.locator('.app-language-view h1')).toHaveText('앱 언어');
  await expect(page.locator('input[value=ko]')).toBeChecked();
  await page.goBack(); await expect(page.getByRole('button', { name: '일본어', exact: true })).toBeVisible();
  await page.goForward(); await expect(page.locator('.app-language-view h1')).toHaveText('앱 언어');
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain('치약');
});

test('invalid saved preference defaults to System and session network errors are localized', async ({ page }) => {
  await fixture(page); await page.addInitScript(() => { if (!localStorage.getItem('lingualoop-app-language')) localStorage.setItem('lingualoop-app-language', 'invalid'); });
  await page.goto('/'); await settings(page); await expect(page.locator('input[value=system]')).toBeChecked();
  await page.locator('input[value=ko]').check(); await page.getByRole('button', { name: '← 뒤로', exact: true }).click();
  await page.route('**/api/auth/me', route => route.abort()); await page.reload();
  await expect(page.getByRole('alert')).toContainText('로그인 정보를 불러오지 못했습니다.');
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
});
