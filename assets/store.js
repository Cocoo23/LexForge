/* ============================================================
   store.js —— 数据层（localStorage 持久化 + 导入导出）
   ============================================================ */
var Store = (function () {

  var KEY = 'lexforge.v1';
  var DAY = 86400000;
  var state = null;
  var loadedFromDisk = false;

  /* ---------- 工具 ---------- */
  function uid(p) {
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function now() { return Date.now(); }

  function blankWord(w) {
    return {
      id: uid('w'),
      bankId: '',
      word: (w || '').trim(),
      pos: '',
      phonetic: '',
      senses: [],              // [{ p 词性, l 等级, d 释义, e 例句 }]
      combos: [],              // [{ t 类型, k 组合, d 释义, e 例句 }]
      mastery: 1,              // Vague
      weak: [],
      unsureSenses: [],        // 多义时：哪几条义项还不熟
      note: '',
      created: now(),
      stats: { articles: 0, hit: 0, miss: 0, skipped: 0, lastSeen: 0 },
      sched: { due: now(), interval: 0, reps: 0 }
    };
  }

  /* ---------- 单词本（可以有多个） ---------- */
  function defaultBankName() {
    try { return I18N.t('bank.mine'); } catch (e) { return 'My words'; }
  }

  function newBank(name) {
    var b = { id: uid('b'), name: (name || defaultBankName()).trim() || defaultBankName(), created: now() };
    state.banks.push(b);
    return b;
  }

  function banks() { return state.banks; }

  function bankOf(id) {
    for (var i = 0; i < state.banks.length; i++) if (state.banks[i].id === id) return state.banks[i];
    return null;
  }

  function lastBankId() {
    var id = state.meta && state.meta.lastBank;
    return bankOf(id) ? id : state.banks[0].id;
  }

  function setLastBank(id) {
    if (!bankOf(id)) return;
    state.meta.lastBank = id;
    save();
  }

  function addBank(name) {
    var b = newBank(name);
    save();
    return b;
  }

  function renameBank(id, name) {
    var b = bankOf(id);
    if (!b) return null;
    b.name = String(name || '').trim() || b.name;
    save();
    return b;
  }

  /** 删掉一个单词本：里面的词搬到剩下的第一个本子，至少保留一个本子 */
  function removeBank(id) {
    if (state.banks.length <= 1) return { ok: false, reason: 'last' };
    var b = bankOf(id);
    if (!b) return { ok: false, reason: 'missing' };
    state.banks = state.banks.filter(function (x) { return x.id !== id; });
    var fallback = state.banks[0].id;
    var moved = 0;
    state.words.forEach(function (w) {
      if (w.bankId === id) { w.bankId = fallback; moved++; }
    });
    if (state.meta.lastBank === id) state.meta.lastBank = fallback;
    save();
    return { ok: true, moved: moved, to: fallback };
  }

  function wordsIn(bankId) {
    return bankId ? state.words.filter(function (w) { return w.bankId === bankId; }) : state.words;
  }

  /* ---------- 持久化 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        loadedFromDisk = true;
        if (!state.words) state.words = [];
        if (!state.tasks) state.tasks = [];
        if (!state.meta) state.meta = {};
        migrate();
        return;
      }
    } catch (e) { console.warn('Could not read local data', e); }
    state = { words: [], tasks: [], banks: [], meta: {} };
    migrate();
    save();
  }

  /** 老数据升级：没有 banks 时造一个默认本子，把现有单词都挂上去 */
  function migrate() {
    if (!Array.isArray(state.banks) || !state.banks.length) {
      state.banks = [{
        id: uid('b'), name: defaultBankName(), created: now()
      }];
    }
    var first = state.banks[0].id;
    state.words.forEach(function (w) {
      if (!w.bankId || !bankOf(w.bankId)) w.bankId = first;
      /* 义项/词组结构升级（老的 senses/phrases/examples 字符串数组） */
      if (typeof Word !== 'undefined') Word.normalize(w);
      if (!Array.isArray(w.unsureSenses)) w.unsureSenses = [];
    });
    (state.tasks || []).forEach(function (t) {
      if (!Array.isArray(t.reviewed)) t.reviewed = [];
    });
    if (!state.meta.lastBank || !bankOf(state.meta.lastBank)) state.meta.lastBank = first;
  }

  var persistOK = true;
  var savedOK = false;      // 真的往主键写成功过至少一次

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      savedOK = true;
      if (!persistOK) { persistOK = true; firePersist(); }
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      persistOK = false;
      firePersist();
      return false;
    }
  }

  /** 存储状态变化时通知 UI（用来撤掉「存不住」的警告条） */
  function firePersist() {
    try {
      document.dispatchEvent(new CustomEvent('lexforge:persist', { detail: persistOK }));
    } catch (e) { /* 极旧环境没有 CustomEvent，忽略 */ }
  }

  /**
   * 浏览器到底能不能存？
   * 别用一个临时键去探——某些环境下临时键会抛异常，可主键其实写得好好的，
   * 用户就会看到明明存住了还挂着警告。这里只认事实：
   *   1) 这次启动已经往主键写成功过        → 能存
   *   2) 现场写一次主键，再读回来看得到    → 能存
   *   3) 读写任一步抛异常                  → 真的不能存
   */
  function checkPersist() {
    if (savedOK) { persistOK = true; return true; }
    if (!save()) { persistOK = false; return false; }
    try { persistOK = !!localStorage.getItem(KEY); } catch (e) { persistOK = false; }
    return persistOK;
  }

  /* ---------- 单词 CRUD ---------- */
  function addWord(data) {
    var w = blankWord(data.word);
    Object.keys(data).forEach(function (k) { w[k] = data[k]; });
    w.created = now();
    if (typeof Word !== 'undefined') Word.normalize(w);
    if (!Array.isArray(w.unsureSenses)) w.unsureSenses = [];
    if (!bankOf(w.bankId)) w.bankId = lastBankId();
    /* 同词副本共享学习进度：新副本直接继承已有副本的排期与统计，
       否则同一个词在不同本里会出现两个不同的 due time */
    var lw = w.word.toLowerCase();
    for (var i = 0; i < state.words.length; i++) {
      var twin = state.words[i];
      if (twin.word.toLowerCase() === lw) {
        w.sched = JSON.parse(JSON.stringify(twin.sched));
        w.stats = JSON.parse(JSON.stringify(twin.stats));
        break;
      }
    }
    state.words.push(w);
    state.meta.lastBank = w.bankId;   // 记住这次用的本子，下次默认还用它
    save();
    return w;
  }

  function updateWord(id, patch) {
    var w = get(id);
    if (!w) return null;
    Object.keys(patch).forEach(function (k) { w[k] = patch[k]; });
    if (typeof Word !== 'undefined') Word.normalize(w);
    if (!Array.isArray(w.unsureSenses)) w.unsureSenses = [];
    save();
    return w;
  }

  function removeWord(id) {
    state.words = state.words.filter(function (w) { return w.id !== id; });
    save();
  }

  function get(id) {
    for (var i = 0; i < state.words.length; i++) {
      if (state.words[i].id === id) return state.words[i];
    }
    return null;
  }

  function hasWord(word, bankId) {
    var lw = String(word).toLowerCase().trim();
    return state.words.some(function (w) {
      return w.word.toLowerCase() === lw && (!bankId || w.bankId === bankId);
    });
  }

  /** 跨单词本找同名词：返回任意本里第一份副本（没有就 null） */
  function findAny(word) {
    var lw = String(word || '').toLowerCase().trim();
    if (!lw) return null;
    for (var i = 0; i < state.words.length; i++) {
      if (state.words[i].word.toLowerCase() === lw) return state.words[i];
    }
    return null;
  }

  /** 把 src 的学习状态（掌握度 / 排期 / 统计）同步给所有同词副本。
   *  一个词只有一份学习进度，不管它存在于几个单词本里。 */
  function shareLearning(src) {
    if (!src) return;
    var lw = src.word.toLowerCase();
    state.words.forEach(function (w) {
      if (w.id !== src.id && w.word.toLowerCase() === lw) {
        w.mastery = src.mastery;
        w.sched = JSON.parse(JSON.stringify(src.sched));
        w.stats = JSON.parse(JSON.stringify(src.stats));
      }
    });
  }

  /** 同一个词在多个单词本里的副本共享学习进度：改了其中一份，其余副本跟着同步。 */
  function syncProgress(word, patch, exceptId) {
    var lw = String(word || '').toLowerCase().trim();
    if (!lw || !patch) return;
    var src = exceptId ? get(exceptId) : null;
    state.words.forEach(function (w) {
      if (w.id === exceptId || w.word.toLowerCase() !== lw) return;
      if (patch.mastery !== undefined && w.mastery !== patch.mastery) w.mastery = patch.mastery;
      if (patch.weak && String(w.weak) !== String(patch.weak)) w.weak = patch.weak.slice();
      if (patch.unsureSenses && String(w.unsureSenses || []) !== String(patch.unsureSenses)) {
        w.unsureSenses = patch.unsureSenses.slice();
      }
      /* 排期与统计以改动的那份为准，副本不再各自重算（否则 due time 会分叉） */
      if (src) {
        w.sched = JSON.parse(JSON.stringify(src.sched));
        w.stats = JSON.parse(JSON.stringify(src.stats));
      }
    });
    save();
  }

  function all() { return state.words; }

  /**
   * 词库条目变了，把单词本里同词头的副本内容同步过去。
   * 只动「这个词长什么样」（词性 / 音标 / 义项 / 词组 / 备注），
   * 掌握度、薄弱点、复习进度这些学习状态一概不碰。
   * 词库那边是空的字段不覆盖（防止空数据倒灌）。
   */
  function syncFromLibrary(word, entry) {
    var key = String(word || '').trim().toLowerCase();
    if (!key || !entry) return 0;
    var n = 0;
    state.words.forEach(function (w) {
      if (w.word.toLowerCase() !== key) return;
      w.pos = entry.pos || w.pos;
      w.phonetic = entry.phonetic || w.phonetic;
      if (entry.senses && entry.senses.length) w.senses = entry.senses.slice();
      if (entry.combos && entry.combos.length) w.combos = entry.combos.slice();
      if (entry.note) w.note = entry.note;
      n++;
    });
    if (n) save();
    return n;
  }

  /**
   * 一键同步：单词本里每个词都从词库取最新内容（义项 / 词组 / 词性 / 音标 / 备注），
   * 词库里找不到的词不动，学习状态（掌握度 / 薄弱点 / 复习进度）永远不碰。
   * 返回实际更新的词数。
   */
  function syncAllFromLibrary() {
    var n = 0;
    state.words.forEach(function (w) {
      var e = (typeof Dict !== 'undefined') && Dict.find(w.word);
      if (!e) return;
      var before = JSON.stringify([w.pos, w.phonetic, w.senses, w.combos, w.note]);
      w.pos = e.pos || w.pos;
      w.phonetic = e.phonetic || w.phonetic;
      if (e.senses && e.senses.length) w.senses = e.senses.slice();
      if (e.combos && e.combos.length) w.combos = e.combos.slice();
      if (e.note) w.note = e.note;
      if (JSON.stringify([w.pos, w.phonetic, w.senses, w.combos, w.note]) !== before) n++;
    });
    if (n) save();
    return n;
  }

  /* ---------- 复习调度 ---------- */
  /**
   * 标记一批词「已练过」：推进间隔，重排下次到期。
   * factor < 1 表示「练过了但没有进步」—— 间隔减半，
   * 让它比掌握度有提高的词更早回到队列里（推荐权重稍高）。
   */
  function scheduleAfterUse(ids, factor) {
    var t = now();
    var f = (typeof factor === 'number' && factor > 0 && factor <= 1) ? factor : 1;
    ids.forEach(function (id) {
      var w = get(id);
      if (!w) return;
      w.stats.articles += 1;
      w.stats.lastSeen = t;
      w.sched.reps += 1;
      var base = INTERVALS[Math.min(w.mastery, 4)] || 1;
      // 抖动 ±25%，避免一批词扎堆到期
      var jitter = 0.75 + Math.random() * 0.5;
      w.sched.interval = Math.max(1, Math.round(base * jitter * f * 10) / 10);
      w.sched.due = t + w.sched.interval * DAY;
      shareLearning(w);   // 同词副本：排期与统计一起共享
    });
    save();
  }

  /**
   * 撤回「已练过」：文章实际没用上这个词，就不该算进复习记录，
   * 否则调度器会把它当成练过而往后推。
   */
  function undoUse(ids) {
    var t = now();
    var done = 0;
    ids.forEach(function (id) {
      var w = get(id);
      if (!w) return;
      w.stats.articles = Math.max(0, (w.stats.articles || 0) - 1);
      w.stats.skipped = (w.stats.skipped || 0) + 1;
      w.stats.lastSeen = 0;
      w.sched.reps = Math.max(0, (w.sched.reps || 0) - 1);
      w.sched.interval = 0;
      w.sched.due = t;            // 立刻回到到期队列
      shareLearning(w);           // 同词副本：排期与统计一起共享
      done++;
    });
    if (done) save();
    return done;
  }

  /** 按词形查找（用于把 AI 回传的未用词对回单词本） */
  function findByWord(word) {
    var lw = String(word).toLowerCase().trim();
    for (var i = 0; i < state.words.length; i++) {
      if (state.words[i].word.toLowerCase() === lw) return state.words[i];
    }
    return null;
  }

  /**
   * 改掌握度：下一次复习时间要跟着新掌握度走，否则标成「已掌握」的词
   * 还会按老间隔天天冒出来。抖动 ±25%，避免一批词同一天扎堆到期。
   */
  function setMastery(id, m) {
    var w = get(id);
    if (!w) return null;
    w.mastery = Math.max(0, Math.min(4, m));
    var base = INTERVALS[w.mastery] || 1;
    var jitter = 0.75 + Math.random() * 0.5;
    w.sched.interval = Math.max(1, Math.round(base * jitter * 10) / 10);
    w.sched.due = now() + w.sched.interval * DAY;
    shareLearning(w);   // 同词副本：掌握度 / 排期 / 统计一起共享
    save();
    return w;
  }

  function isDue(w) { return w.sched.due <= now(); }

  /* ---------- 阅读任务 ---------- */
  function addTask(t) {
    t.id = uid('t');
    t.created = now();
    t.done = false;
    t.doneAt = null;
    t.reviewed = [];      // 已经在「标记已读」里逐张卡片打过分（改过掌握度/薄弱点/备注）的词
    t.unused = [];        // 回传成「文章没用上」的词：不算练过，也不进打分队列
    if (typeof t.deferred !== 'boolean') t.deferred = false;   // 老任务是保存时就推进过间隔的
    state.tasks.unshift(t);
    save();
    return t;
  }
  function updateTask(id, patch) {
    var t = state.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) return null;
    Object.keys(patch).forEach(function (k) { t[k] = patch[k]; });
    save();
    return t;
  }
  function removeTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    save();
  }
  function tasks() { return state.tasks; }

  /* ---------- 统计 ---------- */
  function stats() {
    var s = {
      total: 0,
      due: 0,
      byMastery: [0, 0, 0, 0, 0],
      byWeak: {},
      practiced: 0
    };
    WEAK_KEYS.forEach(function (k) { s.byWeak[k] = 0; });
    var seen = {};   // 同词副本共享进度，统计只算一次，不能重复计数
    state.words.forEach(function (w) {
      var k = w.word.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      s.total++;
      if (isDue(w)) s.due++;
      if (w.stats.articles > 0) s.practiced++;
      s.byMastery[w.mastery] = (s.byMastery[w.mastery] || 0) + 1;
      w.weak.forEach(function (kk) { if (s.byWeak[kk] != null) s.byWeak[kk]++; });
    });
    return s;
  }

  /* ---------- 导入导出 ---------- */
  function exportJSON() {
    return JSON.stringify({
      app: 'LexForge', version: 2, exportedAt: new Date().toISOString(),
      banks: state.banks,
      words: state.words,
      tasks: state.tasks,
      dict: (typeof Dict !== 'undefined') ? Dict.userEntries() : []
    }, null, 2);
  }

  function importJSON(text, mode) {
    var d = JSON.parse(text);
    var words = d.words || (Array.isArray(d) ? d : null);
    if (!words) throw new Error('No word data found in that file');
    if (Array.isArray(d.banks) && d.banks.length) {
      if (mode === 'replace') state.banks = d.banks;
      else {
        var have = {};
        state.banks.forEach(function (b) { have[b.id] = 1; });
        d.banks.forEach(function (b) { if (!have[b.id]) state.banks.push(b); });
      }
    }
    if (mode === 'replace') {
      state.words = words;
      state.tasks = d.tasks || state.tasks;
      state.meta.lastBank = state.banks[0].id;
    } else {
      var seen = {};
      state.words.forEach(function (w) { seen[w.word.toLowerCase() + '|' + w.bankId] = 1; });
      words.forEach(function (w) {
        var k = w.word.toLowerCase() + '|' + (w.bankId || '');
        if (seen[k]) return;
        seen[k] = 1;
        if (!w.id) w.id = uid('w');
        if (!bankOf(w.bankId)) w.bankId = lastBankId();
        state.words.push(w);
      });
    }
    if (typeof Dict !== 'undefined' && Array.isArray(d.dict)) Dict.importEntries(d.dict, mode === 'replace');
    migrate();
    save();
    return state.words.length;
  }

  function exportCSV() {
    /* 列名保持稳定；senses / combos 里一条一段，用 " | " 分隔，
       义项的例句跟在释义后面用 " » " 接上（导入时能拆回来） */
    var rows = [['word', 'pos', 'phonetic', 'senses', 'combos', 'mastery', 'weak', 'note']];
    function seg(s) {
      return [s.p, s.l].filter(Boolean).join(' · ') + (s.p || s.l ? ' — ' : '') + s.d +
        (s.e && s.e.length ? ' » ' + s.e.join(' » ') : '');
    }
    state.words.forEach(function (w) {
      var S = (w.senses || []).map(seg);
      var C = (w.combos || []).map(function (c) {
        return '[' + c.t + '] ' + c.k + (c.d ? ' — ' + c.d : '') +
          (c.e && c.e.length ? ' » ' + c.e.join(' » ') : '');
      });
      rows.push([
        w.word, w.pos, w.phonetic || '',
        S.join(' | '),
        C.join(' | '),
        w.mastery,
        w.weak.join(' '),
        w.note || ''
      ]);
    });
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  }

  function reset() {
    state = { words: [], tasks: [], banks: [], meta: {} };
    migrate();
    save();
  }

  /* ---------- 词典副本判定 / 清理 ---------- */
  /** 内容指纹：只看词性、音标、义项、搭配 —— 掌握度 / 薄弱点 / 备注不算「内容」 */
  function contentFingerprint(o) {
    return JSON.stringify([
      String(o.pos || '').toLowerCase(),
      o.phonetic || '',
      (o.senses || []).map(function (s) {
        return [s.p || '', s.l || '', s.d || '', (s.e || []).join('\n')];
      }),
      (o.combos || []).map(function (c) {
        return [c.t || '', c.k || '', c.d || '', (c.e || []).join('\n')];
      })
    ]);
  }
  /** 单词本里的 w 和词库条目 entry 内容是否一致（一致 = 它还是词典的副本，不是你自己的） */
  function matchesDictContent(w, entry) {
    if (!w || !entry) return false;
    return contentFingerprint(w) === contentFingerprint(entry);
  }
  /**
   * 词库删词后：把单词本里「内容仍与该词库条目一致」的同名词副本一并移除；
   * 改过内容的（＝已经是你自己的词条）保留。返回移除的数量。
   */
  function removeDictCopies(word, entry) {
    var key = String(word || '').trim().toLowerCase();
    if (!key) return 0;
    var before = state.words.length;
    state.words = state.words.filter(function (w) {
      if (w.word.toLowerCase() !== key) return true;
      return !matchesDictContent(w, entry);   // 内容一致才删
    });
    if (state.words.length !== before) save();
    return before - state.words.length;
  }

  return {
    load: load, save: save,
    all: all, get: get, add: addWord, update: updateWord, remove: removeWord, has: hasWord,
    findAny: findAny, syncProgress: syncProgress,
    syncFromLibrary: syncFromLibrary, syncAllFromLibrary: syncAllFromLibrary,
    matchesDictContent: matchesDictContent, removeDictCopies: removeDictCopies,
    wordsIn: wordsIn, banks: banks, bankOf: bankOf,
    lastBankId: lastBankId, setLastBank: setLastBank,
    addBank: addBank, renameBank: renameBank, removeBank: removeBank,
    scheduleAfterUse: scheduleAfterUse, undoUse: undoUse, findByWord: findByWord,
    setMastery: setMastery, isDue: isDue,
    addTask: addTask, updateTask: updateTask, removeTask: removeTask, tasks: tasks,
    stats: stats,
    exportJSON: exportJSON, importJSON: importJSON, exportCSV: exportCSV, reset: reset,
    blankWord: blankWord, DAY: DAY, checkPersist: checkPersist,
    persistOK: function () { return persistOK; }
  };
})();
