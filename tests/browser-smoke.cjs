/* Development-only React Native Web preview checks. These fixtures never enter
 * the product bundle, never contain real credentials, and never reach production.
 * Run from this project root: node tests/browser-smoke.cjs
 * Prerequisite: a completed `pnpm export -- --platform web` in dist.
 * This is browser evidence only; it does not verify an Android/iPhone binary.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const catalog = require('../src/core/market-catalog.json');

const root = path.resolve(__dirname, '..');
const dist = path.resolve(root, 'dist');
const output = path.resolve(root, '.data/native-mobile');
const origin = 'http://127.0.0.1:8181';
const fixtureOrigin = 'https://souqhamad.com';
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('BLOCKED: dist/index.html is missing. Finish the web export before running this preview harness.');
  process.exit(2);
}

// Use the published local policy text itself, without starting the application,
// loading any configuration, accessing a database, or reading secret files.
function sourcePolicies() {
  return catalog.policies;
}
const policies = sourcePolicies();
const user = { id: 'test-mobile-buyer', email: 'mobile-preview@example.test', name: 'حساب اختبار المعاينة' };
const sellerId = 'test-mobile-seller';
const listingId = 'test-mobile-listing';
const conversationId = 'test-mobile-conversation';
const title = 'إعلان اختبار واجهة فقط';
const listing = {
  id: listingId, sellerId, title, description: 'بيانات اختبار واجهة فقط، ليست إعلانًا حقيقيًا ولا عرضًا للبيع.',
  category: 'cars', city: 'الرياض', condition: 'used', status: 'published', attributes: {},
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  views: 0, messageCount: 0, favoriteCount: 0,
  images: [{ id: 'test-pending-image', listingId, status: 'pending_review', isPrimary: true,
    originalUrl: `${fixtureOrigin}/test-assets/pending.svg`, displayUrl: `${fixtureOrigin}/test-assets/pending.svg`, thumbnailUrl: `${fixtureOrigin}/test-assets/pending.svg` }],
};
const seller = { id: sellerId, name: 'معلن اختبار المعاينة', publishedListingCount: 1, ratingAverage: 0, ratingCount: 0, followerCount: 0, listings: [listing] };
const conversation = { id: conversationId, listingId, sellerId, buyerId: user.id, status: 'open', listing,
  seller: { id: sellerId, name: seller.name }, buyer: user,
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  messages: [{ id: 'test-message', conversationId, senderId: sellerId, body: 'رسالة لاختبار الواجهة فقط', status: 'sent', type: 'text', reasons: [], metadata: {}, createdAt: '2026-10-01T10:00:00.000Z' }],
};
const pagination = { page: 1, limit: 24, hasMore: false, nextPage: null };
const bootstrap = {
  categories: catalog.categories, cities: catalog.cities, policies,
  limits: { maxListingImages: 8, maxImageBytes: 12582912, maxProfileImageBytes: 4194304, maxListingsPerSeller: 100 },
  auth: { google: true, apple: false }, policyVersions: {}, attributes: catalog.attributes, siteMessage: null,
};
const report = { boundary: 'React Native Web development preview with intercepted test fixtures; no native-device or production verification', startedAt: new Date().toISOString(), tests: [], browserErrors: [], consoleErrors: [], requests: [], blockedRemote: [], unexpectedApi: [], pendingImageRequests: [] };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function createStaticServer() {
  return http.createServer((request, response) => {
    const parsed = new URL(request.url, origin);
    const candidate = path.resolve(dist, `.${decodeURIComponent(parsed.pathname)}`);
    if (candidate !== dist && !candidate.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
    let file = candidate;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
}

async function fixtureContext(browser, authenticated, label) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, locale: 'ar-SA', serviceWorkers: 'block' });
  const state = { authenticated, favorite: false, favoriteReads: 0, conversationGets: 0, reports: [], sseId: 0, pendingImages: 0, similarFollowing: false };
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== fixtureOrigin) { report.blockedRemote.push({ scenario: label, url: request.url() }); return route.abort('blockedbyclient'); }
    if (url.pathname === '/test-assets/pending.svg') {
      state.pendingImages++;
      report.pendingImageRequests.push({ scenario: label, url: request.url() });
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#CBD5E1"/></svg>' });
    }
    if (!url.pathname.startsWith('/api/')) { report.blockedRemote.push({ scenario: label, url: request.url() }); return route.abort('blockedbyclient'); }
    let body;
    try { body = request.postDataJSON(); } catch { body = request.postData(); }
    const record = { scenario: label, method: request.method(), path: url.pathname, params: Object.fromEntries(url.searchParams), body };
    report.requests.push(record);
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Accept,Content-Type,Authorization,Idempotency-Key,X-Souq-Hamad-Commission-Agreement,Last-Event-ID', 'Cache-Control': 'no-store' };
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/api/auth/session') return json({ authenticated: state.authenticated, user: state.authenticated ? user : null, commissionAgreementAccepted: state.authenticated });
    if (url.pathname === '/api/mobile/bootstrap') return label === 'bootstrap-fallback'
      ? route.fulfill({ status: 404, contentType: 'text/html', headers, body: '<!doctype html><title>Not found</title>' })
      : json(bootstrap);
    if (url.pathname === '/api/auth/google/native-config') return json({ clientId: 'preview-public-client-id' });
    if (url.pathname === '/api/realtime/stream') return route.fulfill({ status: 200, contentType: 'text/event-stream', headers, body: `event: smartstore\nid: ${++state.sseId}\ndata: ${JSON.stringify({ id: state.sseId, type: 'ad_updated', occurredAt: new Date().toISOString(), payload: { listingId } })}\n\n` });
    if (url.pathname === '/api/marketplace/listings' && request.method() === 'GET') {
      const sort = url.searchParams.get('sort');
      if (sort && !['best_match', 'cheapest', 'newest', 'closest', 'best_condition', 'lowest_mileage'].includes(sort)) return json({ error: 'invalid_search_filters' }, 400);
      if (label === 'bootstrap-fallback') return json({ listings: [], pagination });
      return json({ listings: [listing], pagination });
    }
    if (url.pathname === `/api/marketplace/listings/${listingId}` && request.method() === 'GET') return json({ listing });
    if (url.pathname === `/api/marketplace/listings/${listingId}/favorite`) {
      if (request.method() === 'POST') { state.favorite = !state.favorite; return json({ status: state.favorite ? 'saved' : 'removed' }); }
      return json({ listingId, isFavorite: state.favorite, canFavorite: true });
    }
    if (url.pathname === `/api/marketplace/listings/${listingId}/similar-follow`) {
      if (request.method() === 'POST') state.similarFollowing = !state.similarFollowing;
      return json({ status: state.similarFollowing ? 'followed' : 'unfollowed', isFollowing: state.similarFollowing, canFollow: true });
    }
    if (url.pathname === `/api/marketplace/listings/${listingId}/reports`) { if (request.method() === 'POST') { state.reports.push(body); return json({ status: 'reported' }, 201); } return json({ isReported: false }); }
    if (url.pathname === `/api/marketplace/users/${sellerId}/profile`) return json({ seller });
    if (url.pathname === `/api/marketplace/users/${sellerId}/follow`) return json({ isFollowing: false, followerCount: 0, canFollow: true });
    if (url.pathname === `/api/marketplace/users/${sellerId}/ratings`) return json({ ratingAverage: 0, ratingCount: 0, canRate: true });
    if (url.pathname === '/api/marketplace/me/favorites') { state.favoriteReads++; return json({ favorites: state.favorite ? [{ id: 'test-favorite', listingId, listing }] : [], pagination }); }
    if (url.pathname === '/api/marketplace/me/conversations') return json({ conversations: [conversation], pagination });
    if (url.pathname === `/api/marketplace/conversations/${conversationId}` && request.method() === 'GET') { state.conversationGets++; return json({ conversation, blockStatus: { blocked: false, blockedByMe: false } }); }
    if (url.pathname === '/api/notifications') return json({ notifications: [], unreadCount: 0 });
    if (url.pathname === '/api/marketplace/me/follows') return json({ following: [], followers: [], similarListingFollows: state.similarFollowing ? [{ id: 'test-similar-follow', userId: user.id, listingId, createdAt: new Date().toISOString(), listing }] : [], followingCount: 0, followerCount: 0, similarListingFollowCount: state.similarFollowing ? 1 : 0 });
    if (url.pathname === '/api/marketplace/me/listings') return json({ listings: [], pagination });
    if (url.pathname === '/api/marketplace/me/commissions') return json({ commissions: [], pagination });
    if (url.pathname === '/api/marketplace/commission-payment-methods') return json({ paymentMethods: [] });
    report.unexpectedApi.push(record);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => report.browserErrors.push({ scenario: label, message: error.message }));
  page.on('console', message => { if (message.type() === 'error' && !(label === 'bootstrap-fallback' && message.text().includes('responded with a status of 404'))) report.consoleErrors.push({ scenario: label, message: message.text() }); });
  return { context, page, state };
}

async function runCase(name, callback) {
  const started = Date.now();
  try { await callback(); report.tests.push({ name, status: 'passed', durationMs: Date.now() - started }); console.log(`PASS ${name}`); }
  catch (error) { report.tests.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.stack || String(error) }); console.error(`FAIL ${name}: ${error.message}`); }
}

async function screenshot(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }); }

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createStaticServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8181, '127.0.0.1', resolve); });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await runCase('guest home matches the native web hierarchy, horizontal cards, centered tabs, and floating Hamad', async () => {
      const { context, page, state } = await fixtureContext(browser, false, 'guest-home');
      try {
        await page.goto(origin);
        const card = page.getByRole('button', { name: title, exact: true });
        await expect(card).toBeVisible(); await expect(page.getByLabel('البحث في السوق')).toBeVisible();
        await expect(page.getByLabel('فتح حمد')).toBeVisible();
        const cardLayout = await card.evaluate(element => ({ flexDirection: getComputedStyle(element).flexDirection, image: element.children[0]?.getBoundingClientRect().width }));
        assert.equal(cardLayout.flexDirection, 'row-reverse'); assert.equal(Math.round(cardLayout.image), 100);
        const tabBoxes = await Promise.all(['إعلاناتي', 'محادثاتي', 'الرئيسية', 'المفضلة', 'حسابي'].map(async name => page.getByRole('button', { name, exact: true }).boundingBox()));
        assert.ok(tabBoxes[0].x > tabBoxes[1].x && tabBoxes[1].x > tabBoxes[2].x && tabBoxes[2].x > tabBoxes[3].x && tabBoxes[3].x > tabBoxes[4].x, 'Tabs must match the web right-to-left order with home centered');
        assert.equal(state.pendingImages, 0, 'Unapproved images must not load on public market cards'); await screenshot(page, 'home');
        const bubble = page.getByLabel('فتح حمد'); const before = await bubble.boundingBox();
        await page.mouse.move(before.x + 32, before.y + 32); await page.mouse.down(); await page.mouse.move(before.x - 148, before.y + 100, { steps: 8 }); await page.mouse.up();
        await expect.poll(async () => (await bubble.boundingBox()).x).toBeLessThan(before.x - 15);
        const moved = await bubble.boundingBox(); await page.reload(); await expect(page.getByLabel('فتح حمد')).toBeVisible();
        await expect.poll(async () => (await page.getByLabel('فتح حمد').boundingBox()).x).toBeGreaterThan(moved.x - 8);
        await page.getByLabel('فتح حمد').click(); await expect(page.getByText('كيف أساعدك؟', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
        await page.getByLabel('رجوع', { exact: true }).click();
        await page.getByRole('button', { name: 'سيارات ومركبات', exact: true }).click();
        await page.getByRole('button', { name: 'السيارات', exact: true }).click();
        await expect(page.getByRole('button', { name: 'تويوتا', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'تويوتا', exact: true }).click();
        await expect(page.getByRole('button', { name: 'كامري', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'كامري', exact: true }).click();
        await expect.poll(() => report.requests.findLast(request => request.scenario === 'guest-home' && request.path === '/api/marketplace/listings' && request.params.carModel)?.params).toMatchObject({ category: 'cars', categoryOption: 'toyota', carModel: 'camry' });
      } finally { await context.close(); }
    });
    await runCase('search category city and cheapest use valid server query parameters', async () => {
      const { context, page } = await fixtureContext(browser, false, 'search-filters');
      try {
        await page.goto(origin); await page.getByLabel('البحث في السوق').fill('اختبار واجهة');
        await expect.poll(() => report.requests.some(r => r.scenario === 'search-filters' && r.path === '/api/marketplace/listings' && r.params.q === 'اختبار واجهة')).toBe(true);
        await page.getByLabel('تصفية النتائج').click();
        await page.getByRole('button', { name: 'المجموعة: الكل', exact: true }).click();
        await page.getByText('سيارات ومركبات', { exact: true }).last().click();
        await page.getByRole('button', { name: 'القسم الفرعي: الكل', exact: true }).click();
        await page.getByText('السيارات', { exact: true }).last().click();
        await page.getByRole('button', { name: 'المدينة: الكل', exact: true }).click();
        await page.getByText('جدة', { exact: true }).last().click();
        await page.getByRole('button', { name: 'ترتيب النتائج: الأكثر صلة', exact: true }).click();
        await page.getByText('الأقل سعرًا', { exact: true }).last().click();
        await page.getByPlaceholder('أقل سعر').fill('١٠٠٠٠'); await page.getByPlaceholder('أعلى سعر').fill('٥٠٠٠٠');
        await page.getByPlaceholder('1900').fill('٢٠٢٠'); await page.getByPlaceholder('2099').fill('٢٠٢٤');
        await page.getByPlaceholder('0', { exact: true }).fill('٠'); await page.getByPlaceholder('بدون حد').fill('١٢٠٠٠٠');
        await page.getByRole('button', { name: 'عرض النتائج', exact: true }).click();
        await expect.poll(() => report.requests.findLast(r => r.scenario === 'search-filters' && r.path === '/api/marketplace/listings' && r.params.city === 'جدة')?.params).toMatchObject({ q: 'اختبار واجهة', category: 'cars', city: 'جدة', sort: 'cheapest', minPrice: '10000', maxPrice: '50000', yearMin: '2020', yearMax: '2024', mileageMin: '0', mileageMax: '120000', page: '1', limit: '24' });
        await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
      } finally { await context.close(); }
    });
    await runCase('public bootstrap 404 uses the complete bundled catalog and returns no fixture listings', async () => {
      const { context, page } = await fixtureContext(browser, false, 'bootstrap-fallback');
      try {
        await page.goto(origin);
        await expect(page.getByLabel('البحث في السوق')).toBeVisible();
        await page.getByRole('button', { name: 'سيارات ومركبات', exact: true }).click();
        await expect(page.getByRole('button', { name: 'السيارات', exact: true })).toBeVisible();
        assert.equal(catalog.categories.length, 40); assert.equal(new Set(catalog.categories.map(item => item.group)).size, 16);
        const inventory = report.requests.filter(request => request.scenario === 'bootstrap-fallback' && request.path === '/api/marketplace/listings');
        assert.ok(inventory.length > 0); assert.deepEqual(inventory.at(-1).params.category, undefined);
        await expect.poll(() => report.requests.some(request => request.scenario === 'bootstrap-fallback' && request.path === '/api/marketplace/listings' && request.params.categories)).toBe(true);
        await expect(page.getByText('لا توجد إعلانات متاحة', { exact: true })).toBeVisible();
      } finally { await context.close(); }
    });
    await runCase('guest tabs offer real login routes and creation choices stay native UI', async () => {
      const { context, page } = await fixtureContext(browser, false, 'guest-tabs');
      try {
        for (const pathname of ['/listings', '/messages', '/favorites', '/account']) {
          await page.goto(origin + pathname); await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
          if (pathname === '/account') await screenshot(page, 'account');
          await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click(); await expect(page).toHaveURL(/\/auth$/); await expect(page.getByRole('button', { name: 'المتابعة باستخدام Google', exact: true })).toBeVisible();
        }
        await page.goto(origin + '/auth');
        const googleButton = page.getByRole('button', { name: 'المتابعة باستخدام Google', exact: true });
        await expect(googleButton).toBeEnabled();
        await googleButton.click();
        await expect(page.getByText('حدّد مربع الموافقة على الشروط ورسوم المنصة قبل تسجيل الدخول.', { exact: true })).toBeVisible();
        await page.getByRole('checkbox').click();
        await expect(googleButton).toBeEnabled();
        await page.goto(origin + '/create'); await expect(page.getByText('أدخل التفاصيل بنفسك', { exact: true })).toBeVisible(); await expect(page.getByText('أنشئ مع حمد', { exact: true })).toBeVisible(); await screenshot(page, 'creation-guest');
        await page.getByText('أدخل التفاصيل بنفسك', { exact: true }).click(); await expect(page.getByText('سجّل الدخول لإنشاء إعلانك', { exact: true })).toBeVisible();
      } finally { await context.close(); }
    });
    await runCase('policy UI displays original local policy text from intercepted bootstrap', async () => {
      const { context, page } = await fixtureContext(browser, false, 'policy');
      try { await page.goto(origin + '/policies/terms'); await expect(page.getByText(policies.terms.sections[0].body, { exact: true })).toBeVisible(); await expect(page.getByText(`آخر تحديث: ${policies.terms.updatedAt}`, { exact: true })).toBeVisible(); } finally { await context.close(); }
    });
    await runCase('authenticated detail reports other/details and refreshes favorite cache', async () => {
      const { context, page, state } = await fixtureContext(browser, true, 'detail-actions');
      try {
        await page.goto(origin + '/favorites'); await expect(page.getByText('مفضلتك تنتظر أول فرصة', { exact: true })).toBeVisible(); const before = state.favoriteReads;
        // Stay in the same root/provider instance so this exercises cached list
        // invalidation rather than getting a fresh cache from a page reload.
        await page.getByText('الرئيسية', { exact: true }).last().click();
        await page.getByRole('button', { name: title, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/listings/${listingId}$`));
        await expect(page.getByText(title, { exact: true }).filter({ visible: true })).toBeVisible(); await expect(page.getByText('بدون صور', { exact: true }).filter({ visible: true })).toBeVisible(); assert.equal(state.pendingImages, 0, 'Pending image must not load in detail/gallery'); await screenshot(page, 'detail');
        await page.getByRole('button', { name: 'تابع الإعلانات المشابهة', exact: true }).click(); await expect.poll(() => state.similarFollowing).toBe(true);
        await expect(page.getByText('سيصلك تنبيه عند نشر إعلان مشابه بدرجة قوية.', { exact: true })).toBeVisible();
        assert.equal(report.requests.filter(request => request.scenario === 'detail-actions' && request.path === `/api/marketplace/listings/${listingId}/similar-follow` && request.method === 'POST').length, 1);
        await page.getByLabel('حفظ في المفضلة', { exact: true }).click(); await expect.poll(() => state.favorite).toBe(true);
        await page.getByRole('button', { name: 'الإبلاغ عن الإعلان', exact: true }).click(); await page.getByRole('textbox').fill('بلاغ اختبار واجهة فقط'); await page.getByRole('button', { name: 'إرسال البلاغ', exact: true }).click();
        await expect.poll(() => state.reports.length).toBe(1); assert.deepEqual(state.reports[0], { reason: 'other', details: 'بلاغ اختبار واجهة فقط' });
        await page.getByLabel('رجوع', { exact: true }).filter({ visible: true }).click();
        await page.getByText('المفضلة', { exact: true }).last().click();
        await expect(page).toHaveURL(/\/favorites$/);
        await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible(); assert.ok(state.favoriteReads > before, 'Favorite list must re-read after the mutation'); assert.equal(state.pendingImages, 0);
      } finally { await context.close(); }
    });
    await runCase('conversation GET stops while route is blurred and while AppState is background', async () => {
      const { context, page, state } = await fixtureContext(browser, true, 'conversation-privacy');
      try {
        await page.goto(origin + `/conversations/${conversationId}`); await expect(page.getByText('رسالة لاختبار الواجهة فقط', { exact: true })).toBeVisible(); assert.ok(state.conversationGets > 0);
        await page.getByLabel('خيارات المحادثة', { exact: true }).click(); await page.getByRole('button', { name: 'صفحة المعلن', exact: true }).click(); await expect(page.getByText('صفحة المعلن', { exact: true }).filter({ visible: true })).toBeVisible();
        await page.waitForTimeout(250); const blurredReads = state.conversationGets; await page.waitForTimeout(3200); assert.equal(state.conversationGets, blurredReads, 'A blurred mounted conversation must ignore realtime invalidations');
        await page.getByLabel('رجوع', { exact: true }).filter({ visible: true }).click(); await expect(page.getByText('رسالة لاختبار الواجهة فقط', { exact: true }).filter({ visible: true })).toBeVisible();
        await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(250); const backgroundReads = state.conversationGets; await page.waitForTimeout(2400); assert.equal(state.conversationGets, backgroundReads, 'Background app must not mark messages as read');
        await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
        await expect.poll(() => state.conversationGets).toBeGreaterThan(backgroundReads);
      } finally { await context.close(); }
    });
    await runCase('no unexpected API, unapproved image, remote page, or browser exception escaped fixtures', async () => {
      assert.deepEqual(report.unexpectedApi, []);
      assert.deepEqual(report.blockedRemote, []);
      assert.deepEqual(report.pendingImageRequests, []);
      assert.deepEqual(report.browserErrors, []);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    report.finishedAt = new Date().toISOString();
    report.passed = report.tests.filter(test => test.status === 'passed').length;
    report.failed = report.tests.filter(test => test.status === 'failed').length;
    fs.writeFileSync(path.join(output, 'browser-smoke-result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ boundary: report.boundary, passed: report.passed, failed: report.failed, screenshotDirectory: output, result: path.join(output, 'browser-smoke-result.json') }, null, 2));
    if (report.failed) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
