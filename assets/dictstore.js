/* ============================================================
   dictstore.js —— 词库（用户抓取 / 录入 / 导入的词条，统一存取）

   抓词工具 / 粘贴词表 / 粘贴数据包加进来的词条都存在 localStorage，
   合起来就是「词库」。单词本里的词只是从词库里「取一份」的副本，
   取的时候把释义、词组、音标一起带过去。

   对外 API
     Dict.all()            词库全部词条（数组，按字母序）
     Dict.count()          { total, added }
     Dict.has(word)        词库里有没有（含屈折形式回退）
     Dict.find(word)       取一个词条（含屈折形式回退），没有返回 null
     Dict.search(q)        只按单词本身匹配（前缀 > 包含 > 字母顺序散落）
     Dict.upsert(entry)    写入一条（返回 'added' | 'updated'）
     Dict.remove(word)
     Dict.userEntries()    全部词条（导出备份用）
     Dict.importEntries(arr, replace)
     Dict.clearUser()      清空词库
   ============================================================ */
var Dict = (function () {

  var KEY = 'lexforge.dict.v1';
  var added = {};        // { 小写词: entry }

  /* ---------- 词条规范化 ---------- */
  function toArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(function (x) { return x != null && String(x).trim(); })
      .map(function (x) { return String(x).trim(); });
    if (typeof v === 'string') return v.split(/\s*[;；]\s*/).filter(Boolean);
    return [];
  }

  function norm(e) {
    var w = String((e && (e.word || e.w)) || '').trim();
    // 义项 / 词语组合统一成对象（老数据是字符串，Word.normalize 负责转换）
    var n = (typeof Word !== 'undefined')
      ? Word.normalize({
          senses: e.senses || e.s,
          combos: e.combos,
          phrases: e.phrases,
          examples: e.examples || e.e
        })
      : { senses: [], combos: [] };
    return {
      word: w,
      pos: String(e.pos || '').trim(),
      phonetic: String(e.phonetic || e.ph || '').trim(),
      senses: n.senses || [],
      combos: n.combos || [],
      note: String(e.note || '').trim(),
      source: String(e.source || '').trim(),
      updated: +e.updated || Date.now()
    };
  }

  /* ---------- 持久化 ---------- */
  function load() {
    added = {};
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(function (e) {
            var n = norm(e);
            if (n.word) added[n.word.toLowerCase()] = n;
          });
        }
      }
    } catch (e) { console.warn('Could not read the word library', e); }
    return added;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(userEntries()));
      return true;
    } catch (e) {
      console.warn('Could not save the word library', e);
      return false;
    }
  }

  /* ---------- 查询 ---------- */
  function has(word) { return !!find(word); }

  function find(word) {
    var w = String(word || '').trim().toLowerCase();
    if (!w) return null;
    if (added[w]) return added[w];
    // 屈折 / 英美拼写回退：running → run，scrutinise → scrutinize
    var cands = variants(w);
    for (var i = 0; i < cands.length; i++) {
      if (added[cands[i]]) return added[cands[i]];
    }
    return null;
  }

  function variants(word) {
    var out = [word];
    function add(x) { if (x && x.length > 2 && out.indexOf(x) < 0) out.push(x); }
    if (/[^aeiou]ies$/.test(word)) add(word.replace(/ies$/, 'y'));
    if (/(ches|shes|sses|xes|zes)$/.test(word)) add(word.replace(/es$/, ''));
    if (/s$/.test(word)) add(word.replace(/s$/, ''));
    if (/ied$/.test(word)) add(word.replace(/ied$/, 'y'));
    if (/ed$/.test(word)) { add(word.replace(/ed$/, '')); add(word.replace(/ed$/, 'e')); }
    if (/ing$/.test(word)) { add(word.replace(/ing$/, '')); add(word.replace(/ing$/, 'e')); }
    if (/ly$/.test(word)) add(word.replace(/ly$/, ''));
    if (/ise[ds]?$/.test(word)) add(word.replace(/is/, 'iz'));
    if (/izing$/.test(word)) add(word.replace(/izing$/, 'ising'));
    if (/our(s|ed|ing)?$/.test(word)) add(word.replace('our', 'or'));
    if (/yse[ds]?$/.test(word)) add(word.replace(/ys/, 'yz'));
    if (/re$/.test(word)) add(word.replace(/re$/, 'er'));
    if (/ll(ed|ing|er|ers|or)$/.test(word)) add(word.replace('ll', 'l'));
    return out;
  }

  function all() {
    return Object.keys(added)
      .map(function (k) { return added[k]; })
      .sort(function (a, b) { return a.word.localeCompare(b.word); });
  }

  function count() {
    var total = Object.keys(added).length;
    return { total: total, added: total };
  }

  /** 只按单词本身匹配：0 前缀 / 1 包含 / 2 字母顺序散落 / -1 不匹配 */
  function matchRank(word, q) {
    var w = String(word || '').toLowerCase();
    if (!q) return 0;
    var at = w.indexOf(q);
    if (at === 0) return 0;
    if (at > 0) return 1;
    var p = 0;
    for (var i = 0; i < w.length && p < q.length; i++) {
      if (w.charAt(i) === q.charAt(p)) p++;
    }
    return p === q.length ? 2 : -1;
  }

  function search(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return all();
    var hits = [];
    Object.keys(added).forEach(function (k) {
      var r = matchRank(added[k].word, q);
      if (r >= 0) hits.push({ e: added[k], r: r });
    });
    hits.sort(function (a, b) {
      return a.r - b.r || a.e.word.localeCompare(b.e.word);
    });
    return hits.map(function (h) { return h.e; });
  }

  /* ---------- 写入 ---------- */
  function upsert(entry) {
    var e = norm(entry);
    if (!e.word) return null;
    var k = e.word.toLowerCase();
    var existed = !!added[k];
    e.updated = Date.now();
    added[k] = e;
    save();
    /* 词库条目一变，单词本里同词头的副本内容也跟着更新（学习状态不动）。
       放在这里做唯一入口：词库编辑 / 导入覆盖 / 备份恢复都会经过它。 */
    if (typeof Store !== 'undefined' && Store.syncFromLibrary) Store.syncFromLibrary(e.word, e);
    return existed ? 'updated' : 'added';
  }

  function remove(word) {
    var k = String(word || '').trim().toLowerCase();
    if (!k || !added[k]) return false;
    delete added[k];
    save();
    return true;
  }

  function userEntries() {
    return Object.keys(added).map(function (k) { return added[k]; });
  }

  function importEntries(arr, replace) {
    if (replace) added = {};
    var n = { added: 0, updated: 0 };
    (arr || []).forEach(function (raw) {
      var e = norm(raw);
      if (!e.word) return;
      var k = e.word.toLowerCase();
      if (added[k]) n.updated++; else n.added++;
      e.updated = Date.now();
      added[k] = e;
    });
    save();
    return n;
  }

  function clearUser() {
    added = {};
    save();
  }

  return {
    load: load, save: save, clearUser: clearUser,
    all: all, count: count, has: has, find: find, search: search,
    matchRank: matchRank,
    upsert: upsert, remove: remove, userEntries: userEntries, importEntries: importEntries
  };
})();
