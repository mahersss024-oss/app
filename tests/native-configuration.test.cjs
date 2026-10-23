const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const catalog = require("../src/core/market-catalog.json");
const coordinates = require("../src/core/city-coordinates.json");

function sourceModule(relative, imports, runtime = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const javascript = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(javascript, { module, exports: module.exports,
    require: id => { assert.ok(Object.hasOwn(imports, id), `Unexpected dependency ${id}`); return imports[id]; },
    ...runtime,
    setTimeout, clearTimeout,
  }, { filename });
  return module.exports;
}
class ApiError extends Error { constructor(status) { super(`API ${status}`); this.status = status; } }
function bootstrap(get) {
  return sourceModule("src/core/bootstrap.ts", { "./api": { api: { get }, ApiError }, "./market-catalog.json": catalog, "@tanstack/react-query": { useQuery: () => { throw new Error("No React runtime in configuration checks"); } } });
}
test("server bootstrap remains authoritative when available", async () => {
  const live = { ...catalog, siteMessage: { message: "server message" }, auth: { google: false, apple: true } };
  const controller = new AbortController();
  const { loadBootstrap } = bootstrap(async (url, _, { signal }) => {
    assert.equal(url, "/api/mobile/bootstrap"); assert.equal(signal, controller.signal); return live;
  });
  assert.equal(await loadBootstrap(controller.signal), live);
});
test("an undeployed bootstrap uses only the public catalog and reads Google availability", async () => {
  const calls = [];
  const { loadBootstrap } = bootstrap(async url => {
    calls.push(url);
    if (url === "/api/mobile/bootstrap") throw new ApiError(404);
    return { clientId: "public-client-id" };
  });
  const result = await loadBootstrap();
  assert.deepEqual(calls, ["/api/mobile/bootstrap", "/api/auth/google/native-config"]);
  assert.equal(result.categories.length, 40);
  assert.equal(new Set(result.categories.map(item => item.group)).size, 16);
  assert.equal(result.cities.length, 146);
  assert.equal(result.configurationSource, "bundled");
  assert.equal(result.auth.google, true); assert.equal(result.auth.apple, false);
  assert.equal(Object.hasOwn(result, "listings"), false);
  assert.equal(Object.hasOwn(result, "users"), false);
});
test("a server failure or authentication error cannot be hidden by fallback data", async () => {
  for (const failure of [new ApiError(401), new ApiError(503), new Error("network offline")]) {
    let calls = 0;
    const { loadBootstrap } = bootstrap(async () => { calls++; throw failure; });
    await assert.rejects(loadBootstrap(), error => error === failure);
    assert.equal(calls, 1);
  }
});
test("missing Google native configuration disables its login capability", async () => {
  const { loadBootstrap } = bootstrap(async url => { throw new ApiError(url.endsWith("bootstrap") ? 404 : 503); });
  const result = await loadBootstrap();
  assert.equal(result.auth.google, false); assert.equal(result.auth.apple, false);
});
test("Google cancellation stays on the sign-in screen and developer errors name the Android package", () => {
  const { isGoogleSignInSuccess, googleSignInErrorMessage } = sourceModule("src/core/native-auth.ts", {});
  assert.equal(isGoogleSignInSuccess({ type: "cancelled" }), false);
  assert.equal(isGoogleSignInSuccess({ type: "success" }), true);
  const message = googleSignInErrorMessage({ code: "10", message: "DEVELOPER_ERROR" }, "com.souqhamad.app.dev");
  assert.match(message, /com\.souqhamad\.app\.dev/);
  assert.match(message, /SHA-1/);
  assert.match(googleSignInErrorMessage({ code: "PLAY_SERVICES_NOT_AVAILABLE" }), /Google Play/);
});
function location(sdk) { return sourceModule("src/core/location.ts", { "expo-location": sdk, "./city-coordinates.json": coordinates }); }
test("nearest-city selection matches the website coordinates and rejects invalid fixes", () => {
  const { nearestMarketplaceCity } = location({});
  assert.equal(nearestMarketplaceCity(24.7136, 46.6753), "الرياض");
  assert.equal(nearestMarketplaceCity(21.4858, 39.1925), "جدة");
  assert.throws(() => nearestMarketplaceCity(NaN, 46));
  assert.throws(() => nearestMarketplaceCity(92, 46));
});
test("denied location access never asks for coordinates", async () => {
  const { getNearbyMarketplaceCity } = location({ requestForegroundPermissionsAsync: async () => ({ granted: false }) });
  await assert.rejects(getNearbyMarketplaceCity(), /لم يُسمح/);
});
test("current location is reduced to a city and never returned as coordinates", async () => {
  let called = 0;
  const { getNearbyMarketplaceCity } = location({
    Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: async () => ({ granted: true }),
    hasServicesEnabledAsync: async () => true, getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async options => { called++; assert.equal(options.accuracy, 3); return { coords: { latitude: 26.4207, longitude: 50.0888 } }; },
  });
  assert.equal(await getNearbyMarketplaceCity(), "الدمام"); assert.equal(called, 1);
});

test("listing-relative dates work on Hermes without Intl.RelativeTimeFormat", () => {
  const { formatRelativeListingTime } = sourceModule("src/core/presentation.ts", {}, {
    Intl: { NumberFormat: Intl.NumberFormat },
  });
  const minutesAgo = new Date(Date.now() - 6 * 60_000).toISOString();
  assert.match(formatRelativeListingTime(minutesAgo), /^منذ .*دقائق$/);
  assert.equal(formatRelativeListingTime("not-a-date"), "غير محدد");
});
