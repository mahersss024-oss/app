// Snapshot only public, pure catalog/policy modules. Never loads server config,
// environment files, sessions, providers, a database, or marketplace records.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const appRoot = path.resolve(__dirname, '..');
const serverRoot = path.resolve(process.env.SMARTSTORE_SERVER_ROOT || path.join(appRoot, '../SmartStoreAI'));
const allowed = new Set(['lib/marketplace/categories.ts', 'lib/marketplace/category-options.ts', 'lib/marketplace/car-models.ts', 'lib/marketplace/cities.ts', 'lib/platform/policies.ts']);
const cache = new Map();
function read(relative) {
  if (!allowed.has(relative)) throw new Error(`Catalog snapshot cannot import ${relative}`);
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(serverRoot, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  cache.set(relative, module.exports);
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    require: (id) => {
      if (!id.startsWith('.')) throw new Error(`Catalog snapshot cannot import ${id}`);
      const target = path.relative(serverRoot, path.resolve(path.dirname(filename), id + '.ts')).split(path.sep).join('/');
      return read(target);
    },
  }, { filename, timeout: 2000 });
  return module.exports;
}
const {marketplaceCategoryDefinitions} = read('lib/marketplace/categories.ts');
const {marketplaceCategoryOptionGroups, getMarketplaceCategoryOptionLabel, marketplaceCategoryOptionAttribute} = read('lib/marketplace/category-options.ts');
const {marketplaceCarModelsByBrand, marketplaceCarModelAttribute} = read('lib/marketplace/car-models.ts');
const {saudiMarketplaceCities} = read('lib/marketplace/cities.ts');
const {platformPolicies} = read('lib/platform/policies.ts');
const snapshot = {
  catalogDate: '2026-10-23',
  categories: marketplaceCategoryDefinitions.map(category => ({...category,
    options: marketplaceCategoryOptionGroups[category.id].options,
    optionKind: marketplaceCategoryOptionGroups[category.id].kind,
    optionLabel: getMarketplaceCategoryOptionLabel(category.id),
    ...(category.id === 'cars' ? {carModels: marketplaceCarModelsByBrand} : {}),
  })),
  cities: saudiMarketplaceCities,
  policies: platformPolicies,
  attributes: {categoryOption:marketplaceCategoryOptionAttribute,carModel:marketplaceCarModelAttribute},
};
const target = path.join(appRoot, 'src/core/market-catalog.json');
fs.writeFileSync(target, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
// Match the website's nearest-city behavior without evaluating the page module.
const page = fs.readFileSync(path.join(serverRoot, 'app/page.tsx'), 'utf8');
const coordinates = [...page.matchAll(/marketplaceCityCoordinate\('([^']+)',\s*([\d.]+),\s*([\d.]+)\)/g)]
  .map(([, city, latitude, longitude]) => ({ city, latitude: Number(latitude), longitude: Number(longitude) }))
  .filter(entry => saudiMarketplaceCities.includes(entry.city));
if (!coordinates.length) throw new Error('The public website city coordinates could not be read.');
fs.writeFileSync(path.join(appRoot, 'src/core/city-coordinates.json'), JSON.stringify(coordinates, null, 2) + '\n', 'utf8');
console.log(`Updated public catalog: ${snapshot.categories.length} categories, ${new Set(snapshot.categories.map(c=>c.group)).size} groups, ${snapshot.cities.length} cities.`);
