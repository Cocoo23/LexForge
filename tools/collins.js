/* ============================================================
   collins.js — collinsdictionary.com 官网页面 → 结构化词条
   被 fetch-words.js 使用，解析逻辑只有这一份。

   输入是官网整页 HTML。柯林斯官网有 Cloudflare 防护，程序化抓取
   需要真实浏览器（见 fetch-words.js 的 collins 分支），这里只负责解析。

   页面结构要点（都是踩过坑的）：
   · 一页并排好几部词典。COBUILD 的内容全在 class 含
     "cB cB-def cobuild" 的容器块里，而且可能被拆成多个相邻块
     （比如 make 的 28 个义项分在 6 块、动词短语另占 1 块），
     所以要把这些块全部收集起来再解析；
   · 词性有两种写法：<span class="gramGrp pos">countable noun</span>
     和 <span class="gramGrp"><span class="pos">verb</span> …</span>；
   · 释义有两种写法：<div class="sense"><div class="def">… 和
     合并的 <div class="sense def">…；
   · CEFR 等级是义项 gramGrp 里的
     <a data-type="B1+" class="Symbollbcefrb">B1+</a>
     （data-type 在 class 前面！不在学习者词表里的词没有这个徽章）；
   · 词频带是 word-frequency-img 上的 data-band 属性；
   · 短语 / 习语 / 动词短语是 <div class="re type-…"> 的「See xxx」
     交叉链接，没有内联释义 —— 动词短语的释义由 fetch-words.js
     跟着链接去各自页面补齐；
   · COBUILD Collocations 在 class 含 "cB cB-rel-t" 的容器里；
   · 这些容器的 class 后面几乎都跟着 data-* 属性，所以所有
     class 正则必须匹配到整个开标签（…"[^>]*>），只匹配到引号
     会把属性垃圾带进内容。

   输出（义项 / 组合的结构与站点无关，方便上层统一处理）：
     { pos, ph, bd, ce,
       S: [{ p, l, d, e: [] }],                 // 义项：词性/等级/释义/例句
       C: [{ t, k, d, e: [], href? }] }         // 组合：类型/组合/释义/例句
   t 取值：phrase（短语）| phrasal（动词短语）| idiom（习语）| collocation（搭配）
   ============================================================ */
'use strict';

/* ---------- HTML 工具 ---------- */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function unescape(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (m, e) {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(n) ? m : String.fromCodePoint(n);
    }
    return m;
  });
}

function text(html) {
  return unescape(String(html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** 取第一个匹配开标签的那个元素的内部 HTML（按同名标签配平） */
function inner(html, openRe) {
  const m = openRe.exec(html);
  if (!m) return '';
  const tag = (html.slice(m.index + 1).match(/^[a-z]+/i) || ['div'])[0].toLowerCase();
  const rest = html.slice(m.index);
  const token = /<\/?([a-z]+)(\s|>|\/)/gi;
  let depth = 0, t;
  while ((t = token.exec(rest))) {
    if (t[1].toLowerCase() !== tag) continue;
    if (rest.charAt(t.index + 1) === '/') {
      depth--;
      if (depth === 0) return rest.slice(m[0].length, t.index);
    } else depth++;
  }
  return '';
}

/** 取所有该类元素的内部 HTML（不嵌套同类元素的情况下够用） */
function allInner(html, openRe) {
  const tag = (html.match(openRe) || [''])[0].match(/^<([a-z]+)/i);
  const tagName = tag ? tag[1].toLowerCase() : 'div';
  const out = [];
  let rest = html;
  for (let guard = 0; guard < 400; guard++) {
    const m = openRe.exec(rest);
    if (!m) break;
    const token = /<\/?([a-z]+)(\s|>|\/)/gi;
    let depth = 0, end = -1, t;
    token.lastIndex = 0;
    while ((t = token.exec(rest.slice(m.index)))) {
      if (t[1].toLowerCase() !== tagName) continue;
      const at = m.index + t.index;
      if (rest[at + 1] === '/') { depth--; if (depth === 0) { end = at; break; } }
      else depth++;
    }
    if (end < 0) break;
    out.push(rest.slice(m.index + m[0].length, end));
    rest = rest.slice(end);
  }
  return out;
}

function cleanDef(s) {
  return text(s)
    .replace(/^[\s·•]+/, '')
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 真正的词性白名单 —— 里面没有 phrase：那是「组合」不是词性 */
const POS_OK = /^(noun|verb|adjective|adverb|pronoun|preposition|conjunction|determiner|quantifier|exclamation|number|ordinal|ordinal number|prefix|suffix|combining form|modal|auxiliary|article|interjection|convention|colour|color|letter)$/i;

/* 词性前面常带限定语：variable / countable / transitive …，剥掉后才是真词性 */
const POS_MOD = /^(variable|countable|uncountable|singular|plural|proper|common|transitive|intransitive|linking|phrasal|mass|attributive|predicative|auxiliary|modal)\s+/;

function normPos(raw) {
  let p = text(raw).toLowerCase();
  p = p.replace(/\s+(a1|a2|b1|b1\+|b2|c1|c2)$/i, '').trim();
  let guard = 0;
  while (POS_MOD.test(p) && guard++ < 6) p = p.replace(POS_MOD, '').trim();
  if (/^phrasal verb$/.test(text(raw).toLowerCase())) return '';
  return POS_OK.test(p) ? p : '';
}

/* ---------- 音标：把重音音节 <span class="hi rend-u"> 转成 IPA 的 ˈ ---------- */

const IPA_V = 'ɑɒɔəɜɪʊʌæɐɘɵɤœøaeiouy';
const VOWEL_UNIT = /(?:eɪ|aɪ|ɔɪ|əʊ|aʊ|ɪə|eə|ʊə|[ɑɒɔəɜɪʊʌæɐɘɵɤœøaeiouy]ː?)/g;

function stress(html) {
  const plain = text(html.replace(/<[^>]*>/g, ''));
  if ((plain.match(VOWEL_UNIT) || []).length < 2) return plain;
  const MARK = '\u0001';
  let s = text(html.replace(/<span class="hi rend-u">([\s\S]*?)<\/span>/g, MARK + '$1'));
  s = s.replace(new RegExp('((?:[^' + IPA_V + MARK + '])+)' + MARK), MARK + '$1');
  return s.split(MARK).join('ˈ');
}

/* ---------- 主解析 ---------- */

const MAX_SENSES = 36;
const MAX_SENSE_EX = 4;
const MAX_COMBOS = 24;
const MAX_COLLOS = 10;
const EX_MIN = 12, EX_MAX = 220;

/** 官网 HTML 剥标签后会在标点前留空格（"hit , stretched ."）—— 收拾干净 */
function tidy(s) {
  return s
    .replace(/\s+([,.;:!?%)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 例句：只取 <span class="quote"> 里的正文 */
function quotes(block, limit) {
  const out = [];
  allInner(block, /<span class="quote">/).forEach(function (h) {
    if (out.length >= limit) return;
    const q = text(h).replace(/^["“”'']+|["“”'']+$/g, '').trim();
    if (q && q.length >= EX_MIN && q.length <= EX_MAX && out.indexOf(q) < 0) out.push(tidy(q));
  });
  return out;
}

/** 义项的释义：div.def / div.sense def 两种写法 */
function senseDef(block) {
  return tidy(cleanDef(inner(block, /<div class="[^"]*\bdef\b[^"]*">/)));
}

/** 官网 re 区块的类型 → 输出类型 */
const RE_TYPES = {
  'type-phrasalverb': 'phrasal',
  'type-idiom': 'idiom',
  'type-phrase': 'phrase',
  'type-collocation': 'collocation'
};

/** <div class="re type-X"> … 的组合区：同类块是平级兄弟，
    从每个块的开头切到下一个块的开头即可拿到自己的内容 */
function parseReBlocks(entry) {
  const out = [];
  const marks = [];
  const re = /<div class="re (type-[a-z]+)[^"]*"/g;
  let m;
  while ((m = re.exec(entry)) && marks.length < 80) marks.push({ i: m.index, type: m[1] });
  for (let i = 0; i < marks.length && out.length < MAX_COMBOS; i++) {
    const t = RE_TYPES[marks[i].type];
    if (!t) continue;
    const chunk = entry.slice(marks[i].i, i + 1 < marks.length ? marks[i + 1].i : undefined);
    /* 「See make for」—— 链接文字就是组合本身 */
    const am = /<a[^>]*class="ref"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(chunk) ||
               /<a[^>]*href="([^"]*)"[^>]*class="ref"[^>]*>([\s\S]*?)<\/a>/.exec(chunk) ||
               /<a[^>]*>([\s\S]*?)<\/a>/.exec(chunk);
    if (!am) continue;
    const k = text(am[2] || am[1]).replace(/\s+/g, ' ').trim();
    if (!k || out.some(function (x) { return x.k === k; })) continue;
    const item = { t: t, k: k, d: '', e: [] };
    /* 动词短语的独立页链接，交给 fetch-words.js 去补释义 */
    if (t === 'phrasal' && am[1] && am[1].indexOf('http') === 0) item.href = am[1].split('#')[0];
    out.push(item);
  }
  return out;
}

/** COBUILD Collocations：<div class="… cB cB-rel-t"> 容器里，
    标题下跟着一串 <a href="…/dictionary/english/resilient-economy"> 搭配链接 */
function parseColloBlocks(html) {
  const out = [];
  allInner(html, /<div class="[^"]*cB cB-rel-t[^"]*"[^>]*>/).forEach(function (blk) {
    const h = text(inner(blk, /<div class="cB-h[^"]*"[^>]*>/) || '');
    if (h.indexOf('Collocations') < 0) return;
    [...blk.matchAll(/<a[^>]*href="([^"]*\/dictionary\/english\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
      .forEach(function (m) {
        if (out.length >= MAX_COLLOS) return;
        const k = text(m[2]).replace(/\s+/g, ' ').trim();
        if (!k || out.some(function (x) { return x.k === k; })) return;
        out.push({ t: 'collocation', k: k, d: '', e: [] });
      });
  });
  return out;
}

function parseCollins(html, word) {
  if (!html || html.indexOf('cB-def cobuild') < 0) return null;
  /* COBUILD 的内容可能被拆成多个相邻容器块，全部收集。
     容器的 class 后面跟着 data-* 属性，正则匹配到整个开标签 */
  const blocks = allInner(html, /<div class="cB cB-def cobuild[^"]*"[^>]*>/);
  if (!blocks.length) return null;
  const entry = blocks.join('\n');
  const first = blocks[0];

  /* 词头校验：查 scouted 会跳到 scout，词头对得上就接受 */
  const hw = text(inner(first, /<h2 class="h2_entry[^"]*"[^>]*>/) || '').toLowerCase();
  if (hw && hw.replace(/[^a-z]/g, '') !== word.replace(/[^a-z]/g, '')) {
    if (!hw.split(/\s+/)[0].startsWith(word.slice(0, 3))) return null;
  }

  /* 音标：mini_h2 里的 span.pron，带 hi rend-u 重音符（stress() 转 ˈ）。
     多词性的词（如 transfer）mini_h2 里每个读音后面跟着「(verb) (noun)」
     这样的词性小标签，IPA 里不可能出现这些字母序列，直接删；
     两个读音只取第一个（verb 在前） */
  const mh = inner(first, /<div class="mini_h2[^"]*"[^>]*>/) || '';
  let ph = text(stress(mh))
    .replace(/[()]/g, '').replace(/\s+/g, '');
  ph = ph.replace(/verb|noun|adjective|adverb|preposition|conjunction|exclamation/g, '');
  if (ph.indexOf(',') > 0) ph = ph.split(',')[0];
  if (ph) ph = '/' + ph + '/';

  const bandM = /data-band="(\d)"/.exec(first);

  /* 义项：COBUILD 的每个 .hom 是一个义项（可能分布在多个块里） */
  const S = [], posList = [];
  let lastPos = '', lastLv = '';
  const homs = allInner(entry, /<div class="hom[^"]*">/);
  homs.forEach(function (hom) {
    /* 词性：gramGrp pos 直接文本，或 gramGrp 里嵌套的 span.pos */
    const g = /<span class="gramGrp pos"[^>]*>([\s\S]*?)<\/span>/.exec(hom) ||
              /<span class="pos"[^>]*>([^<]*)<\/span>/.exec(hom);
    let pos = g ? normPos(g[1]) : '';
    if (pos) { lastPos = pos; if (posList.indexOf(pos) < 0) posList.push(pos); }
    else pos = lastPos;
    /* 等级：官网徽章 <a data-type="B1+" class="Symbollbcefrb">B1+</a> */
    const lv = ((/<a[^>]*class="Symbollbcefrb"[^>]*>([^<]*)<\/a>/.exec(hom) || [])[1] ||
                (/<span class="cefr"[^>]*>([^<]*)<\/span>/.exec(hom) || [])[1] || '').trim();
    const level = lv || lastLv;
    if (lv) lastLv = lv;
    const d = senseDef(hom);
    if (!d) return;
    if (S.length >= MAX_SENSES) return;
    if (S.some(function (x) { return x.d === d; })) return;
    S.push({ p: pos, l: level, d: d, e: quotes(hom, MAX_SENSE_EX) });
  });

  if (!S.length) return null;

  return {
    pos: posList.join(' / '),
    ph: ph,
    bd: bandM ? parseInt(bandM[1], 10) : 0,
    ce: (S.find(function (x) { return x.l; }) || S[0]).l || '',
    S: S,
    C: parseReBlocks(entry).concat(parseColloBlocks(html))
  };
}

module.exports = { parseCollins, quotes };
