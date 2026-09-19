'use strict';

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const VECTORS_DIR = path.join(ROOT, 'assets', 'vectors');
const CHARACTERS_DIR = path.join(ROOT, 'assets', 'characters');
const brandTokens = require(path.join(ROOT, 'assets', 'brand', 'brand-tokens.json'));

const CHARACTER_NAMES = {
  benny: 'Benny',
  luna: 'Luna',
  zippy: 'Zippy',
  professorOllo: 'Professor Ollo',
};

// Character key -> portrait asset filename slug (assets/characters/<slug>-face.png / -hero.png)
const CHARACTER_SLUGS = {
  benny: 'benny',
  luna: 'luna',
  zippy: 'zippy',
  professorOllo: 'ollo',
};

const svgCache = new Map();
const photoCache = new Map();
const partialsLoaded = new Set();
const compiledPageCache = new Map();

function loadSvgRaw(name) {
  if (svgCache.has(name)) return svgCache.get(name);
  const file = path.join(VECTORS_DIR, `${name}.svg`);
  const raw = fs.readFileSync(file, 'utf8');
  svgCache.set(name, raw);
  return raw;
}

function loadCharacterPhotoDataUri(key, variant) {
  const slug = CHARACTER_SLUGS[key];
  if (!slug) return '';
  const cacheKey = `${slug}-${variant}`;
  if (photoCache.has(cacheKey)) return photoCache.get(cacheKey);
  const file = path.join(CHARACTERS_DIR, `${slug}-${variant}.png`);
  const base64 = fs.readFileSync(file).toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;
  photoCache.set(cacheKey, dataUri);
  return dataUri;
}

function registerPartial(name) {
  if (partialsLoaded.has(name)) return;
  const file = path.join(TEMPLATES_DIR, 'partials', `${name}.hbs`);
  Handlebars.registerPartial(name, fs.readFileSync(file, 'utf8'));
  partialsLoaded.add(name);
}

// --- Helpers available inside every .hbs template ---

Handlebars.registerHelper('svg', function svgHelper(name) {
  if (!name) return '';
  return new Handlebars.SafeString(loadSvgRaw(name));
});

// {{characterPhoto character}} -> face crop (default) | {{characterPhoto character "hero"}} -> full portrait
Handlebars.registerHelper('characterPhoto', function characterPhotoHelper(key, ...rest) {
  const variant = typeof rest[0] === 'string' ? rest[0] : 'face';
  return loadCharacterPhotoDataUri(key, variant);
});

Handlebars.registerHelper('characterColor', function characterColorHelper(key) {
  const entry = brandTokens.characters[key];
  return entry ? entry.color : brandTokens.color.neutral.charcoal;
});

Handlebars.registerHelper('characterName', function characterNameHelper(key) {
  return CHARACTER_NAMES[key] || key;
});

Handlebars.registerHelper('year', function yearHelper() {
  return new Date().getFullYear();
});

// Repeats a block `n` times. Supports:
//   {{#times 5}} ... {{/times}}               -> keeps outer context
//   {{#times 5 someObject}} ... {{/times}}     -> block context becomes someObject
Handlebars.registerHelper('times', function timesHelper(n, ...rest) {
  const options = rest[rest.length - 1];
  const explicitContext = rest.length > 1 ? rest[0] : undefined;
  const context = explicitContext !== undefined ? explicitContext : this;
  let out = '';
  for (let i = 0; i < n; i += 1) {
    out += options.fn(context, { data: { index: i } });
  }
  return out;
});

registerPartial('page-header');
registerPartial('page-footer');

/**
 * Renders a single page template (e.g. "covers/front-cover") with the given data.
 * Compiled templates are cached by name for repeated use across a build run.
 */
function renderPage(templateName, data) {
  let compiled = compiledPageCache.get(templateName);
  if (!compiled) {
    const file = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
    const source = fs.readFileSync(file, 'utf8');
    compiled = Handlebars.compile(source);
    compiledPageCache.set(templateName, compiled);
  }
  return compiled(data);
}

module.exports = {
  Handlebars,
  brandTokens,
  renderPage,
  loadSvgRaw,
};
