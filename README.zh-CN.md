# LexForge · 词炉

[English](./README.md) | 简体中文

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](./LICENSE)

一个**完全离线**的英语词汇训练工具。它不背单词——它让你**通过读文章来练单词**：从你的词库里智能选词，生成一篇刚好用到这些词的英语阅读材料（正文、题目、释义表、答案），读完还能打卡复习。

无服务器、无账号、无联网依赖（抓词工具除外）：双击 `index.html` 就能用，所有数据存在浏览器 localStorage 里。

## 功能

- **词库（Dictionary）**：所有词的第一站；编辑义项/搭配/例句、删除词条、一键从词典同步
- **抓词工具**：从 Collins / Oxford 官网把词条抓进词库，义项、搭配、例句、音标一并带入（详见下文）
- **生成文章（Build a passage）**：按篇幅自动缩放段落数/题目数/目标词数，也可手动固定；提示词直接喂给你喜欢的 AI，让 AI 产出阅读材料
- **智能选词**：按到期时间、掌握度、词性分布、生疏度加权选词，支持多义项薄弱点（只练你不熟的那几条释义）
- **复习打卡**：读完文章逐词标记回传，自动排期下次复习
- **数据管理**：CSV 导入导出、完整备份/恢复、数据包（wordpack）导入
- **中英双语界面**、浅色/深色主题

## 快速开始

1. 双击打开 `index.html`（推荐 Edge / Chrome）
2. 用「导入」加几个词（手动录入、粘贴列表，或用下面的抓词工具）
3. 在「词库」里挑词加入单词本
4. 到「生成文章」里智能选词 → 生成提示词 → 粘贴给 AI → 把 AI 写的文章贴回来练习

> 提示：数据存在浏览器里，**请时不时在「数据」页导出一份备份文件**。

## 抓词工具（可选）

词库里没有的词，可以用命令行小工具从 Collins / Oxford **官网**抓取（需要 Node 18+ 和联网）。本工具不使用任何第三方接口或服务，直接访问词典官网；抓回的内容仅供个人学习使用，请遵守各站点的使用条款。

**方式一 · 手动**：双击 `tools/fetch-words.cmd`，输入一行：第一个字符是数字选词典（`1` 牛津，默认，**推荐** / `2` 柯林斯官网），后面跟要抓的单词，空格隔开，回车运行。抓完 JSON 自动进剪贴板，回到网页「导入 → 粘贴数据包」即可。

- **牛津（推荐）**：普通请求即可，秒级出词，支持 `--concurrency` 并发。
- **柯林斯**：官网有 Cloudflare 防护，工具会用本机已装的 Chrome/Edge 开一个隐藏窗口来取页面（首次运行自动安装 playwright-core；每词约 10 秒，赶时间请用牛津）。

**方式二 · 网页一键**：双击 `tools/register-fetch-protocol.cmd` 注册 `lexforge-fetch://` 协议，之后点网页里的「打开抓词工具」直接运行。撤销注册用 `tools/register-fetch-protocol.cmd -u`。

也可以不用任何工具，直接「导入 → 添加一个词」手动录入，或者粘贴一个列表，具体见导入界面。

## 目录结构

```
index.html            应用入口（单页）
assets/
  dictstore.js        词典存取 / 词条删除（墓碑）机制
  store.js            单词本与复习排期
  word.js             词条数据模型
  scheduler.js        智能选词打分
  promptgen.js        提示词生成
  i18n.js             界面文案（中英）
  ui.js               界面渲染
  app.js              事件绑定
  style.css           样式（浅色/深色）
tools/
  fetch-words.cmd     抓词一行式入口（Windows，首次运行自动装依赖）
  fetch-words.js      抓词主逻辑（Node 18+）
  collins.js          Collins 官网页面解析
  register-fetch-protocol.cmd  注册/撤销 lexforge-fetch:// 协议
package.json          抓词工具的依赖声明（playwright-core）
```

> README、LICENSE、.gitignore 是仓库自带的元文件，不列在上面。

## 隐私

所有数据只存在你自己的浏览器里。抓词工具只在你主动运行时访问词典网站，不上传任何数据。

## 许可证 / License

本项目以 **CC BY-NC-SA 4.0**（署名—非商业性使用—相同方式共享 4.0 国际）协议发布，完整文本见 [LICENSE](./LICENSE)。

- ✅ 可以自由**使用、学习、修改和再分发**，包括发布你自己的改版
- ✍️ 使用、修改或分发时**必须保留原作者署名**（LICENSE 开头的版权声明与协议链接，不得删除或替换）
- ❌ **不得用于商业目的**——包括出售本工具、把它做进收费服务或商业产品等
- 🔄 发布改版时必须**继续使用同一协议**（相同方式共享），不得附加额外限制

> 人话版摘要在 [creativecommons.org](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)，仅供参考，以 [LICENSE](./LICENSE) 全文为准。

> 另请注意：用抓词工具抓取的词典内容（词条、释义、例句等）版权归 Oxford University Press、HarperCollins Publishers 等原权利人所有，本协议只覆盖本项目的代码、界面文案与文档本身。
