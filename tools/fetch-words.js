/* ============================================================
   fetch-words.js —— 词典抓取小工具（Node 18+，需要联网）

   为什么要有它：Collins / Oxford 的站点都没给 CORS 头，浏览器里的
   fetch 一定被拦，页面里没法直接在线查词。查词库查不到的外词，
   就用这个命令行工具抓下来，打包成一段 JSON，粘贴回阅读器的
   Import 里，就进了词库。

   数据来源（都是官网直连，抓回来的数据请遵守各站点的使用条款，
   仅供个人学习使用）。**推荐牛津 —— 快得多**：
     1 oxford    oxfordlearnersdictionaries.com（默认，推荐）
                 普通 HTTP 请求即可，支持并发，秒级出结果。
     2 collins   collinsdictionary.com
                 官网有 Cloudflare 防护，纯 HTTP 请求一律 403，
                 所以会用本机已装的 Chrome/Edge 开一个隐藏的真实
                 浏览器窗口来取页面（依赖 playwright-core，见下）。
                 慢：每个词约 10 秒，赶时间请用牛津。

   用法
     node tools/fetch-words.js --line="1 book run make"
     node tools/fetch-words.js book run make
     node tools/fetch-words.js --source=collins --file=my-words.txt
     node tools/fetch-words.js --source=oxford --file=w.txt --out=pack.json

   --line 是给 fetch-words.cmd 用的「一行式」写法：
     [dict] <word> <word> …
     dict 可省略：1 oxford（默认）   2 collins
     例：  1 book run
           2 scout resilient ledger
           mitigate                     （不写数字 = 牛津）

   抓完会自动把数据包复制到剪贴板（Windows/macOS/Linux 都支持），
   回到网页「导入 → 粘贴数据包」按 Ctrl+V 即可。

   掌握度 / 薄弱点不在这一步问了 —— 抓回来的词先进词库，之后在阅读器的
   「词库」里多选加进单词本时，再一个个填。

   依赖（只有柯林斯需要）：
     playwright-core + 本机 Chrome 或 Edge。
     在项目目录里执行一次：npm install playwright-core
     fetch-words.cmd 首次运行会自动帮你装。

   参数
     --line="<一行式>"         见上；给了它就忽略下面的单词参数
     --source=oxford|collins   默认 oxford（推荐，快）
     --file=<path>             按行读词（# 开头为注释）
     --out=<path>              同时写文件（默认只打到终端 + 剪贴板）
     --limit=N                 最多抓多少个
     --concurrency=N           牛津并发数，默认 4（柯林斯固定串行）
     --delay=MS               每个词抓完后的间隔，牛津默认 90，柯林斯默认 1200
   ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const { parseCollins } = require('./collins.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_SENSES = +(process.env.MAX_SENSES || 6);
const MAX_EXAMPLES = +(process.env.MAX_EXAMPLES || 3);
const MAX_COLLOS = +(process.env.MAX_COLLOS || 10);
const MAX_PV = +(process.env.MAX_PV || 6);   // 动词短语最多跟抓几个子页

/* ---------- args ---------- */
function arg(name, dflt) {
  const hit = process.argv.find(a => a === '--' + name || a.startsWith('--' + name + '='));
  if (!hit) return dflt;
  const i = hit.indexOf('=');
  return i < 0 ? true : hit.slice(i + 1);
}

const SOURCE_BY_NUM = { 1: 'oxford', 2: 'collins' };

/** 解密一行式：开头最多一个数字（词典编号），后面全是单词 */
function parseLine(raw) {
  const toks = String(raw).trim().split(/\s+/).filter(Boolean);
  const out = { words: toks, source: null, notes: [] };
  if (toks.length && /^\d+$/.test(toks[0])) {
    const n = parseInt(toks.shift(), 10);
    if (SOURCE_BY_NUM[n]) out.source = SOURCE_BY_NUM[n];
    else out.notes.push('词典编号 ' + n + ' 不认识（1 牛津 / 2 柯林斯）—— 已按牛津处理');
  }
  out.words = toks;
  return out;
}

const LINE = typeof arg('line') === 'string' ? parseLine(arg('line')) : null;

const SRC = String((LINE && LINE.source) || arg('source', 'oxford')).toLowerCase();
const LIMIT = +(arg('limit', 0)) || 0;
const CONC = Math.max(1, +(arg('concurrency', 4)) || 4);
const DELAY = arg('delay') != null ? (+(arg('delay', 0)) || 0)
                                  : (SRC === 'collins' ? 1200 : 90);

let words = (LINE ? LINE.words : process.argv.slice(2)
  .filter(a => !a.startsWith('--')))
  .map(s => String(s).trim().toLowerCase())
  .filter(Boolean);
if (arg('file')) {
  words = words.concat(fs.readFileSync(arg('file'), 'utf8').split('\n')
    .map(s => s.trim().toLowerCase())
    .filter(w => w && !w.startsWith('#')));
}
words = words.filter((w, i, a) => a.indexOf(w) === i);
if (LIMIT) words = words.slice(0, LIMIT);

if (LINE) {
  LINE.notes.forEach(n => console.log('! ' + n));
  console.log('→ ' + SRC + ' · ' + words.length + ' word(s)');
}

/* ---------- helpers ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function unesc(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (m, e) {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(n) ? m : String.fromCodePoint(n);
    }
    return m;
  });
}
function text(h) {
  return unesc(String(h).replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
}
function cleanDef(s) {
  return text(s)
    .replace(/^[\s·•]+/, '')
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function normPos(raw) {
  let p = text(raw).toLowerCase();
  p = p.replace(/\s+(a1|a2|b1|b1\+|b2|c1|c2)$/i, '').trim();
  return /^(noun|verb|adjective|adverb|pronoun|preposition|conjunction|determiner|quantifier|exclamation|modal|auxiliary)$/i.test(p) ? p : '';
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 英美拼写变体：词典站常只收一种拼法 ---------- */
function variants(w) {
  const out = [w];
  const add = x => { if (x && x !== w && out.indexOf(x) < 0) out.push(x); };
  if (/isation$/.test(w)) add(w.slice(0, -7) + 'ization');
  if (/ization$/.test(w)) add(w.slice(0, -7) + 'isation');
  if (/ise$/.test(w)) add(w.slice(0, -3) + 'ize');
  if (/ize$/.test(w)) add(w.slice(0, -3) + 'ise');
  if (/ised$/.test(w)) add(w.slice(0, -4) + 'ized');
  if (/ized$/.test(w)) add(w.slice(0, -4) + 'ised');
  if (/ising$/.test(w)) add(w.slice(0, -5) + 'izing');
  if (/izing$/.test(w)) add(w.slice(0, -5) + 'ising');
  if (/our(s|ed|ing)?$/.test(w)) add(w.replace('our', 'or'));
  if (/yse[ds]?$/.test(w)) add(w.replace('ys', 'yz'));
  if (/(tre|bre|vre)$/.test(w)) add(w.replace(/re$/, 'er'));
  if (/ll(ed|ing|er|ers|or)$/.test(w)) add(w.replace('ll', 'l'));
  return out;
}

/* ============================================================
   Oxford Learners：普通 HTTP 请求即可
   ============================================================ */

async function get(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, });
      // 4xx 是「这个词没有」，重试无意义，直接抛出交给上层换拼法
      if (r.status >= 400 && r.status < 500) {
        const e = new Error('HTTP ' + r.status); e.fatal = true; throw e;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      last = e;
      if (e.fatal) break;
      await sleep(500 * (i + 1));
    }
  }
  throw last;
}

function oxfordUrl(w) {
  return 'https://www.oxfordlearnersdictionaries.com/definition/english/' +
         encodeURIComponent(w.replace(/\s+/g, '-'));
}

function parseOxford(html, word) {
  /* Idioms / Phrases 是独立容器，里面同样有 <li class="sense">。
     以前整页扫 sense，就把这些习语的定义当成了这个单词的义项 —— 必须先切掉。 */
  let cut = html.length;
  ['<div class="idioms"', '<div class="phrases"'].forEach(function (mk) {
    const i = html.indexOf(mk);
    if (i >= 0 && i < cut) cut = i;
  });
  const mainHtml = html.slice(0, cut);

  const senses = [];
  let lastPos = '';

  // 词性：取该释义之前最近一次出现的 <span class="pos">
  const posAt = [];
  const pe = /<span class="pos"[^>]*>([^<]*)<\/span>/g;
  let pm;
  while ((pm = pe.exec(mainHtml))) posAt.push({ i: pm.index, p: normPos(text(pm[1])) });

  const re = /<li class="sense"[\s\S]*?(?=<li class="sense"|<\/ol>)/g;
  let m, guard = 0;
  while ((m = re.exec(mainHtml)) && guard++ < 60) {
    const blk = m[0];
    // 往前找最近一次出现的 pos
    let pos = '';
    for (let k = 0; k < posAt.length; k++) { if (posAt[k].i < m.index && posAt[k].p) pos = posAt[k].p; }
    if (pos) lastPos = pos; else pos = lastPos;
    /* Oxford 现在把等级写成 <li> 的属性（cefr="b1"）；老版页面是 <span class="cefr">，两种都认 */
    const ce = ((/\scefr="([^"]*)"/.exec(blk) || [])[1] ||
                (/<span class="cefr"[^>]*>([^<]*)<\/span>/.exec(blk) || [])[1] || '').trim().toUpperCase();
    const def = cleanDef((/<span class="def"[^>]*>([\s\S]*?)<\/span>/.exec(blk) || [])[1] || '');
    if (!def) continue;
    const ex = [];
    [...blk.matchAll(/<span class="x">([\s\S]*?)<\/span>/g)].forEach(function (x) {
      const q = text(x[1]).replace(/\s+/g, ' ').trim();
      if (q && ex.length < MAX_EXAMPLES) ex.push(q);
    });
    senses.push({ p: pos, l: ce, d: def, e: ex });
    if (senses.length >= MAX_SENSES) break;
  }
  if (!senses.length) return null;

  let ph = '';
  const br = /<div class="phons_br"[\s\S]*?<span class="phon">([^<]*)<\/span>/.exec(html) ||
            /<span class="phon">([^<]*)<\/span>/.exec(html);
  if (br) { ph = text(br[1]).trim(); if (ph && ph[0] !== '/') ph = '/' + ph + '/'; }

  // Oxford Collocations Dictionary 的结构是：
  //   <span class="unbox">verbs|adverb|preposition|phrases</span><ul class="collocs_list"><li>…</li></ul>
  // 标签决定词序：preposition 跟在词后（scrub off / resilient to），
  // 其余标签是放在词前的搭配词（be resilient / furiously scrub）；
  // phrases 一栏本身就是完整短语（freshly scrubbed），直接照用。
  const collos = [];
  const headRe = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'i');
  [...html.matchAll(/<span class="unbox">([^<]+)<\/span><ul class="collocs_list">([\s\S]*?)<\/ul>/g)]
    .forEach(function (g) {
      const label = text(g[1]).toLowerCase();
      const after = label.indexOf('preposition') >= 0 || label.indexOf('prep') >= 0;
      [...g[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].forEach(function (li) {
        const w = text(li[1]).replace(/\s+/g, ' ').trim();
        if (!w || w === '…' || w === '...') return;
        let phrase;
        if (headRe.test(w)) phrase = w;                          // 完整短语 / 已含词头
        else if (after) phrase = word + ' ' + w;                 // 介词后置
        else phrase = w + ' ' + word;                            // 动词/副词/形容词前置
        phrase = phrase.replace(/\s+/g, ' ').trim();
        if (collos.indexOf(phrase) < 0 && collos.length < MAX_COLLOS) {
          collos.push({ t: 'collocation', k: phrase, d: '', e: [] });
        }
      });
    });

  return {
    pos: [...new Set(senses.map(s => s.p))].filter(Boolean).join(' / '),
    ph: ph,
    S: senses.slice(0, MAX_SENSES),
    C: collos.concat(oxfordCombos(html)).slice(0, MAX_COLLOS * 2),
    wk: []
  };
}

/**
 * Oxford 的 Idioms / Phrases 是独立容器：
 *   <div class="idioms"><span class="idioms_heading">Idioms</span>
 *     <span class="idm-g" …><span class="idm">key</span> … <span class="def">释义</span>
 * phrases 一栏结构相同，只是 class 换成 phr / phrases。
 */
function oxfordCombos(html) {
  const out = [];
  [['idioms', 'idiom', 'idm'], ['phrases', 'phrase', 'phr']].forEach(function (spec) {
    const cls = spec[0], type = spec[1], key = spec[2];
    let from = 0;
    for (let n = 0; n < 40; n++) {
      const at = html.indexOf('<div class="' + cls + '"', from);
      if (at < 0) break;
      let end = html.length;
      ['<div class="idioms"', '<div class="phrases"'].forEach(function (mk) {
        const i = html.indexOf(mk, at + 1);
        if (i >= 0 && i < end) end = i;
      });
      const chunk = html.slice(at, end);
      chunk.split('class="' + key + '-g"').slice(1).forEach(function (g) {
        const km = new RegExp('<span class="' + key + '"[^>]*>([\\s\\S]*?)<\\/span>').exec(g);
        if (!km) return;
        const k = text(km[1]).replace(/\s+/g, ' ').trim();
        if (!k) return;
        const dm = /<span class="def"[^>]*>([\s\S]*?)<\/span>/.exec(g);
        const ex = [];
        [...g.matchAll(/<span class="x">([\s\S]*?)<\/span>/g)].forEach(function (x) {
          const q = text(x[1]).replace(/\s+/g, ' ').trim();
          if (q && ex.length < MAX_EXAMPLES) ex.push(q);
        });
        out.push({ t: type, k: k, d: dm ? cleanDef(dm[1]) : '', e: ex });
      });
      if (end >= html.length) break;
      from = end;
    }
  });
  return out;
}

/* ---------- 牛津动词短语：主页面只有链接，词条在各自的页面上 ----------
   <dt>Phrasal verbs</dt><dd><ul class="list-col">
     <a href="…/definition/english/account-for#account_pvg_1" …><span class='arl5'>account for something</span></a>
   …把链接收集起来，回头逐个抓那一页，取第一个义项的释义和例句。 */
function oxfordPhrasalLinks(html) {
  const out = [];
  const sec = /<dt>\s*Phrasal verbs\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/.exec(html);
  if (!sec) return out;
  [...sec[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].forEach(function (m) {
    const k = text(m[2]).replace(/\s+/g, ' ').trim();
    if (!k || out.some(x => x.k === k)) return;
    out.push({ href: m[1].split('#')[0], k: k });
  });
  return out;
}

/* ============================================================
   Collins：官网有 Cloudflare 防护，纯 HTTP 请求一律 403，
   所以用本机已装的 Chrome/Edge 开一个真实浏览器会话来取页面。
   关键点：不用 playwright 的 launch()（那会带上 navigator.webdriver
   自动化标记，Cloudflare 一眼识破），而是自己 spawn 浏览器进程 +
   CDP 调试端口连上去 —— 这样的浏览器指纹和人工打开没区别。
   浏览器窗口开在屏幕外（-32000,-32000），不会打扰使用者。
   ============================================================ */

function findBrowser() {
  if (process.env.COLLINS_BROWSER && fs.existsSync(process.env.COLLINS_BROWSER)) {
    return process.env.COLLINS_BROWSER;
  }
  const cands = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

let browserProc = null;
function killBrowser() {
  if (!browserProc) return;
  try { execSync('taskkill /pid ' + browserProc.pid + ' /T /F', { stdio: 'ignore' }); }
  catch (e) { try { browserProc.kill(); } catch (e2) {} }
  browserProc = null;
}
process.on('exit', killBrowser);
process.on('SIGINT', () => { killBrowser(); process.exit(130); });
process.on('SIGTERM', () => { killBrowser(); process.exit(143); });

/** 找 playwright-core：先按常规 require，再试几个常见安装位置
    （npm 全局目录、项目本地 node_modules、tools/node_modules 等），
    这样双击 fetch-words.cmd 时不用手动设 NODE_PATH */
function loadPlaywright() {
  try { return require('playwright-core'); } catch (e) {}
  const home = os.homedir();
  const dirs = [
    process.env.NODE_PATH || '',
    path.join(process.env.APPDATA || '', 'npm', 'node_modules'),
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
  ].filter(Boolean);
  for (const dir of dirs) {
    try { return require(path.join(dir, 'playwright-core')); }
    catch (e) { /* 这个位置没有，试下一个 */ }
  }
  throw new Error('柯林斯抓取需要 playwright-core：在项目目录里执行 ' +
    'npm install playwright-core（fetch-words.cmd 首次运行会自动装）');
}

let collinsPage = null;

async function openCollinsPage() {
  if (collinsPage) return collinsPage;
  const { chromium } = loadPlaywright();
  const exe = findBrowser();
  if (!exe) {
    throw new Error('找不到本机的 Chrome / Edge，可用环境变量 COLLINS_BROWSER 指定浏览器 exe 路径');
  }
  const port = 9333 + (process.pid % 500);
  const profile = path.join(os.tmpdir(), 'lexforge-collins-profile-' + port);
  console.error('→ 浏览器：' + exe.replace(/^.*[\\/]/, '') + '（柯林斯需要，窗口开在屏幕外）');
  browserProc = spawn(exe, [
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--window-position=-32000,-32000', '--window-size=1280,900',
    '--no-first-run', '--no-default-browser-check', 'about:blank',
    /* 严禁登录 / 同步：Chromium 系浏览器可能用系统账户自动登录新档案，
       这里把自动登录和同步全部关死 */
    '--disable-sync',
    '--disable-features=msImplicitSignin,msImplicitSigninEnabled,msAccountAutoSignin',
  ], { stdio: 'ignore' });

  let browser = null;
  for (let i = 0; i < 40; i++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:' + port); break; }
    catch (e) {
      if (browserProc.exitCode !== null) throw new Error('浏览器进程退出了');
      await sleep(500);
    }
  }
  if (!browser) throw new Error('连不上浏览器的调试端口');
  collinsPage = await browser.contexts()[0].newPage();
  collinsPage.setDefaultTimeout(45000);
  return collinsPage;
}

/** 打开一个柯林斯页面，等 Cloudflare 放行、等词条出现。
    返回页面 HTML；没有词条（站点查无此词）返回 null。 */
async function loadCollins(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  /* Cloudflare「Just a moment...」：等它自己放行，出现人机框就点一下 */
  for (let i = 0; i < 15; i++) {
    const t = await page.title();
    if (!/just a moment|attention required/i.test(t)) break;
    await sleep(2000);
    for (const f of page.frames()) {
      try {
        const cb = f.locator('input[type="checkbox"], .ctp-checkbox-label');
        if (await cb.count()) await cb.first().click({ timeout: 1500 }).catch(() => {});
      } catch (e) {}
    }
  }
  /* 词条可能还没渲染完，等它出现；等不到就是查无此词 */
  try {
    await page.waitForSelector('div.dictentry .cobuild, div.dictentry div.hom', { timeout: 10000 });
  } catch (e) { return null; }
  return await page.content();
}

/* ---------- 剪贴板：抓完自动复制数据包（Windows/macOS/Linux） ---------- */
function copyClipboard(s) {
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('clip', { input: s, stdio: ['pipe', 'ignore', 'ignore'] });
      return !r.error && r.status === 0;
    }
    if (process.platform === 'darwin') {
      spawnSync('pbcopy', { input: s, stdio: ['pipe', 'ignore', 'ignore'] });
      return true;
    }
    let r = spawnSync('xclip', ['-selection', 'clipboard'], { input: s, stdio: ['pipe', 'ignore', 'ignore'] });
    if (!r.error) return true;
    r = spawnSync('xsel', ['--clipboard', '--input'], { input: s, stdio: ['pipe', 'ignore', 'ignore'] });
    return !r.error && r.status === 0;
  } catch (e) { return false; }
}

/* ---------- main ---------- */
(async function () {
  if (!words.length) {
    console.log('用法: node tools/fetch-words.js --line="book run make"');
    console.log('  开头的数字是词典：[1] 牛津（默认，推荐）  [2] 柯林斯官网，后面跟任意多个单词');
    console.log('用法: node tools/fetch-words.js [--source=oxford|collins] [--file=words.txt] [--out=pack.json] word1 word2 …');
    console.log('输出是一个 word pack，抓完自动进剪贴板，在 LexForge 里用 Import → 粘贴数据包 加进词库。');
    return;
  }
  const out = [];
  let done = 0, miss = [];

  if (SRC === 'collins') {
    /* 柯林斯：真开浏览器，只能串行 */
    let cfHits = 0;
    const page = await openCollinsPage();
    for (const w of words) {
      try {
        let d = null;
        // 依次试原拼写和英美变体，第一个拿到义项的就用
        for (const cand of variants(w)) {
          const url = 'https://www.collinsdictionary.com/dictionary/english/' +
            encodeURIComponent(cand.replace(/\s+/g, '-'));
          let html = null;
          try { html = await loadCollins(page, url); } catch (e) { html = null; }
          if (/just a moment/i.test(await page.title().catch(() => ''))) cfHits++;
          if (html) {
            const got = parseCollins(html, cand);
            if (got && got.S && got.S.length) { d = got; break; }
          }
          if (DELAY) await sleep(DELAY);
        }
        if (!d) { miss.push(w); continue; }
        /* 动词短语：「See make for」只有链接，跟过去把释义抓回来 */
        const pvs = d.C.filter(c => c.t === 'phrasal' && c.href).slice(0, MAX_PV);
        for (const pv of pvs) {
          try {
            const sub = parseCollins(await loadCollins(page, pv.href), pv.k);
            if (sub && sub.S && sub.S.length) {
              pv.d = sub.S[0].d;
              pv.e = (sub.S[0].e || []).slice(0, 2);
            }
          } catch (e) { /* 这个短语页抓不到，跳过 */ }
          if (DELAY) await sleep(DELAY);
        }
        d.C.forEach(c => { delete c.href; });
        out.push({
          word: w, pos: d.pos, phonetic: d.ph,
          senses: d.S, combos: d.C, note: ''
        });
        process.stderr.write('  ✓ ' + w + '（' + d.S.length + ' 义项）\n');
      } catch (e) {
        miss.push(w);
        process.stderr.write('  ✗ ' + w + ' — ' + String(e.message || e).split('\n')[0] + '\n');
      }
      if (DELAY) await sleep(DELAY);
    }
    if (cfHits) console.error('（Cloudflare 验证出现 ' + cfHits + ' 次，均已等待放行）');
  } else {
    /* 牛津：普通请求，可并发 */
    const parse = parseOxford;
    await Promise.all(new Array(CONC).fill(0).map(async function () {
      while (done < words.length) {
        const w = words[done++];
        try {
          // 依次试原拼写和英美变体，第一个拿到义项的就用
          let d = null, html = null;
          for (const cand of variants(w)) {
            try {
              html = await get(oxfordUrl(cand));
              const got = parse(html, cand);
              if (got && (got.S || []).length) { d = got; break; }
            } catch (e) { /* 这个词站上没有，换下一个拼法 */ }
            if (DELAY) await sleep(DELAY);
          }
          if (!d) { miss.push(w); continue; }
          /* 跟着「Phrasal verbs」一节的链接，把动词短语的独立页抓回来 */
          const links = oxfordPhrasalLinks(html).slice(0, MAX_PV);
          for (const p of links) {
            try {
              const pv = parseOxford(await get(p.href), p.k);
              if (pv && pv.S && pv.S.length) {
                d.C.push({ t: 'phrasal', k: p.k, d: pv.S[0].d, e: pv.S[0].e || [] });
              }
            } catch (e) { /* 这个短语页面抓不到，跳过 */ }
            if (DELAY) await sleep(DELAY);
          }
          out.push({
            word: w, pos: d.pos, phonetic: d.ph,
            senses: d.S, combos: d.C, note: ''
          });
          process.stderr.write('  ✓ ' + w + '（' + d.S.length + ' 义项）\n');
        } catch (e) {
          miss.push(w);
          process.stderr.write('  ✗ ' + w + ' — ' + String(e.message || e).split('\n')[0] + '\n');
        }
        if (DELAY) await sleep(DELAY);
      }
    }));
  }

  out.sort((a, b) => a.word.localeCompare(b.word));
  const pack = { app: 'LexForge', kind: 'wordpack', source: SRC, count: out.length, words: out };
  const json = JSON.stringify(pack, null, 2);

  if (arg('out')) fs.writeFileSync(arg('out'), json, 'utf8');
  console.log(json);
  console.error('\n--- ' + SRC + ': ' + out.length + ' word(s) fetched' +
    (miss.length ? '; not found: ' + miss.join(', ') : '') +
    (arg('out') ? '; written to ' + arg('out') : '') + ' ---');
  console.error(copyClipboard(json)
    ? '（数据包已自动复制到剪贴板，回 LexForge：Import → 粘贴数据包，Ctrl+V 即可）'
    : '（自动复制剪贴板失败 —— 可手动复制上面的 JSON，或用 --out 写文件后打开复制）');
})();
