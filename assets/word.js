/* ============================================================
   word.js — 词条数据结构与兼容层
   ------------------------------------------------------------
   一个单词长这样：
     { word, pos, phonetic, audio,
       senses: [ { p: 词性, l: 等级, d: 释义, e: [例句] } ],
       combos: [ { t: phrase|phrasal|idiom|collocation, k: 组合, d: 释义, e: [例句] } ],
       mastery, weak: [], note, bankId, sched, stats }

   老数据（senses 是字符串数组、phrases 是字符串数组、examples 是平铺数组）
   一律经 normalize() 转成上面的形状，所以调用方不用再判类型。
   ============================================================ */

/* ---- 应用级常量 ---- */
var MASTERY = ["New","Vague","Recognised","Solid","Mastered"];

var INTERVALS = [1,2,5,12,30];

var WEAK_TYPES = {
  "polysemy": {
    "label": "Multiple meanings",
    "short": "Polysemy",
    "desc": "You know one sense, but freeze when it shows up in a different context"
  },
  "phrase": {
    "label": "Collocations",
    "short": "Collocation",
    "desc": "You know the word alone, but not how it combines with others"
  },
  "derivation": {
    "label": "Word family",
    "short": "Derivation",
    "desc": "Adding a prefix or changing the part of speech makes it unrecognisable"
  },
  "grammar": {
    "label": "Grammar patterns",
    "short": "Grammar",
    "desc": "Sentence patterns, transitivity, verb complements and similar usage"
  },
  "register": {
    "label": "Register / formality",
    "short": "Register",
    "desc": "Unsure whether a word is formal, informal, spoken or academic"
  },
  "speed": {
    "label": "Recognition speed",
    "short": "Speed",
    "desc": "You get there, but slowly enough to break your reading flow"
  },
  "active": {
    "label": "Passive to active",
    "short": "Production",
    "desc": "You recognise it while reading but cannot produce it yourself"
  },
  "discourse": {
    "label": "Discourse function",
    "short": "Discourse",
    "desc": "Logical connectors and attitude markers whose function you are unsure of"
  }
};
var WEAK_KEYS = Object.keys(WEAK_TYPES);

(function (global) {
  'use strict';

  var TYPES = ['phrase', 'phrasal', 'idiom', 'collocation'];

  function arr(x) {
    return Array.isArray(x) ? x : (x == null || x === '' ? [] : [x]);
  }

  function str(x) {
    return x == null ? '' : String(x);
  }

  /** 一条义项：对象或老式字符串 "noun · A1 — 释义" */
  function sense(x) {
    if (x && typeof x === 'object') {
      return {
        p: str(x.p || x.pos || ''),
        l: str(x.l || x.level || ''),
        d: str(x.d || x.def || x.t || ''),
        e: arr(x.e || x.ex).map(str).filter(Boolean)
      };
    }
    var s = str(x);
    var m = /^([\s\S]{0,40}?)\s*—\s*([\s\S]*)$/.exec(s);
    var head = m ? m[1] : '';
    var body = m ? m[2] : s;
    var p = '', l = '';
    head.split(/[·•]/).forEach(function (t) {
      t = t.trim();
      if (!t) return;
      if (/^[ABC][12]\+?$/.test(t)) l = t; else p = t;
    });
    return { p: p, l: l, d: body.trim(), e: [] };
  }

  /** 一条词语组合：对象或老式字符串 */
  function combo(x, fallbackType) {
    if (x && typeof x === 'object') {
      var t = str(x.t || 'phrase');
      if (TYPES.indexOf(t) < 0) t = 'phrase';
      return {
        t: t,
        k: str(x.k || x.key || ''),
        d: str(x.d || x.def || ''),
        e: arr(x.e || x.ex).map(str).filter(Boolean)
      };
    }
    return { t: fallbackType || 'phrase', k: str(x), d: '', e: [] };
  }

  function comboKey(c) {
    return str(c.k).toLowerCase()
      .replace(/^to\s+/, '')
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dedupeCombos(list) {
    var seen = {};
    return list.filter(function (c) {
      var k = comboKey(c);
      if (!k || seen[k]) return false;
      seen[k] = 1;
      return true;
    });
  }

  /** 原地把任意来源的词条统一成新结构 */
  function normalize(w) {
    if (!w || typeof w !== 'object') return w;

    var raw = Array.isArray(w.senses) ? w.senses : [];
    w.senses = raw.map(sense).filter(function (s) { return s.d; });

    /* 老数据把例句平铺在一层：按顺序分给前几条义项，分不完就挂在第一条上 */
    var loose = arr(w.examples).map(str).filter(Boolean);
    if (loose.length && !w.senses.some(function (s) { return s.e.length; })) {
      if (!w.senses.length) w.senses.push(sense(loose[0]));
      else {
        loose.forEach(function (q, i) {
          var s = w.senses[Math.min(i, w.senses.length - 1)];
          if (s.e.length < 2 && s.e.indexOf(q) < 0) s.e.push(q);
        });
      }
    }

    var combos = [];
    (Array.isArray(w.combos) ? w.combos : []).forEach(function (c) { combos.push(combo(c)); });
    arr(w.phrases).forEach(function (p) { combos.push(combo(p)); });
    w.combos = dedupeCombos(combos.filter(function (c) { return c.k; }));

    delete w.phrases;
    delete w.examples;

    if (!w.pos) {
      var ps = [];
      w.senses.forEach(function (s) { if (s.p && ps.indexOf(s.p) < 0) ps.push(s.p); });
      if (ps.length) w.pos = ps.join(' / ');
    }
    return w;
  }

  /** 词条 → 显示用文本（提示词、CSV 里都用这个） */
  function senseText(s) {
    return str(s.d);
  }

  /** 义项标签：词性 · 等级 */
  function senseLabel(s) {
    return [s.p, s.l].filter(Boolean).join(' · ');
  }

  function typeLabel(t, tFn) {
    var fallback = { phrase: 'phrase', phrasal: 'phrasal verb', idiom: 'idiom', collocation: 'collocation' };
    if (tFn) {
      var v = tFn('combo.' + t);
      if (v && v !== 'combo.' + t) return v;
    }
    return fallback[t] || 'phrase';
  }

  /** 词典条目（DICT 行 / 词库条目）→ 词 */
  function fromDict(d) {
    if (!d) return null;
    var S = Array.isArray(d.S) ? d.S : arr(d.s);
    var C = Array.isArray(d.C) ? d.C : arr(d.c);
    var w = {
      word: str(d.word || d.w),
      pos: str(d.pos || ''),
      phonetic: str(d.phonetic || d.ph || ''),
      audio: str(d.audio || d.au || ''),
      senses: S.map(function (x) {
        if (x && typeof x === 'object') return { p: str(x.p), l: str(x.l), d: str(x.d || x.def || x.t), e: arr(x.e) };
        return sense(x);
      }).filter(function (s) { return s.d; }),
      combos: C.map(function (x) {
        if (x && typeof x === 'object') return combo(x);
        return combo(x);
      }).filter(function (c) { return c.k; })
    };
    return normalize(w);
  }

  global.Word = {
    TYPES: TYPES,
    arr: arr,
    sense: sense,
    combo: combo,
    comboKey: comboKey,
    normalize: normalize,
    senseText: senseText,
    senseLabel: senseLabel,
    typeLabel: typeLabel,
    fromDict: fromDict,
    dedupeCombos: dedupeCombos
  };
})(window);
