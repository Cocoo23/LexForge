/* ============================================================
   ui.js —— 界面渲染与交互
   ============================================================ */
var UI = (function () {

  var OUTPUTS = {
    glossary:    { k: 'out.glossary',    on: true },
    translation: { k: 'out.translation', on: false },
    answerKey:   { k: 'out.answerKey',   on: true }
  };

  var LEN_PRESETS = [120, 200, 280, 360, 500, 700, 1000, 1500];

  var picked = [];
  var weakFocus = [];
  var modalEditId = null;
  var modalMastery = 1;
  var modalWeak = [];
  var impMode = 'paste';

  /* ---------- helpers ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var toastTimer = null;
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function num(id, dflt) {
    var n = el(id);
    if (!n) return dflt;
    var v = parseInt(n.value, 10);
    if (isNaN(v)) return dflt;
    // 手输的数字不受 input 的 min/max 约束，这里补上，免得「题目 99 道」这种值流进提示词
    var lo = parseFloat(n.getAttribute('min')), hi = parseFloat(n.getAttribute('max'));
    if (!isNaN(lo) && v < lo) v = lo;
    if (!isNaN(hi) && v > hi) v = hi;
    return v;
  }

  /* ---------- stats ---------- */
  function renderStats() {
    var s = Store.stats();
    el('statStrip').innerHTML =
      '<div class="stat"><b>' + s.total + '</b><span>' + esc(I18N.t('stat.words')) + '</span></div>' +
      '<div class="stat' + (s.due ? ' alert' : '') + '"><b>' + s.due + '</b><span>' + esc(I18N.t('stat.due')) + '</span></div>' +
      '<div class="stat"><b>' + (s.byMastery[0] + s.byMastery[1]) + '</b><span>' + esc(I18N.t('stat.fresh')) + '</span></div>' +
      '<div class="stat"><b>' + (s.byMastery[3] + s.byMastery[4]) + '</b><span>' + esc(I18N.t('stat.solid')) + '</span></div>' +
      '<div class="stat"><b>' + s.practiced + '</b><span>' + esc(I18N.t('stat.practised')) + '</span></div>';
  }

  /* ---------- tabs ---------- */
  function switchTab(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === name);
    }
    var ps = document.querySelectorAll('.panel');
    for (var j = 0; j < ps.length; j++) {
      ps[j].classList.toggle('active', ps[j].id === 'panel-' + name);
    }
    if (name === 'log') renderLog();
    if (name === 'data') renderData();
    if (name === 'words') renderWords();
  }

  /* ---------- word bank ---------- */
  function stars(m) {
    var h = '<div class="stars">';
    for (var i = 0; i < 5; i++) h += '<span class="star' + (i <= m - 1 ? ' on' : '') + '">★</span>';
    return h + '</div>';
  }

  function dueLabel(w) {
    var d = (w.sched.due - Date.now()) / Store.DAY;
    if (d <= 0) return '<span class="due over">' + esc(I18N.t('due.over')) + '</span>';
    if (d < 1) return '<span class="due now">' + esc(I18N.t('due.today')) + '</span>';
    return '<span class="due later">' + esc(I18N.tf('due.inDays', { n: Math.ceil(d) })) + '</span>';
  }

  /* ---------- 义项 / 词语组合的分行展示 ---------- */
  /** 展开状态：'wId:s:0'（第 0 条义项）/'wId:c:2'（第 2 条组合） */
  var openItems = {};

  /** 一条义项：词性标签 + 释义，点一下展开它的例句。
   *  quiet=true（选词列表用）：纯展示，不显示 ›、不可点开例句。 */
  function senseItem(w, s, i, tag, quiet) {
    var key = w.id + ':s:' + i;
    var open = !!openItems[key];
    var hasEx = !!(s.e && s.e.length);
    var t = tag == null ? (typeof Word !== 'undefined' ? Word.senseLabel(s) : '') : tag;
    return '<div class="s-item' + (hasEx && !quiet ? ' has-ex' : '') + (open ? ' open' : '') + '"' +
        (hasEx && !quiet ? ' data-exp="' + key + '"' : '') + '>' +
        (t ? '<span class="s-tag">' + esc(t) + '</span>' : '') +
        '<span class="s-body">' + esc(s.d) + '</span>' +
        (hasEx && !quiet ? '<span class="s-caret">›</span>' : '') +
      '</div>' +
      (hasEx && !quiet ? '<div class="s-ex" data-ex="' + key + '"' + (open ? '' : ' hidden') + '>' +
        s.e.map(function (q) { return '<div class="ex">' + esc(q) + '</div>'; }).join('') +
      '</div>' : '');
  }

  /** 一条词语组合：类型 + 组合本身，点一下展开释义和例句 */
  function comboItem(w, c, i) {
    var key = w.id + ':c:' + i;
    var open = !!openItems[key];
    var hasBody = !!(c.d || (c.e && c.e.length));
    var label = I18N.t('combo.' + (c.t || 'phrase'));
    if (label === 'combo.' + (c.t || 'phrase')) label = c.t || 'phrase';
    return '<div class="cl-item' + (open ? ' open' : '') + '"' +
        (hasBody ? ' data-exp="' + key + '"' : '') + '>' +
        '<span class="cl-tag t-' + esc(c.t || 'phrase') + '">' + esc(label) + '</span>' +
        '<span class="cl-key">' + esc(c.k) + '</span>' +
        (hasBody ? '<span class="s-caret">›</span>' : '') +
      '</div>' +
      (hasBody ? '<div class="s-ex" data-ex="' + key + '"' + (open ? '' : ' hidden') + '>' +
        (c.d ? '<div class="ex def">' + esc(c.d) + '</div>' : '') +
        (c.e || []).map(function (q) { return '<div class="ex">' + esc(q) + '</div>'; }).join('') +
      '</div>' : '');
  }

  function senseBlock(w, limit, expanded) {
    var senses = w.senses || [];
    if (!senses.length) return '<span class="muted">—</span>';
    var n = expanded ? senses.length : (limit || senses.length);
    var shown = senses.slice(0, n);
    var hidden = senses.length - shown.length;
    var html = '<div class="sense-list">' + shown.map(function (s, i) {
      return senseItem(w, s, i);
    }).join('') + '</div>';
    if (hidden > 0) {
      html += '<button class="sense-more" data-more="' + w.id + '" title="' + esc(I18N.t('word.moreTip')) + '">' +
        esc(I18N.tf('word.more', { n: hidden })) + '</button>';
    } else if (expanded && senses.length > (limit || 0)) {
      html += '<button class="sense-more less" data-more="' + w.id + '" data-collapse="1">' +
        esc(I18N.t('word.less')) + '</button>';
    }
    return html;
  }

  var expandedCombos = {};   // 词组列表展开状态（和义项的 expandedSenses 一个路数）
  function colloBlock(w, limit) {
    var combos = w.combos || [];
    if (!combos.length) return '';
    var expanded = !!expandedCombos[w.id];
    var n = expanded ? combos.length : (limit || combos.length);
    var html = '<div class="collo-list">' + combos.slice(0, n).map(function (c, i) {
      return comboItem(w, c, i);
    }).join('') + '</div>';
    var hidden = combos.length - n;
    if (hidden > 0) {
      html += '<button class="sense-more" data-cmore="' + w.id + '" title="' +
        esc(I18N.t('word.moreTip')) + '">' + esc(I18N.tf('word.more', { n: hidden })) + '</button>';
    } else if (expanded && combos.length > (limit || 0)) {
      html += '<button class="sense-more less" data-cmore="' + w.id + '" data-collapse="1">' +
        esc(I18N.t('word.less')) + '</button>';
    }
    return html;
  }

  /* ---------- 表格搜索 ---------- */
  /**
   * 只拿「单词本身」做匹配，不再去扫释义/搭配（否则搜 "use" 会把所有释义里
   * 含 use 的词全带出来）。命中等级用来排序：
   *   0 以输入开头   word → wod
   *   1 词里包含这段 word → sword（连续）
   *   2 字母按顺序散落 word → w o r d（中间可以隔字母）
   *  -1 不匹配
   */
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

  function renderWords() {
    var q = (el('searchInput').value || '').trim().toLowerCase();
    var fm = el('filterMastery').value;
    var fw = el('filterWeak').value;
    var fd = el('filterDue').checked;
    var sort = el('sortBy').value;
    var bank = (el('bankSelect') && el('bankSelect').value) || '';

    var rank = {};
    var list = Store.wordsIn(bank).filter(function (w) {
      if (fm !== '' && String(w.mastery) !== fm) return false;
      if (fw && w.weak.indexOf(fw) < 0) return false;
      if (fd && !Store.isDue(w)) return false;
      if (q) {
        var r = matchRank(w.word, q);
        if (r < 0) return false;
        rank[w.id] = r;
      }
      return true;
    });

    /* 「全部单词本」视图：同一个词在不同本里的副本只显示一行
       （学习进度本来就是共享的，显示两行纯属重复） */
    if (!bank) {
      var seen = {};
      list = list.filter(function (w) {
        var k = w.word.toLowerCase();
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
    }

    var t = Date.now();
    /* 主界面和选词列表用同一套推荐分：难度、侧重薄弱点都取文章设置的当前值。
       noiseSeed 固定住，重绘时分数不会跳。 */
    var scoreOpts = { difficulty: num('fDiff', 50), focusTypes: focusTypes(), noiseSeed: 1 };
    var score = {};
    list.forEach(function (w) { score[w.id] = Scheduler.score(w, scoreOpts, t); });

    /* 排序必须稳定：展开/收起义项会触发重绘，如果每次重绘都重排，
       单词就会跳来跳去、找不到刚才在看的那个。
       所以 ①优先度打分用固定噪声（不再每帧 Math.random），
            ②把「筛选条件 + 每个词的排序输入」算成一个签名，
              签名没变就直接套用上一次的顺序。 */
    var sigParts = [q, fm, fw, fd ? '1' : '0', sort, bank, list.length,
      scoreOpts.difficulty, scoreOpts.focusTypes.join('.')];
    list.forEach(function (w) {
      sigParts.push(w.id + ':' + w.word + ':' + w.mastery + ':' + w.sched.due +
        ':' + w.stats.articles + ':' + (w.stats.lastSeen || 0) + ':' + w.weak.join('.'));
    });
    var sig = sigParts.join('|');

    if (sortSig === sig && sortOrder.length === list.length) {
      var at = {};
      list.forEach(function (w, i) { at[w.id] = i; });
      list = sortOrder.map(function (id) { return list[at[id]]; }).filter(Boolean);
    } else {
      if (sort === 'priority') {
        /* 「优先级」＝推荐分从高到低，跟选词列表显示的分数一回事 */
        list.sort(function (a, b) { return score[b.id].total - score[a.id].total; });
      } else if (sort === 'due') {
        list.sort(function (a, b) { return a.sched.due - b.sched.due; });
      } else if (sort === 'mastery') {
        list.sort(function (a, b) { return a.mastery - b.mastery; });
      } else if (sort === 'added') {
        list.sort(function (a, b) { return b.created - a.created; });
      } else {
        list.sort(function (a, b) { return a.word.localeCompare(b.word); });
      }
      // 有搜索词时：词首命中 > 词中包含 > 字母散落命中，同档保留上面的排序
      if (q) list.sort(function (a, b) { return rank[a.id] - rank[b.id]; });
      sortSig = sig;
      sortOrder = list.map(function (w) { return w.id; });
    }

    el('wordsEmpty').hidden = list.length > 0;
    el('wordRows').innerHTML = list.map(function (w) {
      // 表格里默认只展开前 3 条，否则一行能顶半个屏幕；点 "+n more" 展开全部
      var open = !!expandedSenses[w.id];
      var sens = senseBlock(w, 3, open);
      var coll = colloBlock(w, 2);
      return '<tr data-id="' + w.id + '">' +
        '<td class="c-word"><div class="w-cell">' + esc(w.word) +
          ' <button class="spk-mini" data-play="" data-word="' + esc(w.word) +
            '" title="' + esc(I18N.t('tip.play')) + '">🔊</button>' +
          (w.phonetic ? '<span class="sub">' + esc(w.phonetic) + '</span>' : '') +
          (w.note ? '<span class="sub">' + esc(w.note) + '</span>' : '') + '</div></td>' +
        '<td class="c-pos">' + esc(w.pos) + '</td>' +
        '<td class="c-gloss gloss">' + sens + coll + '</td>' +
        '<td class="c-mast"><div data-mastery="' + w.id + '">' + stars(w.mastery) +
          '<div class="mast-label">' + esc(I18N.masteryLabel(w.mastery)) + '</div></div></td>' +
        '<td class="c-weak"><div class="weak-cell">' +
          (w.weak.length ? w.weak.map(function (k) {
            return '<span class="tag t-' + k + '">' + esc(I18N.weakLabel(k).short) + '</span>';
          }).join('') : '<span class="muted">—</span>') + '</div></td>' +
        '<td>' + dueLabel(w) +
          '<span class="w-score" title="' + esc(I18N.tf('tip.score', {
            s: score[w.id].total.toFixed(2),
            d: score[w.id].parts.due.toFixed(2), m: score[w.id].parts.mastery.toFixed(2),
            t: score[w.id].parts.type.toFixed(2), n: score[w.id].parts.novel.toFixed(2),
            r: score[w.id].parts.recent.toFixed(2)
          })) + '">' + score[w.id].total.toFixed(2) + '</span></td>' +
        '<td class="c-op"><div class="row-op">' +
          '<button class="btn sm" data-edit="' + w.id + '" title="' + esc(I18N.t('btn.editTip')) + '">' +
            esc(I18N.t('btn.edit')) + '</button>' +
          '<button class="btn sm danger" data-del="' + w.id + '" title="' + esc(I18N.t('btn.delTip')) + '">' +
            esc(I18N.t('btn.delete')) + '</button>' +
        '</div></td></tr>';
    }).join('');

    /* 操作后排序可能变了（比如点了星星优先级提高），
       把刚操作过的那个词的框钉回屏幕原位，视线不用追着找 */
    if (wordAnchor) {
      var row = el('wordRows').querySelector('tr[data-id="' + wordAnchor.id + '"]');
      if (row) {
        var delta = row.getBoundingClientRect().top - wordAnchor.top;
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
      }
      wordAnchor = null;
    }
  }

  /** 记下某个词当前在屏幕上的位置（重绘后用它把词框钉回原位） */
  var wordAnchor = null;
  function captureWordAnchor(id) {
    var row = el('wordRows') && el('wordRows').querySelector('tr[data-id="' + id + '"]');
    wordAnchor = row ? { id: id, top: row.getBoundingClientRect().top } : null;
  }

  /* ---------- 单词本选择 ---------- */
  var bankFilter = '';        // '' = 所有单词本
  var bankFilterSet = false;  // 用户自己选过就不再跟随「上一次用的本」
  /* 记住筛选：刷新后停在用户上一次选的单词本（或「全部」），不回到初始值 */
  var BANK_FILTER_KEY = 'lexforge.bankFilter';
  try {
    var savedBankFilter = JSON.parse(localStorage.getItem(BANK_FILTER_KEY) || 'null');
    if (savedBankFilter && savedBankFilter.set) { bankFilter = savedBankFilter.id || ''; bankFilterSet = true; }
  } catch (e) {}

  function renderBankSelect() {
    var sel = el('bankSelect');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(I18N.t('bank.all')) + '</option>' +
      Store.banks().map(function (b) {
        return '<option value="' + b.id + '">' + esc(b.name) + '</option>';
      }).join('');
    // 没选过就默认落在上一次用过的本子上 —— 列表里看到的正是新词会去的那个本
    var want = bankFilterSet ? bankFilter : Store.lastBankId();
    if (want && !Store.bankOf(want)) want = '';
    if (cur && Store.bankOf(cur) && !bankFilterSet) want = cur;
    sel.value = want;
    bankFilter = want;
    syncBatchEditBtn();
  }

  function setBankFilter(id) {
    bankFilter = id || '';
    bankFilterSet = true;
    try { localStorage.setItem(BANK_FILTER_KEY, JSON.stringify({ set: true, id: bankFilter })); } catch (e) {}
    if (el('bankSelect')) el('bankSelect').value = bankFilter;
    // 正在看哪个本就当「上一次用的本」，下次加词默认往这儿放
    if (bankFilter) Store.setLastBank(bankFilter);
    syncBatchEditBtn();
    renderWords();
  }

  /** 「全部单词本」不指向任何一个本子，没法批量编辑 —— 按钮灰掉并说明原因 */
  function syncBatchEditBtn() {
    var beBtn = el('btnBatchEdit');
    if (!beBtn) return;
    var all = !el('bankSelect') || (el('bankSelect').value || '') === '';
    beBtn.disabled = all;
    beBtn.title = all ? I18N.t('bankedit.needBank') : '';
  }

  /** 按当前单词本筛选语义删除一个词：
   *  「全部单词本」视图 → 删这个词本身，所有本里的副本一起删；
   *  单个本视图 → 只删当前本里的副本，别的本不受影响。 */
  function removeWordSmart(id) {
    var w = Store.get(id);
    if (!w) return;
    var all = !el('bankSelect') || (el('bankSelect').value || '') === '';
    if (all) {
      Store.all().forEach(function (x) {
        if (x.word.toLowerCase() === w.word.toLowerCase()) Store.remove(x.id);
      });
    } else {
      Store.remove(id);
    }
  }

  function newBankFlow() {
    var name = window.prompt(I18N.t('bank.nameAsk'),
      I18N.tf('bank.defaultName', { n: Store.banks().length + 1 }));
    if (name == null) return;
    var b = Store.addBank(String(name).trim());
    Store.setLastBank(b.id);
    renderBankSelect();
    renderBankList();
    fillLibBanks();
    setBankFilter(b.id);
    toast(I18N.tf('bank.created', { name: b.name }));
  }

  /** 表格里 "n more" / "Show less" 的展开状态，按单词 id 记，重渲染后不丢 */
  var expandedSenses = {};
  /** 上一次的排序结果：签名没变就照旧，别让展开操作把顺序打乱 */
  var sortSig = null;
  var sortOrder = [];

  function toggleSenses(id) {
    if (!id) return;
    if (expandedSenses[id]) delete expandedSenses[id];
    else expandedSenses[id] = true;
    renderWords();
  }

  /** 展开/收起一个词的完整词组列表（默认只露前 5 条） */
  function toggleCombos(id) {
    if (!id) return;
    if (expandedCombos[id]) delete expandedCombos[id];
    else expandedCombos[id] = true;
    renderWords();
  }

  /** 展开/收起某一条义项或词语组合的例句 —— 只动 DOM，不动列表顺序 */
  function toggleExamples(key) {
    if (!key) return;
    var open = !openItems[key];
    if (open) openItems[key] = true; else delete openItems[key];
    var box = document.querySelector('[data-ex="' + key.replace(/"/g, '\\"') + '"]');
    var head = document.querySelector('[data-exp="' + key.replace(/"/g, '\\"') + '"]');
    if (box) box.hidden = !open;
    if (head) head.classList.toggle('open', open);
  }

  /* ---------- chips / segmented ---------- */
  function weakChips(container, selected, onToggle) {
    container.innerHTML = WEAK_KEYS.map(function (k) {
      var L = I18N.weakLabel(k);
      return '<span class="chip t-' + k + (selected.indexOf(k) >= 0 ? ' on' : '') + '" data-w="' + k +
        '" title="' + esc(L.label + ' — ' + L.desc) + '">' +
        esc(L.label) + '</span>';
    }).join('');
    container.onclick = function (e) {
      var c = e.target.closest('.chip');
      if (c) onToggle(c.getAttribute('data-w'));
    };
  }

  function masterySeg(container, value, onSet) {
    container.innerHTML = MASTERY.map(function (m, i) {
      var lbl = I18N.masteryLabel(i);
      return '<button class="seg-btn' + (i === value ? ' active' : '') + '" data-m="' + i + '">' + esc(lbl) + '</button>';
    }).join('');
    container.onclick = function (e) {
      var b = e.target.closest('.seg-btn');
      if (b) onSet(parseInt(b.getAttribute('data-m'), 10));
    };
  }

  /* ---------- word modal（也用作「逐个打分」的向导） ---------- */
  var wizardQueue = [];      // 还没填的单词（来自词库多选）
  var wizardTotal = 0;
  var wizardDone = 0;
  var wizardNolib = false;   // 词库外的词：向导只选薄弱点，不进本、不设掌握度
  var wizardCur = null;      // nolib 向导当前这张卡对应的本轮词条
  var nolibRoundN = 0;       // 本轮一共加进了几个词（含本里的），收尾提示用
  var modalBank = '';
  /* 阅读任务的「标记已读」流程：一个词一张卡，改掌握度 / 薄弱点 / 备注 */
  var reviewQueue = [];
  var reviewTotal = 0;
  var reviewDone = 0;
  var reviewTask = null;
  var reviewCur = null;

  function fillBankSelect() {
    var sel = el('mBank');
    if (!sel) return;
    if (!modalBank) modalBank = Store.lastBankId();
    sel.innerHTML = Store.banks().map(function (b) {
      return '<option value="' + b.id + '">' + esc(b.name) + '</option>';
    }).join('');
    sel.value = modalBank;
  }

  /** 把一份数据铺到表单上 */
  function fillForm(s) {
    s = s || {};
    el('mWord').value = s.word || '';
    el('mPos').value = s.pos || '';
    posSeed = s.pos || '';
    el('mPhonetic').value = s.phonetic || '';
    modalCombos = (s.combos || []).map(function (c) {
      return typeof Word !== 'undefined' ? Word.combo(c) : { t: 'phrase', k: String(c), d: '', e: [] };
    });
    el('mNote').value = s.note || '';
    var msg = el('mLookupMsg');
    if (msg) { msg.textContent = ''; msg.className = 'm-msg'; }
    modalSenses = (s.senses || []).map(function (x) {
      return typeof Word !== 'undefined' ? Word.sense(x) : { p: '', l: '', d: String(x), e: [] };
    });
    if (!modalSenses.length) modalSenses = [{ p: '', l: '', d: '', e: [] }];    modalUnsure = (s.unsureSenses || []).slice();
    renderSenseEditor();
    renderComboEditor();
    updatePosField();
    modalMastery = (s.mastery == null) ? 1 : s.mastery;
    modalWeak = (s.weak || []).slice();
    modalBank = s.bankId || Store.lastBankId();
    fillBankSelect();
    renderProgressInputs();
    renderUnsure();   // 换了一个词就按这个词的薄弱点重算「不熟义项」区域的显隐
  }

  /** 掌握度星 + 薄弱点 chips：fillForm（打开表单）与 fillFrom（查词典回填）共用 */
  function renderProgressInputs() {
    (function renderSeg() { masterySeg(el('mMastery'), modalMastery, function (v) { modalMastery = v; renderSeg(); }); })();
    (function renderChips() {
      weakChips(el('mWeak'), modalWeak, function (k) {
        var i = modalWeak.indexOf(k);
        if (i >= 0) modalWeak.splice(i, 1); else modalWeak.push(k);
        renderChips();
        renderUnsure();       // 勾/取消「一次多义」时，下面那块要跟着出现/消失
      });
    })();
  }

  /* ---------- 义项编辑：一条一个输入框 ---------- */
  var modalSenses = [];
  var modalUnsure = [];      // 哪几条义项还不熟（只在薄弱点勾了「一次多义」时用）
  var modalCombos = [];      // 表单里当前的组合
  var posSeed = '';          // 释义里没填词性时兜底用的老 POS

  /** POS 不再手填：从各释义的词性框里自动摘（去重、按顺序、/ 连接） */
  function derivePos() {
    var seen = [], out = [];
    modalSenses.forEach(function (s) {
      var p = (s.p || '').trim();
      if (p && seen.indexOf(p.toLowerCase()) < 0) { seen.push(p.toLowerCase()); out.push(p); }
    });
    return out.join(' / ');
  }

  function updatePosField() {
    var inp = el('mPos');
    if (!inp) return;
    syncSensesFromDom();        // 先把词性框里刚敲的字收进来
    inp.value = derivePos() || posSeed;
  }

  /** 例句框里的内容：一行一条 */
  function exLines(v) {
    return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function senseRowHtml(s, i) {
    var ex = (s.e || []).join('\n');
    var rows = Math.max(1, Math.min(4, (s.e || []).length));
    return '<div class="sense-item">' +
      '<div class="sense-row">' +
        '<input class="input sr-pos" data-sp="' + i + '" value="' + esc(s.p || '') +
          '" placeholder="' + esc(I18N.t('f.posPh')) + '" autocomplete="off">' +
        '<input class="input sr-def" data-sd="' + i + '" value="' + esc(s.d || '') +
          '" placeholder="' + esc(I18N.t('f.defPh')) + '" autocomplete="off">' +
        '<button class="icon-btn sr-del" data-sdel="' + i + '" title="' + esc(I18N.t('btn.removeSense')) + '">✕</button>' +
      '</div>' +
      '<textarea class="input sr-ex" data-se="' + i + '" rows="' + rows + '" placeholder="' +
        esc(I18N.t('f.exPh')) + '">' + esc(ex) + '</textarea>' +
    '</div>';
  }

  function renderSenseEditor() {
    var box = el('mSenseList');
    if (!box) return;
    box.innerHTML = modalSenses.map(senseRowHtml).join('');
    growAllEx();
    renderUnsure();
  }

  /** 例句框跟着内容长高（一行一条，别让用户在小框里滚） */
  function growTextarea(ta) {
    if (!ta || !ta.style) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(120, Math.max(30, ta.scrollHeight)) + 'px';
  }
  function growAllEx() {
    if (!el('mSenseList')) return;
    Array.prototype.forEach.call(el('mSenseList').querySelectorAll('[data-se]'), growTextarea);
  }

  /** 把输入框里的内容写回 modalSenses（重绘前必须先调，否则刚敲的字会丢） */
  function syncSensesFromDom() {
    if (!el('mSenseList')) return;
    Array.prototype.forEach.call(el('mSenseList').querySelectorAll('[data-sd]'), function (inp) {
      var i = parseInt(inp.getAttribute('data-sd'), 10);
      if (modalSenses[i]) modalSenses[i].d = inp.value;
    });
    Array.prototype.forEach.call(el('mSenseList').querySelectorAll('[data-sp]'), function (inp) {
      var i = parseInt(inp.getAttribute('data-sp'), 10);
      if (modalSenses[i]) modalSenses[i].p = inp.value;
    });
    Array.prototype.forEach.call(el('mSenseList').querySelectorAll('[data-se]'), function (inp) {
      var i = parseInt(inp.getAttribute('data-se'), 10);
      if (modalSenses[i]) modalSenses[i].e = exLines(inp.value);
    });
  }

  function addSense() {
    syncSensesFromDom();
    modalSenses.push({ p: '', l: '', d: '', e: [] });
    renderSenseEditor();
    updatePosField();
    var all = el('mSenseList').querySelectorAll('[data-sd]');
    if (all.length) all[all.length - 1].focus();
  }

  function removeSense(i) {
    syncSensesFromDom();
    if (modalSenses.length <= 1) { modalSenses[0] = { p: '', l: '', d: '', e: [] }; }
    else modalSenses.splice(i, 1);
    modalUnsure = [];
    renderSenseEditor();
    updatePosField();
  }

  /** 勾了「一次多义」才有这一块：选哪几条义项还不熟 */
  function renderUnsure() {
    var wrap = el('mUnsureWrap');
    var box = el('mUnsure');
    if (!wrap || !box) return;
    var on = modalWeak.indexOf('polysemy') >= 0 && modalSenses.length > 1;
    wrap.hidden = !on;
    if (!on) return;
    box.innerHTML = modalSenses.map(function (s, i) {
      var pick = modalUnsure.indexOf(i) >= 0;
      var lbl = (s.p ? s.p + ' · ' : '') + (s.d || '—').slice(0, 40);
      return '<span class="chip' + (pick ? ' on' : '') + '" data-unsure="' + i + '" title="' + esc(s.d || '') + '">' +
        (i + 1) + '. ' + esc(lbl) + '</span>';
    }).join('');
  }

  function toggleUnsure(i) {
    var at = modalUnsure.indexOf(i);
    if (at >= 0) modalUnsure.splice(at, 1); else modalUnsure.push(i);
    renderUnsure();
  }

  /* ---------- 词语组合编辑：一条一个卡片（和义项一样） ---------- */
  var COMBO_TYPES = ['phrase', 'phrasal', 'idiom', 'collocation'];

  function comboRowHtml(c, i) {
    var ex = (c.e || []).join('\n');
    var rows = Math.max(1, Math.min(4, (c.e || []).length));
    var opts = COMBO_TYPES.map(function (t) {
      return '<option value="' + t + '"' + ((c.t || 'phrase') === t ? ' selected' : '') + '>' +
        esc(I18N.t('combo.' + t)) + '</option>';
    }).join('');
    return '<div class="combo-item">' +
      '<div class="combo-row">' +
        '<select class="input cr-type" data-ctype="' + i + '" title="' + esc(I18N.t('f.combos')) + '">' + opts + '</select>' +
        '<input class="input cr-key" data-ck="' + i + '" value="' + esc(c.k || '') +
          '" placeholder="' + esc(I18N.t('f.comboKeyPh')) + '" autocomplete="off">' +
        '<button class="icon-btn cr-del" data-cdel="' + i + '" title="' + esc(I18N.t('btn.removeCombo')) + '">✕</button>' +
      '</div>' +
      '<input class="input cr-def" data-cd="' + i + '" value="' + esc(c.d || '') +
        '" placeholder="' + esc(I18N.t('f.comboDefPh')) + '" autocomplete="off">' +
      '<textarea class="input cr-ex" data-ce="' + i + '" rows="' + rows + '" placeholder="' +
        esc(I18N.t('f.exPh')) + '">' + esc(ex) + '</textarea>' +
    '</div>';
  }

  function renderComboEditor() {
    var box = el('mComboList');
    if (!box) return;
    if (!modalCombos.length) modalCombos = [{ t: 'phrase', k: '', d: '', e: [] }];
    box.innerHTML = modalCombos.map(comboRowHtml).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-ce]'), growTextarea);
  }

  /** 把输入框里的内容写回 modalCombos（保存前必须先调） */
  function syncCombosFromDom() {
    var box = el('mComboList');
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('[data-ctype]'), function (sel) {
      var i = parseInt(sel.getAttribute('data-ctype'), 10);
      if (modalCombos[i]) modalCombos[i].t = sel.value;
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-ck]'), function (inp) {
      var i = parseInt(inp.getAttribute('data-ck'), 10);
      if (modalCombos[i]) modalCombos[i].k = inp.value.trim();
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-cd]'), function (inp) {
      var i = parseInt(inp.getAttribute('data-cd'), 10);
      if (modalCombos[i]) modalCombos[i].d = inp.value.trim();
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-ce]'), function (ta) {
      var i = parseInt(ta.getAttribute('data-ce'), 10);
      if (modalCombos[i]) modalCombos[i].e = exLines(ta.value);
    });
  }

  function addCombo() {
    syncCombosFromDom();
    modalCombos.push({ t: 'phrase', k: '', d: '', e: [] });
    renderComboEditor();
    var all = el('mComboList').querySelectorAll('[data-ck]');
    if (all.length) all[all.length - 1].focus();
  }

  function removeCombo(i) {
    syncCombosFromDom();
    if (modalCombos.length <= 1) { modalCombos[0] = { t: 'phrase', k: '', d: '', e: [] }; }
    else modalCombos.splice(i, 1);
    renderComboEditor();
  }

  /** 保存用的干净列表：没有词组的条目丢掉 */
  function cleanCombos() {
    syncCombosFromDom();
    return modalCombos.filter(function (c) { return c.k; })
      .map(function (c) { return { t: c.t || 'phrase', k: c.k, d: (c.d || '').trim(), e: (c.e || []).slice() }; });
  }

  /**
   * 词典字段默认收起：先让你看到要填的掌握度 / 薄弱点 / 备注。
   * openDetails 决定这次进来时是摊开还是收着 —— 词库编辑主要用「显示」，
   * 打分流 / 加词主要用「隐藏」，两边不共享上一次的状态。
   */
  function setCompact(on, openDetails) {
    var box = el('wordModal') && el('wordModal').querySelector('.modal-box');
    if (!box) return;
    box.classList.toggle('compact', !!on);
    var d = el('mDetails');
    if (d) d.classList.toggle('open', !!on && !!openDetails);
    syncDetailsBtn();
  }

  /** 按钮文案要区分「展开」和「收起」，只写 Details 看不出状态 */
  function syncDetailsBtn() {
    var btn = el('mDetailsBtn');
    var d = el('mDetails');
    if (!btn || !d) return;
    btn.hidden = false;
    var open = d.classList.contains('open') || !d.closest('.modal-box').classList.contains('compact');
    btn.textContent = I18N.t(open ? 'btn.detailsHide' : 'btn.detailsShow');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toggleDetails() {
    var d = el('mDetails');
    if (!d) return;
    syncSensesFromDom();
    d.classList.toggle('open');
    syncDetailsBtn();
  }

  function openWordModal(id) {
    cancelReview();
    modalImportSingle = false;
    wizardQueue = []; wizardTotal = 0; wizardDone = 0;
    modalEditId = id || null;
    modalLibWord = null;
    el('mLookup').hidden = false;   /* 单词本弹窗没有「从词典导入」键 */
    el('mLibHint').hidden = true;   /* 「改内容会变成自己的词条」提示只在词库模式显示 */
    var box = el('wordModal').querySelector('.modal-box');
    if (box) box.classList.remove('lib-mode');
    var w = id ? Store.get(id) : null;
    el('modalTitle').textContent = I18N.t(w ? 'modal.editTitle' : 'modal.addTitle');
    el('mDelete').hidden = !w;
    el('mSave').textContent = I18N.t('btn.save');
    setCompact(true, false);   // 词典字段先收着，掌握度/薄弱点/备注在最前面
    fillForm(w ? {
      word: w.word, pos: w.pos, phonetic: w.phonetic,
      senses: w.senses, combos: w.combos,
      note: w.note, mastery: w.mastery, weak: w.weak, bankId: w.bankId,
      unsureSenses: w.unsureSenses
    } : {});
    el('mGloss').textContent = w && w.senses && w.senses[0] ? w.senses[0].d : '';
    syncDetailsBtn();
    el('wordModal').hidden = false;
    setTimeout(function () { el('mWord').focus(); }, 30);
  }

  /** 从词库多选后进入：一个一个填掌握度 / 薄弱点 / 备注。
   *  nolib=true 时是「词库外的词」专用流程：只选薄弱点（不选掌握度、不进本）。 */
  function openWizard(entries, nolib) {
    cancelReview();
    wizardQueue = (entries || []).slice();
    wizardTotal = wizardQueue.length;
    wizardDone = 0;
    modalEditId = null;
    wizardNolib = !!nolib;
    if (!wizardQueue.length) { wizardNolib = false; return; }
    modalBank = '';
    nextWizard();
  }

  /** 词库外的词 → 只选薄弱点，选完直接关掉选词页面 */
  function openNolibWizard(items) {
    openWizard(items, true);
  }

  function nextWizard() {
    var e = wizardQueue.shift();
    if (!e) return;
    wizardCur = e;
    el('mDelete').hidden = true;
    setCompact(true, false);
    if (wizardNolib) {
      el('modalTitle').textContent = I18N.tf('modal.weakWizard', { i: wizardDone + 1, n: wizardTotal });
      el('mLibHint').hidden = true;
      el('mLookup').hidden = true;      // 不进本，不用从词典拉释义
      el('mMasteryWrap').hidden = true; // 没有掌握度可设
      el('mBankWrap').hidden = true;    // 不进任何单词本
    } else {
      el('modalTitle').textContent = I18N.tf('modal.wizard', { i: wizardDone + 1, n: wizardTotal });
      el('mLibHint').hidden = false;   /* 词库向导也是词库模式，声明要显示 */
      el('mLookup').hidden = false;
      el('mMasteryWrap').hidden = false;
      el('mBankWrap').hidden = false;
    }
    el('mSave').textContent = wizardQueue.length ? I18N.t('btn.saveNext') : I18N.t('btn.save');
    fillForm({
      word: e.word, pos: e.pos, phonetic: e.phonetic,
      senses: e.senses, combos: e.combos,
      note: '', mastery: wizardNolib ? 0 : 1, weak: [],
      bankId: modalBank || Store.lastBankId()
    });
    if (el('mGloss')) el('mGloss').textContent = (e.senses && e.senses[0]) ? e.senses[0].d : '';
    el('wordModal').hidden = false;
    setTimeout(function () { el('mWord').focus(); el('mWord').select(); }, 30);
  }

  /** 词库外的词选完薄弱点：只挂在本轮，不写进任何单词本 */
  function saveNolibWizard() {
    if (wizardCur) {
      wizardCur.weak = modalWeak.slice();
      wizardCur.unsureSenses = modalWeak.indexOf('polysemy') >= 0
        ? modalUnsure.filter(function (i) { return i < wizardCur.senses.length; })
        : [];
    }
    wizardDone++;
    if (wizardQueue.length) { nextWizard(); return; }
    el('wordModal').hidden = true;
    el('pickModal').hidden = true;   // 选完直接关闭手动选取页面
    wizardNolib = false; wizardCur = null;
    var n = wizardTotal;
    wizardTotal = 0; wizardDone = 0;
    renderAll();
    toast(I18N.tf('lib.addedRound', { n: nolibRoundN || n }));
  }

  /* ---------- 阅读任务：标记已读 → 一张卡一个词 ---------- */
  /** 这条任务里还要打分的词：没打过分的，且没被回传成「文章没用上」的 */
  function pendingOf(t) {
    var done = t.reviewed || [];
    var skipped = t.unused || [];
    return (t.wordIds || []).filter(function (id) {
      return done.indexOf(id) < 0 && skipped.indexOf(id) < 0 && !!Store.get(id);
    });
  }

  function taskById(id) {
    return Store.tasks().filter(function (x) { return x.id === id; })[0] || null;
  }

  /**
   * 开始逐个过词。onlyId 传了就是只过这一个（点词上的小键）。
   * 全部过完再点，就整轮重来一遍 —— 复习本来就可以重复。
   */
  function openReview(taskId, onlyId) {
    var t = taskById(taskId);
    if (!t) return;
    /* 词片是按任务快照渲染的，词可能已经被删了 */
    if (onlyId && !Store.get(onlyId)) { toast(I18N.t('msg.wordGone')); return; }
    var ids = onlyId ? [onlyId] : pendingOf(t);
    if (!ids.length) {
      /* 整轮重来：清掉打分记录，但回传成「没用到」的词仍然不参与 */
      Store.updateTask(taskId, { reviewed: [] });
      ids = pendingOf(taskById(taskId));
    }
    if (!ids.length) { toast(I18N.t('msg.pickFirst')); return; }
    reviewQueue = ids.slice();
    reviewTotal = reviewQueue.length;
    reviewDone = 0;
    reviewTask = taskId;
    wizardTotal = 0; wizardDone = 0;
    nextReview();
  }

  function nextReview() {
    var id = reviewQueue.shift();
    if (!id) { finishReview(); return; }
    var w = Store.get(id);
    if (!w) { nextReview(); return; }
    reviewCur = id;
    modalEditId = id;
    modalLibWord = null;
    var box = el('wordModal').querySelector('.modal-box');
    if (box) box.classList.remove('lib-mode');
    el('mDelete').hidden = true;
    setCompact(true, false);             // 先看掌握度 / 薄弱点 / 备注
    el('modalTitle').textContent = I18N.tf('review.title', { i: reviewDone + 1, n: reviewTotal });
    el('mSave').textContent = reviewQueue.length ? I18N.t('review.next') : I18N.t('review.finish');
    fillForm({
      word: w.word, pos: w.pos, phonetic: w.phonetic,
      senses: w.senses, combos: w.combos, note: w.note,
      mastery: w.mastery, weak: w.weak, bankId: w.bankId, unsureSenses: w.unsureSenses
    });
    if (el('mGloss')) el('mGloss').textContent = (w.senses && w.senses[0]) ? w.senses[0].d : '';
    syncDetailsBtn();
    el('wordModal').hidden = false;
  }

  /**
   * 存完一张卡：记进任务的 reviewed，然后下一张；队列空了就收尾。
   * 打分即复习（间隔照常推进）；掌握度 / 薄弱点没变的词只推进一半，
   * 让它比「有进步」的词更早回到队列里。
   */
  function advanceReview(changed) {
    var t = taskById(reviewTask);
    if (t && reviewCur) {
      var done = (t.reviewed || []).slice();
      if (done.indexOf(reviewCur) < 0) {
        done.push(reviewCur);
        Store.scheduleAfterUse([reviewCur], changed ? 1 : 0.5);
      }
      Store.updateTask(t.id, { reviewed: done });
    }
    reviewDone++;
    nextReview();
  }

  /** 中途退出复习：清掉队列，任务保持「待阅读」状态，下次还能接着过 */
  function cancelReview() {
    reviewTask = null; reviewCur = null;
    wizardNolib = false; wizardCur = null;
    reviewQueue = []; reviewTotal = 0; reviewDone = 0;
  }

  function finishReview() {
    var n = reviewTotal;
    var tid = reviewTask;
    el('wordModal').hidden = true;
    /* 只复习了其中一个词 ≠ 整个任务读完：等所有词都打分/回传了才算完成 */
    if (tid) {
      var t = taskById(tid);
      if (t && pendingOf(t).length === 0) Store.updateTask(tid, { done: true, doneAt: Date.now() });
    }
    reviewTask = null; reviewCur = null; reviewTotal = 0; reviewDone = 0;
    renderLog(); renderStats(); renderWords();
    toast(I18N.tf('review.done', { n: n }));
  }

  /** 两个薄弱点列表是不是同一组（顺序无关） */
  function sameList(a, b) {
    a = (a || []).slice().sort();
    b = (b || []).slice().sort();
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function saveWordModal() {
    if (wizardNolib) { saveNolibWizard(); return; }   // 词库外的词：只收薄弱点，不进 store
    if (modalLibWord !== null) { saveLibWord(); return; }
    var word = el('mWord').value.trim();
    if (!word) { toast(I18N.t('msg.wordEmpty')); return; }
    if (modalEditId) captureWordAnchor(modalEditId);   // 保存后行可能重排，先把位置记下
    syncSensesFromDom();
    var senses = modalSenses.filter(function (s) { return (s.d || '').trim(); })
      .map(function (s) { return { p: (s.p || '').trim(), l: s.l || '', d: s.d.trim(), e: (s.e || []).slice() }; });
    var combos = cleanCombos();
    /* 勾了「一次多义」但没选具体义项时，默认把第一条之后的全算不熟 */
    var unsure = modalWeak.indexOf('polysemy') >= 0
      ? modalUnsure.filter(function (i) { return i < senses.length; })
      : [];
    var data = {
      word: word,
      bankId: (el('mBank') && el('mBank').value) || Store.lastBankId(),
      pos: derivePos() || posSeed,
      phonetic: el('mPhonetic').value.trim(),
      senses: senses,
      combos: combos,
      unsureSenses: unsure,
      mastery: modalMastery,
      weak: modalWeak.slice(),
      note: el('mNote').value.trim()
    };
    /* 推荐权重（下次复习时间）只在三种时候变：
       ① 手动改了掌握度 / 薄弱点；② 阅读任务里打了分；③ 新加单词。
       单纯改备注、义项、例句不动它。 */
    var progressChanged = false;
    if (modalEditId) {
      var prev = Store.get(modalEditId);
      /* 改名 / 换本防重：只有当这次改动会让词落进「同本已有同词副本」时才拦
         （否则同本重复、进度还会串到一起）。不改名不换本的普通编辑永不拦 ——
         存档里就算真有一对重复词，也得能打开编辑去修内容。 */
      var renamed = prev && prev.word.toLowerCase() !== word.toLowerCase();
      var moved = prev && prev.bankId !== data.bankId;
      if (renamed || moved) {
        var clash = null;
        Store.all().forEach(function (w) {
          if (w.id !== modalEditId && w.bankId === data.bankId &&
              w.word.toLowerCase() === word.toLowerCase()) clash = w;
        });
        if (clash) { toast(I18N.tf('msg.dupWord', { w: word })); return; }
      }
      var prevMastery = prev ? prev.mastery : null;
      var prevWeak = prev ? prev.weak : null;
      progressChanged = (prevMastery !== null && prevMastery !== data.mastery) ||
        !sameList(prevWeak, data.weak);
      Store.update(modalEditId, data);
      /* 掌握度 / 薄弱点变了就按当前掌握度重排下次复习时间 */
      if (progressChanged) {
        Store.setMastery(modalEditId, data.mastery);
      }
      /* 备注/释义是对「词库里的这个词」的认知，一起写回词库，下次从词库取还是最新的 */
      if (typeof Dict !== 'undefined') Dict.upsert(syncToDict(data));
    } else {
      // 手工添加时防重：同一个单词本里已有这个词就拦下来（向导那边已经预先过滤过）
      if (Store.has(word, data.bankId)) {
        toast(I18N.tf('msg.dupWord', { w: word }));
        return;
      }
      /* 这个词在别的单词本里已经有了：掌握度 / 薄弱点是「这个词」的，直接沿用，
         不吃表单上的默认值 */
      var twin = Store.findAny(word);
      if (twin) {
        data.mastery = twin.mastery;
        data.weak = (twin.weak || []).slice();
        data.unsureSenses = (twin.unsureSenses || []).slice();
      }
      Store.add(data);          // 新词默认就是「到期」，天然有最高推荐权重
      /* 手动加的词也进词库，下次能直接在词库里搜到、取用 */
      if (typeof Dict !== 'undefined') Dict.upsert(syncToDict(data));
    }

    /* 同一个词在其他单词本里的副本：掌握度 / 薄弱点一起改（共享学习进度） */
    if (modalEditId) {
      Store.syncProgress(word, {
        mastery: data.mastery, weak: data.weak, unsureSenses: data.unsureSenses
      }, modalEditId);
    }

    /* 阅读任务复习：存一个就接下一个，队列空了自动收尾（任务标成已完成）。
       打了分就一定算复习过；但掌握度 / 薄弱点没变的词，下次出现得稍早一点
       （间隔减半），给还没巩固住的词多留一点权重。 */
    if (reviewTask) { advanceReview(progressChanged); return; }

    // 向导模式：存完一个马上接下一个，最后才关窗
    if (wizardTotal) {
      wizardDone++;
      modalBank = data.bankId;
      if (wizardQueue.length) { nextWizard(); return; }
      el('wordModal').hidden = true;
      renderAll();
      toast(I18N.tf('msg.wizardDone', { n: wizardTotal }));
      wizardTotal = 0; wizardDone = 0;
      return;
    }

    el('wordModal').hidden = true;
    renderAll();
    toast(modalEditId ? I18N.t('msg.saved') : I18N.tf('msg.added', { w: word }));
  }

  /** 单词本里的词 → 词库条目（备注、释义、组合都带上，两边保持一致）。
   *  内容（除掌握度 / 薄弱点 / 备注）和词库现有条目一致 → 保留词典来源，不算手动补充的；
   *  改过内容 → 变成 'mine'。 */
  function syncToDict(w) {
    var prev = (typeof Dict !== 'undefined') ? Dict.find(w.word) : null;
    var source = (prev && prev.source && Store.matchesDictContent(w, prev)) ? prev.source : 'mine';
    return {
      word: w.word,
      pos: w.pos || '',
      phonetic: w.phonetic || '',
      senses: (w.senses || []).slice(),
      combos: (w.combos || []).slice(),
      note: w.note || '',
      source: source,
      updated: Date.now()
    };
  }

  /* ---------- 发音 ---------- */
  var audioBtn = null;
  /** 只用系统语音：离线环境里下载音频本来就不可能 */
  function speak(word) {
    if (!word) return false;
    var ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return false;
    try {
      ss.cancel();
      var u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-GB';
      u.rate = 0.92;
      ss.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function stopAudio() {
    if (audioBtn) { audioBtn.classList.remove('playing'); audioBtn = null; }
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  /** 单词一律用系统语音念（不想听就别点播放键，没有别的开关） */
  function playAudio(url, btn, word) {
    stopAudio();
    if (speak(word)) {
      if (btn) {
        btn.classList.add('playing');
        audioBtn = btn;
        setTimeout(function () {
          if (audioBtn === btn) { btn.classList.remove('playing'); audioBtn = null; }
        }, 1200);
      }
    } else {
      toast(I18N.t('msg.noAudio'));
    }
  }

  function renderModalChips() {
    weakChips(el('mWeak'), modalWeak, function (k) {
      var i = modalWeak.indexOf(k);
      if (i >= 0) modalWeak.splice(i, 1); else modalWeak.push(k);
      renderModalChips();
    });
  }

  /* ---------- 从词典导入（常驻按钮） ---------- */
  /* 浏览器直接连牛津/柯林斯会被 CORS 拦死，所以「导入」只查本地词库：
     自己用抓词工具抓回来 / 手动录入 / 导入的词条，共用同一个入口。 */
  function setLookupMsg(html, kind) {
    var n = el('mLookupMsg');
    if (!n) return;
    n.innerHTML = html || '';
    n.className = 'm-msg' + (kind ? ' ' + kind : '');
  }

  /** 命中：把词性 / 音标 / 义项 / 词组铺进表单；没命中：提示去抓词 */
  function fillFrom(d, viaStem) {
    if (d.pos) el('mPos').value = d.pos;
    if (d.phonetic) el('mPhonetic').value = d.phonetic;
    if (d.senses && d.senses.length) {
      modalSenses = d.senses.map(function (s) {
        return typeof Word !== 'undefined' ? Word.sense(s) : { p: '', l: '', d: String(s), e: [] };
      });
      modalUnsure = [];
      renderSenseEditor();
    }
    if (d.combos && d.combos.length) {
      modalCombos = d.combos.map(function (c) {
        return typeof Word !== 'undefined' ? Word.combo(c) : { t: 'phrase', k: String(c), d: '', e: [] };
      });
      renderComboEditor();
    }
    if (d.note && !el('mNote').value.trim()) el('mNote').value = d.note;
    el('mGloss').textContent = (d.senses && d.senses[0]) ? (d.senses[0].d || '') : '';
    updatePosField();
    /* 这个词在某个单词本里已经有了：掌握度 / 薄弱点是「这个词」的，
       直接铺进表单，别让用户对着默认值再设一遍（保存时本来就会沿用） */
    var twin = (!modalEditId && !modalLibWord) ? Store.findAny(d.word) : null;
    if (twin) {
      modalMastery = twin.mastery;
      modalWeak = (twin.weak || []).slice();
      modalUnsure = (twin.unsureSenses || []).filter(function (i) { return i < modalSenses.length; });
      renderProgressInputs();
      renderUnsure();
    }
    setLookupMsg(I18N.tf('msg.filled', {
      n: (d.senses || []).length,
      m: (d.combos || []).length,
      stem: viaStem ? I18N.tf('msg.viaStem', { w: esc(viaStem) }) : ''
    }) + (twin ? ' ' + esc(I18N.t('msg.twinSeeded')) : ''), 'ok');
  }

  function pullFromDict() {
    var raw = el('mWord').value.trim();
    if (!raw) { toast(I18N.t('msg.typeWord')); el('mWord').focus(); return null; }
    var hit = Dict.find(raw);
    if (!hit) {
      /* 提示就在输入框正下方，永远不会被折叠面板藏起来 */
      setLookupMsg(I18N.tf('msg.notInDict', { w: esc(raw), n: Dict.count().total }), 'bad');
      return null;
    }
    var same = hit.word.toLowerCase() === raw.toLowerCase();
    fillFrom(hit, same ? '' : hit.word);
    return hit;
  }

  /* ---------- 词库条目编辑（词库里那支笔 / 导入时的「只加一个词」） ---------- */
  var modalLibWord = null;    // 非空表示这次保存写词库，不写单词本

  var modalImportSingle = false;   // 从导入弹窗「只加一个词」进来的
  function openLibWordModal(word, fromImport) {
    wizardQueue = []; wizardTotal = 0; wizardDone = 0;
    modalEditId = null;
    modalLibWord = String(word || '').trim();
    modalImportSingle = !!fromImport;
    /* 导入里的「添加一个词」不放「从词典导入」键 —— 那是词库编辑用的 */
    el('mLookup').hidden = !!fromImport;
    el('mLibHint').hidden = false;  /* 词库模式：声明「改内容会变成自己的词条」 */
    var box = el('wordModal').querySelector('.modal-box');
    box.classList.add('lib-mode');
    el('modalTitle').textContent = I18N.t(modalLibWord ? 'modal.libEdit' : 'modal.libAdd');
    el('mDelete').hidden = true;
    el('mSave').textContent = I18N.t('btn.save');
    /* 词库编辑主要就是改释义 / 例句，所以这次进来直接摊开 */
    setCompact(true, true);
    var hit = modalLibWord ? Dict.find(modalLibWord) : null;
    fillForm(hit ? {
      word: hit.word, pos: hit.pos, phonetic: hit.phonetic,
      senses: hit.senses, combos: hit.combos, note: hit.note || '',
      mastery: 1, weak: []
    } : { word: modalLibWord });
    el('mGloss').textContent = hit && hit.senses[0] ? hit.senses[0].d : '';
    syncDetailsBtn();
    el('wordModal').hidden = false;
    setTimeout(function () { el('mWord').focus(); el('mWord').select(); }, 30);
  }

  function saveLibWord() {
    var word = el('mWord').value.trim();
    if (!word) { toast(I18N.t('msg.wordEmpty')); return; }
    syncSensesFromDom();
    var entry = {
      word: word,
      pos: derivePos() || posSeed,
      phonetic: el('mPhonetic').value.trim(),
      senses: modalSenses.filter(function (s) { return (s.d || '').trim(); })
        .map(function (s) { return { p: (s.p || '').trim(), l: s.l || '', d: s.d.trim(), e: (s.e || []).slice() }; }),
      combos: cleanCombos(),
      note: el('mNote').value.trim()
    };
    if (!entry.senses.length) { toast(I18N.t('msg.needSense')); return; }
    /* 内容没改就保留原来的来源（仍是词典词）；改了内容才算你自己添加的 */
    var prevLib = Dict.find(word);
    entry.source = (prevLib && prevLib.source && Store.matchesDictContent(entry, prevLib))
      ? prevLib.source : 'mine';
    /* 导入里的「只加一个词」+ 选了跳过 + 词库已有 → 词库那份不动 */
    if (modalImportSingle && !modalLibWord &&
        el('impPackDup') && el('impPackDup').value !== 'overwrite' && Dict.find(word)) {
      toast(I18N.tf('msg.libDupSkip', { w: word }));
    } else {
      Dict.upsert(entry);
    }
    modalImportSingle = false;
    el('wordModal').hidden = true;
    el('wordModal').querySelector('.modal-box').classList.remove('lib-mode');
    modalLibWord = null;
    if (!el('libModal').hidden) renderLib(el('libSearch').value);
    renderData();
    toast(modalEditId ? I18N.t('msg.saved') : I18N.tf('msg.libSaved', { w: word }));
  }

  /* ---------- forge controls ---------- */
  function buildForgeControls() {
    loadPrefs();
    buildWeakFocus([]);

    el('fLenPresets').innerHTML = LEN_PRESETS.map(function (n) {
      return '<span class="chip" data-len="' + n + '">' + n + '</span>';
    }).join('');
    el('fLenPresets').onclick = function (e) {
      var c = e.target.closest('[data-len]');
      if (c) { el('fLength').value = c.getAttribute('data-len'); syncAuto(); }
    };

    renderQTypeChips();
    el('fQTypes').onclick = function (e) {
      var c = e.target.closest('[data-q]');
      if (!c) return;
      var k = c.getAttribute('data-q');
      var i = qTypeSel.indexOf(k);
      if (i >= 0) { qTypeSel.splice(i, 1); }
      else {
        var cap = qTypeCap();
        if (qTypeSel.length >= cap) {
          toast(I18N.tf('msg.qTypeCap', { n: cap }));
          return;
        }
        qTypeSel.push(k);
      }
      renderQTypeChips();
    };
    el('fQStrict').addEventListener('change', renderQTypeChips);

    renderOutputChips();
    el('fOutputs').onclick = function (e) {
      var c = e.target.closest('[data-o]');
      if (!c) return;
      var k = c.getAttribute('data-o');
      OUTPUTS[k].on = !OUTPUTS[k].on;
      c.classList.toggle('on', OUTPUTS[k].on);
      el('fL1Wrap').hidden = !OUTPUTS.translation.on;
    };
    el('fL1Wrap').hidden = !OUTPUTS.translation.on;

    el('fLevel').onchange = function () {
      el('fLevelCustomWrap').hidden = this.value !== '__custom';
    };
    el('fTopic').onchange = function () {
      el('fTopicCustomWrap').hidden = this.value !== '__custom';
    };
    el('fQuestions').oninput = function () {
      renderQTypeChips();
    };

    el('fCount').oninput = function () { el('fCountVal').textContent = this.value; };
    el('fDiff').oninput = function () { el('fDiffVal').textContent = diffLabel(parseInt(this.value, 10)); };
    // 防止两端文字贴在一起
    var de = el('fDiff').parentNode.querySelector('.range-ends');
    if (de) de.style.gap = '8px';

    el('fLength').addEventListener('input', syncAuto);
    el('fCountAuto').addEventListener('change', syncAuto);
    el('fParasAuto').addEventListener('change', syncAuto);
    el('fQuestionsAuto').addEventListener('change', syncAuto);

    el('fCount').addEventListener('input', function () {
      el('fCountAuto').checked = false;         // 手动改过就不再自动跟随篇幅
      el('fCountVal').textContent = this.value;
    });
    el('fParas').addEventListener('input', function () { el('fParasAuto').checked = false; });
    el('fQuestions').addEventListener('input', function () {
      el('fQuestionsAuto').checked = false;
      renderQTypeChips();
    });
    // 手填完再裁（边打字边裁会把「12」打成「1」时把多选的题型吃掉）
    el('fQuestions').addEventListener('change', function () { trimQTypes(true); });
    /* 设置里勾「随篇幅自动调整」→ 数字框灰掉（跟篇幅走，填了也不生效）；
       取消勾选才能填固定默认值。是否自动以「保存时」的勾选状态为准。 */
    [['setCountAuto', 'setCount'], ['setParasAuto', 'setParas'], ['setQuestionsAuto', 'setQuestions']]
      .forEach(function (p) {
        el(p[0]).addEventListener('change', function () { el(p[1]).disabled = this.checked; });
      });

    applyPrefs();
  }

  /** 附加输出板块的 chips（语言切换时要重画） */
  function renderOutputChips() {
    el('fOutputs').innerHTML = Object.keys(OUTPUTS).map(function (k) {
      return '<span class="chip' + (OUTPUTS[k].on ? ' on' : '') + '" data-o="' + k + '">' +
        esc(I18N.t(OUTPUTS[k].k)) + '</span>';
    }).join('');
    el('fL1Wrap').hidden = !OUTPUTS.translation.on;
  }

  /* ---------- 题型：选中的种类不能多于题目数 ---------- */
  /** 选中的题型（跨语言重绘、跨重渲染都保持） */
  var qTypeSel = [];

  /** 还能再选几种：一道题最多一种题型；题目数为 0 时不限制 */
  function qTypeCap() {
    var n = num('fQuestions', 4);
    var all = Object.keys(PromptGen.Q_TYPES).length;
    return n > 0 ? Math.min(n, all) : all;
  }

  function renderQTypeChips() {
    var cap = qTypeCap();
    var full = qTypeSel.length >= cap;
    el('fQTypes').innerHTML = Object.keys(PromptGen.Q_TYPES).map(function (k) {
      var on = qTypeSel.indexOf(k) >= 0;
      return '<span class="chip' + (on ? ' on' : (full ? ' off' : '')) +
        '" data-q="' + k + '" title="' + esc(I18N.t('qt.' + k)) + '">' +
        esc(I18N.t('qt.' + k)) + '</span>';
    }).join('');
    var cnt = el('fQTypesCount');
    if (cnt) cnt.textContent = qTypeSel.length ? qTypeSel.length + ' / ' + cap : '';
    el('fQTypes').style.opacity = num('fQuestions', 4) > 0 ? '1' : '.4';
  }

  /** 题目数调小了：多出来的题型自动裁掉（只保留前几个） */
  function trimQTypes(announce) {
    var cap = qTypeCap();
    if (qTypeSel.length > cap) {
      qTypeSel = qTypeSel.slice(0, cap);
      if (announce) toast(I18N.tf('msg.qTypeTrim', { n: cap }));
    }
    renderQTypeChips();
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /** 难度滑块文案随语言切换 */
  function diffLabel(v) {
    return I18N.t(v < 30 ? 'forge.diff.known' : (v > 70 ? 'forge.diff.new' : 'forge.diff.balanced'));
  }

  /* 篇幅越长，目标词、段落、题目都应该跟着变多 */
  function autoCount(len)     { return clamp(Math.round(len / 40), 3, 30); }   // 每 40 词一个目标词
  function autoParas(len)     { return clamp(Math.round(len / 90), 2, 10); }   // 每段约 90 词
  function autoQuestions(len) { return clamp(Math.round(len / 100), 2, 8); }   // 每 100 词一道题

  function syncAuto() {
    var len = num('fLength', 360);
    if (el('fCountAuto').checked) {
      el('fCount').value = autoCount(len);
      el('fCountVal').textContent = el('fCount').value;
    }
    if (el('fParasAuto').checked) el('fParas').value = autoParas(len);
    if (el('fQuestionsAuto').checked) {
      el('fQuestions').value = autoQuestions(len);
      trimQTypes(false);
    }
  }

  function buildWeakFocus(arr) {
    weakFocus = arr.slice();
    weakChips(el('fWeakFocus'), arr, function (k) {
      var i = arr.indexOf(k);
      var next = arr.slice();
      if (i >= 0) next.splice(i, 1); else next.push(k);
      buildWeakFocus(next);
    });
  }

  function focusTypes() {
    return Array.prototype.map.call(el('fWeakFocus').querySelectorAll('.chip.on'),
      function (c) { return c.getAttribute('data-w'); });
  }
  function qTypes() {
    var n = num('fQuestions', 4);
    var sel = qTypeSel.slice();
    // 一道题最多一种题型；题目数为 0 时整节不生成
    return (n > 0 && sel.length > n) ? sel.slice(0, n) : sel;
  }

  function effectiveLevel() {
    var v = el('fLevel').value;
    if (v === '__custom') return (el('fLevelCustom').value || '').trim();
    return v;
  }
  function effectiveTopic() {
    var v = el('fTopic').value;
    if (v === '__custom') return (el('fTopicCustom').value || '').trim() || 'Any topic that fits the target words';
    return v;
  }

  function doPick(reroll) {
    var opts = {
      count: num('fCount', 10),
      focusTypes: focusTypes(),
      difficulty: num('fDiff', 50)
    };
    var res = reroll ? Scheduler.reroll(opts) : Scheduler.pick(opts);
    if (!res.length) { toast(I18N.t('msg.bankEmpty')); return; }
    picked = res.map(function (c) { return c.w; });
    renderPicks();
  }

  /** 选词列表可能被删/被改过：每次渲染前从 store 重新取一遍，别用旧快照。
   *  不在任何单词本里的词（nolib）不进 store，原样保留。 */
  function livePicks() {
    picked = picked.map(function (w) {
      if (w.nolib) return w;
      return Store.get(w.id);
    }).filter(Boolean);
    return picked;
  }

  function renderPicks() {
    var t = Date.now();
    livePicks();
    if (!picked.length) {
      el('pickList').innerHTML = '<p class="muted">' + I18N.t('pick.empty') + '</p>';
      return;
    }
    el('pickList').innerHTML = picked.map(function (w, i) {
      // 显示要练的义项：勾了「一次多义」的词优先显示还不熟的那几条；
      // 其它情况也至少给一条释义，不许空着
      var unsureIdx = (w.weak.indexOf('polysemy') >= 0 && w.unsureSenses) ? w.unsureSenses.slice(0, 3) : [];
      var targets = unsureIdx.length
        ? unsureIdx.map(function (i) { return w.senses[i]; }).filter(Boolean)
        : (w.senses.length > 1 ? w.senses.slice(1, 3) : w.senses.slice(0, 1));
      if (!targets.length && w.senses.length) targets = w.senses.slice(0, 1);
      var head;
      if (w.nolib) {
        /* 不在任何单词本里：红底标识，不显示推荐分（它不参与复习安排） */
        head = '<div class="pick-head"><b>' + esc(w.word) + '</b><span class="pos">' + esc(w.pos) + '</span>' +
          '<span class="pick-nolib" title="' + esc(I18N.t('tip.nolibPick')) + '">' + esc(I18N.t('pick.nolib')) + '</span></div>';
      } else {
        var s = Scheduler.score(w, { difficulty: num('fDiff', 50), focusTypes: focusTypes() }, t);
        var tip = I18N.tf('tip.score', {
          s: s.total.toFixed(2),
          d: s.parts.due.toFixed(2), m: s.parts.mastery.toFixed(2), t: s.parts.type.toFixed(2),
          n: s.parts.novel.toFixed(2), r: s.parts.recent.toFixed(2)
        });
        head = '<div class="pick-head"><b>' + esc(w.word) + '</b><span class="pos">' + esc(w.pos) + '</span>' +
          '<span class="pick-score" title="' + esc(tip) + '">' + s.total.toFixed(2) + '</span></div>';
      }
      return '<div class="pick-item' + (w.nolib ? ' nolib' : '') + '" data-id="' + esc(w.id) + '">' +
        '<span class="idx">' + (i + 1) + '</span>' +
        '<div class="pick-main">' +
          head +
          (targets.length ? '<div class="pick-sense"><span class="s-cap">' + esc(I18N.t('pick.willTarget')) + '</span>' +
            '<div class="sense-list">' + targets.map(function (se, si) {
              return senseItem(w, se, 'p' + si, null, true);
            }).join('') + '</div></div>' : '') +
          '<div class="pick-tags">' + w.weak.map(function (k) {
            return '<span class="tag t-' + k + '">' + esc(I18N.weakLabel(k).short) + '</span>';
          }).join('') + '</div>' +
        '</div>' +
        '<button class="pick-del" data-unpick="' + esc(w.id) + '" title="' + esc(I18N.t('tip.remove')) + '">✕</button>' +
      '</div>';
    }).join('');
  }

  function collectParams() {
    return {
      length: num('fLength', 360),
      paragraphs: num('fParas', 4),
      genre: el('fGenre').value,
      topic: effectiveTopic(),
      level: effectiveLevel(),
      coverage: num('fCoverage', 75),
      questions: num('fQuestions', 4),
      qTypes: qTypes(),
      qStrict: !!el('fQStrict').checked,
      l1: (el('fL1').value || 'Chinese').trim(),
      extra: el('fExtra').value,
      outputs: {
        glossary: OUTPUTS.glossary.on,
        translation: OUTPUTS.translation.on,
        answerKey: OUTPUTS.answerKey.on
      }
    };
  }

  function genPrompt() {
    livePicks();
    if (!picked.length) { toast(I18N.t('msg.pickFirst')); return; }
    var p = collectParams();
    var text = PromptGen.build(picked, p);
    el('promptOut').value = text;
    el('genInfo').textContent = text.length + ' chars · ' + picked.length + ' target words · ' +
      p.length + ' words · ' + p.questions + ' question' + (p.questions === 1 ? '' : 's');
  }

  /* ---------- 一键复制 ---------- */
  /** 老浏览器的兜底：临时 textarea + execCommand */
  function execCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) {}
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /** chatbox 风格反馈：按钮自己变成 Copied ✓，1.6s 后复原 */
  function markCopied(btn) {
    if (!btn) return;
    var lbl = btn.querySelector('.cl');
    if (!lbl) return;
    var done = btn.getAttribute('data-i18n-done') || 'btn.copied';
    var back = btn.getAttribute('data-i18n') || 'btn.copy';
    btn.classList.add('copied');
    lbl.textContent = I18N.t(done);
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function () {
      btn.classList.remove('copied');
      lbl.textContent = I18N.t(back);
    }, 1600);
  }

  function copyText(text, btn) {
    if (!text) { toast(I18N.t('copy.nothing')); return; }
    var done = function () { markCopied(btn); };
    var fail = function () { toast(I18N.t('copy.fail')); };
    // 只要浏览器给了 clipboard 就用它；非安全上下文里它本来就是 undefined，
    // 因此不必再额外判断 isSecureContext（jsdom / file:// 下该标志可能为 false）
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        if (execCopy(text)) done(); else fail();
      });
      return;
    }
    if (execCopy(text)) done(); else fail();
  }

  /** 通用复制按钮：data-copy-target 指向元素，或直接 data-copy-text */
  function handleCopyClick(btn) {
    var tid = btn.getAttribute('data-copy-target');
    var text = btn.getAttribute('data-copy-text');
    if (tid) {
      var t = el(tid);
      text = t ? t.value : '';
    }
    copyText(text || '', btn);
  }

  function copyPrompt() { handleCopyClick(el('btnCopy')); }

  function saveTask() {
    if (!picked.length) { toast(I18N.t('msg.pickFirst')); return; }
    var p = collectParams();
    var text = el('promptOut').value || PromptGen.build(picked, p);
    var t = Store.addTask({
      params: p,
      /* 词库外的词没有 store id，占位空串：打分、回传、复习安排都会自动跳过它们 */
      wordIds: picked.map(function (w) { return w.nolib ? '' : w.id; }),
      words: picked.map(function (w) { return { word: w.word, pos: w.pos, weak: w.weak.slice(), nolib: !!w.nolib }; }),
      prompt: text,
      /* 间隔从现在开始不推进：等你在阅读记录里逐个打完分才算练过 */
      deferred: true
    });
    toast(I18N.t('msg.taskSaved'));
    renderAll();
    switchTab('log');
  }

  /* ---------- 未用词回传 ---------- */
  var UNUSED_NOISE = { none: 1, nil: 1, na: 1, 'n/a': 1, '—': 1, '-': 1, '–': 1, '': 1,
                        unused: 1, target: 1, words: 1, word: 1, list: 1 };

  /**
   * 从任意一段 AI 输出里挖出 UNUSED 行的内容。
   * 返回 null = 明确没找到（此时不该把整篇文章当词表解析）。
   */
  function findUnusedLine(text) {
    var raw = String(text || '');
    if (!raw.trim()) return '';

    // ① 优先认 ```unused 围栏块 —— 提示词就是让 AI 这么输出的
    var fenced = raw.match(/```[ \t]*(?:unused|text-unused)[ \t]*\r?\n([\s\S]*?)```/i);
    if (fenced) return fenced[1];

    // ② 再找 UNUSED: 行（从后往前，取最后一条）
    var lines = raw.split(/\r?\n/);
    for (var i = lines.length - 1; i >= 0; i--) {
      // 容忍 **Unused target words** 这类小标题混在同一行，以及反引号/加粗包裹
      var m = lines[i].replace(/[*`#]/g, '')
                      .match(/^\s*unused\s*(?:target\s*words?)?\s*[:：]\s*(.*)$/i);
      if (!m) continue;
      if (m[1].trim()) return m[1];
      // 有些模型会在 "UNUSED:" 后面换行再列词：往下一直收到空行或下一个小节标题
      var collected = [];
      for (var j = i + 1; j < lines.length; j++) {
        var ln = lines[j].trim();
        if (!ln || ln.indexOf('```') === 0) break;
        if (/^#{1,6}\s/.test(ln) || /^\*\*[^*]+\*\*$/.test(ln)) break;
        collected.push(ln);
      }
      return collected.join(' ');
    }

    // ③ 整段就是一张光秃秃的词表
    return looksLikeWordList(raw) ? raw : null;
  }

  /** 判断一段文字是不是「光秃秃的词表」，而不是一整篇回复 */
  function looksLikeWordList(s) {
    var t = String(s || '').trim();
    if (!t) return false;
    if (/[.!?;]/.test(t)) return false;              // 有句末标点 → 是句子
    var toks = t.split(/[^A-Za-z'’\-]+/).filter(Boolean);
    if (!toks.length || toks.length > 60) return false;
    for (var i = 0; i < toks.length; i++) {
      if (toks[i].length > 24) return false;
    }
    return true;
  }

  /** 把 UNUSED 行的内容切成词表 */
  function tokenizeUnused(body) {
    var s = String(body || '');
    if (/^\s*(none|nil|n\/a|-|—|–)\s*$/i.test(s.trim())) return [];
    var seen = {}, out = [];
    s.split(/[^A-Za-z'’\-]+/).forEach(function (tok) {
      var w = tok.replace(/^[’'\-]+|[’'\-]+$/g, '').toLowerCase();
      if (!w || w.length < 2 || UNUSED_NOISE[w]) return;
      if (seen[w]) return;
      seen[w] = 1;
      out.push(w);
    });
    return out;
  }

  /** 把 AI 输出的 UNUSED 行解析成词表（找不到就返回空数组） */
  function parseUnused(text) {
    var body = findUnusedLine(text);
    return body == null ? [] : tokenizeUnused(body);
  }

  /**
   * 把「文章没用上的词」直接回传进这条任务：
   * 粘 UNUSED 行（或光秃秃一串词）→ 这些词从「待打分」里消失，并且不算练过。
   * 回传栏就在任务卡里，不再单独开一块。
   */
  function returnUnused(taskId) {
    var t = taskById(taskId);
    if (!t) return;
    var inp = document.querySelector('[data-unused-input="' + taskId + '"]');
    /* 每次都现查节点：renderLog 会整块重绘，旧的引用会失效 */
    var setMsg = function (txt, kind) {
      var msg = document.querySelector('[data-unused-msg="' + taskId + '"]');
      if (!msg) return;
      msg.textContent = txt;
      msg.className = 'hint lf-msg' + (kind ? ' ' + kind : '');
    };
    var raw = inp ? inp.value : '';
    var body = findUnusedLine(raw);
    if (body === null) { setMsg(I18N.t('un.notFound'), 'bad'); return; }
    var words = tokenizeUnused(body);
    if (!words.length) {
      setMsg(raw.trim() ? I18N.t('un.bad') : I18N.t('un.empty'), 'bad');
      return;
    }
    /* 只认这条任务里的词；别的词本里的同形词不该被这条任务回传掉 */
    var ids = [], missing = [];
    words.forEach(function (w) {
      var at = -1;
      (t.words || []).some(function (x, i) {
        if (String(x.word).toLowerCase() === w) { at = i; return true; }
        return false;
      });
      var id = at >= 0 ? (t.wordIds || [])[at] : null;
      if (id && ids.indexOf(id) < 0) ids.push(id);
      else if (at < 0) missing.push(w);
    });
    if (!ids.length) {
      setMsg(I18N.tf('un.noneMatch', { list: missing.join(', ') || words.join(', ') }), 'bad');
      return;
    }
    var reviewed = (t.reviewed || []).slice();
    /* 保存时就按整轮推进过间隔的老任务，要先撤回；新任务是打分时才推进的 */
    var undo = t.deferred ? ids.filter(function (id) { return reviewed.indexOf(id) >= 0; }) : ids.slice();
    if (undo.length) Store.undoUse(undo);
    var unused = (t.unused || []).slice();
    ids.forEach(function (id) { if (unused.indexOf(id) < 0) unused.push(id); });
    Store.updateTask(taskId, {
      unused: unused,
      reviewed: reviewed.filter(function (id) { return ids.indexOf(id) < 0; })
    });
    if (inp) inp.value = '';
    renderLog();
    renderStats();
    renderWords();
    /* 提示要写在 renderLog 之后：重绘会把旧的提示节点换掉 */
    setMsg(I18N.tf('un.done', {
      n: ids.length,
      extra: missing.length ? I18N.tf('un.notInBank', { list: missing.join(', ') }) : ''
    }), 'ok');
  }

  /* ---------- reading log ---------- */
  function renderLog() {
    var showDone = el('logShowDone').checked;
    var list = Store.tasks().filter(function (t) { return showDone || !t.done; });
    el('logEmpty').hidden = list.length > 0;
    el('logList').innerHTML = list.map(function (t) {
      var p = t.params || {};
      var reviewed = t.reviewed || [];
      var unused = t.unused || [];
      var ids = t.wordIds || [];
      var total = ids.length;
      var left = pendingOf(t).length;
      /* 词片只是展示：直观看到这次练到了哪些词（✓ 打过分 / 划线回传或已删）。
         回传 / 已删的词统一排在最后面，不和还等着练的词混在一起。
         要复习走卡片上的「标记已读」，词片本身不可点 */
      var chips = (t.words || []).map(function (x, i) {
        var id = ids[i];
        var nolib = !!x.nolib;
        var got = !nolib && reviewed.indexOf(id) >= 0;
        var gone = !nolib && !Store.get(id);
        var off = !nolib && (gone || unused.indexOf(id) >= 0);
        var tip = nolib ? I18N.t('log.tipNolib')
          : gone ? I18N.t('msg.wordGone')
          : (unused.indexOf(id) >= 0 ? I18N.t('log.fbReturned')
            : I18N.t(got ? 'log.tipHit' : 'log.tipTodo'));
        return {
          off: off,
          html: '<span class="lw' + (got ? ' hit' : '') + (off ? ' off' : '') + (nolib ? ' nolib' : '') +
            '" title="' + esc(tip) + '">' +
            esc(x.word) + (got ? '<i>✓</i>' : '') + '</span>'
        };
      });
      chips.sort(function (a, b) { return (a.off ? 1 : 0) - (b.off ? 1 : 0); });
      var words = chips.map(function (c) { return c.html; }).join('');
      var fb = '<div class="log-fb">' +
        '<div class="lf-head"><span class="lf-title">' + esc(I18N.t('log.fbTitle')) + '</span>' +
          '<span class="lf-count">' + esc(I18N.tf(left ? 'log.fbLeft' : 'log.fbAll', { n: left, t: total })) + '</span>' +
        '</div>' +
        '<p class="hint">' + esc(I18N.t('log.fbHint')) + '</p>' +
        '<div class="lf-unused">' +
          '<input class="input lf-input" type="text" data-unused-input="' + t.id +
            '" placeholder="' + esc(I18N.t('log.unusedPh')) + '" autocomplete="off">' +
          '<button class="btn sm" data-unused-apply="' + t.id + '">' +
            esc(I18N.t('log.unusedBtn')) + '</button>' +
        '</div>' +
        '<p class="hint lf-msg" data-unused-msg="' + t.id + '"></p>' +
      '</div>';
      return '<div class="log-card' + (t.done ? ' done' : '') + '">' +
        '<div class="log-head"><b>' + fmtDate(t.created) + '</b>' +
        '<span class="log-meta">' + (p.length || '?') + ' words · ' + esc(p.genre || '') +
        ' · ' + esc(p.topic || '') + ' · ' + (p.questions || 0) + 'Q · cover ' + (p.coverage || '?') + '%</span>' +
        '<span class="tag' + (t.done ? ' t-active' : '') + '">' + esc(I18N.t(t.done ? 'log.done' : 'log.todo')) + '</span></div>' +
        '<div class="log-words">' + words + '</div>' +
        fb +
        '<div class="log-actions">' +
          '<button class="btn" data-copytask="' + t.id + '">' + esc(I18N.t('log.copyPrompt')) + '</button>' +
          '<button class="btn" data-showprompt="' + t.id + '">' + esc(I18N.t('log.viewPrompt')) + '</button>' +
          '<button class="btn primary" data-finish="' + t.id + '">' +
            esc(I18N.t(left || !t.done ? 'log.fbStart' : 'log.fbReview')) + '</button>' +
          '<button class="btn ghost" data-deltask="' + t.id + '">' + esc(I18N.t('btn.delete')) + '</button>' +
        '</div>' +
        '<div class="log-prompt" id="lp-' + t.id + '" hidden>' + esc(t.prompt || '') + '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- data page ---------- */
  /** 一键同步：单词本里的词全部从词库取最新内容（学习状态不动） */
  function syncAllFromLibrary() {
    var n = Store.syncAllFromLibrary();
    renderAll();
    toast(n ? I18N.tf('msg.synced', { n: n }) : I18N.t('msg.syncNone'));
    return n;
  }

  function renderData() {
    var s = Store.stats();
    var b = Dict.count();
    var banks = Store.banks().length;
    var info = I18N.tf('data.sourceText2', {
      total: b.total, mine: b.added, banks: banks
    });
    el('sourceHint').innerHTML = info;      // 这条文案本身带 <b>/<code>，不能再转义

    var max = Math.max(1, s.total);
    el('distMastery').innerHTML = MASTERY.map(function (m, i) {
      var lbl = I18N.masteryLabel(i);
      var c = s.byMastery[i] || 0;
      return '<div class="dist-row"><span class="lb">' + esc(lbl) + '</span>' +
        '<span class="dist-bar"><i style="width:' + (c / max * 100) + '%;background:' +
        ['#d94a4a', '#e08a1e', '#2f6feb', '#2f9e58', '#0f9d8c'][i] + '"></i></span>' +
        '<span class="vl">' + c + '</span></div>';
    }).join('');
    var wmax = Math.max(1, Math.max.apply(null, WEAK_KEYS.map(function (k) { return s.byWeak[k]; })));
    el('distWeak').innerHTML = WEAK_KEYS.map(function (k) {
      var c = s.byWeak[k] || 0;
      return '<div class="dist-row"><span class="lb">' + esc(I18N.weakLabel(k).short) + '</span>' +
        '<span class="dist-bar"><i style="width:' + (c / wmax * 100) + '%"></i></span>' +
        '<span class="vl">' + c + '</span></div>';
    }).join('');

    renderBankList();
  }

  /** 单词本一览：改名 / 删除。只剩一个本子时删除键禁用 */
  function renderBankList() {
    var box = el('bankList');
    if (!box) return;
    var list = Store.banks();
    var onlyOne = list.length <= 1;
    box.innerHTML = list.map(function (b) {
      var n = Store.wordsIn(b.id).length;
      return '<div class="bank-row">' +
        '<span class="bank-name">' + esc(b.name) + '</span>' +
        '<span class="bank-n">' + esc(I18N.tf('bank.wordCount', { n: n })) + '</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn sm" data-bank-rename="' + esc(b.id) + '">' +
          esc(I18N.t('btn.bankRename')) + '</button>' +
        '<button class="btn sm danger" data-bank-del="' + esc(b.id) + '"' +
          (onlyOne ? ' disabled title="' + esc(I18N.t('bank.lastOne')) + '"' : '') + '>' +
          esc(I18N.t('btn.bankDelete')) + '</button>' +
        '</div>';
    }).join('');
  }

  function bankById(id) {
    var list = Store.banks();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function renameBankFlow(id) {
    var b = bankById(id);
    if (!b) return;
    var name = window.prompt(I18N.t('bank.renameAsk'), b.name);
    if (name == null) return;
    var done = Store.renameBank(id, name);
    if (!done) return;
    renderBankList();
    renderBankSelect();
    fillLibBanks();
    toast(I18N.tf('bank.renamed', { name: done.name }));
  }

  function deleteBankFlow(id) {
    var b = bankById(id);
    if (!b) return;
    var n = Store.wordsIn(id).length;
    if (!window.confirm(I18N.tf('bank.delAsk', { name: b.name, n: n }))) return;
    var res = Store.removeBank(id);
    if (!res.ok) {
      toast(I18N.t('bank.lastOne'));
      return;
    }
    if (bankFilter === id) { bankFilter = ''; bankFilterSet = false; }
    renderBankList();
    renderBankSelect();
    fillLibBanks();
    renderWords();
    renderData();
    toast(I18N.tf('bank.deleted', { name: b.name, n: res.moved }));
  }

  /* ---------- import ---------- */
  /* ---------- import（全部进词库，不进单词本） ---------- */
  function openImport() {
    /* 数据包是第一入口：抓词工具的产物直接粘进来就行 */
    impMode = 'pack';
    el('impPaste').hidden = true;
    el('impPack').hidden = false;
    el('impDict').hidden = true;
    /* 「载入 wordpack.json」和「打开抓词工具」只在数据包模式下有用；
       词典模式有自己的键，底下的「导入」确认键也只在 pack / paste 两种模式里有意义 */
    el('impPackLoad').hidden = false;
    el('openFetch').hidden = false;
    el('impGo').hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('#impMode .seg-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === 'pack');
    });
    el('importModal').hidden = false;
  }

  /** 一行一条：裸词 / word | sense; sense / word, pos, sense */
  function parsePaste(text) {
    var out = [];
    String(text || '').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var word = '', pos = '', senses = [], phrases = [];

      if (line.indexOf('|') >= 0) {
        var a = line.split('|');
        word = a[0].trim();
        if (a[1]) senses = a[1].split(/[;；]/).map(function (x) { return x.trim(); }).filter(Boolean);
        if (a[2]) phrases = a[2].split(/[;；]/).map(function (x) { return x.trim(); }).filter(Boolean);
      } else if (/[,，\t]|\s{2,}/.test(line)) {
        var b = line.split(/[,，\t]|\s{2,}/);
        word = (b[0] || '').trim();
        var rest = (b[1] || '').trim();
        if (/^(n|v|adj|adv|prep|conj|pron|num|art|int|noun|verb|adjective|adverb)\.?$/i.test(rest)) {
          pos = rest;
          senses = (b.slice(2).join(' ') || '').split(/[;；]/).map(function (x) { return x.trim(); }).filter(Boolean);
        } else if (rest) {
          senses = rest.split(/[;；]/).map(function (x) { return x.trim(); }).filter(Boolean);
        }
      } else {
        word = line;
      }
      if (!word) return;
      out.push({ word: word, pos: pos, senses: senses, phrases: phrases, source: 'pasted' });
    });
    return out;
  }

  /**
   * 覆盖也别糟蹋例句：新数据里没带例句的组合 / 义项（牛津的 collocation 全是裸的），
   * 把词库里现成的例句按 key / 释义接过来。
   */
  function carryExamples(incoming, have) {
    if (!have) return incoming;
    var oldC = {};
    (have.combos || []).forEach(function (c) { oldC[Word.comboKey(c)] = c; });
    incoming.combos = (incoming.combos || []).map(function (c) {
      var o = oldC[Word.comboKey(c)];
      if (o && !(c.e && c.e.length) && o.e && o.e.length) c.e = o.e.slice();
      return c;
    });
    var oldS = {};
    (have.senses || []).forEach(function (s) { if (s.d) oldS[s.d.toLowerCase()] = s; });
    incoming.senses = (incoming.senses || []).map(function (s) {
      var o = s.d ? oldS[String(s.d).toLowerCase()] : null;
      if (o && !(s.e && s.e.length) && o.e && o.e.length) s.e = o.e.slice();
      return s;
    });
    return incoming;
  }

  /**
   * 合并进词库：词库已有的沿用（只补空缺字段），没有的直接新增。
   * dupMode === 'overwrite' 时用新数据盖掉 —— 但没带例句的部分会继承词库现成的。
   * 词库条目变动后，单词本里同词头的副本内容也跟着更新。
   */
  function mergeIntoLibrary(entries, dupMode) {
    var added = 0, updated = 0, skipped = 0;
    entries.forEach(function (e) {
      var have = Dict.find(e.word);
      var incoming = {
        word: e.word, pos: e.pos || '', phonetic: e.phonetic || '',
        senses: e.senses || [], combos: e.combos || [],
        source: e.source || ''
      };
      if (!have) { Dict.upsert(incoming); added++; return; }
      if (dupMode === 'overwrite') {
        var merged = carryExamples(incoming, have);
        Dict.upsert(merged); updated++;
        return;
      }
      var pick = {
        word: have.word,
        pos: have.pos || incoming.pos,
        phonetic: have.phonetic || incoming.phonetic,
        senses: (have.senses && have.senses.length) ? have.senses : incoming.senses,
        combos: (have.combos && have.combos.length) ? have.combos : incoming.combos,
        note: have.note || '',
        source: have.source || incoming.source
      };
      var changed = JSON.stringify(pick) !== JSON.stringify({
        word: have.word, pos: have.pos, phonetic: have.phonetic,
        senses: have.senses, combos: have.combos, note: have.note || '', source: have.source
      });
      if (changed) { Dict.upsert(pick); updated++; } else skipped++;
    });
    return { added: added, updated: updated, skipped: skipped };
  }

  function doImport() {
    if (impMode === 'dict') return;   /* 词典模式里的导出 / 导入都是即点即做 */
    if (impMode === 'pack') {
      importPack(el('impPackText').value, el('impPackDup').value);
      return;
    }
    var items = parsePaste(el('impText').value);
    if (!items.length) { toast(I18N.t('msg.noWords')); return; }
    var r = mergeIntoLibrary(items,
      (el('impPackDup') && el('impPackDup').value === 'overwrite') ? 'overwrite' : 'merge');
    el('importModal').hidden = true;
    el('impText').value = '';
    renderAll();
    if (!el('libModal').hidden) renderLib(el('libSearch').value);
    toast(I18N.tf('imp.libSummary', { a: r.added, u: r.updated, s: r.skipped, t: items.length }));
  }

  /* ---------- word library browser ---------- */
  var libSelected = {};
  var libFromPick = false;   // 从「选词弹窗」进来的词库：加入键直接加进本轮，不走掌握度向导

  function normalizeForBank(e) {
    return {
      word: e.word, pos: e.pos, phonetic: e.phonetic,
      senses: (e.senses || []).slice(), combos: (e.combos || []).slice(),
      note: e.note || ''
    };
  }

  function openLibrary() {
    libFromPick = false;
    libSelected = {};
    el('libSearch').value = '';
    fillLibBanks();
    el('libBank').hidden = false;    // 加进单词本要选目标本
    el('libHint').textContent = I18N.t('lib.hint');
    renderLib('');
    /* 加入键文案跟着入口走：平时是加进单词本 */
    el('libAdd').textContent = I18N.t('lib.addToBank');
    el('libModal').hidden = false;
    setTimeout(function () { el('libSearch').focus(); }, 30);
  }

  function fillLibBanks() {
    var sel = el('libBank');
    if (!sel) return;
    sel.innerHTML = Store.banks().map(function (b) {
      return '<option value="' + b.id + '">' + esc(b.name) + '</option>';
    }).join('');
    sel.value = Store.lastBankId();
  }

  /** 当前筛选下的条目：搜索词 */
  function libRows(q) {
    return Dict.search((q || '').trim());
  }

  function renderLib(q) {
    q = (q || '').trim().toLowerCase();
    var bank = (el('libBank') && el('libBank').value) || Store.lastBankId();
    var rows = libRows(q);
    var c = Dict.count();
    el('libStat').innerHTML = I18N.tf('lib.stat', { total: c.total });

    el('libGrid').innerHTML = rows.map(function (e) {
      /* 加进本轮训练时不分单词本：所有词一视同仁，不做「已在本里」的灰化标记 */
      var owned = !libFromPick && Store.has(e.word, bank);
      var sel = !!libSelected[e.word.toLowerCase()];
      var gloss = (e.senses && e.senses[0] && e.senses[0].d) ? e.senses[0].d : '';
      return '<div class="lib-item' + (sel ? ' on' : '') + (owned ? ' owned' : '') +
        '" data-lib="' + esc(e.word) + '" title="' + esc(gloss) + '">' +
        '<span class="w">' + esc(e.word) + '</span>' +
        '<span class="g">' + esc(e.pos || (e.senses.length ? '' : I18N.t('lib.noSenses'))) + '</span>' +
        '<button class="lib-edit" data-libedit="' + esc(e.word) + '" title="' +
          esc(I18N.t('lib.editTip')) + '" aria-label="' + esc(I18N.t('lib.editTip')) + '">✎</button>' +
        '<button class="lib-del" data-libdel="' + esc(e.word) + '" title="' +
          esc(I18N.t('lib.delTip')) + '" aria-label="' + esc(I18N.t('lib.delTip')) + '">\u{1F5D1}\u{FE0E}</button>' +
        '</div>';
    }).join('') || '<p class="muted">' + esc(I18N.t('lib.empty')) + '</p>';

    updateLibCount();
  }

  /** 从词典删除一个词。
   *  单词本里内容仍与该词条一致的同名词副本跟着一起删；
   *  改过内容的（＝已经是你自己的词条）保留。 */
  function deleteLibWord(word) {
    if (!word) return;
    if (!confirm(I18N.tf('msg.delDictAsk', { w: word }))) return;
    var entry = Dict.find(word);
    if (!Dict.remove(word)) { toast(I18N.t('msg.delDictFail')); return; }
    var n = Store.removeDictCopies(word, entry);
    if (el('libModal') && !el('libModal').hidden) renderLib(el('libSearch').value);
    renderData(); renderWords(); renderPicks();
    toast(I18N.tf('msg.dictDeleted', { w: word }));
    if (n) toast(I18N.tf('msg.dictCopiesGone', { n: n }));
  }

  /** 批量删除选中的词条：一次确认，逐个删。
   *  规则和单个删除一致：单词本里内容未改过的同名词副本跟着删，改过的保留。 */
  function deleteSelectedLib() {
    var words = Object.keys(libSelected).filter(function (k) { return libSelected[k]; });
    if (!words.length) { toast(I18N.t('msg.nothingSel')); return; }
    if (!confirm(I18N.tf('msg.delDictSelAsk', { n: words.length }))) return;
    var gone = 0, copies = 0;
    words.forEach(function (k) {
      var entry = Dict.find(k);
      if (!Dict.remove(k)) return;
      gone++;
      copies += Store.removeDictCopies(k, entry);
      delete libSelected[k];
    });
    if (el('libModal') && !el('libModal').hidden) renderLib(el('libSearch').value);
    renderData(); renderWords(); renderPicks();
    if (gone) toast(I18N.tf('msg.dictDeletedMany', { n: gone }));
    if (copies) toast(I18N.tf('msg.dictCopiesGone', { n: copies }));
  }

  /* ---------- 批量编辑单词本 ---------- */
  var bankMarked = {};      // id -> true（标记删除；没标记的＝变灰保留）
  var bankEditBankId = '';  // 批量编辑当前针对的单词本（弹窗里可切换）

  function openBankEdit() {
    bankMarked = {};
    bankEditBankId = (el('bankSelect') && el('bankSelect').value) || Store.lastBankId();
    el('bankEditSearch').value = '';
    fillBankEditBanks();
    renderBankEdit('');
    el('bankEditModal').hidden = false;
  }

  function fillBankEditBanks() {
    var sel = el('bankEditBank');
    if (!sel) return;
    sel.innerHTML = Store.banks().map(function (b) {
      return '<option value="' + b.id + '">' + esc(b.name) + '</option>';
    }).join('');
    sel.value = bankEditBankId;
  }

  /** 弹窗里切换单词本：清空标记重画 */
  function setBankEditBank(id) {
    bankEditBankId = id || Store.lastBankId();
    bankMarked = {};
    renderBankEdit(el('bankEditSearch').value);
  }

  function renderBankEdit(q) {
    q = (q || '').trim().toLowerCase();
    var bank = bankEditBankId || Store.lastBankId();
    var rows = Store.wordsIn(bank).filter(function (w) {
      return !q || w.word.toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.word.localeCompare(b.word); });
    el('bankEditGrid').innerHTML = rows.map(function (w) {
      var marked = !!bankMarked[w.id];
      return '<div class="lib-item be-item' + (marked ? ' on' : ' stay') + '" data-be="' + w.id + '">' +
        '<span class="w">' + esc(w.word) + '</span>' +
        '<span class="g">' + esc((w.senses[0] && w.senses[0].d) || '') + '</span>' +
        '<button class="lib-edit" data-beedit="' + w.id + '" title="' +
          esc(I18N.t('btn.editTip')) + '">✎</button>' +
      '</div>';
    }).join('') || '<p class="muted">' + esc(I18N.t('bankedit.empty')) + '</p>';
    updateBankEditCount();
  }

  function toggleBankMarked(id) {
    if (bankMarked[id]) delete bankMarked[id];
    else bankMarked[id] = true;
    var it = el('bankEditGrid').querySelector('[data-be="' + id + '"]');
    if (it) {
      it.classList.toggle('on', !!bankMarked[id]);
      it.classList.toggle('stay', !bankMarked[id]);
    }
    updateBankEditCount();
  }

  function updateBankEditCount() {
    var n = Object.keys(bankMarked).length;
    /* 底部小字显示当前标记数；保存键文案同步变化 */
    el('bankEditCount').textContent = n ? I18N.tf('bankedit.saveN', { n: n }) : '';
    el('bankEditSave').textContent = n ? I18N.tf('bankedit.saveN', { n: n }) : I18N.t('bankedit.save');
  }

  function saveBankEdit() {
    var ids = Object.keys(bankMarked);
    if (!ids.length) { el('bankEditModal').hidden = true; return; }
    ids.forEach(function (id) { Store.remove(id); });
    bankMarked = {};
    el('bankEditModal').hidden = true;
    renderAll();
    if (ids.length) toast(I18N.tf('bankedit.removed', { n: ids.length }));
  }

  function updateLibCount() {
    var n = Object.keys(libSelected).filter(function (k) { return libSelected[k]; }).length;
    el('libSelCount').textContent = n ? I18N.tf('lib.selected', { n: n }) : '';
    el('libAdd').disabled = n === 0;
    var del = el('libDelSel');
    if (del) del.disabled = n === 0;
  }

  function toggleLib(word) {
    var k = String(word || '').toLowerCase();
    if (!k) return;
    if (libSelected[k]) delete libSelected[k];
    else libSelected[k] = true;
    var box = el('libGrid').querySelector('[data-lib="' + word + '"]');
    if (box) box.classList.toggle('on', !!libSelected[k]);
    updateLibCount();
  }

  function clearLibSelection() {
    libSelected = {};
  }

  /** 「全选当前结果」——只加不减，别把已经勾上的反选掉 */
  function selectAllShown(q) {
    libRows(q).forEach(function (e) {
      libSelected[e.word.toLowerCase()] = true;
    });
    renderLib(q);
  }

  /** 「反选当前结果」——只翻当前筛出来的这些，别的不动 */
  function invertShown(q) {
    libRows(q).forEach(function (e) {
      var k = e.word.toLowerCase();
      if (libSelected[k]) delete libSelected[k];
      else libSelected[k] = true;
    });
    renderLib(q);
  }

  function selectedLibEntries() {
    var out = [];
    Object.keys(libSelected).forEach(function (k) {
      if (!libSelected[k]) return;
      var e = Dict.find(k);
      if (e) out.push(normalizeForBank(e));
    });
    return out;
  }

  /** 选好词 → 关词库 → 一个个填掌握度 / 薄弱点 / 备注。
   *  已在别的单词本里的词不走向导：直接复制进目标本，并沿用现有的掌握度 / 薄弱点。 */
  function addSelectedToBank() {
    var list = selectedLibEntries();
    if (!list.length) { toast(I18N.t('msg.nothingSel')); return; }
    var bank = (el('libBank') && el('libBank').value) || Store.lastBankId();
    /* 从「选词弹窗」进来的：加进本轮训练，和单词本无关 */
    if (libFromPick) { addSelectedToRound(list); return; }
    Store.setLastBank(bank);
    var todo = [], shared = 0, dup = 0;
    list.forEach(function (e) {
      if (Store.has(e.word, bank)) { dup++; return; }
      var src = Store.findAny(e.word);
      if (src) {
        Store.add({
          word: e.word, pos: e.pos, phonetic: e.phonetic,
          senses: (e.senses || []).slice(), combos: (e.combos || []).slice(),
          note: e.note || '', bankId: bank,
          mastery: src.mastery, weak: (src.weak || []).slice(),
          unsureSenses: (src.unsureSenses || []).slice()
        });
        shared++;
      } else {
        todo.push(e);
      }
    });
    libSelected = {};
    el('libModal').hidden = true;
    if (!todo.length) {
      renderAll();
      if (shared) toast(I18N.tf('lib.sharedCopied', { n: shared }));
      else toast(I18N.tf('lib.allOwned', { n: dup }));
      return;
    }
    if (shared) toast(I18N.tf('lib.sharedCopied', { n: shared }));
    if (dup) toast(I18N.tf('lib.someOwned', { n: dup }));
    modalBank = bank;
    openWizard(todo);
  }

  /** 词库选中的词 → 直接勾进本轮训练（不开掌握度向导）：
   *  任意本里已有的词直接沿用那份副本；哪个本都没有的词只挂在本轮（nolib），
   *  稍后补选薄弱点，不写进任何单词本。 */
  function addSelectedToRound(list) {
    var cur = picked.slice();
    var addedN = 0;
    var fresh = [];
    list.forEach(function (e) {
      var lw = e.word.toLowerCase();
      var src = Store.findAny(e.word);
      if (src) {
        if (!cur.some(function (x) { return x.id === src.id; })) { cur.push(src); addedN++; }
      } else if (!cur.some(function (x) { return x.nolib && x.word.toLowerCase() === lw; })) {
        var item = {
          id: 'nolib:' + lw, nolib: true,
          word: e.word, pos: e.pos || '', phonetic: e.phonetic || '',
          senses: (e.senses || []).slice(), combos: (e.combos || []).slice(),
          note: e.note || '', mastery: 0, weak: [], unsureSenses: [],
          created: Date.now()
        };
        cur.push(item);
        addedN++;
        fresh.push(item);
      }
    });
    picked = cur;
    libSelected = {};
    el('libModal').hidden = true;
    if (fresh.length) {
      nolibRoundN = addedN;
      openNolibWizard(fresh);   // 选完薄弱点后自动结算关闭
    } else {
      /* 不管哪种情况，从词库加完词都直接结算：关掉选词页，训练名单立刻刷新 */
      renderAll();
      el('pickModal').hidden = true;
      toast(I18N.tf('lib.addedRound', { n: addedN }));
    }
  }

  /* ---------- manual pick ---------- */
  var pickBankId = '';       // 选词弹窗当前浏览的单词本（'' = 全部单词本）
  function openPickModal() {
    fillPickBanks();
    el('pickModal').hidden = false;
    renderPickGrid(el('pickSearch').value);
  }
  function fillPickBanks() {
    var sel = el('pickBank');
    if (!sel) return;
    sel.innerHTML = '<option value="">' + esc(I18N.t('pick.allBanks')) + '</option>' +
      Store.banks().map(function (b) {
        return '<option value="' + b.id + '">' + esc(b.name) + '</option>';
      }).join('');
    sel.value = pickBankId || (el('bankSelect') ? el('bankSelect').value : '');
    if (sel.selectedIndex < 0) sel.value = '';   // 之前选的本子被删了
    pickBankId = sel.value;
  }
  /** 弹窗里切换单词本：重画格子 */
  function setPickBank(id) {
    pickBankId = id || '';
    renderPickGrid(el('pickSearch').value);
  }
  /** 「从词库加词」：关掉本轮选词，去词库里挑（挑完直接结算，不开向导） */
  function openLibraryFromPick() {
    el('pickModal').hidden = true;
    openLibrary();
    libFromPick = true;   // openLibrary 会重置入口标记，这里要在它之后置位
    el('libBank').hidden = true;     // 加进本轮和单词本无关
    el('libHint').textContent = I18N.t('lib.hintPick');
    el('libAdd').textContent = I18N.t('lib.addRound');
    renderLib(el('libSearch').value);   // 按新入口重画：去掉「已在本里」的灰化标记
  }
  /** 选词格子里的候选行：按所选单词本（或全部）+ 搜索词过滤，按字母排 */
  function pickRows(q) {
    q = (q || '').trim().toLowerCase();
    var src = pickBankId ? Store.wordsIn(pickBankId) : Store.all();
    return src.filter(function (w) {
      return !q || w.word.toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.word.localeCompare(b.word); });
  }
  /** 三键：全选 / 反选 / 清空已选 —— 只动当前筛出来的这些词 */
  function pickSelectAll(q) {
    var cur = picked.slice();
    pickRows(q).forEach(function (w) {
      if (!cur.some(function (x) { return x.id === w.id; })) cur.push(w);
    });
    picked = cur;
    renderPicks();
    renderPickGrid(q);
  }
  function pickInvert(q) {
    var cur = picked.slice();
    pickRows(q).forEach(function (w) {
      if (cur.some(function (x) { return x.id === w.id; })) {
        cur = cur.filter(function (x) { return x.id !== w.id; });
      } else {
        cur.push(w);
      }
    });
    picked = cur;
    renderPicks();
    renderPickGrid(q);
  }
  function pickClearSel() {
    picked = [];
    renderPicks();
    renderPickGrid(el('pickSearch').value);
  }
  function renderPickGrid(q) {
    var inPick = {};
    picked.forEach(function (w) { inPick[w.id] = 1; });
    var html = pickRows(q).map(function (w) {
      return '<div class="lib-item' + (inPick[w.id] ? ' on' : '') + '" data-pickadd="' + w.id + '">' +
        '<span class="w">' + esc(w.word) + '</span><span class="g">' +
        esc((w.senses[0] && w.senses[0].d) || '') + '</span></div>';
    }).join('');
    el('pickGrid').innerHTML = html || '<p class="muted">' + esc(I18N.t('pick.noMatch')) + '</p>';
  }

  /* ---------- 设置：界面语言 / 主题 / 新文章默认值 ---------- */
  var PREF_KEY = 'lexforge.prefs.v1';
  var DEFAULT_PREFS = {
    lang: 'en',
    theme: 'light',
    length: 360,
    coverage: 60,
    count: 9,
    countAuto: true,
    paras: 4,
    parasAuto: true,
    questions: 4,
    questionsAuto: true,
    genre: 'Expository — explaining a phenomenon or concept',
    topic: 'Any topic that best fits the target words',
    level: 'Gaokao (China national college entrance exam) — C/D reading passages',
    levelCustom: '',
    /* 新文章默认的补充说明（设置里可改，逐篇仍可改/清空） */
    extra: '',
    /* 附加输出板块的默认勾选（有人习惯每次都看全文翻译） */
    outputs: { glossary: true, translation: false, answerKey: true }
  };
  var prefs = {};

  function loadPrefs() {
    var p = {};
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) p = JSON.parse(raw) || {};
    } catch (e) { p = {}; }
    prefs = {};
    Object.keys(DEFAULT_PREFS).forEach(function (k) {
      prefs[k] = (p[k] == null) ? DEFAULT_PREFS[k] : p[k];
    });
    /* outputs 是对象：老存档没有它，补全缺的键 */
    var o = {};
    Object.keys(DEFAULT_PREFS.outputs).forEach(function (k) {
      o[k] = (prefs.outputs && prefs.outputs[k] != null) ? !!prefs.outputs[k] : DEFAULT_PREFS.outputs[k];
    });
    prefs.outputs = o;
    return prefs;
  }

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function applyTheme(mode) {
    var dark = (mode === 'dark') ||
      (mode === 'system' && window.matchMedia &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    /* 切主题这一下必须关掉过渡：.chip / .btn 都带 transition，
       否则底色会从旧主题的值慢慢淡过来，能看到一瞬的浅色块；
       无头浏览器里这条过渡还会被虚拟时间冻在起始值上，截图永远是旧的。 */
    var rootEl = document.documentElement;
    rootEl.classList.add('no-anim');
    rootEl.setAttribute('data-theme', dark ? 'dark' : 'light');
    void rootEl.offsetWidth;   /* 强制同步重算，让新值在「无过渡」状态下落地 */
    clearTimeout(applyTheme.timer);
    applyTheme.timer = setTimeout(function () { rootEl.classList.remove('no-anim'); }, 80);
    var m = document.querySelector('meta[name="color-scheme"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'color-scheme');
      document.head.appendChild(m);
    }
    m.setAttribute('content', dark ? 'dark light' : 'light dark');
  }

  /** 用下拉表重填 <select>：value 永远是英文（要喂给 AI），显示文案随语言变 */
  function fillSelect(sel, rows) {
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = rows.map(function (r) {
      var lbl = (I18N.getLang() === 'zh' && r.zh) ? r.zh : r.en;
      return '<option value="' + esc(r.v) + '">' + esc(lbl) + '</option>';
    }).join('');
    if (rows.some(function (r) { return r.v === cur; })) sel.value = cur;
  }

  function buildLocalized() {
    fillSelect(el('fLevel'), I18N.LEVELS);
    fillSelect(el('fGenre'), I18N.GENRES);
    fillSelect(el('fTopic'), I18N.TOPICS);
    fillSelect(el('filterWeak'),
      [{ v: '', en: I18N.t('filter.anyWeak'), zh: I18N.t('filter.anyWeak') }].concat(
        WEAK_KEYS.map(function (k) {
          var L = I18N.weakLabel(k);
          return { v: k, en: L.label, zh: L.label };
        })));
    fillSelect(el('setLevel'), I18N.LEVELS);
    fillSelect(el('setGenre'), I18N.GENRES);
    fillSelect(el('setTopic'), I18N.TOPICS);
  }

  /** 语言切换后：静态文案 + 下拉选项 + 所有动态内容全部重刷 */
  function refreshLocale() {
    I18N.apply(document);
    buildLocalized();
    renderOutputChips();
    renderQTypeChips();
    renderBankSelect();
    buildWeakFocus(weakFocus);
    el('fDiffVal').textContent = diffLabel(num('fDiff', 50));
    renderStats();
    renderWords();
    renderPicks();
    if (document.getElementById('panel-log').classList.contains('active')) renderLog();
    if (document.getElementById('panel-data').classList.contains('active')) renderData();
  }

  function currentSeg(id, attr) {
    var b = el(id).querySelector('.seg-btn.active');
    return b ? b.getAttribute(attr) : null;
  }
  function setSeg(id, attr, val) {
    Array.prototype.forEach.call(el(id).querySelectorAll('.seg-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute(attr) === val);
    });
  }

  function applyPrefs() {
    I18N.setLang(prefs.lang);
    applyTheme(prefs.theme);
    // 静态文案 + 下拉选项 + chips + 动态内容，一次刷全
    refreshLocale();

    el('fLength').value    = prefs.length;
    el('fCoverage').value  = String(prefs.coverage);
    el('fCount').value     = prefs.count;
    el('fCountVal').textContent = String(prefs.count);
    el('fParas').value     = prefs.paras;
    el('fQuestions').value = prefs.questions;
    el('fGenre').value     = prefs.genre;
    el('fTopic').value     = prefs.topic;
    el('fLevel').value     = prefs.level;
    el('fLevelCustom').value = prefs.levelCustom || '';
    /* 程序赋值不触发 onchange，自定义输入框的显隐要手动跟一次 */
    el('fLevelCustomWrap').hidden = prefs.level !== '__custom';
    el('fTopicCustomWrap').hidden = prefs.topic !== '__custom';
    el('fExtra').value = prefs.extra || '';

    el('fCountAuto').checked     = !!prefs.countAuto;
    el('fParasAuto').checked     = !!prefs.parasAuto;
    el('fQuestionsAuto').checked = !!prefs.questionsAuto;
    el('fQTypes').style.opacity  = (parseInt(prefs.questions, 10) || 0) > 0 ? '1' : '.4';

    /* 附加输出板块按设置里的默认勾选铺开（之后仍可逐篇改） */
    Object.keys(OUTPUTS).forEach(function (k) {
      if (prefs.outputs && prefs.outputs[k] != null) OUTPUTS[k].on = !!prefs.outputs[k];
    });
    renderOutputChips();

    syncAuto();
  }

  /** 设置面板里那排「默认附加输出板块」 */
  function renderSetOutputs() {
    var box = el('setOutputs');
    if (!box) return;
    box.innerHTML = Object.keys(OUTPUTS).map(function (k) {
      var on = !!(prefs.outputs && prefs.outputs[k]);
      return '<span class="chip' + (on ? ' on' : '') + '" data-so="' + k + '">' +
        esc(I18N.t(OUTPUTS[k].k)) + '</span>';
    }).join('');
  }

  /** 打开设置面板：只显示已保存的默认值。
   *  绝不从文章参数表单抓值 —— 那些是「这一次」的选择，不保存就永远不是默认值。 */
  function syncPrefForm() {
    el('setLength').value   = prefs.length;
    el('setCoverage').value = String(prefs.coverage);
    el('setCount').value    = prefs.count;
    el('setParas').value    = prefs.paras;
    el('setQuestions').value = prefs.questions;
    el('setCountAuto').checked     = !!prefs.countAuto;
    el('setParasAuto').checked     = !!prefs.parasAuto;
    el('setQuestionsAuto').checked = !!prefs.questionsAuto;
    syncSetAutoUI();
    el('setGenre').value    = prefs.genre;
    el('setTopic').value    = prefs.topic;
    el('setLevel').value    = prefs.level;
    el('setLevelCustomWrap').hidden = prefs.level !== '__custom';
    el('setLevelCustom').value = prefs.levelCustom || '';
    el('setExtra').value = prefs.extra || '';

    renderSetOutputs();

    setSeg('setLang', 'data-lang', prefs.lang);
    setSeg('setTheme', 'data-theme', prefs.theme);
  }

  /** 设置里：勾了「随篇幅自动调整」的那一项，数字框灰掉 */
  function syncSetAutoUI() {
    el('setCount').disabled     = el('setCountAuto').checked;
    el('setParas').disabled     = el('setParasAuto').checked;
    el('setQuestions').disabled = el('setQuestionsAuto').checked;
  }

  function readPrefForm() {
    var l = currentSeg('setLang', 'data-lang');
    var th = currentSeg('setTheme', 'data-theme');
    if (l) prefs.lang = l;
    if (th) prefs.theme = th;
    /* 是否自动跟随以保存时的勾选状态为准；勾了自动的那一项，数字不读 */
    prefs.countAuto     = el('setCountAuto').checked;
    prefs.parasAuto     = el('setParasAuto').checked;
    prefs.questionsAuto = el('setQuestionsAuto').checked;
    prefs.length    = num('setLength', prefs.length);
    prefs.coverage  = num('setCoverage', prefs.coverage);
    if (!prefs.countAuto)     prefs.count     = num('setCount', prefs.count);
    if (!prefs.parasAuto)     prefs.paras     = num('setParas', prefs.paras);
    if (!prefs.questionsAuto) prefs.questions = num('setQuestions', prefs.questions);
    prefs.genre     = el('setGenre').value;
    prefs.topic     = el('setTopic').value;
    prefs.level     = el('setLevel').value;
    /* 自定义难度的描述跟其它默认值一样，只在保存时写入 */
    if (prefs.level === '__custom') prefs.levelCustom = el('setLevelCustom').value;
    prefs.extra = el('setExtra').value.trim();
    Array.prototype.forEach.call(
      (el('setOutputs') || { querySelectorAll: function () { return []; } }).querySelectorAll('[data-so]'),
      function (c) {
        var k = c.getAttribute('data-so');
        if (OUTPUTS[k]) prefs.outputs[k] = c.classList.contains('on');
      });
  }

  /** 设置里点一下附加输出板块 */
  function toggleSetOutput(k) {
    if (!OUTPUTS[k]) return;
    prefs.outputs[k] = !prefs.outputs[k];
    renderSetOutputs();
  }

  function openSettings() {
    syncPrefForm();
    el('settingsModal').hidden = false;
  }

  function saveSettings() {
    readPrefForm();
    savePrefs();
    applyPrefs();
    el('settingsModal').hidden = true;
    toast(I18N.t('set.saved'));
  }

  function resetSettings() {
    prefs = {};
    Object.keys(DEFAULT_PREFS).forEach(function (k) { prefs[k] = DEFAULT_PREFS[k]; });
    prefs.outputs = {};
    Object.keys(DEFAULT_PREFS.outputs).forEach(function (k) {
      prefs.outputs[k] = DEFAULT_PREFS.outputs[k];
    });
    savePrefs();
    applyPrefs();
    syncPrefForm();
  }

  /* ---------- 数据包导入（配合 tools/fetch-words.js） ---------- */
  function arr(v) {
    if (!v) return [];
    if (typeof v === 'string') {
      return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return v.map(function (s) { return String(s).trim(); }).filter(Boolean);
  }

  /** 数据包里可能是新对象数组，也可能是老字符串数组 —— 统一成对象 */
  function arrObj(v, isCombo) {
    if (!v) return [];
    if (!Array.isArray(v)) v = [v];
    return v.map(function (x) {
      return isCombo ? Word.combo(x) : Word.sense(x);
    }).filter(function (x) { return isCombo ? x.k : x.d; });
  }

  function importPack(text, dupMode) {
    var d;
    try { d = JSON.parse(text); }
    catch (err) { toast(I18N.t('imp.badJSON')); return; }
    var list = d.words || (Array.isArray(d) ? d : null);
    if (!list || !list.length) { toast(I18N.t('imp.notPack')); return; }

    var entries = packToEntries(d);
    var r = mergeIntoLibrary(entries, dupMode === 'overwrite' ? 'overwrite' : 'merge');
    el('importModal').hidden = true;
    el('impPackText').value = '';
    renderAll();
    if (!el('libModal').hidden) renderLib(el('libSearch').value);
    toast(I18N.tf('imp.libSummary', { a: r.added, u: r.updated, s: r.skipped, t: list.length }));
  }

  /** wordpack JSON → 词库条目（新包 combos/senses 与老包 phrases/examples 都认） */
  function packToEntries(d) {
    var list = d.words || (Array.isArray(d) ? d : null) || [];
    return list.map(function (e) {
      if (!e) return null;
      var w = String(e.word || e.w || '').trim();
      if (!w) return null;
      var o = {
        word: w,
        pos: String(e.pos || '').trim(),
        phonetic: String(e.phonetic || e.ph || '').trim(),
        senses: arrObj(e.senses || e.s, false),
        combos: arrObj(e.combos || e.c, true)
      };
      var ph = e.phrases || e.p;
      if (ph) o.phrases = arrObj(ph, true).map(function (c) { return c.k; });
      var ex = e.examples || e.ex;
      if (ex) o.examples = Array.isArray(ex) ? ex : [ex];
      if (typeof Word !== 'undefined') Word.normalize(o);
      return {
        word: o.word,
        pos: o.pos,
        phonetic: o.phonetic,
        senses: o.senses,
        combos: o.combos,
        source: String(e.source || d.source || 'scraper')
      };
    }).filter(Boolean);
  }

  /* ---------- 词典数据的导出 / 导入 ----------
     导出：全部词条，格式与数据包相同。
     导入：走和 wordpack 一样的合并逻辑，遇到已有词按「跳过 / 覆盖」处理。 */
  function exportDict() {
    var list = Dict.userEntries();
    var pack = {
      app: 'LexForge', kind: 'wordpack', source: 'dictionary',
      count: list.length, words: list,
      exported: new Date().toISOString().slice(0, 10)
    };
    var json = JSON.stringify(pack, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lexforge-dictionary-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast(I18N.tf('imp.dictExported', { n: list.length }));
  }

  function importDictText(text) {
    var d;
    try { d = JSON.parse(text); }
    catch (err) { toast(I18N.t('imp.badJSON')); return; }
    var list = d.words || (Array.isArray(d) ? d : null);
    if (!list || !list.length) { toast(I18N.t('imp.notPack')); return; }
    var entries = packToEntries(d);
    var r = mergeIntoLibrary(entries,
      (el('impPackDup') && el('impPackDup').value === 'overwrite') ? 'overwrite' : 'merge');
    renderAll();
    if (!el('libModal').hidden) renderLib(el('libSearch').value);
    toast(I18N.tf('imp.libSummary', { a: r.added, u: r.updated, s: r.skipped, t: entries.length }));
  }

  function renderAll() {
    renderStats();
    renderBankSelect();
    renderWords();
    renderPicks();
    /* 手动选词弹窗开着的时候，词可能刚被加进单词本 —— 顺手重画一遍 */
    if (el('pickModal') && !el('pickModal').hidden) renderPickGrid(el('pickSearch').value);
    /* 批量编辑弹窗开着时，词可能刚被编辑/增删 —— 网格也要跟上 */
    if (el('bankEditModal') && !el('bankEditModal').hidden) renderBankEdit(el('bankEditSearch').value);
  }

  return {
    el: el, esc: esc, toast: toast, switchTab: switchTab,
    renderAll: renderAll, renderStats: renderStats, renderWords: renderWords,
    toggleSenses: toggleSenses, toggleCombos: toggleCombos, toggleExamples: toggleExamples, matchRank: matchRank,
    syncAllFromLibrary: syncAllFromLibrary,
    renderPicks: renderPicks, renderLog: renderLog, renderData: renderData,
    openWordModal: openWordModal, saveWordModal: saveWordModal, pullFromDict: pullFromDict,
    openReview: openReview, cancelReview: cancelReview, returnUnused: returnUnused,
    openLibWordModal: openLibWordModal, deleteLibWord: deleteLibWord,
    openBankEdit: openBankEdit, renderBankEdit: renderBankEdit, toggleBankMarked: toggleBankMarked, saveBankEdit: saveBankEdit,
    setBankEditBank: setBankEditBank,
    captureWordAnchor: captureWordAnchor,
    addSense: addSense, removeSense: removeSense, toggleUnsure: toggleUnsure,
    updatePosField: updatePosField,
    addCombo: addCombo, removeCombo: removeCombo,
    openWizard: openWizard, growTextarea: growTextarea,
    toggleDetails: toggleDetails, setCompact: setCompact,
    playAudio: playAudio, stopAudio: stopAudio, speak: speak,
    parseUnused: parseUnused, findUnusedLine: findUnusedLine, tokenizeUnused: tokenizeUnused,
    syncAuto: syncAuto,
    openImport: openImport, doImport: doImport, importPack: importPack, parsePaste: parsePaste,
    exportDict: exportDict, importDictText: importDictText,
    mergeIntoLibrary: mergeIntoLibrary,
    openLibrary: openLibrary, renderLib: renderLib, toggleLib: toggleLib, deleteSelectedLib: deleteSelectedLib,
    openLibraryFromPick: openLibraryFromPick,
    removeWordSmart: removeWordSmart,
    clearLibSelection: clearLibSelection,
    selectAllShown: selectAllShown, invertShown: invertShown,
    addSelectedToBank: addSelectedToBank, fillLibBanks: fillLibBanks,
    renderBankSelect: renderBankSelect, setBankFilter: setBankFilter, newBankFlow: newBankFlow,
    renderBankList: renderBankList, renameBankFlow: renameBankFlow, deleteBankFlow: deleteBankFlow,
    openPickModal: openPickModal, renderPickGrid: renderPickGrid,
    setPickBank: setPickBank,
    pickSelectAll: pickSelectAll, pickInvert: pickInvert, pickClearSel: pickClearSel,
    buildForgeControls: buildForgeControls,
    openSettings: openSettings, saveSettings: saveSettings, resetSettings: resetSettings,
    toggleSetOutput: toggleSetOutput,
    applyPrefs: applyPrefs, refreshLocale: refreshLocale,
    doPick: doPick, genPrompt: genPrompt, copyPrompt: copyPrompt,
    handleCopyClick: handleCopyClick,
    saveTask: saveTask,
    picked: function () { return picked; },
    setPicked: function (a) { picked = a; },
    libSel: function () { return libSelected; },
    setImpMode: function (m) { impMode = m; },
    getImpMode: function () { return impMode; },
    modalEditId: function () { return modalEditId; }
  };
})();
