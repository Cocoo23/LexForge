/* ============================================================
   promptgen.js —— 把选中的词 + 参数 编译成一段给大模型用的提示词
   核心：不只是「请用这些词写篇文章」，而是针对每个词的薄弱类型，
   给出该词在文中应该被怎么呈现的具体要求。
   输出顺序刻意让「做题」发生在「对答案」之前：
   Passage → Questions → Word check → Glossary → Translation → Answer key
   ============================================================ */
var PromptGen = (function () {

  /* 每种薄弱类型 → 该词在文章中应如何被呈现 */
  var DIRECTIVE = {
    polysemy: 'Use a sense other than the first one listed (the first is usually the one already known). You may set up a familiar sense first, then use the target sense elsewhere, so the meaning can only be inferred from context. Do not gloss it or supply a synonym nearby.',
    phrase: 'Use at least one of the listed collocations in full: do not break it apart or swap any word in it, and place it where it carries real weight in the sentence.',
    derivation: 'Bring in one related word form as well (verb to noun, adjective to adverb, and so on) so the word family gets reinforced.',
    grammar: 'Build a sentence that shows off its pattern (gerund or infinitive complement, double object, that-clause, and so on) so the structure itself becomes the clue.',
    register: 'Put it in a part of the text that matches its register: formal words in argument or conclusion, informal ones in reported speech or dialogue. Never in a register-mismatched sentence.',
    speed: 'Let it appear twice, in two slightly different collocations, so it trains fast recognition rather than a single encounter.',
    active: 'Show it in a realistic, imitable situation — the reader should finish the sentence able to reuse it. Avoid abstract description.',
    discourse: 'Give it a real logical job (contrast, concession, cause, addition, conclusion). The sentences around it must actually stand in that relation.'
  };

  /* 题型清单 */
  var Q_TYPES = {
    mainIdea:     { label: 'Main idea / best title', hint: 'asks for the central point or the best title' },
    detail:       { label: 'Detail',                 hint: 'asks about a specific fact stated in the passage' },
    inference:    { label: 'Inference',              hint: 'asks what follows from the text but is not stated outright' },
    wordInContext:{ label: 'Word in context',        hint: 'asks what a target word means in its sentence; aim it at the polysemous words below' },
    attitude:     { label: 'Attitude / tone',        hint: 'asks about the writer stance or tone' },
    reference:    { label: 'Reference',              hint: 'asks what a pronoun or demonstrative refers back to' },
    structure:    { label: 'Text structure',         hint: 'asks why a paragraph or sentence is there, or how the text is organised' },
    gap:          { label: 'Sentence insertion',     hint: 'asks where a given sentence best fits' }
  };

  function build(words, o) {
    var total = words.length;
    var must = Math.max(1, Math.ceil(total * o.coverage / 100));
    var paras = o.paragraphs || 4;
    var lines = [];

    /* ---------- 目标词表 ---------- */
    words.forEach(function (w, i) {
      var tag = i < must ? '[MUST]' : '[TRY] ';
      var bits = [];

      if (w.senses && w.senses.length) {
        /* 优先练「标记为不熟」的义项；没标就练第一条之后的那几条
           （第一个义项通常是已经掌握的那个） */
        var S = w.senses;
        var unsure = (w.unsureSenses || []).filter(function (i) { return S[i]; });
        var rest = S.slice(1);
        var pick = unsure.length ? unsure.map(function (i) { return S[i]; }) : (rest.length ? rest : S);
        var target = pick.slice(0, 2).map(function (s) { return s.d || ''; }).filter(Boolean).join(' / ');
        var more = pick.length > 2 ? ' (+' + (pick.length - 2) + ' further senses on file; any one of them counts)' : '';
        bits.push('target sense: ' + (target || '(common sense)') + more +
          ' — one is enough; do not pad the text to fit several');
      } else {
        bits.push('target sense: (use a common, level-appropriate sense)');
      }
      var combos = (w.combos || []).filter(function (c) { return c.k; });
      if (w.weak.indexOf('phrase') >= 0 && combos.length) {
        bits.push('use at least one of these combinations: ' +
          combos.slice(0, 3).map(function (c) { return c.k; }).join(' / '));
      } else if (combos.length) {
        bits.push('possible combinations: ' +
          combos.slice(0, 2).map(function (c) { return c.k; }).join(' / '));
      }
      bits.push('weakness: ' + (w.weak.length
        ? w.weak.map(function (k) { return WEAK_TYPES[k].short; }).join(', ')
        : '(untagged; treat as a normal unknown word)'));

      lines.push(tag + ' ' + (i + 1) + '. **' + w.word + '**' +
        (w.pos ? ' (' + w.pos + ')' : '') + ' — ' + bits.join('; '));
    });

    /* ---------- 逐类型的呈现要求（只列本轮涉及到的） ---------- */
    var usedTypes = {};
    words.forEach(function (w) { w.weak.forEach(function (k) { usedTypes[k] = 1; }); });
    var dirLines = Object.keys(usedTypes).map(function (k) {
      return '- **' + WEAK_TYPES[k].label + '**: ' + DIRECTIVE[k];
    });

    /* ---------- 题目 ---------- */
    var poly = words.filter(function (w) { return w.weak.indexOf('polysemy') >= 0; });
    var nQ = Math.max(0, o.questions | 0);

    var DEFAULT_Q = ['mainIdea', 'detail', 'inference', 'wordInContext'];
    var sel = (o.qTypes && o.qTypes.length) ? o.qTypes.filter(function (k) { return !!Q_TYPES[k]; }) : DEFAULT_Q;
    // 一道题最多一种题型：选多了就按选择顺序取前 nQ 个
    if (nQ > 0 && sel.length > nQ) sel = sel.slice(0, nQ);
    if (!sel.length) sel = DEFAULT_Q.slice(0, Math.max(1, nQ || DEFAULT_Q.length));

    function specOf(k) {
      var t = Q_TYPES[k];
      if (k === 'wordInContext' && poly.length) {
        return 'one that ' + t.hint + ' — pick from ' + poly.slice(0, 4).map(function (w) { return w.word; }).join(', ');
      }
      return 'one that ' + t.hint;
    }
    var qSpec = sel.map(specOf);
    var others = Object.keys(Q_TYPES).filter(function (k) { return sel.indexOf(k) < 0; })
      .map(function (k) { return Q_TYPES[k].label; });

    /* ---------- 输出格式（编号连续） ---------- */
    var seq = 0;
    function next() { return (++seq) + '.'; }
    var out = [];

    out.push(next() + ' **Passage** — the English text in ' + paras +
      ' paragraphs, each labelled "Para 1" ... "Para ' + paras + '".');

    if (nQ > 0) {
      var typeLine;
      if (o.qStrict) {
        typeLine = nQ <= qSpec.length
          ? '   Types — use exactly these, one per question, in this order: ' + qSpec.join('; ') +
            '. Do not use any other type.'
          : '   Types — use only these ' + qSpec.length + ', cycling through them in this order across the ' +
            nQ + ' questions: ' + qSpec.join('; ') + '. Do not use any other type.';
      } else {
        typeLine = '   Types — these must each appear at least once: ' + qSpec.join('; ') + '.' +
          (nQ > qSpec.length
            ? '\n   That leaves ' + (nQ - qSpec.length) + ' question(s) to fill with whatever fits the passage best' +
              (others.length ? ' — other types on the menu: ' + others.join(', ') : '') + '.'
            : '');
      }
      out.push(next() + ' **Questions** — exactly ' + nQ + ' multiple-choice question' + (nQ === 1 ? '' : 's') +
        ' (A/B/C/D), numbered Q1 to Q' + nQ + '.\n' + typeLine + '\n' +
        '   Every distractor must be plausible yet provably wrong from the passage.\n' +
        '   **Print the questions only. No answers, no explanations, no hints here.**');
    }

    out.push(next() + ' **Target word check** — a Markdown table: word | used (yes/no) | sentence from the passage | sense or collocation actually tested. ' +
      'For any word you dropped, write "no" and add one short clause on why it would have felt forced.');

    if (o.outputs.glossary) {
      out.push(next() + ' **Glossary** — a table: word | pronunciation | meaning **in this passage only** (one sense, not a full dictionary entry) | the sentence it appeared in.');
    }
    if (o.outputs.translation) {
      out.push(next() + ' **Translation** — a full ' + (o.l1 || 'Chinese') + ' translation, paragraph by paragraph, matching the passage.');
    }
    if (nQ > 0) {
      out.push(next() + ' **Answer key** — the last section a reader needs. ' +
        'Repeat Q1 to Q' + nQ + ' with the correct letter and a one-sentence explanation each. ' +
        'It stays separate from the questions so the reader can attempt them first.');
    }

    out.push(next() + ' **Unused target words** — the very last thing in your reply. The section contains one fenced code block and nothing else:\n' +
      '   ```unused\n' +
      '   UNUSED: <every target word that did NOT appear in the passage, comma separated>\n' +
      '   ```\n' +
      '   Use exactly that ```unused fenced block. Chat interfaces render a one-click copy button on fenced blocks, and the reader needs to copy this list straight back into their trainer so skipped words are not marked as practised.\n' +
      '   If you used all of them, the block contains exactly: UNUSED: none\n' +
      '   No prose before or after the block, no bold, no bullets.');

    /* ---------- 难度 / 固定要求（编号动态生成，避免漏号） ---------- */
    var reqs = [
      'Length: about ' + o.length + ' words, plus or minus 8%.',
      'Genre: ' + o.genre + '.',
      'Structure: ' + paras + ' paragraphs with a clear line of development (open the topic, develop or argue, go a level deeper or raise a counter-case, then close or look ahead).',
      'Topic: ' + o.topic + '.'
    ];
    if (o.level) {
      reqs.push('Level: ' + o.level + '. Keep vocabulary and syntax inside that band unless a target word requires otherwise.');
    }
    reqs.push('Vocabulary ceiling: apart from the target words below, stay within the stated level. Proper nouns may stand.');
    reqs.push('**Naturalness beats coverage.** Cover at least ' + o.coverage + '% of the target words (roughly ' + must +
      ', the ones marked [MUST]). If forcing a word would make a sentence awkward or illogical, drop it — a contrived passage does more harm to reading practice than a missed word. Explain the drop in the target word check.');
    reqs.push('Every target word should sit in a sentence with enough context for its meaning to be worked out.');

    var body = [
      'You are an experienced writer of English reading-comprehension passages for learners, able to tune difficulty, genre and length precisely.',

      '## 1. Task',
      'Write an English passage for targeted vocabulary training. It must first and foremost read like a real text: fluent, natural and worth reading. The vocabulary work is the means, not the point.',

      '## 2. Fixed requirements',
      reqs.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n'),

      '## 3. Target words (lower number = higher priority)',
      lines.join('\n'),

      '## 4. How each word should be presented',
      dirLines.length ? dirLines.join('\n') : '- Treat them as ordinary unknown words: a natural context is enough.',
      'General rule: one or two appearances per word, never bunched into a single paragraph.',

      '## 5. Output format',
      out.join('\n'),

      o.extra ? '## 6. Extra instructions\n' + o.extra.trim() : '',

      '## Final rules',
      '- Output nothing outside the requested sections: no preamble, no "here is your passage", no closing remarks.',
      '- Never contort a sentence to fit a word in.',
      '- Do not annotate target words inside the passage; definitions belong in the Glossary.',
      '- The answer key comes after all reading sections, always separated from the questions.',
      '- The Unused target words section is one ```unused fenced block and nothing else. That fence is what gives the reader a one-click copy button.',

      'Before you finish, check five things: (a) is the word count right; (b) did every [MUST] word get used; ' +
      '(c) did each target word actually appear in the intended sense or collocation; ' +
      '(d) read it once through and ask whether any sentence exists only to smuggle a word in; ' +
      '(e) does the final ```unused block list exactly the words missing from the passage.'
    ].filter(Boolean);

    return body.join('\n\n');
  }

  return { build: build, DIRECTIVE: DIRECTIVE, Q_TYPES: Q_TYPES };
})();
