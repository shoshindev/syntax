// Download the task pages from Rosetta Code and turn them into the JSON files the page loads.
// Usage: npm run data            (reuses pages already downloaded to .cache/rosetta)
//        npm run data:refresh    (downloads every page again)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundledLanguagesInfo, createHighlighter, createJavaScriptRegexEngine } from 'shiki';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'rosetta');
const OUT_DIR = path.join(ROOT, 'data');
const REFRESH = process.argv.includes('--refresh');
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const TASKS = [
  { id: 'hello', page: 'Hello world/Text', title: 'Hello world', blurb: 'Print “Hello world!” to the screen.' },
  { id: 'fizzbuzz', page: 'FizzBuzz', title: 'FizzBuzz',
    blurb: 'Print 1 to 100, but say Fizz for multiples of 3, Buzz for multiples of 5, and FizzBuzz for both.' },
  { id: 'quicksort', page: 'Sorting algorithms/Quicksort', title: 'Quicksort',
    blurb: 'Sort an array: pick a pivot, split the rest into smaller and larger items, then sort each side the same way.' },
  { id: 'anagrams', page: 'Anagrams', title: 'Anagrams',
    blurb: 'Read a word list and find the largest sets of words that use the same letters, like “angel” and “glean”.' },
  { id: 'life', page: "Conway's Game of Life", title: 'Game of Life',
    blurb: 'Simulate a grid of cells where each cell lives or dies based on how many of its eight neighbours are alive.' },
];

// ---------- Shiki language resolution ----------
const alias = new Map();
for (const l of bundledLanguagesInfo) {
  alias.set(l.id, l.id);
  for (const a of l.aliases || []) alias.set(a, l.id);
  alias.set(l.name.toLowerCase(), l.id);
}
const nameOf = Object.fromEntries(bundledLanguagesInfo.map((l) => [l.id, l.name]));
// Closest grammar for Rosetta lang attributes that Shiki has no grammar for.
const CUSTOM = {
  vb: ['qbasic', 'basic', 'freebasic', 'purebasic', 'futurebasic', 'qb64', 'bbcbasic', 'yabasic', 'runbasic', 'lb',
    'zxbasic', 'xbasic', 'smallbasic', 'gwbasic', 'basic256', 'is-basic', 'vbscript', 'vbnet', 'gambas', 'realbasic',
    'powerbasic', 'truebasic', 'tinybasic', 'applesoftbasic', 'applesoft', 'microsoftsmallbasic', 'iwbasic', 'glbasic',
    'gfabasic', 'blitzmax', 'b4x', 'rapidq', 'casiobasic', 'basic09', 'smilebasic', 'melonbasic', 'ns-hubasic', 'xojo'],
  pascal: ['delphi', 'modula2', 'modula3', 'oberon2', 'freepascal'],
  'fortran-free-form': ['fortran'],
  wolfram: ['mathematica'],
  r: ['rsplus'],
  matlab: ['octave', 'scilab'],
  java: ['processing', 'java5'],
  'common-lisp': ['picolisp', 'newlisp', 'xlisp', 'openlisp', 'cadlisp'],
  bat: ['dos', '4dos'],
  shellscript: ['ksh', 'csh'],
  fish: ['fishshell'],
  ocaml: ['sml'],
  haskell: ['miranda', 'idris', 'agda', 'frege', 'clean', 'curry'],
  asm: ['x86asm', 'arm', 'aarch64', 'z80', '360', '360asm', '6502asm', '8080asm', 'arm_assembly', 'mmix', 'sparc',
    'lc3asm', '68000devpac', 'macro11', 'macro-11', 'pasm', 'hla', 'vax', 'edsac'],
  sql: ['mysql'],
  html: ['html5'],
  xml: ['sgml'],
  coffee: ['livescript', 'coco'],
  python: ['coconut'],
  c: ['holyc', 'ec'],
  cpp: ['carbon'],
  smalltalk: ['pharo'],
  clojure: ['janet'],
};
for (const [target, list] of Object.entries(CUSTOM)) for (const a of list) if (!alias.has(a)) alias.set(a, target);
// Headers whose name collides with an unrelated grammar.
const HEADER_BLOCK = new Set(['fish', 'small', 'e', 'k', 'q', 'j', 'i', 'b', 'make']);

function resolveShiki(header, attr) {
  const h = header.toLowerCase();
  if (!HEADER_BLOCK.has(h) && alias.has(h)) return alias.get(h);
  const a = (attr || '').toLowerCase();
  if (HEADER_BLOCK.has(h) && a === h) return null;
  if (a && a !== 'text' && alias.has(a)) return alias.get(a);
  return null;
}

// ---------- wikitext parsing ----------
const HEAD_RE = /^(={2,6})\s*(.*?)\s*\1\s*$/;
const HEADER_TPL = /\{\{header\|([^}|]+)(?:\|([^}]+))?\}\}/i;
const CODE_RE = /<syntaxhighlight\b([^>]*)>([\s\S]*?)<\/syntaxhighlight>|<lang(?:\s+([^>\s]*))?[^>]*>([\s\S]*?)<\/lang>/gi;

const cleanHeading = (s) => s
  .replace(/\{\{header\|([^}|]+)(?:\|([^}]+))?\}\}/gi, (_, a, b) => (b || a))
  .replace(/\{\{[^}]*\}\}/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/'''?/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Split a page into sections: [{ level, heading, isLang, lang:{name, display}, body }]
function sections(text) {
  const out = [];
  let cur = { level: 1, heading: '', body: [] };
  for (const line of text.split('\n')) {
    const m = line.match(HEAD_RE);
    if (m) {
      out.push(cur);
      const tpl = m[2].match(HEADER_TPL);
      cur = {
        level: m[1].length,
        heading: cleanHeading(m[2]),
        lang: tpl ? { name: tpl[1].replace(/_/g, ' ').trim(), display: (tpl[2] || tpl[1]).replace(/_/g, ' ').trim() } : null,
        body: [],
      };
    } else cur.body.push(line);
  }
  out.push(cur);
  return out.map((s) => ({ ...s, body: s.body.join('\n') }));
}

function dedent(code) {
  const lines = code.replace(/\t/g, '    ').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0).replace(/\s+$/, '')).join('\n')
    // A few pages lost raw ESC characters to U+FFFD; show them the way shell code writes them.
    .replace(/\uFFFD\[/g, '\\e[').replace(/\uFFFD/g, '?');
}

// Code blocks in a chunk of wikitext, skipping blocks that are program output.
function codeBlocks(body) {
  const blocks = [];
  let last = 0;
  for (const m of body.matchAll(CODE_RE)) {
    const attrs = m[1] || '';
    const attr = m[1] !== undefined ? (attrs.match(/lang\s*=\s*"?([^"\s>]+)"?/i) || [])[1] || '' : (m[3] || '');
    const raw = m[1] !== undefined ? m[2] : m[4];
    const before = body.slice(last, m.index).slice(-240);
    last = m.index + m[0].length;
    const isTextish = !attr || /^(text|txt|none|output)$/i.test(attr);
    if (isTextish && /\{\{out|output|result|sample run|produces|prints/i.test(before)) continue;
    const code = dedent(raw);
    if (!code.trim()) continue;
    blocks.push({ attr: attr.toLowerCase(), code });
  }
  return blocks;
}

// ---------- downloading ----------
const pageCache = new Map();
const cacheFile = (title) => path.join(CACHE_DIR, title.replace(/'/g, '%27').replace(/ /g, '_').replace(/[/%]/g, '_') + '.wiki');
async function fetchPage(title) {
  const file = cacheFile(title);
  if (!REFRESH && fs.existsSync(file)) return pageCache.set(title, fs.readFileSync(file, 'utf8'));
  const url = `https://rosettacode.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=raw`;
  const res = await fetch(url, { headers: { 'User-Agent': 'syntax-side-by-side/1.0 (personal learning tool)' } });
  if (!res.ok) { console.warn(`Skipped ${title}: HTTP ${res.status}`); return pageCache.set(title, null); }
  const text = await res.text();
  fs.writeFileSync(file, text);
  console.log(`Downloaded ${title}`);
  await new Promise((r) => setTimeout(r, 300)); // be gentle with the wiki
  return pageCache.set(title, text);
}
// Some languages live on subpages ("See [[FizzBuzz/Basic]]"), so fetch those too.
for (const task of TASKS) {
  await fetchPage(task.page);
  const text = pageCache.get(task.page) || '';
  const subpages = new Set([...text.matchAll(/See \[\[([^\]|#]+)/g)].map((m) => m[1].trim()).filter((t) => t.startsWith(task.page + '/')));
  for (const sub of subpages) await fetchPage(sub);
}
const loadPage = (title) => pageCache.get(title) ?? null;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+#]/g, '');
const anchorOf = (s) => encodeURIComponent(s.replace(/ /g, '_')).replace(/%2F/g, '/');

// Resolve "See [[Task/Sub#Anchor]]" references to code on a subpage.
function resolveSee(body, task, langName, subheading) {
  const out = [];
  for (const m of body.matchAll(/See \[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|[^\]]*)?\]\]/g)) {
    const target = m[1].trim(), anchor = m[2]?.trim();
    if (!target.startsWith(task.page + '/')) continue;
    const text = loadPage(target);
    if (!text) continue;
    const secs = sections(text);
    const want = norm(anchor || langName);
    const lastSeg = target.slice(task.page.length + 1);
    let picked = secs.filter((s) => s.heading && norm(s.heading) === want);
    let useWhole = false;
    if (!picked.length) {
      if (anchor) continue;
      if (norm(lastSeg).startsWith(norm(langName)) || norm(langName).startsWith(norm(lastSeg)) || subheading) useWhole = true;
      else continue;
    }
    const src = useWhole ? secs : picked.flatMap((p) => {
      // include deeper sub-sections that follow the picked heading
      const i = secs.indexOf(p); const res = [p];
      for (let j = i + 1; j < secs.length && secs[j].level > p.level; j++) res.push(secs[j]);
      return res;
    });
    for (const s of src) {
      for (const b of codeBlocks(s.body)) {
        const label = [subheading, useWhole ? s.heading : (s === src[0] ? '' : s.heading)].filter(Boolean).join(' · ');
        out.push({ ...b, title: label, link: `https://rosettacode.org/wiki/${anchorOf(target)}${s.heading ? '#' + anchorOf(s.heading) : ''}` });
      }
    }
  }
  return out;
}

// ---------- column width ----------
// Width a solution needs, in monospace columns, ignoring comments (the page wraps those).
const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;
const cols = (s) => { let n = 0; for (const ch of s) n += WIDE.test(ch) ? 2 : 1; return n; };
const hl = await createHighlighter({ themes: ['github-light-default'], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) });
const loadedLangs = new Set();
function lineCodeCols(tokens) {
  let col = 0, end = 0;
  for (const t of tokens) {
    for (const p of t.explanation?.length ? t.explanation : [{ content: t.content, scopes: [] }]) {
      const w = cols(p.content);
      if (p.content.trim() && !p.scopes.some((s) => s.scopeName.startsWith('comment'))) end = col + w;
      col += w;
    }
  }
  return end;
}
async function codeWidth(code, lang) {
  if (lang) {
    try {
      if (!loadedLangs.has(lang)) { await hl.loadLanguage(lang); loadedLangs.add(lang); }
      const { tokens } = hl.codeToTokens(code, { lang, theme: 'github-light-default', includeExplanation: 'scopeName' });
      return Math.max(0, ...tokens.map(lineCodeCols));
    } catch (e) { console.warn('width fallback for', lang, e.message); }
  }
  return Math.max(0, ...code.split('\n').map(cols));
}

const report = {};
for (const task of TASKS) {
  const text = loadPage(task.page);
  const secs = sections(text);
  const langs = new Map();
  let cur = null;
  for (const s of secs) {
    if (s.lang) {
      const key = norm(s.lang.display) || norm(s.lang.name);
      cur = langs.get(key) || { name: s.lang.display, key, anchor: s.lang.name, sub: '', blocks: [], level: s.level };
      cur.level = s.level;
      langs.set(key, cur);
      cur.sub = '';
      for (const b of codeBlocks(s.body)) cur.blocks.push({ ...b, title: '' });
      cur.blocks.push(...resolveSee(s.body, task, s.lang.name, ''));
      continue;
    }
    if (!cur) continue;
    if (s.level <= cur.level) { cur = null; continue; } // a non-language section at the same level ends it
    const title = s.heading;
    for (const b of codeBlocks(s.body)) cur.blocks.push({ ...b, title });
    cur.blocks.push(...resolveSee(s.body, task, cur.anchor, title));
  }

  const languages = [];
  for (const l of langs.values()) {
    if (!l.blocks.length) continue;
    const solutions = l.blocks.map((b) => {
      const sol = { title: b.title || '', code: b.code, hl: resolveShiki(l.name, b.attr), w: 0 };
      if (b.link) sol.link = b.link;
      return sol;
    });
    // Number repeated titles so each option in the picker is distinct.
    const count = {};
    solutions.forEach((s) => { count[s.title] = (count[s.title] || 0) + 1; });
    const idx = {};
    solutions.forEach((s) => {
      if (count[s.title] > 1) { idx[s.title] = (idx[s.title] || 0) + 1; s.title = (s.title ? s.title + ' ' : 'Version ') + idx[s.title]; }
      if (!s.title) s.title = 'Solution';
    });
    for (const sol of solutions) sol.w = await codeWidth(sol.code, sol.hl);
    // Default to the first solution that isn't an explicitly outdated dialect.
    const def = Math.max(0, solutions.findIndex((s) => !/\b(python ?2|legacy|deprecated|obsolete)\b/i.test(s.title)));
    languages.push({ name: l.name, key: l.key, def, link: `https://rosettacode.org/wiki/${anchorOf(task.page)}#${anchorOf(l.anchor)}`, solutions });
  }
  languages.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }));
  const firstLines = languages.map((l) => l.solutions[l.def].code.split('\n').length).sort((a, b) => a - b);
  const median = firstLines[Math.floor(firstLines.length / 2)];
  const out = { id: task.id, title: task.title, page: task.page, blurb: task.blurb, median, languages };
  fs.writeFileSync(path.join(OUT_DIR, `${task.id}.json`), JSON.stringify(out));
  const highlighted = languages.filter((l) => l.solutions[l.def].hl).length;
  report[task.id] = { languages: languages.length, highlighted, median, kb: Math.round(JSON.stringify(out).length / 1024) };
}

// Index: tasks + highlighter display names, small enough to load up front.
const usedHl = new Set();
const names = {};
for (const t of TASKS) for (const l of JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${t.id}.json`))).languages) {
  names[l.key] ??= l.name;
  for (const s of l.solutions) if (s.hl) usedHl.add(s.hl);
}
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify({
  tasks: TASKS.map(({ id, title, blurb, page }) => ({ id, title, blurb, page, languages: report[id].languages, median: report[id].median })),
  hlNames: Object.fromEntries([...usedHl].sort().map((id) => [id, nameOf[id]])),
  names,
}));
console.table(report);
