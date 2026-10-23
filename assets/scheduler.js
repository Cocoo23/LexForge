/* ============================================================
   scheduler.js —— 选词算法
   思路：一个词该不该出现在这一轮文章里，由 5 个信号加权决定：
     1. 到期（SRS）    —— 该复习了吗
     2. 掌握度         —— 越不熟越该练（难度滑块可调节偏向）
     3. 薄弱类型命中   —— 是否命中本轮想突破的类型
     4. 新颖度         —— 从来没被文章覆盖过的优先
     5. 最近抑制       —— 刚练过的先放一放，避免连续撞车
   之后再做一轮「多样性约束」贪心筛选，防止抓出来一堆同类词。
   ============================================================ */
var Scheduler = (function () {

  var DAY = 86400000;
  var W = { due: 0.34, mastery: 0.26, type: 0.16, novel: 0.14, recent: -0.45, noise: 0.06 };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /** 粗糙词干：去掉常见屈折/派生后缀，用于避免同根词重复入选 */
  function stem(w) {
    var s = String(w).toLowerCase().replace(/[^a-z]/g, '');
    var sufs = ['ations', 'ation', 'ities', 'ity', 'ments', 'ment', 'ness', 'ings', 'ing',
                'ions', 'ion', 'ers', 'er', 'est', 'ies', 'ies', 'ed', 'es', 'ly', 's', 'al', 'ive', 'able'];
    for (var i = 0; i < sufs.length; i++) {
      if (s.length > sufs[i].length + 3 && s.slice(-sufs[i].length) === sufs[i]) {
        return s.slice(0, s.length - sufs[i].length);
      }
    }
    return s;
  }

  /** 主词性：从 "n./v." 里取第一个 */
  function mainPos(w) {
    if (!w.pos) return '';
    var m = String(w.pos).match(/[a-z]+/i);
    return m ? m[0].toLowerCase() : '';
  }

  /** 单条评分，返回 {total, parts}（parts 用于界面上解释「为什么选它」） */
  function score(w, opts, t) {
    t = t || Date.now();

    // 1) 到期信号
    var daysToDue = (w.sched.due - t) / DAY;
    var dueRaw;
    if (daysToDue <= 0) dueRaw = 1 + clamp(-daysToDue / 4, 0, 1.2);   // 1.0 ~ 2.2
    else dueRaw = clamp(1 - daysToDue / 14, 0, 1);                     // 越接近到期越高
    var due = dueRaw / 2.2;

    // 2) 掌握度信号（难度滑块用指数变换调节偏向）
    var tilt = (opts.difficulty - 50) / 50;                            // -1 ~ 1
    var exp = tilt >= 0 ? 1 + tilt * 1.2 : 1 + tilt * 0.7;             // 0.3 ~ 2.2
    var mastery = Math.pow((4 - w.mastery) / 4, exp);

    // 3) 薄弱类型命中
    var type;
    if (opts.focusTypes && opts.focusTypes.length) {
      var hit = w.weak.filter(function (k) { return opts.focusTypes.indexOf(k) >= 0; }).length;
      type = clamp(hit / opts.focusTypes.length, 0, 1);
      if (hit === 0) type = 0;
    } else {
      type = clamp(w.weak.length / 4, 0, 1);
    }

    // 4) 新颖度：从没进过文章的优先
    var novel = w.stats.articles === 0 ? 1 : clamp(1 - w.stats.articles / 6, 0, 1);

    // 5) 最近抑制
    var recent = 0;
    if (w.stats.lastSeen) {
      var daysSince = (t - w.stats.lastSeen) / DAY;
      if (daysSince < 7) recent = clamp(1 - daysSince / 7, 0, 1);
    }

    var noise = opts.noiseSeed != null
      ? (Math.sin((w.word.charCodeAt(0) || 65) * 12.9898 + opts.noiseSeed * 78.233) * 0.5 + 0.5)
      : Math.random();

    var total =
      W.due * due +
      W.mastery * mastery +
      W.type * type +
      W.novel * novel +
      W.recent * recent +
      W.noise * noise;

    // 没有任何薄弱标记的词，优先级整体下调（它可能只是个普通生词）
    if (!w.weak.length) total -= 0.08;

    return {
      total: total,
      parts: { due: due, mastery: mastery, type: type, novel: novel, recent: recent }
    };
  }

  /** 生成候选池并按分数排序 */
  function rank(opts, excludeIds) {
    var t = Date.now();
    var ex = {};
    (excludeIds || []).forEach(function (id) { ex[id] = 1; });
    var pool = Store.all().filter(function (w) { return !ex[w.id]; });
    return pool.map(function (w) {
      var s = score(w, opts, t);
      return { w: w, score: s.total, parts: s.parts, stem: stem(w.word), pos: mainPos(w) };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /**
   * 贪心 + 多样性约束选词
   * opts: { count, focusTypes[], difficulty(0-100), excludeIds[], noiseSeed }
   */
  function pick(opts) {
    var ranked = rank(opts, opts.excludeIds);
    var n = opts.count || 10;
    var capType = Math.max(2, Math.ceil(n * 0.55));   // 同一薄弱类型上限
    var capPos = Math.max(3, Math.ceil(n * 0.62));    // 同一词性上限
    var typeCount = {}, posCount = {}, stems = {};
    var chosen = [];

    for (var i = 0; i < ranked.length && chosen.length < n; i++) {
      var c = ranked[i];

      if (stems[c.stem]) continue;                    // 同根词只留一个

      var overPos = false, overType = false;
      if (c.pos && posCount[c.pos] >= capPos) overPos = true;
      for (var k = 0; k < c.w.weak.length; k++) {
        var wt = c.w.weak[k];
        if ((typeCount[wt] || 0) >= capType) { overType = true; break; }
      }
      if (overPos || overType) continue;

      chosen.push(c);
      stems[c.stem] = 1;
      if (c.pos) posCount[c.pos] = (posCount[c.pos] || 0) + 1;
      c.w.weak.forEach(function (wt) { typeCount[wt] = (typeCount[wt] || 0) + 1; });
    }

    // 兜底：约束太紧导致没选够，就放宽再补
    if (chosen.length < n) {
      for (var j = 0; j < ranked.length && chosen.length < n; j++) {
        if (chosen.indexOf(ranked[j]) < 0 && !stems[ranked[j].stem]) {
          chosen.push(ranked[j]);
          stems[ranked[j].stem] = 1;
        }
      }
    }

    // 回选后按分数重排：序号 = 真实优先级（序号越靠前越必须覆盖）
    chosen.sort(function (a, b) { return b.score - a.score; });
    return chosen;
  }

  /**
   * 换一批：就是再选一次。换一个随机种子让结果稍有不同，
   * 不刻意排除上一批 —— 值得练的词自然会再次浮上来。
   */
  function reroll(opts) {
    var o = {};
    for (var k in opts) o[k] = opts[k];
    o.noiseSeed = Math.random() * 1000;
    o.excludeIds = [];
    return pick(o);
  }

  return { score: score, pick: pick, reroll: reroll, rank: rank, stem: stem };
})();
