/* ============================================================
   i18n.js —— 界面语言（English / 中文）
   静态文案写在 index.html 的 data-i18n 上；动态文案用 t('key')。
   ============================================================ */
var I18N = (function () {

  var DICT = {
    'app.name':        { en: 'LexForge',                zh: 'LexForge 词炉' },
    'app.tagline':     { en: 'Reading-driven vocabulary trainer', zh: '以阅读驱动的词汇训练器' },

    'tab.words':       { en: 'Word bank',               zh: '单词本' },
    'tab.forge':       { en: 'Build a passage',         zh: '生成文章' },
    'tab.log':         { en: 'Reading log',             zh: '阅读记录' },
    'tab.data':        { en: 'Data & backup',           zh: '数据与备份' },
    'tab.about':       { en: 'About',                   zh: '关于' },

    'stat.words':      { en: 'words',                   zh: '总词数' },
    'stat.due':        { en: 'due',                     zh: '待复习' },
    'stat.fresh':      { en: 'new / vague',             zh: '生疏 / 模糊' },
    'stat.solid':      { en: 'solid',                   zh: '已掌握' },
    'stat.practised':  { en: 'practised',               zh: '已练过' },

    'search.ph':         { en: 'Search a word…', zh: '搜索单词…' },
    'filter.anyMastery':{ en: 'Any mastery',            zh: '不限掌握度' },
    /* 掌握度五档 */
    'm.0':             { en: 'New',                     zh: '未学' },
    'm.1':             { en: 'Vague',                   zh: '模糊' },
    'm.2':             { en: 'Recognised',              zh: '认得' },
    'm.3':             { en: 'Solid',                   zh: '牢固' },
    'm.4':             { en: 'Mastered',                zh: '精通' },
    'filter.anyWeak':    { en: 'Any weakness',           zh: '不限薄弱点' },
    'filter.dueOnly':  { en: 'Due only',             zh: '只看待复习' },
    'sort.priority':     { en: 'Priority',              zh: '优先级' },
    'sort.due':          { en: 'Due date',               zh: '到期时间' },
    'sort.mastery':     { en: 'Mastery (low first)',     zh: '掌握度（低在前）' },
    'sort.added':        { en: 'Recently added',         zh: '最近添加' },
    'sort.alpha':        { en: 'A–Z',                    zh: '字母序' },
    'btn.import':      { en: 'Import / Export',          zh: '导入 / 导出' },
    'btn.addWord':     { en: 'Add word',                 zh: '添加单词' },

    'th.word':           { en: 'Word',                   zh: '单词' },
    'th.pos':            { en: 'POS',                     zh: '词性' },
    'th.gloss':          { en: 'Senses / collocations',  zh: '义项 / 搭配' },
    'th.mastery':        { en: 'Mastery',                 zh: '掌握度' },
    'th.weak':           { en: 'Weaknesses',              zh: '薄弱点' },
    'th.due':            { en: 'Due',                     zh: '到期' },
    'due.over':          { en: 'due now',                 zh: '该复习了' },
    'due.today':         { en: 'today',                   zh: '今天' },
    'due.inDays':        { en: 'in {n} d',                zh: '{n} 天后' },
    'word.more':         { en: '+{n} more',               zh: '+{n} 条' },
    'word.less':         { en: 'Show less',               zh: '收起' },
    'word.moreTip':      { en: 'Show every sense of this word', zh: '展开这个词的全部义项' },
    'btn.editTip':       { en: 'Edit this word',          zh: '编辑这个单词' },
    'btn.delTip':        { en: 'Delete this word',        zh: '删除这个单词' },
    'tip.play':          { en: 'Play pronunciation (your system voice)',
                                                          zh: '播放发音（系统语音）' },
    'tip.remove':        { en: 'Remove',                  zh: '移除' },
    'tip.score':         { en: 'score {s} — due {d} / mastery {m} / type {t} / novelty {n} / recent −{r}',
                                                          zh: '得分 {s} —— 到期 {d} / 掌握 {m} / 类型 {t} / 新鲜 {n} / 近期 −{r}' },
    'pick.noMatch':      { en: 'No match',                zh: '没有匹配' },
    'words.empty':       { en: 'No words in this bank yet — use <b>Add word</b>, or open <b>Library</b> to pick words you already have.',
                                                           zh: '这个单词本还是空的 —— 用 <b>添加单词</b>，或打开 <b>词库</b> 挑已有的词。' },

    'forge.params':      { en: '1 · Passage parameters',  zh: '1 · 文章参数' },
    'forge.level':       { en: 'Target level',           zh: '目标难度' },
    'forge.levelCustom': { en: 'Custom level',           zh: '自定义难度' },
    'forge.length':      { en: 'Length (words)',         zh: '篇幅（词数）' },
    'forge.presets':     { en: 'Presets',               zh: '预设' },
    'forge.paras':       { en: 'Paragraphs',             zh: '段落数' },
    'forge.genre':       { en: 'Genre',                   zh: '体裁' },
    'forge.topic':       { en: 'Topic',                   zh: '话题' },
    'forge.topicCustom': { en: 'Custom topic',           zh: '自定义话题' },
    'forge.questions':   { en: 'Questions',              zh: '题目数' },
    'forge.qTypes':      { en: 'Question types',         zh: '题型' },
    'forge.qStrict':     { en: 'Only these types',       zh: '只出这些题型' },
    'forge.qHint':       { en: 'Leave empty for a sensible mix. One question can carry at most one type, so the selection is capped at the question count.',
                                                          zh: '留空则自动搭配。一道题最多一种题型，所以可选的种类数不会超过题目数。' },
    'qt.mainIdea':       { en: 'Main idea / best title', zh: '主旨 / 最佳标题' },
    'qt.detail':         { en: 'Detail',                 zh: '细节题' },
    'qt.inference':      { en: 'Inference',              zh: '推断题' },
    'qt.wordInContext':  { en: 'Word in context',        zh: '词义理解' },
    'qt.attitude':       { en: 'Attitude / tone',        zh: '态度 / 语气' },
    'qt.reference':      { en: 'Reference',              zh: '指代题' },
    'qt.structure':      { en: 'Text structure',         zh: '篇章结构' },
    'qt.gap':            { en: 'Sentence insertion',     zh: '句子插入' },
    'forge.weakFocus':   { en: 'Weakness types to focus on this round', zh: '本轮重点突破的薄弱类型' },
    'forge.weakHint':    { en: 'Unchecked = no filter; the algorithm scores everything. Checked types get priority.',
                                                           zh: '不勾选 = 不过滤，算法对所有词打分；勾选的类型会被优先选中。' },
    'forge.count':       { en: 'Target words',           zh: '目标词数' },
    'forge.diff':       { en: 'Difficulty lean',        zh: '难度倾向' },
    'forge.diff.balanced': { en: 'Balanced',            zh: '均衡' },
    'forge.diff.known':  { en: 'Towards known',         zh: '偏已掌握' },
    'forge.diff.new':    { en: 'Towards new',           zh: '偏生词' },
    'forge.range.known': { en: 'known',                 zh: '已掌握' },
    'forge.range.new':   { en: 'new',                   zh: '生词' },
    'forge.coverage':   { en: 'Minimum coverage',       zh: '最低覆盖度' },
    'forge.cover.60':   { en: '60% — naturalness first', zh: '60% —— 优先自然' },
    'forge.cover.75':   { en: '75%',                    zh: '75%' },
    'forge.cover.90':   { en: '90%',                    zh: '90%' },
    'forge.cover.100':  { en: '100% (may read forced)', zh: '100%（可能生硬）' },
    'forge.auto':       { en: 'Adjust with length',        zh: '随篇幅自动调整' },
    'forge.autoHint':   { en: 'Auto scales three things with the passage length: target words ≈ length/40, paragraphs ≈ length/90, questions ≈ length/100. Edit any of the three by hand and its auto switch turns itself off — the others keep following.',
                                                           zh: '篇幅会同时带动三项：目标词 ≈ 篇幅/40，段落 ≈ 篇幅/90，题目 ≈ 篇幅/100。手动改其中任意一项，该项的自动开关会自行关闭，其余两项继续跟随。' },
    'forge.outputs':   { en: 'Extra output sections',   zh: '附加输出板块' },
    'out.glossary':    { en: 'Glossary',                zh: '词汇表' },
    'out.translation': { en: 'Full translation',        zh: '全文翻译' },
    'out.answerKey':   { en: 'Answer key',              zh: '答案' },
    'forge.l1':        { en: 'Translation language',   zh: '翻译语言' },
    'forge.extra':     { en: 'Extra instructions (optional)', zh: '补充说明（可选）' },

    'forge.picks':     { en: '2 · Pick the words to train',           zh: '2 · 选择需要训练的词' },
    'btn.pick':        { en: 'Pick words',              zh: '智能选词' },
    'btn.reroll':      { en: 'Reroll',                 zh: '换一批' },
    'btn.clear':       { en: 'Clear',                   zh: '清空' },
    'btn.addManual':   { en: 'Add manually',            zh: '手动添加' },
    'pick.empty':      { en: 'Hit <b>Pick words</b>. The algorithm weighs due date, mastery, weakness tags and recent use, then applies diversity limits.',
                                                           zh: '点 <b>智能选词</b>。算法会综合到期时间、掌握度、薄弱标签和最近是否练过，并做多样性限制。' },
    'pick.willTarget':  { en: 'Will target',             zh: '本轮练' },

    'forge.prompt':    { en: '3 · Prompt or reading task',             zh: '3 · 生成提示词或阅读任务' },
    'btn.generate':    { en: 'Generate prompt',          zh: '生成提示词' },
    'btn.copy':        { en: 'Copy',                     zh: '复制' },
    'btn.copied':      { en: 'Copied ✓',                 zh: '已复制 ✓' },
    'btn.saveTask':    { en: 'Save as reading task',      zh: '存为阅读任务' },
    'copy.fail':       { en: 'Copy failed — select the text and copy manually', zh: '复制失败 —— 请手动选中复制' },

    'log.tasks':       { en: 'Reading tasks',                zh: '阅读任务' },
    'log.showDone':    { en: 'Show completed',                zh: '显示已完成' },
    'log.empty':       { en: 'No reading tasks yet. Generate a prompt and save it, then come back here to score the words.',
                                                           zh: '还没有阅读任务。先生成提示词并保存，再回来给单词打分。' },
    'log.copyPrompt':  { en: 'Copy prompt',                  zh: '复制提示词' },
    'log.viewPrompt':  { en: 'View prompt',                  zh: '查看提示词' },
    'btn.delete':      { en: 'Delete',                     zh: '删除' },
    'btn.edit':        { en: 'Edit',                       zh: '编辑' },
    'log.done':        { en: 'done',                        zh: '已完成' },
    'log.todo':        { en: 'to read',                    zh: '待阅读' },
    'log.fbTitle':     { en: 'Words to feed back',          zh: '回传栏' },
    'log.fbHint':      { en: 'Mark as read walks these words one card at a time (words not in any word bank are skipped) — set mastery, weaknesses and a note. Paste the words the passage never used into the box below to return them: they stop counting as practised and stay on the due list.',
                         zh: '点「标记已读」会一张卡一张卡地过这些词（不在任何单词本里的词除外），直接改掌握度、薄弱点和备注。文章没用到的词粘进下面的框里回传 —— 不算练过，继续留在待复习队列。' },
    'log.tipTodo':     { en: 'Not scored yet — click “Mark as read” to walk the words card by card.', zh: '还没打分 —— 点「标记已读」会一张卡一张卡地过这些词。' },
    'log.tipHit':      { en: '✓ Scored in this task — mastery and weaknesses updated.', zh: '✓ 这张卡已过：掌握度、薄弱点已更新。' },
    'log.tipNolib':    { en: 'Red — not in any word bank: only practised this round; skipped by Mark-as-read and never scheduled for review.', zh: '红底 —— 不在任何单词本里：只练这一轮，「标记已读」会跳过它，也不进复习安排。' },
    'log.unusedPh':    { en: 'Words the passage left out — paste the UNUSED line or just the words',
                                                          zh: '文章没用上的词 —— 粘 UNUSED 行或直接输入单词' },
    'log.unusedBtn':   { en: 'Return',                       zh: '回传' },
    'log.fbReturned':  { en: 'Returned as unused — not counted as practised', zh: '已回传：文章没用上，不算练过' },
    'btn.save':        { en: 'Save',                         zh: '保存' },
    'btn.cancel':      { en: 'Cancel',                       zh: '取消' },
    'log.fbLeft':      { en: '{n} of {t} still to score',   zh: '{n} / {t} 个还没过' },
    'log.fbAll':       { en: 'All {t} words scored',        zh: '{t} 个词都过完了' },
    'log.fbReview':    { en: 'Score again',                 zh: '再过一遍' },
    'log.fbStart':     { en: 'Mark as read',                zh: '标记已读' },
    'review.title':    { en: 'Score word {i} of {n}',       zh: '第 {i}/{n} 个词：掌握度' },
    'review.done':     { en: 'Scored {n} word(s).',         zh: '{n} 个词都过完了。' },
    'review.next':     { en: 'Next word',                   zh: '下一个词' },
    'review.finish':   { en: 'Finish',                      zh: '完成' },

    'data.source':      { en: 'Where the word bank comes from', zh: '词库数据来源' },
    'data.masteryDist':{ en: 'Mastery distribution',       zh: '掌握度分布' },
    'data.weakDist':    { en: 'Weakness distribution',     zh: '薄弱点分布' },
    'data.backup':      { en: 'Backup and migration',      zh: '备份与迁移' },
    'data.banks':       { en: 'Word banks',                zh: '单词本' },
    'data.banksHint':   { en: 'Rename a bank, or delete one you no longer need — its words move into the first remaining bank. At least one bank always stays.',
                          zh: '可以给单词本改名，或删掉不再需要的 —— 里面的词会转移到剩下的第一个单词本。至少会保留一个。' },
    'btn.bankRename':   { en: 'Rename',                    zh: '改名' },
    'btn.bankDelete':   { en: 'Delete',                    zh: '删除' },
    'data.sourceText2': { en: '<b>{total}</b> words in the library across <b>{banks}</b> word bank(s). Add more with <code>fetch-words.cmd</code> → Import.',
                                                           zh: '<b>{total}</b> 个词在词库里，共 <b>{banks}</b> 个单词本。更多词用 <code>fetch-words.cmd</code> 抓取后导入。' },
    'btn.exportJSON':   { en: 'Export JSON (full backup)', zh: '导出 JSON（完整备份）' },
    'btn.exportCSV':    { en: 'Export CSV',                zh: '导出 CSV' },
    'btn.importJSON':   { en: 'Import JSON / CSV',         zh: '导入 JSON / CSV' },
    'btn.erase':        { en: 'Erase everything',          zh: '清空所有数据' },

    'modal.addTitle':  { en: 'Add word',               zh: '添加单词' },
    'modal.editTitle': { en: 'Edit word',              zh: '编辑单词' },
    'f.word':          { en: 'Word *',                 zh: '单词 *' },
    'f.pos':           { en: 'POS',                    zh: '词性' },
    'f.posAuto':       { en: 'POS is picked up automatically from the POS box of each sense below.',
                                                           zh: '词性不用手填 —— 会自动从下面每条释义的词性框里摘取。' },
    'f.phonetic':       { en: 'Pronunciation',            zh: '音标' },
    'btn.lookup':      { en: 'Pull from dictionary',   zh: '从词典导入' },
    'btn.library':     { en: 'Library',                 zh: '词库' },
    'btn.syncLib':     { en: 'Sync from library',       zh: '从词库同步' },
    'btn.syncLibTip':  { en: 'Bank words that lag behind the library get refreshed here', zh: '词库里的词更新了，单词本没跟上时点这个' },
    'msg.synced':      { en: '{n} word(s) updated from the library', zh: '已从词库更新 {n} 个词的内容' },
    'msg.syncNone':    { en: 'Everything already matches the library', zh: '单词本和词库内容一致，无需同步' },
    'btn.newBank':     { en: 'New bank',                zh: '新建单词本' },
    'btn.saveNext':    { en: 'Save & next',             zh: '保存并继续' },
    'btn.details':     { en: 'Show senses & combinations', zh: '显示释义与组合' },
    'btn.detailsShow': { en: 'Show senses & combinations', zh: '显示释义与组合' },
    'btn.detailsHide': { en: 'Hide senses & combinations', zh: '收起释义与组合' },
    'f.senses':        { en: 'Senses',                     zh: '义项' },
    'btn.addSense':    { en: '+ Add sense',                zh: '+ 加一条释义' },
    'btn.removeSense': { en: 'Remove this sense',          zh: '删掉这条释义' },
    'btn.removeCombo': { en: 'Remove this combination',    zh: '删掉这条组合' },
    'f.posPh':         { en: 'noun',                       zh: '词性' },
    'f.defPh':         { en: 'what it means',              zh: '释义' },
    'f.unsure':        { en: 'Tick the senses you are not sure about', zh: '勾出你还不熟的义项' },
    'f.unsureHint':    { en: 'Only these senses will be targeted when the passage is written. Hover a sense to see its full definition.',
                                                           zh: '写文章时只会专门练这几条。鼠标在义项上悬停可查看完整释义。' },
    'f.combos':        { en: 'Word combinations',          zh: '词语组合' },
    'btn.addCombo':    { en: '+ Add combination',          zh: '+ 加一条组合' },
    'f.comboKeyPh':    { en: 'take up',                    zh: 'take up' },
    'f.comboDefPh':    { en: 'what it means',              zh: '释义' },
    'f.combosHint':    { en: 'Phrases, phrasal verbs, idioms and collocations — each with its own meaning and example sentences.',
                                                           zh: '短语、动词短语、习语、搭配都放这里，每条都可以有自己的释义和例句。' },
    'f.exPh':          { en: 'Example sentences — one per line', zh: '例句 —— 一行一句' },
    'combo.phrase':    { en: 'phrase',                     zh: '短语' },
    'combo.phrasal':   { en: 'phrasal verb',               zh: '动词短语' },
    'combo.idiom':     { en: 'idiom',                      zh: '习语' },
    'combo.collocation': { en: 'collocation',              zh: '搭配' },
    'modal.libEdit':   { en: 'Edit library entry',         zh: '编辑词库条目' },
    'modal.libAdd':    { en: 'Add a word to the library',  zh: '往词库加一个词' },
    'modal.libHint':   { en: 'Leave the content as-is and this stays a dictionary word (mastery, weak points and the note are always yours to fill); edit the content and it becomes your own entry.',
                                                          zh: '内容保持原样就仍是词典词（掌握度、薄弱点、备注本来就是你填的）；一旦修改了义项、搭配等内容，它就会变成你自己添加的词条。' },
    'msg.libSaved':    { en: 'Saved “{w}” to the library', zh: '已把「{w}」存进词库' },
    'lib.delTip':      { en: 'Delete from dictionary',      zh: '从词典删除' },
    'lib.delSel':      { en: 'Delete selected',             zh: '删除所选' },
    'msg.delDictSelAsk': { en: 'Delete the {n} selected word(s) from the dictionary? Unedited copies in your word banks will be removed too; words you edited stay.',
                           zh: '删除选中的 {n} 个词条？单词本里内容未改过的同名副本会一并移除；你改过的词条会保留。' },
    'msg.dictDeletedMany': { en: 'Deleted {n} word(s) from the dictionary', zh: '已从词典删除 {n} 个词条' },
    'msg.delDictAsk':  { en: 'Delete “{w}” from the dictionary? Unedited copies in your word bank will be removed too; words you edited stay.',
                                                          zh: '从词典里删除 “{w}”？单词本里内容一致的词典副本会一并删除；你改过内容的词条会保留。' },
    'msg.dictDeleted': { en: 'Deleted “{w}” from the dictionary', zh: '已从词典删除 “{w}”' },
    'msg.dictCopiesGone': { en: 'Also removed {n} matching bank word(s)', zh: '单词本里 {n} 个词典副本也一并移除' },
    'msg.delDictFail': { en: 'That word is not in the dictionary', zh: '词典里没有这个词' },
    'msg.needSense':   { en: 'Give the word at least one sense', zh: '至少写一条释义' },
    'btn.addOne':      { en: 'Add one word',            zh: '添加一个词' },
    'f.mastery':       { en: 'Mastery',                   zh: '掌握度' },
    'f.weak':          { en: 'Weaknesses',              zh: '薄弱点' },
    'f.note':          { en: 'Note',                    zh: '备注' },

    'pick.title':      { en: 'Select words to include',  zh: '选择包含单词' },
    'pick.fromLib':    { en: 'Add from the library…',    zh: '从词库加词…' },
    'btn.done':        { en: 'Done',                    zh: '完成' },

    /* 设置面板 */
    'set.title':       { en: 'Settings',                 zh: '设置' },
    'set.language':    { en: 'Interface language',      zh: '界面语言' },
    'set.theme':       { en: 'Theme',                    zh: '主题' },
    'set.defaults':    { en: 'Defaults for a new passage', zh: '新文章的默认值' },
    'set.defHint':     { en: 'Used every time you open Build a passage. Tick “Adjust with length” and the number box greys out — the value scales with the passage length. Untick it to set a fixed default.',
                                                           zh: '每次打开「生成文章」时的初始值。勾选「随篇幅自动调整」后数字框会灰掉，数值跟着篇幅走；取消勾选才能填固定的默认值。' },
    'set.reset':       { en: 'Restore defaults',         zh: '恢复默认' },
    'set.close':       { en: 'Close',                    zh: '关闭' },
    /* 导入 */
    'imp.title':       { en: 'Import words',            zh: '导入单词' },
    'imp.paste':       { en: 'Paste a list',             zh: '粘贴词表' },
    'imp.pasteHint':   { en: 'One word per line. A bare word is filled in from the library when we have it; <code>word | sense; sense</code> and <code>word, pos, sense</code> also work.',
                                                           zh: '一行一个词。裸词会尽量从词库补全；也支持 <code>word | sense; sense</code> 和 <code>word, pos, sense</code>。' },
    'imp.libSummary':  { en: 'Library: {a} new, {u} updated, {s} unchanged of {t}.', zh: '词库：共 {t} 个 —— 新增 {a}，更新 {u}，未变 {s}。' },
    'imp.pack':         { en: 'Paste a word pack',       zh: '粘贴数据包' },
    'imp.openFetch':    { en: 'Open fetch tool',            zh: '打开抓词工具' },
    'imp.loadFile':    { en: 'Load wordpack.json',      zh: '导入 wordpack.json' },
    'msg.packLoaded':  { en: 'Loaded {f} — press Import below', zh: '已载入 {f}，点下方「导入」即可' },
    'msg.libDupSkip':  { en: '“{w}” is already in the library — skipped, the library copy stays', zh: '“{w}”已在词库里 —— 按设置跳过，词库那份保持不动' },
    'imp.helpTitle':   { en: 'Fetch tool: usage & how to undo (click to expand)',
                                                           zh: '抓词工具：使用方法与撤销方法（点此展开）' },
    'imp.packHint':    { en: '<b>Usage 1 · Manual</b>: double-click <code>fetch-words.cmd</code> (it sits in the same folder as this app). You will type ONE line: the FIRST character is a digit picking the dictionary (<code>1</code> Oxford, default / <code>2</code> Collins) — or leave it out for Oxford — then the words you want. Separate the digit and every word with a space, then press Enter to run. The JSON pack is copied to your clipboard automatically — come back here, press Ctrl+V into the box below and click Import. Or click <b>Load wordpack.json</b> and pick the file directly: the scraper saves packs into the app folder (next to <code>index.html</code>), named like <code>wordpack-123456.json</code>.',
                                                           zh: '<b>用法一 · 手动</b>：双击 <code>fetch-words.cmd</code>（它和应用在同一个文件夹里）。要输入的是一行：第一个字符是数字，用来选词典（<code>1</code> 牛津，默认 / <code>2</code> 柯林斯；不输入数字就用牛津），数字后面跟要抓的单词。数字和单词、单词和单词之间都用空格隔开，最后按回车确认并开始抓取。抓完输出的 JSON 会自动复制到剪贴板 —— 回到本页按 Ctrl+V 粘进下面的框（在窗口里点右键也能粘贴），再点「导入」。也可以点 <b>导入 wordpack.json</b> 直接选文件：抓词工具把数据包存在应用所在文件夹里（<code>index.html</code> 旁边），文件名形如 <code>wordpack-123456.json</code>。' },
    'imp.openFetchHint': { en: '<b>Usage 2 · One click from the browser (one-time setup)</b>: double-click <code>tools\\register-fetch-protocol.cmd</code>. When the window says “Done. The lexforge-fetch:// protocol now points to: …”, registration has succeeded. From then on, click the Open fetch tool button on the right — the browser asks once, allow it (tick “always allow” if you never want to be asked again — but read the last few paragraphs of the undo notes below before making that choice), and the fetch window opens. Usage is the same as Usage 1.',
                                                           zh: '<b>用法二 · 浏览器一键（需一次性设置）</b>：双击 <code>tools\\register-fetch-protocol.cmd</code>。等窗口出现 <b>Done. The lexforge-fetch:// protocol now points to: …</b> 就说明注册成功了。之后点本页右侧「打开抓词工具」→ 浏览器弹窗点允许（想以后不再问就勾选始终允许 —— 勾之前先看看下面撤销方法里的最后几段）→ 抓词窗口直接打开，用法和用法一相同。' },
    'imp.fetchUndo':   { en: '<b>How to undo</b>: ① Unregister the protocol — open the tools folder in File Explorer, type <code>register-fetch-protocol.cmd -u</code> in the address bar and press Enter; after that the Open fetch tool button simply does nothing. ② Remove the browser\u2019s "always allow" — fully quit the browser you registered it from, then open its profile folder with File Explorer (paste the path into the address bar and press Enter; %LOCALAPPDATA% is <code>C:\\Users\\&lt;you&gt;\\AppData\\Local</code>): Edge <code>%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\</code>, Chrome <code>%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\</code>. Open the <code>Preferences</code> file inside with any text editor (no extension — Notepad, VS Code, anything works), press Ctrl+F and search for <code>protocol_handler</code>, then delete the whole <code>"protocol_handler":{…},</code> key-value pair it lands on. The exact shape varies by browser and machine — what it stores is only "which sites may open which external programs". As one real example, on the machine this text was written on, Edge had: <code>"protocol_handler":{"allowed_origin_protocol_pairs":{"http://127.0.0.1:50201":{"lexforge-fetch":true}}},</code> — the address in the middle is the page\u2019s address and port, so yours may differ (another port, or several site entries inside). Deleting the whole block affects nothing else. Firefox is a different beast: no Preferences file — its profile folder (<code>%APPDATA%\\Mozilla\\Firefox\\Profiles\\…</code>) holds a <code>handlers.json</code>; Ctrl+F for <code>lexforge-fetch</code> and delete that one entry (keep the JSON braces balanced). Any other browser: look up where it keeps this kind of setting \u2014 asking an AI is the fastest way. After that the browser asks every time again. Cleaning these remembered decisions up one by one is a hassle \u2014 if in doubt, the easiest path is simply not to tick \u201calways allow\u201d in the first place.',
                                                           zh: '<b>撤销方法</b>：① 注销协议 —— 在文件管理器打开 tools 文件夹，在地址栏输入 <code>register-fetch-protocol.cmd -u</code> 回车，之后「打开抓词工具」点了就不会再有反应。② 撤销浏览器的「始终允许」—— 完全退出你注册时用的那个浏览器，然后用资源管理器打开它的配置文件夹（直接把路径复制粘贴到资源管理器地址栏回车即可；%LOCALAPPDATA% 就是 <code>C:\\Users\\你的用户名\\AppData\\Local</code> 文件夹）：Edge 是 <code>%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\</code>，Chrome 是 <code>%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\</code>。用任意文本编辑器（记事本、VS Code 都行）打开里面的 <code>Preferences</code> 文件（没有扩展名），按 Ctrl+F 搜索 <code>protocol_handler</code>，把定位到的整个 <code>"protocol_handler":{…},</code> 键值对整段删掉。这段的具体长相因浏览器、因机器而异 —— 它记录的只是「哪些网站允许打开哪些外部程序」。举个实测例子：写这段文案的这台机器上，Edge 里是 <code>"protocol_handler":{"allowed_origin_protocol_pairs":{"http://127.0.0.1:50201":{"lexforge-fetch":true}}},</code> —— 中间的地址是本页面的地址和端口，你的可能不同（端口不一样，或者里面不止一个网站的条目）。整段删掉不影响其它任何设置。Firefox 完全不同：没有 Preferences 文件，用的是配置文件夹（<code>%APPDATA%\\Mozilla\\Firefox\\Profiles\\…</code>）里的 <code>handlers.json</code>，Ctrl+F 搜 <code>lexforge-fetch</code> 删掉那一条（注意保持 JSON 括号配对）。其它浏览器：自己查这类设置存在哪 —— 推荐直接问 AI。删完浏览器就恢复每次询问了。这些记录一个个翻出来删挺麻烦的，如果不放心的话，最省事的做法就是当初别勾选「始终允许」。' },
    'imp.packPh':      { en: '{ "app": "LexForge", "kind": "wordpack", … }', zh: '{ "app": "LexForge", "kind": "wordpack", … }' },
    'imp.badJSON':     { en: 'That is not valid JSON — copy the whole block the scraper printed.', zh: '不是合法的 JSON —— 请把抓取工具输出的整段内容复制进来。' },
    'imp.notPack':     { en: 'That JSON has no word list in it.', zh: '这段 JSON 里没有单词列表。' },
    'imp.dupMode':     { en: 'On a word you already have:', zh: '遇到已有的单词时：' },
    'imp.skip':        { en: 'Skip',                       zh: '跳过' },
    'imp.overwrite':   { en: 'Overwrite',                  zh: '覆盖' },
    'imp.dict':        { en: 'Dictionary data',            zh: '词典数据' },
    'imp.dictHint':    { en: 'Export saves the entries you added or edited as a wordpack JSON — for backup or moving to another device. Import follows the skip / overwrite setting above for words you already have.', zh: '导出的是你自己添加 / 编辑过的词条，格式与数据包相同，可存档或搬到别的设备。导入时遇到词库已有的词，按上面的「跳过 / 覆盖」处理。' },
    'imp.dictExport':  { en: 'Export dictionary',          zh: '导出词典' },
    'imp.dictImport':  { en: 'Import dictionary file',     zh: '导入词典文件' },
    'imp.dictExported':{ en: 'Exported {n} entries.',      zh: '已导出 {n} 个词条。' },

    /* 未用词回传（就在阅读任务卡里） */
    'un.notFound':     { en: 'No UNUSED line in what you pasted — copy the tail of the AI reply, or just type the missing words.',
                                                           zh: '粘贴的内容里没有 UNUSED 行 —— 请复制 AI 回复的结尾，或直接手动输入没用到的词。' },
    'un.empty':        { en: 'Type or paste the unused words first.', zh: '请先输入或粘贴没用到的词。' },
    'un.bad':          { en: 'Nothing to return — paste the UNUSED line, or the words separated by commas or spaces.',
                                                           zh: '没有可回传的词 —— 请粘贴 UNUSED 行，或用逗号/空格分隔的单词。' },
    'un.noneMatch':    { en: 'None of those words are in this task ({list}).', zh: '这些词都不在这条任务里（{list}）。' },
    'un.done':         { en: 'Returned {n} word(s) to the due list — they will not be counted as practised.{extra}',
                                                           zh: '已把 {n} 个词放回待复习队列 —— 它们不会被算作已练过。{extra}' },
    'un.notInBank':    { en: ' Not in this task: {list}.',   zh:  '不在本条任务里：{list}。' },
    'copy.nothing':    { en: 'Nothing to copy yet',          zh: '还没有可复制的内容' },

    /* 提示 / 确认框 */
    'msg.wordEmpty':   { en: 'Word cannot be empty',          zh: '单词不能为空' },
    'msg.wordGone':    { en: 'That word is no longer in your word bank.', zh: '这个词已经不在单词本里了。' },
    'msg.dupWord':     { en: '“{w}” is already in this word bank.', zh: '“{w}” 已经在这个单词本里了。' },
    'msg.twinSeeded':  { en: '(mastery & weaknesses carried over from the word banks)', zh: '（掌握度 / 薄弱点已按单词本里已有的词沿用）' },
    'msg.csvDone':     { en: 'Imported {n} word(s) from the CSV.', zh: '已从 CSV 导入 {n} 个单词。' },
    'msg.csvNoWord':   { en: 'That CSV has no “word” column.',     zh: '这个 CSV 里没有 “word” 列。' },
    'msg.qTypeCap':    { en: 'Only {n} question(s), so at most {n} type(s). Deselect one first, or raise the question count.',
                                                              zh: '只有 {n} 道题，最多选 {n} 种题型。先取消一个，或者把题目数调大。' },
    'msg.qTypeTrim':   { en: 'Question count dropped to {n}, so extra types were removed.',
                                                              zh: '题目数减到 {n}，多出来的题型已去掉。' },
    'msg.noAudio':     { en: 'No pronunciation available for that word', zh: '这个词没有可用发音' },
    'msg.filled':      { en: 'Pulled {n} sense(s) and {m} combination(s) from the dictionary{stem}. Edit as you like, then Save.',
                                                           zh: '已从词典导入 {n} 条义项、{m} 条词语组合{stem}。可随意修改后再保存。' },
    'msg.notInDict':   { en: '“{w}” is not in the dictionary yet ({n} words). Type the senses by hand, or pull it in with <code>fetch-words.cmd</code> → <b>Import → Paste a word pack</b>.',
                                                           zh: '词典（{n} 个词）里还没有 “{w}”。可以手动填写，或用 <code>fetch-words.cmd</code> 抓取后粘进 <b>导入 → 粘贴数据包</b>。' },
    'msg.viaStem':     { en: ' (matched the headword “{w}”)', zh: '（匹配到原形词 “{w}”）' },
    'msg.typeWord':    { en: 'Type a word first',             zh: '请先输入单词' },
    'msg.wizardDone':  { en: 'All {n} word(s) are in your word bank', zh: '{n} 个词都加进单词本了' },
    'msg.bankEmpty':   { en: 'Your word bank is empty — open Library and add some words', zh: '单词本是空的 —— 打开「词库」选些词加进来' },
    'bank.all':        { en: 'All word banks',            zh: '所有单词本' },
    'bank.mine':       { en: 'My words',                  zh: '我的单词' },
    'bank.nameAsk':    { en: 'Name for the new word bank', zh: '新单词本的名字' },
    'bank.defaultName':{ en: 'Word bank {n}',             zh: '单词本 {n}' },
    'bank.created':    { en: 'Created “{name}”',          zh: '已创建「{name}」' },
    'bank.wordCount':  { en: '{n} words',                 zh: '{n} 个词' },
    'bank.renameAsk':  { en: 'New name for this word bank', zh: '这个单词本改成什么名字' },
    'bank.renamed':    { en: 'Renamed to “{name}”',       zh: '已改名为「{name}」' },
    'bank.delAsk':     { en: 'Delete “{name}”? Its {n} word(s) will move into the first remaining bank. This cannot be undone.',
                         zh: '删除「{name}」？里面的 {n} 个词会搬到剩下的第一个单词本。此操作不可撤销。' },
    'bank.deleted':    { en: 'Deleted “{name}” — {n} word(s) moved', zh: '已删除「{name}」—— {n} 个词已转移' },
    'bank.lastOne':    { en: 'Keep at least one word bank', zh: '至少要保留一个单词本' },
    'f.bank':          { en: 'Word bank',                 zh: '单词本' },
    'lib.title':       { en: 'Word library',              zh: '词库' },
    'lib.searchPh':    { en: 'Search words…',             zh: '搜索单词…' },
    'lib.selectAll':   { en: 'Select all shown',          zh: '全选当前结果' },
    'lib.invertSel':   { en: 'Invert selection',          zh: '反选' },
    'lib.clearSel':    { en: 'Clear selection',           zh: '清空选择' },
    'lib.addRound':    { en: 'Add to this round',         zh: '加到本轮' },
    'lib.addedRound':  { en: 'Added {n} word(s) to this round', zh: '已把 {n} 个词加进本轮' },
    'lib.sharedCopied': { en: 'Copied {n} word(s) from another bank, keeping their mastery and weaknesses.', zh: '已从其他单词本复制 {n} 个词（沿用现有掌握度和薄弱点）。' },
    'lib.hintPick':    { en: 'Tick the words to train this round, then press “Add to this round”. Words already in any word bank keep their existing mastery and weaknesses; words in no bank get a quick weakness pick and stay out of the banks.',
                         zh: '勾选要练的词，点「加到本轮」。任意单词本里已有的词直接沿用现有掌握度和薄弱点；哪个本都没有的词补选一下薄弱点即可，不会加进任何单词本。' },
    'modal.weakWizard': { en: 'Pick weaknesses {i}/{n}',  zh: '选薄弱点 {i}/{n}' },
    'pick.allBanks':   { en: 'All banks',                 zh: '全部单词本' },
    'pick.nolib':      { en: 'not in any bank',           zh: '词库外' },
    'tip.nolibPick':   { en: 'Red — not in any word bank: only practised this round; skipped by Mark-as-read and never scheduled for review.', zh: '红底 —— 不在任何单词本里：只练这一轮，「标记已读」会跳过它，也不进复习安排。' },
    'lib.hint':        { en: 'Words already in the chosen word bank are greyed out ✓. Pick the bank at the bottom.',
                                                           zh: '已在该单词本里的词会变灰并打 ✓。单词本在底部选。' },
    'lib.stat':        { en: '{total} words in the library.',
                                                           zh: '词库共 {total} 个词。' },
    'btn.batchEdit':   { en: 'Batch edit',                zh: '批量编辑' },
    'bankedit.title':  { en: 'Batch edit word bank',      zh: '批量编辑单词本' },
    'bankedit.hint':   { en: 'Greyed-out words stay in the bank. Click a word to un-grey it (= mark it for removal), then press Save — marked words leave the bank. ✎ edits the word in place.',
                                                          zh: '变灰的词保留在单词本里；点一下取消变灰＝标记删除，点「保存」才真正删除。✎ 可以就地编辑这个词。' },
    'bankedit.searchPh': { en: 'Search words…',            zh: '搜索单词…' },
    'bankedit.save':   { en: 'Save — remove marked',      zh: '保存（删除标记的词）' },
    'bankedit.saveN':  { en: 'Save — remove {n} marked',  zh: '保存（删除标记的 {n} 个词）' },
    'bankedit.removed': { en: 'Removed {n} word(s) from the bank', zh: '已从单词本移除 {n} 个词' },
    'bankedit.empty':  { en: 'No words in this bank',     zh: '这个单词本里还没有词' },
    'bankedit.needBank': { en: 'Pick a specific word bank first — "All banks" cannot be batch edited.',
                                                          zh: '先选一个具体的单词本（「全部单词本」不能批量编辑）。' },
    'lib.selected':    { en: '{n} selected',              zh: '已选 {n} 个' },
    'lib.addToBank':   { en: 'Add to word bank',          zh: '加入单词本' },
    'lib.editTip':     { en: 'Edit this entry',           zh: '编辑这个词条' },
    'lib.noSenses':    { en: 'no senses yet',             zh: '还没有释义' },
    'lib.empty':       { en: 'No word matches that.',     zh: '没有匹配的单词。' },
    'lib.allOwned':    { en: 'All {n} of them are already in that word bank', zh: '这 {n} 个词都已经在那个单词本里了' },
    'lib.someOwned':   { en: '{n} already in that bank, skipped', zh: '有 {n} 个已在该单词本里，已跳过' },
    'modal.wizard':    { en: 'Add word {i} of {n}',       zh: '添加第 {i}/{n} 个词' },
    'msg.pickFirst':   { en: 'Pick some target words first',   zh: '请先选择目标词' },
    'msg.taskSaved':   { en: 'Saved. Score the words in Reading log when you are done.', zh: '已保存。读完后到「阅读记录」给单词打分。' },
    'msg.noWords':     { en: 'No words found in that text',    zh: '这段文字里没有识别到单词' },
    'msg.nothingSel':  { en: 'Nothing selected',              zh: '没有选中任何词' },
    'msg.delWord':     { en: 'Delete “{w}”?',                  zh: '删除 “{w}”？' },
    'msg.delTask':     { en: 'Delete this reading task? Your word bank is unaffected.', zh: '删除这条阅读任务？单词本不受影响。' },
    'msg.eraseAll':   { en: 'This erases every word and reading task and cannot be undone. Export a backup first. Continue?',
                                                           zh: '这会清空所有单词和阅读任务，且无法撤销。请先导出备份。确定继续？' },
    'msg.persistWarn': { en: 'This browser is blocking local storage, so anything you add will vanish on reload.',
                                                           zh: '当前浏览器禁止本地存储，新增内容在刷新后会丢失。' },
    'msg.persistHint': { en: ' Try opening the file directly in Chrome or Edge, and export a JSON backup from Data & backup from time to time.',
                                                           zh: ' 建议直接用 Chrome 或 Edge 打开本文件，并定期从「数据与备份」导出 JSON 备份。' },
    'msg.added':       { en: 'Added {w}',                  zh: '已添加 {w}' },
    'msg.saved':       { en: 'Saved',                      zh: '已保存' },
    'msg.exported':    { en: 'Exported',                   zh: '已导出' },
    'msg.erased':      { en: 'Everything erased',           zh: '已清空全部数据' },
    'msg.imported':    { en: 'Imported — {n} words total',   zh: '导入完成 —— 共 {n} 个词' },
    'msg.importFail':  { en: 'Import failed: {e}',           zh: '导入失败：{e}' },
    'about.title':     { en: 'About LexForge',            zh: '关于 LexForge' },
    'about.intro':     { en: 'LexForge is a local, offline vocabulary trainer: it trains your vocabulary through reading practice, not rote memorisation. Everything lives in your browser — no account, no server, no network calls. To guard against data loss, export a backup now and then.',
                                                           zh: 'LexForge 是一个本地离线的词汇训练器：靠阅读练习训练词汇量，而不是死记硬背。所有数据都在浏览器里 —— 没有账号，没有服务器，不联网。为了防止数据丢失，请时不时导出备份文件。' },
    'about.algoTitle': { en: 'How the word-picker works', zh: '选词算法是怎么想的' },
    'about.algo':      { en: 'Every word gets a recommendation score, made of five parts added together by weight. <b>Due date</b> has the biggest weight (≈34%): spaced repetition works out when each word should next be trained, and the closer a word is to its due date, the more weight it gets. <b>Mastery</b> (≈26%): the lower your mastery of a word, the more weight it gets. <b>Weaknesses</b> (≈16%): words matching the weakness types you picked in the passage settings get more weight. <b>Novelty</b> (≈14%): words that no passage has used yet carry more weight. <b>Recent use</b> (≈ −45%): anything practised in the last 7 days has its weight pushed down, so you don\u2019t run into the same words day after day. On top of these, a pinch of randomness (≈6%) keeps the result a little different each time, so the same few words don\u2019t always come out on top.<br>Once every word has its weight, the picker walks down the list from heaviest to lightest and gives words a seat in the round one by one, applying de-dup rules along the way: common endings are trimmed off before comparing, so words with the same stem (running and runner, for example) get only one seat per round; and there are limits on how many picked words may share the same part of speech or the same weakness type — so a round never comes out as a pile of look-alikes.<br>Review intervals move in only three cases: you edit a word\u2019s mastery or weaknesses, you score it in a reading task, or you add the word. If you scored a word but changed nothing, it comes back a little sooner than one you actually improved.',
                                                           zh: '每个词都会算出一个推荐分，由五部分按权重相加。<b>到期日</b>的权重最大（≈34%）：间隔复习会算出每个词下次该什么时候练，离到期日越近权重越高。<b>掌握度</b>（≈26%）：掌握度越低权重越高。<b>薄弱点</b>（≈16%）：你在文章参数里选择的想要突破的类型，对应词的权重会增加。<b>新颖度</b>（≈14%）：还没被任何一篇文章用过的词权重更高。<b>最近用过</b>（≈ −45%）：7 天内刚练过的词权重会被压低，免得连着几天都碰上同一批。另外再加一点小随机（≈6%），让结果每次稍有不同，不会老是挑中同几个词。<br>所有词都有了权重之后，选词按权重从高到低逐个往这轮里请，过程中按规则防止重复：应用会把常见的后缀去掉再比较，词干相同的词（比如 running 和 runner）一轮只挑一个；同一种词性、同一种薄弱类型的词数量也各有上限 —— 保证一轮不会全挑出长得像的词。<br>复习间隔只在三种情况下变化：你手动改了某个词的掌握度或薄弱点、你在阅读任务里给它打了分、或者你新加了这个词。打了分但什么都没改的词，会比有进步的词稍早一点回来。' },
    'about.links':     { en: 'Source & feedback: <a href="https://github.com/Cocoo23/LexForge" target="_blank" rel="noopener">github.com/Cocoo23/LexForge</a> · Contact: <a href="mailto:Cocoo23stu@proton.me">Cocoo23stu@proton.me</a>',
                                                           zh: '源码与反馈：<a href="https://github.com/Cocoo23/LexForge" target="_blank" rel="noopener">github.com/Cocoo23/LexForge</a> · 联系：<a href="mailto:Cocoo23stu@proton.me">Cocoo23stu@proton.me</a>' },
    'about.voiceTitle': { en: 'Pronunciation & offline',  zh: '发音与离线' },
    'about.voice':     { en: 'The app works offline, so it never downloads clips — every word is read with your system voice. If a word sounds odd or is mispronounced, that is your system voice, not this app.',
                                                           zh: '这个应用是离线的，不会去下载音频，所有单词都用系统语音读。要是哪个词读错了或发音奇怪，那是系统语音的问题，和应用无关。' },
    'about.creditTitle': { en: 'Attribution & disclaimer', zh: '素材来源与免责声明' },
    'about.credit':    { en: 'LexForge ships with no dictionary of its own. Whatever word data ends up in it — fetched with the bundled fetch tool from the public web pages of <b>Oxford Learner’s Dictionaries</b> (© Oxford University Press) and <b>Collins COBUILD</b> (© HarperCollins Publishers), or added by any other means — belongs to its copyright owners. Content is fetched for <b>personal study only</b>; anything here can be removed on request from the rights holders.',
                                                           zh: 'LexForge 本身不带任何词典数据。词库里的词条无论来自哪里——用随附的抓词工具从<b>牛津高阶 Oxford Learner’s Dictionaries</b>（版权归 Oxford University Press 所有）和 <b>Collins COBUILD</b>（版权归 HarperCollins Publishers 所有）的公开网页抓取，还是用其他方式添加——内容所有权都归原权利人所有。抓取仅供<b>个人学习使用</b>；应权利人要求，可随时移除相关内容。' },
    'about.disclaimer': { en: 'LexForge runs entirely offline and collects nothing. Use at your own risk: the author is not liable for any loss caused by using LexForge or the bundled fetch tool, and any infringement arising from how you fetch, store, or share the content is the user’s own responsibility.',
                                                           zh: '本工具完全离线运行、不收集任何数据。请自行斟酌使用：对使用本工具及随附抓词工具造成的任何损失，或因用户自行抓取、保存、传播所抓内容而产生的侵权责任，均由用户承担，作者不承担责任。' },
    'about.version':   { en: 'Version 1.0 · built 2026-10-23', zh: '版本 1.0 · 构建于 2026-10-23' },
    'data.backupHint': { en: 'Data lives in your browser (localStorage). <b>Clearing site data wipes it</b>, so export a backup now and then.',
                                                           zh: '数据存在浏览器本地（localStorage）。<b>清除站点数据会一并抹掉</b>，记得不时导出备份。' },
    'msg.mergePrompt': { en: 'OK = merge into your word bank; Cancel = replace everything', zh: '确定 = 合并进现有单词本；取消 = 覆盖全部数据' },

    /* 主题 / 设置补充 */
    'set.theme.light': { en: 'Light',                      zh: '浅色' },
    'set.theme.dark':  { en: 'Dark',                       zh: '深色' },
    'set.theme.system':{ en: 'Follow system',              zh: '跟随系统' },
    'set.saved':       { en: 'Settings saved',             zh: '设置已保存' },
    'set.outputs':     { en: 'Extra output sections, on by default', zh: '默认勾选的附加输出板块' },
    'set.outputsHint': { en: 'Ticked here = already ticked every time you open Build a passage. You can still switch them per passage.',
                                                           zh: '这里勾上的板块，每次打开「生成文章」都会默认勾着；单篇文章仍可临时改。' },
    'set.extra':       { en: 'Default extra instructions', zh: '默认补充说明' },
    'set.extraHint':   { en: 'Pre-filled in the extra instructions box every time you open Build a passage. You can still change or clear it per passage.',
                         zh: '每次打开「生成文章」都会预先填进补充说明框；单篇文章仍可修改或清空。' }
  };

  /* 下拉选项：value 始终用英文（要喂给 AI），显示文案随语言切换 */
  var LEVELS = [
    { v: 'Gaokao (China national college entrance exam) — C/D reading passages', en: 'Gaokao (China) — C/D passages', zh: '高考 —— C/D 篇' },
    { v: 'Zhongkao (China junior-high entrance exam)', en: 'Zhongkao (China junior-high)', zh: '中考' },
    { v: 'CET-4 (China college English band 4)', en: 'CET-4 (China)', zh: '大学英语四级' },
    { v: 'CET-6 (China college English band 6)', en: 'CET-6 (China)', zh: '大学英语六级' },
    { v: 'Kaoyan (China postgraduate English, reading section)', en: 'Kaoyan (China postgraduate)', zh: '考研英语' },
    { v: 'IELTS Academic reading (band 6.0–7.0)', en: 'IELTS Academic', zh: '雅思学术类' },
    { v: 'TOEFL iBT reading', en: 'TOEFL iBT', zh: '托福 iBT' },
    { v: 'CEFR A2 — elementary', en: 'CEFR A2 — elementary', zh: 'CEFR A2 初级' },
    { v: 'CEFR B1 — intermediate', en: 'CEFR B1 — intermediate', zh: 'CEFR B1 中级' },
    { v: 'CEFR B2 — upper intermediate', en: 'CEFR B2 — upper intermediate', zh: 'CEFR B2 中高级' },
    { v: 'CEFR C1 — advanced', en: 'CEFR C1 — advanced', zh: 'CEFR C1 高级' },
    { v: 'CEFR C2 — proficient', en: 'CEFR C2 — proficient', zh: 'CEFR C2 精通' },
    { v: '', en: 'General educated reading, no exam constraint', zh: '通用阅读，不绑定考试' },
    { v: '__custom', en: 'Custom', zh: '自定义' }
  ];

  var GENRES = [
    { v: 'Expository — explaining a phenomenon or concept', en: 'Expository', zh: '说明文' },
    { v: 'Argumentative — a claim with reasons and a counter-argument', en: 'Argumentative', zh: '议论文' },
    { v: 'News report — an event with several voices', en: 'News report', zh: '新闻报道' },
    { v: 'Science explainer — how something works', en: 'Science explainer', zh: '科普解释' },
    { v: 'Research summary — a study and what it means', en: 'Research summary', zh: '研究综述' },
    { v: 'Opinion column / op-ed', en: 'Opinion column / op-ed', zh: '评论 / 专栏' },
    { v: 'Book or film review', en: 'Book or film review', zh: '书评 / 影评' },
    { v: 'Biography / personal profile', en: 'Biography / profile', zh: '人物传记 / 特写' },
    { v: 'Narrative — a story with a turn', en: 'Narrative', zh: '记叙文' },
    { v: 'Historical account', en: 'Historical account', zh: '历史记述' },
    { v: 'Culture and travel essay', en: 'Culture & travel', zh: '文化 / 游记' },
    { v: 'Business / market report', en: 'Business / market', zh: '商业 / 市场' },
    { v: 'Product or service description', en: 'Product description', zh: '产品介绍' },
    { v: 'How-to / practical guide', en: 'How-to guide', zh: '操作指南' },
    { v: 'Interview (Q&A form)', en: 'Interview (Q&A)', zh: '访谈（问答）' },
    { v: 'Letter or email to an editor', en: 'Letter to an editor', zh: '致编辑的信' },
    { v: 'Speech / talk transcript', en: 'Speech / talk', zh: '演讲 / 讲话' },
    { v: 'Fable or allegory', en: 'Fable / allegory', zh: '寓言 / 讽喻' },
    { v: 'Comparison — two things weighed against each other', en: 'Comparison', zh: '对比分析' }
  ];

  var TOPICS = [
    { v: 'Any topic that best fits the target words', en: "Any (writer's choice)", zh: '不限（由作者决定）' },
    { v: 'Technology and artificial intelligence', en: 'Technology & AI', zh: '科技与人工智能' },
    { v: 'Environment and sustainability', en: 'Environment & sustainability', zh: '环境与可持续发展' },
    { v: 'Psychology and behavioural science', en: 'Psychology & behaviour', zh: '心理与行为科学' },
    { v: 'Education and learning science', en: 'Education & learning', zh: '教育与学习科学' },
    { v: 'Culture and cross-cultural exchange', en: 'Culture & exchange', zh: '文化与跨文化交流' },
    { v: 'Health, medicine and lifestyle', en: 'Health & lifestyle', zh: '健康与生活方式' },
    { v: 'Society, cities and demography', en: 'Society & cities', zh: '社会与城市' },
    { v: 'History, archaeology and the humanities', en: 'History & humanities', zh: '历史与人文学科' },
    { v: 'Business, economy and consumption', en: 'Business & economy', zh: '商业与经济' },
    { v: 'Art, literature and media', en: 'Art, literature & media', zh: '艺术、文学与传媒' },
    { v: 'Sports and competition', en: 'Sports', zh: '体育竞技' },
    { v: 'Food, agriculture and diet', en: 'Food & agriculture', zh: '饮食与农业' },
    { v: 'Law, ethics and public policy', en: 'Law, ethics & policy', zh: '法律、伦理与公共政策' },
    { v: 'Space, physics and natural science', en: 'Space & natural science', zh: '太空与自然科学' },
    { v: 'Work, careers and organisations', en: 'Work & careers', zh: '职场与组织' },
    { v: '__custom', en: 'Custom… (type below)', zh: '自定义…（在下方输入）' }
  ];

  /* 掌握度五档：真正的中英对照在 DICT 的 m.0–m.4，这里只留顺序 */
  var MASTERY_KEYS = ['m.0', 'm.1', 'm.2', 'm.3', 'm.4'];

  /* 薄弱类型标签（中文） */
  var WEAK_ZH = {
    polysemy:   { label: '一词多义',   short: '多义',   desc: '认识其中一义，换个语境就卡住' },
    phrase:     { label: '搭配',        short: '搭配',   desc: '单词单独认识，但不知道它跟谁一起用' },
    derivation: { label: '词族',        short: '派生',   desc: '加了词缀或换了词性就认不出来' },
    grammar:    { label: '语法句型',    short: '句型',   desc: '句式、及物性、动词补足语等用法' },
    register:   { label: '语体 / 正式度', short: '语体',   desc: '分不清正式、口语、学术等语域' },
    speed:      { label: '识别速度',    short: '速度',  desc: '能想起来，但慢到打断阅读节奏' },
    active:    { label: '被动转主动',  short: '产出',   desc: '阅读时认得，自己却用不出来' },
    discourse: { label: '语篇功能',    short: '语篇',   desc: '逻辑连接与态度标记，搞不清其作用' }
  };

  var LANG = 'en';

  function t(key) {
    var e = DICT[key];
    if (!e) return key;
    return (LANG === 'zh' && e.zh) ? e.zh : e.en;
  }

  function setLang(l) {
    LANG = (l === 'zh') ? 'zh' : 'en';
    document.documentElement.setAttribute('lang', LANG);
  }
  function getLang() { return LANG; }

  /** 带变量替换的翻译：t('imp.summary', {a:1}) */
  function tf(key, vars) {
    var s = t(key);
    if (!vars) return s;
    Object.keys(vars).forEach(function (k) {
      s = s.split('{' + k + '}').join(String(vars[k]));
    });
    return s;
  }

  /** 把 data-i18n 上挂的文案重新刷一遍 */
  function apply(root) {
    var nodes = (root || document).querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var key = n.getAttribute('data-i18n');
      var extra = n.getAttribute('data-i18n-suffix');
      var v = t(key) + (extra || '');
      if (n.hasAttribute('placeholder')) n.setAttribute('placeholder', v);
      else if (n.tagName === 'TITLE') n.textContent = v;
      else n.innerHTML = v;
    }
    /* data-i18n-title：悬停提示也跟着语言走 */
    var titled = (root || document).querySelectorAll('[data-i18n-title]');
    for (var j = 0; j < titled.length; j++) {
      titled[j].setAttribute('title', t(titled[j].getAttribute('data-i18n-title')));
    }
  }

  /** 词条标签：英文界面用 WEAK_TYPES，中文界面用 WEAK_ZH */
  function weakLabel(k) {
    if (LANG === 'zh') {
      var z = WEAK_ZH[k];
      if (z) return { label: z.label, short: z.short, desc: z.desc };
    }
    return WEAK_TYPES[k] || { label: k, short: k, desc: '' };
  }
  function masteryLabel(i) {
    return t(MASTERY_KEYS[i] || 'm.0');
  }

  return {
    t: t, tf: tf, apply: apply, setLang: setLang, getLang: getLang,
    weakLabel: weakLabel, masteryLabel: masteryLabel,
    LEVELS: LEVELS, GENRES: GENRES, TOPICS: TOPICS
  };
})();
