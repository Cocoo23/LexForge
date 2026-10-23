/* ============================================================
   app.js —— 启动与全局事件
   ============================================================ */
(function () {
  var el = UI.el;

  function download(name, text, mime, bom) {
    var blob = new Blob([(bom ? '\ufeff' : '') + text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 600);
  }

  /* 简易 CSV 解析（支持引号包裹） */
  function parseCSV(text) {
    var rows = [], row = [], cur = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c !== '\r') cur += c;
      }
    }
    row.push(cur); rows.push(row);
    return rows.filter(function (r) { return r.length && r.some(function (x) { return x.trim(); }); });
  }

  /* 把一列 "a | b | c" 拆成义项 / 词语组合对象（导出格式的反向操作） */
  function parseSegList(v, isCombo) {
    return String(v || '').split(' | ').map(function (seg) {
      seg = seg.trim();
      if (!seg) return null;
      var type = '';
      var tm = /^\[([a-z]+)\]\s*/i.exec(seg);
      if (tm) { type = tm[1].toLowerCase(); seg = seg.slice(tm[0].length); }
      var parts = seg.split(' » ');
      var head = (parts.shift() || '').trim();
      var ex = parts.map(function (s) { return s.trim(); }).filter(Boolean);
      if (isCombo) {
        var cm = /^([\s\S]*?)\s+—\s+([\s\S]*)$/.exec(head);
        return {
          t: type || 'phrase',
          k: (cm ? cm[1] : head).trim(),
          d: cm ? cm[2].trim() : '',
          e: ex
        };
      }
      var sm = /^([\s\S]{0,40}?)\s*—\s*([\s\S]*)$/.exec(head);
      var p = '', l = '';
      if (sm) {
        sm[1].split(/[·•]/).forEach(function (x) {
          x = x.trim();
          if (!x) return;
          if (/^[ABC][12]\+?$/.test(x)) l = x; else p = x;
        });
      }
      return { p: p, l: l, d: (sm ? sm[2] : head).trim(), e: ex };
    }).filter(function (x) { return x && (x.d || x.k); });
  }

  function csvToWords(rows) {
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var iw = head.indexOf('word');
    if (iw < 0) return null;
    var iPos = head.indexOf('pos'), iPh = head.indexOf('phonetic'),
        iS = head.indexOf('senses'), iC = head.indexOf('combos'), iP = head.indexOf('phrases'),
        iE = head.indexOf('examples'), iM = head.indexOf('mastery'), iW = head.indexOf('weak'),
        iN = head.indexOf('note');
    return rows.slice(1).map(function (r) {
      var senses = iS >= 0 ? parseSegList(r[iS], false) : [];
      var combos = iC >= 0 ? parseSegList(r[iC], true) : [];
      /* 老格式：phrases + examples 两列 */
      if (!combos.length && iP >= 0 && (r[iP] || '').trim()) {
        combos = String(r[iP]).split(' / ').map(function (k) { return { t: 'phrase', k: k.trim(), d: '', e: [] }; });
      }
      if (!senses.length && iE >= 0 && (r[iE] || '').trim()) {
        senses = [{ p: '', l: '', d: String(r[iE]).split(' / ')[0].trim(), e: [] }];
      }
      return {
        word: (r[iw] || '').trim(),
        pos: iPos >= 0 ? (r[iPos] || '').trim() : '',
        phonetic: iPh >= 0 ? (r[iPh] || '').trim() : '',
        senses: senses,
        combos: combos,
        mastery: iM >= 0 ? Math.max(0, Math.min(4, parseInt(r[iM], 10) || 0)) : 1,
        weak: iW >= 0 ? (r[iW] || '').split(/\s+/).filter(function (k) { return WEAK_TYPES[k]; }) : [],
        note: iN >= 0 ? (r[iN] || '').trim() : ''
      };
    }).filter(function (w) { return w.word; });
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    Dict.load();
    Store.load();

    // 语言 / 主题 / 默认参数 先落地，再渲染（下拉选项由 buildLocalized 负责填充）
    UI.buildForgeControls();
    UI.renderAll();

    // 存不住才提示；能存就明确把条子收起来（别指望 HTML 里那个 hidden 还在）
    var bar = el('warnBar');
    if (Store.checkPersist()) {
      bar.hidden = true;
    } else {
      bar.innerHTML = '<b>' + I18N.t('msg.persistWarn') + '</b>' + I18N.t('msg.persistHint');
      bar.hidden = false;
    }
    bind();
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {

    /* Tab */
    document.getElementById('tabBar').addEventListener('click', function (e) {
      var t = e.target.closest('.tab');
      if (t) UI.switchTab(t.getAttribute('data-tab'));
    });

    /* 排序方式记住：刷新后不重置回优先级 */
    var savedSort = null;
    try { savedSort = localStorage.getItem('lexforge.sortBy'); } catch (e) {}
    if (savedSort && el('sortBy').querySelector('option[value="' + savedSort + '"]')) {
      el('sortBy').value = savedSort;
      UI.renderWords();   // 首屏已经按默认排过了，恢复后补一次
    }
    el('sortBy').addEventListener('change', function () {
      try { localStorage.setItem('lexforge.sortBy', this.value); } catch (e) {}
    });

    /* 单词本筛选 */
    ['searchInput', 'filterMastery', 'filterWeak', 'sortBy'].forEach(function (id) {
      el(id).addEventListener('input', UI.renderWords);
    });
    el('filterDue').addEventListener('change', UI.renderWords);

    el('btnAdd').addEventListener('click', function () { UI.openWordModal(null); });
    el('btnSyncLib').addEventListener('click', UI.syncAllFromLibrary);
    el('btnImport').addEventListener('click', UI.openImport);
    el('btnBatchEdit').addEventListener('click', UI.openBankEdit);

    /* 批量编辑弹窗：点条目标记删除（变灰＝保留），✎ 就地编辑 */
    el('bankEditGrid').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-beedit]');
      if (ed) { UI.openWordModal(ed.getAttribute('data-beedit')); return; }
      var it = e.target.closest('[data-be]');
      if (it) UI.toggleBankMarked(it.getAttribute('data-be'));
    });
    el('bankEditSearch').addEventListener('input', function () { UI.renderBankEdit(this.value); });
    el('bankEditBank').addEventListener('change', function () { UI.setBankEditBank(this.value); });
    el('bankEditSave').addEventListener('click', UI.saveBankEdit);
    document.getElementById('bankEditModal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close') || e.target === this) { this.hidden = true; return; }
    });

    /* 表格内的操作（事件委托） */
    el('wordRows').addEventListener('click', function (e) {
      var more = e.target.closest('[data-more]');
      if (more) { UI.toggleSenses(more.getAttribute('data-more')); return; }
      var cmore = e.target.closest('[data-cmore]');
      if (cmore) { UI.toggleCombos(cmore.getAttribute('data-cmore')); return; }
      /* 点义项 / 词语组合 → 就地展开例句（再点收起），不重绘，顺序不会乱 */
      var exp = e.target.closest('[data-exp]');
      if (exp) { UI.toggleExamples(exp.getAttribute('data-exp')); return; }
      var ed = e.target.closest('[data-edit]');
      if (ed) { UI.openWordModal(ed.getAttribute('data-edit')); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) {
        var id = dl.getAttribute('data-del');
        var w = Store.get(id);
        if (w && confirm(I18N.tf('msg.delWord', { w: w.word }))) {
          UI.removeWordSmart(id);   // 全部视图删所有副本，单本视图只删该本副本
          UI.renderAll();
        }
        return;
      }
      var spk = e.target.closest('[data-play]');
      if (spk) {
        UI.playAudio(spk.getAttribute('data-play'), spk, spk.getAttribute('data-word'));
        return;
      }
      var star = e.target.closest('.star');
      if (star) {
        var box = star.closest('[data-mastery]');
        if (!box) return;
        var mId = box.getAttribute('data-mastery');
        var idx = Array.prototype.indexOf.call(star.parentNode.children, star);
        /* 点第一颗星在 1 星和 0 星之间切换：1 星再点一下变 0 星，0 星点一下变 1 星 */
        var cur = Store.get(mId);
        var next = (idx === 0 && cur && cur.mastery === 1) ? 0 : idx + 1;
        UI.captureWordAnchor(mId);   // 掌握度变了可能重排，把词框钉回屏幕原位
        Store.setMastery(mId, next);
        UI.renderAll();
      }
    });

    /* 单词弹窗 */
    document.getElementById('wordModal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close') || e.target === this) {
        this.hidden = true;
        UI.cancelReview();     // 中途关掉就别再往下走卡片了
      }
    });
    el('mSave').addEventListener('click', UI.saveWordModal);
    /* 从词典导入：一直挂在单词输入框旁边；回车也等于点它 */
    el('mLookup').addEventListener('click', function () { UI.pullFromDict(); });
    el('mWord').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); UI.pullFromDict(); }
    });
    el('mDetailsBtn').addEventListener('click', UI.toggleDetails);

    /* 义项：一条一个框，可以加/删；例句框跟着内容长高 */
    el('mAddSense').addEventListener('click', UI.addSense);
    el('mSenseList').addEventListener('click', function (e) {
      var d = e.target.closest('[data-sdel]');
      if (d) UI.removeSense(parseInt(d.getAttribute('data-sdel'), 10));
    });
    el('mSenseList').addEventListener('input', function (e) {
      if (!e.target.hasAttribute) return;
      if (e.target.hasAttribute('data-se')) UI.growTextarea(e.target);
      if (e.target.hasAttribute('data-sp')) UI.updatePosField();   // POS 自动摘自释义
    });
    /* 词语组合：和义项一样，一条一个卡片 */
    el('mAddCombo').addEventListener('click', UI.addCombo);
    el('mComboList').addEventListener('click', function (e) {
      var d = e.target.closest('[data-cdel]');
      if (d) UI.removeCombo(parseInt(d.getAttribute('data-cdel'), 10));
    });
    el('mComboList').addEventListener('input', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-ce')) UI.growTextarea(e.target);
    });
    el('mUnsure').addEventListener('click', function (e) {
      var c = e.target.closest('[data-unsure]');
      if (c) UI.toggleUnsure(parseInt(c.getAttribute('data-unsure'), 10));
    });
    el('mPlay').addEventListener('click', function () {
      UI.playAudio('', this, el('mWord').value.trim());
    });
    el('mDelete').addEventListener('click', function () {
      var id = UI.modalEditId();
      var w = Store.get(id);
      if (w && confirm(I18N.tf('msg.delWord', { w: w.word }))) {
        UI.removeWordSmart(id);   // 与列表删除同语义：看全部删全部，看单本删单本
        el('wordModal').hidden = true;
        UI.renderAll();
      }
    });

    /* 生成文章 */
    el('btnPick').addEventListener('click', function () { UI.doPick(false); });
    el('btnPickReroll').addEventListener('click', function () { UI.doPick(true); });
    el('btnClearPick').addEventListener('click', function () { UI.setPicked([]); UI.renderPicks(); });
    el('btnAddPick').addEventListener('click', UI.openPickModal);
    el('btnGen').addEventListener('click', UI.genPrompt);
    el('btnSaveTask').addEventListener('click', UI.saveTask);

    /* 任何带 data-copy-target / data-copy-text 的按钮都能一键复制 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy-target],[data-copy-text]');
      if (b && !b.hasAttribute('data-copy-wired')) UI.handleCopyClick(b);
    });

    el('pickList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-unpick]');
      if (!b) return;
      var id = b.getAttribute('data-unpick');
      UI.setPicked(UI.picked().filter(function (w) { return w.id !== id; }));
      UI.renderPicks();
    });

    /* 手动加词弹窗 */
    el('pickBank').addEventListener('change', function () { UI.setPickBank(this.value); });
    el('pickAll').addEventListener('click', function () { UI.pickSelectAll(el('pickSearch').value); });
    el('pickInvert').addEventListener('click', function () { UI.pickInvert(el('pickSearch').value); });
    el('pickClear').addEventListener('click', UI.pickClearSel);
    el('pickFromLib').addEventListener('click', UI.openLibraryFromPick);
    document.getElementById('pickModal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close') || e.target === this) { this.hidden = true; return; }
      var it = e.target.closest('[data-pickadd]');
      if (!it) return;
      var id = it.getAttribute('data-pickadd');
      var w = Store.get(id);
      if (!w) return;
      var cur = UI.picked();
      if (cur.some(function (x) { return x.id === id; })) {
        UI.setPicked(cur.filter(function (x) { return x.id !== id; }));
      } else {
        UI.setPicked(cur.concat([w]));
      }
      UI.renderPicks();
      UI.renderPickGrid(el('pickSearch').value);
    });
    el('pickSearch').addEventListener('input', function () { UI.renderPickGrid(this.value); });

    /* 设置面板 */
    el('btnSettings').addEventListener('click', UI.openSettings);
    el('setSave').addEventListener('click', UI.saveSettings);
    el('setReset').addEventListener('click', UI.resetSettings);
    /* 难度选「自定义」时，下方出现自定义难度输入框 */
    el('setLevel').addEventListener('change', function () {
      el('setLevelCustomWrap').hidden = this.value !== '__custom';
    });
    el('setOutputs').addEventListener('click', function (e) {
      var c = e.target.closest('[data-so]');
      if (c) UI.toggleSetOutput(c.getAttribute('data-so'));
    });
    document.getElementById('settingsModal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close') || e.target === this) { this.hidden = true; return; }
      /* 分段控件：语言 / 主题 / 发音，点一下就切换（保存时才写入） */
      var seg = e.target.closest('.seg-btn');
      if (!seg || !seg.parentNode || seg.parentNode.id.indexOf('set') !== 0) return;
      Array.prototype.forEach.call(seg.parentNode.querySelectorAll('.seg-btn'), function (b) {
        b.classList.toggle('active', b === seg);
      });
    });

    /* 阅读记录 */
    el('logShowDone').addEventListener('change', UI.renderLog);
    el('logList').addEventListener('click', function (e) {
      /* 词片只是展示（这次练到了哪些词），没有可点的操作；
         复习一律走「标记已读」：把还没过的词按顺序过一遍 */
      var fin = e.target.closest('[data-finish]');
      if (fin) {
        UI.openReview(fin.getAttribute('data-finish'));
        return;
      }
      /* 回传：把文章没用上的词直接还回这条任务里 */
      var ua = e.target.closest('[data-unused-apply]');
      if (ua) { UI.returnUnused(ua.getAttribute('data-unused-apply')); return; }
      var dt = e.target.closest('[data-deltask]');
      if (dt) {
        if (confirm(I18N.t('msg.delTask'))) {
          Store.removeTask(dt.getAttribute('data-deltask'));
          UI.renderLog();
        }
        return;
      }
      var sp = e.target.closest('[data-showprompt]');
      if (sp) {
        var box = document.getElementById('lp-' + sp.getAttribute('data-showprompt'));
        box.hidden = !box.hidden;
        return;
      }
      var ct = e.target.closest('[data-copytask]');
      if (ct) {
        var tt = Store.tasks().filter(function (x) { return x.id === ct.getAttribute('data-copytask'); })[0];
        if (!tt) return;
        el('promptOut').value = tt.prompt || '';
        UI.copyPrompt();
      }
    });
    /* 回传框里按回车 = 点「回传」；重新输入时清掉上一次的提示 */
    el('logList').addEventListener('keydown', function (e) {
      var inp = e.target.closest('[data-unused-input]');
      if (inp && e.key === 'Enter') {
        e.preventDefault();
        UI.returnUnused(inp.getAttribute('data-unused-input'));
      }
    });
    el('logList').addEventListener('input', function (e) {
      var inp = e.target.closest('[data-unused-input]');
      if (inp) {
        var msg = document.querySelector('[data-unused-msg="' + inp.getAttribute('data-unused-input') + '"]');
        if (msg) { msg.textContent = ''; msg.className = 'hint lf-msg'; }
      }
    });

    /* 数据页 */
    el('btnExportJSON').addEventListener('click', function () {
      download('lexforge-backup-' + new Date().toISOString().slice(0, 10) + '.json',
        Store.exportJSON(), 'application/json');
      UI.toast(I18N.t('msg.exported'));
    });
    el('btnExportCSV').addEventListener('click', function () {
      download('lexforge-words-' + new Date().toISOString().slice(0, 10) + '.csv',
        Store.exportCSV(), 'text/csv;charset=utf-8', true);
      UI.toast(I18N.t('msg.exported'));
    });
    el('btnImportJSON').addEventListener('click', function () {
      el('fileInput').click();
    });
    el('fileInput').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result);
        try {
          if (/\.csv$/i.test(f.name)) {
            var ws = csvToWords(parseCSV(text));
            if (!ws) throw new Error(I18N.t('msg.csvNoWord'));
            var home = Store.lastBankId(), n = 0;
            ws.forEach(function (w) { if (!Store.has(w.word, home)) { Store.add(w); n++; } });
            UI.renderAll(); UI.renderData(); UI.toast(I18N.tf('msg.csvDone', { n: n }));
          } else {
            var mode = confirm(I18N.t('msg.mergePrompt')) ? 'merge' : 'replace';
            var total = Store.importJSON(text, mode);
            UI.renderAll(); UI.renderData(); UI.renderLog();
            UI.toast(I18N.tf('msg.imported', { n: total }));
          }
        } catch (err) {
          UI.toast(I18N.tf('msg.importFail', { e: err.message }));
        }
      };
      reader.readAsText(f, 'utf-8');
      this.value = '';
    });
    el('btnReset').addEventListener('click', function () {
      if (confirm(I18N.t('msg.eraseAll'))) {
        Store.reset();
        if (typeof Dict !== 'undefined') Dict.clearUser();
        UI.renderAll();
        UI.renderData();          // 擦除键就在这一页，不重画会留下旧数字
        UI.renderLog();
        UI.toast(I18N.t('msg.erased'));
      }
    });

    /* 导入弹窗 */
    document.getElementById('importModal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close') || e.target === this) { this.hidden = true; return; }
      var m = e.target.closest('[data-mode]');
      if (m) {
        UI.setImpMode(m.getAttribute('data-mode'));
        Array.prototype.forEach.call(document.querySelectorAll('#impMode .seg-btn'), function (b) {
          b.classList.toggle('active', b === m);
        });
        el('impPaste').hidden = UI.getImpMode() !== 'paste';
        el('impPack').hidden  = UI.getImpMode() !== 'pack';
        el('impDict').hidden  = UI.getImpMode() !== 'dict';
        /* 「载入 wordpack.json」和「打开抓词工具」只在数据包模式；词典模式即点即做，无需「导入」确认键 */
        el('impPackLoad').hidden = UI.getImpMode() !== 'pack';
        el('openFetch').hidden = UI.getImpMode() !== 'pack';
        el('impGo').hidden = UI.getImpMode() === 'dict';
        return;
      }
    });
    el('impGo').addEventListener('click', UI.doImport);
    /* 词典数据的导出 / 导入（导出自己的词条，导入按跳过 / 覆盖合并） */
    el('impDictExport').addEventListener('click', UI.exportDict);
    el('impDictLoad').addEventListener('click', function () { el('impDictFile').click(); });
    el('impDictFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { UI.importDictText(String(rd.result || '')); };
      rd.readAsText(f);
    });
    /* 只加一个词：直接开「加词表单」，但不问掌握度/薄弱点 */
    el('impSingle').addEventListener('click', function () {
      el('importModal').hidden = true;
      UI.openLibWordModal('', true);
    });
    /* 直接载入抓词工具生成的 wordpack-*.json，不用打开文件复制粘贴 */
    el('impPackLoad').addEventListener('click', function () { el('impPackFile').click(); });
    el('impPackFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        el('impPackText').value = String(rd.result || '');
        toast(I18N.tf('msg.packLoaded', { f: f.name }));
      };
      rd.readAsText(f);
    });

    /* 词库浏览器 */
    el('btnLibrary').addEventListener('click', UI.openLibrary);
    document.getElementById('libModal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close') || e.target === this) { this.hidden = true; return; }
      /* 每张词卡右上角那支笔：改词库里的词条（不带掌握度/薄弱点） */
      var ed = e.target.closest('[data-libedit]');
      if (ed) { UI.openLibWordModal(ed.getAttribute('data-libedit')); return; }
      var dl = e.target.closest('[data-libdel]');
      if (dl) { UI.deleteLibWord(dl.getAttribute('data-libdel')); return; }
      var it = e.target.closest('[data-lib]');
      if (it) UI.toggleLib(it.getAttribute('data-lib'));
    });
    el('libSearch').addEventListener('input', function () { UI.renderLib(this.value); });
    el('libBank').addEventListener('change', function () { UI.renderLib(el('libSearch').value); });
    el('libSelectAll').addEventListener('click', function () {
      UI.selectAllShown(el('libSearch').value);
    });
    el('libInvert').addEventListener('click', function () {
      UI.invertShown(el('libSearch').value);
    });
    el('libClearAll').addEventListener('click', function () {
      UI.clearLibSelection();
      UI.renderLib(el('libSearch').value);
    });
    el('libDelSel').addEventListener('click', UI.deleteSelectedLib);
    el('libAdd').addEventListener('click', UI.addSelectedToBank);

    /* 单词本切换 / 新建 */
    el('bankSelect').addEventListener('change', function () { UI.setBankFilter(this.value); });
    el('btnBankNew').addEventListener('click', UI.newBankFlow);

    /* 数据页里的单词本一览：改名 / 删除 */
    if (el('bankList')) {
      el('bankList').addEventListener('click', function (e) {
        var r = e.target.closest('[data-bank-rename]');
        if (r) { UI.renameBankFlow(r.getAttribute('data-bank-rename')); return; }
        var d = e.target.closest('[data-bank-del]');
        if (d && !d.disabled) UI.deleteBankFlow(d.getAttribute('data-bank-del'));
      });
    }

    /* 存储状态变化：能存就把警告条撤掉 */
    document.addEventListener('lexforge:persist', function (e) {
      if (e.detail) el('warnBar').hidden = true;
    });

    /* Esc 关弹窗；词库弹窗开着且不在输入框里时，Delete 删除所选 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var lib = document.getElementById('libModal');
        var t = e.target;
        var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (lib && !lib.hidden && !typing) UI.deleteSelectedLib();
        return;
      }
      if (e.key === 'Escape') {
        ['wordModal', 'importModal', 'pickModal', 'settingsModal', 'libModal', 'bankEditModal'].forEach(function (id) {
          var n = el(id);
          if (n) n.hidden = true;
        });
        UI.cancelReview();
        UI.stopAudio();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
