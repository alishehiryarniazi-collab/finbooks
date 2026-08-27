// i18n parity check — guarantees en / ur / ar stay perfectly in sync so the UI can never
// silently fall back to English (which would look like mixed languages) or crash on a missing
// key. Run with `npm run check:i18n`. Exits non-zero on any drift, so it can gate CI later.
//
// No dependencies — plain Node + the JSON files.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "src", "i18n");
const BASE = "en";
const LANGS = ["en", "ur", "ar"];

// Collect every leaf key path (e.g. "nav.invoices") from a nested object.
function keyPaths(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keyPaths(v, path));
    else out.push(path);
  }
  return out;
}

// Pull the {{placeholders}} out of a string so we can check they match across languages.
function placeholders(str) {
  if (typeof str !== "string") return [];
  return [...str.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

function valueAt(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const data = {};
for (const lang of LANGS) {
  try {
    data[lang] = JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8"));
  } catch (e) {
    console.error(`✗ ${lang}.json failed to parse: ${e.message}`);
    process.exit(1);
  }
}

const baseKeys = new Set(keyPaths(data[BASE]));
let problems = 0;

for (const lang of LANGS.filter((l) => l !== BASE)) {
  const keys = new Set(keyPaths(data[lang]));
  const missing = [...baseKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !baseKeys.has(k));

  if (missing.length) {
    problems += missing.length;
    console.error(`✗ ${lang}.json is MISSING ${missing.length} key(s) present in ${BASE}:`);
    missing.forEach((k) => console.error(`    - ${k}`));
  }
  if (extra.length) {
    problems += extra.length;
    console.error(`✗ ${lang}.json has ${extra.length} EXTRA key(s) not in ${BASE}:`);
    extra.forEach((k) => console.error(`    + ${k}`));
  }

  // Interpolation placeholders must match, or a translated line would drop a value.
  for (const k of baseKeys) {
    if (!keys.has(k)) continue;
    const a = placeholders(valueAt(data[BASE], k)).join(",");
    const b = placeholders(valueAt(data[lang], k)).join(",");
    if (a !== b) {
      problems++;
      console.error(`✗ ${lang}.json placeholder mismatch at "${k}": expected {${a}} got {${b}}`);
    }
  }
}

if (problems) {
  console.error(`\n✗ i18n check failed with ${problems} problem(s).`);
  process.exit(1);
}
console.log(`✓ i18n parity OK — ${baseKeys.size} keys match across ${LANGS.join(", ")}.`);
