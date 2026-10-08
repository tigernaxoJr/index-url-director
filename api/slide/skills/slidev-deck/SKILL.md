---
name: slidev-deck
description: 協助使用者在本機建立高質感 Slidev 簡報，結合 HTML/Tailwind、SVG 向量圖、Three.js 3D 視覺並匯出 PDF。使用者要求製作簡報、或資料夾中有 slide.start.json / slide.project.json 時使用。
---

# Slidev Deck Skill

本 Skill 指引 Coding Agent（如 Claude Code）在使用者本機以 Slidev 製作簡報，並透過 Slidev CLI 匯出 PDF。網頁工作台 https://aofa.tigernaxo.com/slide/ 只讀寫使用者授權的資料夾，所有內容與運算都留在本機。

- 協議：專案檔 [https://aofa.tigernaxo.com/api/slide/schemas/project.schema.json](https://aofa.tigernaxo.com/api/slide/schemas/project.schema.json)、進度檔 [https://aofa.tigernaxo.com/api/slide/schemas/activity.schema.json](https://aofa.tigernaxo.com/api/slide/schemas/activity.schema.json)、流程 [https://aofa.tigernaxo.com/api/slide/workflow.json](https://aofa.tigernaxo.com/api/slide/workflow.json)
- 視覺做法：[visual-guide.md](visual-guide.md)；匯出：[export-guide.md](export-guide.md)

---

## <a id="init"></a>1. 判斷狀態與初始化（`/slide-init`）

先看目前資料夾：

1. **有 `slide.project.json`** → 既有專案，跳到 §2 對應的階段（依 `status`：`initialized` → 大綱、`outlined` → 文案、`drafted` → 視覺、`visualized` → 匯出）。
2. **只有 `slide.start.json`**（網頁準備的空資料夾）→ 專案就建在這裡，不要另建子資料夾；網頁一直在看這個資料夾。
3. **都沒有** → 在目前工作資料夾建立 `<主題英文小寫>-slides`，先用白話向使用者確認位置。資料夾必須是空的或不存在。

初始化步驟：

1. **下載並驗證範本**（雜湊不符就停止並告知使用者，不使用該檔案）：
   ```bash
   curl -fsSL -o slidev-deck.zip https://aofa.tigernaxo.com/api/slide/templates/slidev-deck.zip
   curl -fsSL https://aofa.tigernaxo.com/api/slide/templates/slidev-deck/manifest.json
   node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('slidev-deck.zip')).digest('hex'))"
   ```
   比對 manifest 的 `zip.sha256` 後解壓：macOS / Linux `unzip -q slidev-deck.zip`；Windows PowerShell `Expand-Archive slidev-deck.zip -DestinationPath .`。解壓後刪除 zip。範本不含 `slide.start.json` 與 `slide.activity.json`，不會覆蓋網頁寫的檔案。
2. **安裝依賴**：`pnpm install`（匯出 PDF 需要 Chromium；第一次匯出若出現 `Executable doesn't exist`，執行 `pnpm exec playwright install chromium`）。
3. **填寫專案檔**：範本的 `slide.project.json` 是佔位內容。有 `slide.start.json` 時以它為準（`title`、`description`、`audience`、`pagesCount`、`theme`、`aspectRatio`、`notes`），沒有就向使用者詢問主題、對象與頁數：
   ```bash
   pnpm run state project --id <英文小寫-連字號> --title "<主題>" --description "<一句說明>" --pages <頁數> --theme <主題風格> --status initialized
   ```
   `theme` 不是 `default` 時安裝對應套件（例如 `pnpm add @slidev/theme-seriph`），並同步修改 `slides.md` 開頭的 `theme:`。
4. 執行 `pnpm run validate`，通過後進入大綱階段。

## 2. 製作流程

每開始一個階段、每次停下來等使用者回覆前，都更新進度檔（網頁會顯示）：

```bash
pnpm run state activity --step outline --message "正在規劃大綱"
pnpm run state activity --step outline --message "大綱完成，請在對話中確認或告訴我要改哪裡" --waiting
pnpm run state activity --step visual --slide 3 --total 8 --message "正在畫第 3 頁的架構圖"
```

`--step` 只能是 `init`、`outline`、`draft`、`visual`、`export`、`idle`；`--status` 只能是 schema 列出的值。腳本會先依 `schemas/` 驗證、驗證失敗不寫檔，並以原子寫入（暫存檔改名）避免留下損壞的 JSON。

1. <a id="outline"></a>**規劃大綱（`/slide-outline`）**：依主題、對象與資料擬定分頁大綱，決定每頁的核心訊息與呈現方式（文字、SVG 圖、3D、引言）。向使用者展示大綱並等待確認，確認後 `pnpm run state project --status outlined --pages <頁數>`。
2. <a id="draft"></a>**撰寫簡報（`/slide-draft`）**：編輯 `slides.md`，以單獨一行的 `---` 分頁；每頁可在開頭用 frontmatter 指定版型：
   - `cover`：首頁與大標題；`two-cols`：左右雙欄（右欄以 `::right::` 開始）；`center`：聚焦單一重點；`quote`：引言。
   - **講者備忘錄**：寫在該頁**最後一個** HTML 註解裡（Slidev 的規則），例如 `<!-- 這裡先停頓，問聽眾是否用過 Agent -->`。不要寫成 `<!-- notes -->` 這種標籤；頁中其他註解不會被當成備忘錄。
   完成後展示給使用者確認，`pnpm run state project --status drafted`。
3. **視覺升級（`/slide-visual`）**：見 [visual-guide.md](visual-guide.md)。內嵌 SVG 架構圖與流程圖、在關鍵頁使用 `<ThreeGlobe />` 等 3D 組件、以 `v-click` 逐步揭示。完成後 `pnpm run state project --status visualized`。
4. **匯出 PDF（`/slide-export`）**：見 [export-guide.md](export-guide.md)。`pnpm run export` 產出 `output/slides.pdf`，成功後 `pnpm run state project --status exported`；失敗時 `--status failed` 並把錯誤用白話告訴使用者。

完成後告訴使用者可在網頁工作台 https://aofa.tigernaxo.com/slide/ 開啟這個資料夾預覽每一頁與 PDF。

---

## 3. 嚴格規則

1. **資料不離開本機**：不把使用者資料上傳到任何外部端點。
2. **單一真理來源**：簡報內容只在 `slides.md`；狀態只透過 `pnpm run state` 修改，不手寫 `slide.project.json` / `slide.activity.json`。
3. **向量優先**：圖表與圖示優先使用 SVG 或 Iconify；文字與 SVG 在 PDF 中是向量。WebGL（Three.js）畫面匯出後是點陣圖，只用在裝飾或氛圍頁，不要用來承載需要放大閱讀的資訊。
