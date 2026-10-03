# 分鏡與旁白寫作指引

用於 `/video-storyboard`：根據 `brief/product-brief.md`（與可選的 `brief/style.json`）規劃 scene，產生每個 scene 的 `scene.json` 與 `script.md`。影片做到一半或已經合成後要重新規劃分鏡，見 [§6](#revise)。

---

## 1. <a id="structure"></a>規劃結構

### 依長度決定 scene 數

| 目標長度 | scene 數 | 建議結構 |
|---|---|---|
| ≤ 30 秒 | 3–4 | hook → solution → cta（可加一個 feature） |
| 31–60 秒 | 4–6 | hook → problem → solution → feature ×1–2 → cta |
| 61–90 秒 | 6–8 | hook → problem → solution → how-it-works → feature ×2 → benefit / social-proof → cta |

- 單一 scene 建議 4–12 秒；超過 12 秒就拆成兩個。
- 第一個 scene 必須是 `hook`，最後一個必須是 `cta`。
- `social-proof` 只在 brief 的「可信證據」有內容時使用。
- 有 `brief/style.json` 時，依 `pacing` 調整：`fast` 偏向較多、較短的 scene；`slow` 偏向較少、較長的 scene。
- 依 `project.style` 與 `project.targetAudience` 決定語氣、用詞與畫面：例如「專業簡報」句子沉穩、畫面資訊清楚；「活潑社群短片」句子短、口語、畫面文字放大（見 [§3 字級](#visual)）。

### 各 purpose 的寫法

| purpose | 目的 | 旁白要點 | 建議 visual.type |
|---|---|---|---|
| `hook` | 3 秒內抓住注意力 | 一個提問、反差或驚人的結果；不要先自我介紹 | `motion-graphic`、`web-capture`（最吸睛的畫面） |
| `problem` | 讓受眾覺得「這就是我」 | 具體情境，而非抽象描述 | `motion-graphic`、`screenshot` |
| `solution` | 介紹產品 | 產品名稱 + 一句話定位 | `web-capture`（首頁或主畫面） |
| `feature` | 展示一個功能 | 一個 scene 只講一個功能，講好處而非規格 | `web-capture`、`code` |
| `how-it-works` | 降低上手門檻 | 步驟化：「只要三步…」 | `web-capture`（操作流程）、`code` |
| `benefit` | 使用後的改變 | 量化或具體的結果 | `motion-graphic` |
| `social-proof` | 建立信任 | 只用 brief 中有出處的證據 | `screenshot`、`motion-graphic` |
| `cta` | 告訴觀眾下一步 | 一個明確動作 + 網址 | `motion-graphic`（logo + 網址） |
| `custom` | 以上都不適用 | — | 任意 |

### 範例（45 秒、zh-TW、開發者工具）

| # | purpose | 旁白 | 畫面 |
|---|---|---|---|
| 1 | hook | 部署一個網站，還要花你半天嗎？ | 時鐘快轉 + 終端機報錯畫面 |
| 2 | problem | 設定伺服器、申請憑證、串接 CI，每一步都可能卡關。 | 三張卡片依序出現並打叉 |
| 3 | solution | ShipIt 讓你推送程式碼，網站就上線。 | 產品首頁首屏 |
| 4 | feature | 每個分支自動產生預覽網址，直接貼給同事看。 | 錄製 PR 頁面出現預覽連結 |
| 5 | how-it-works | 只要連結 GitHub、選擇專案、按下部署。 | 錄製三步操作並高亮按鈕 |
| 6 | cta | 現在就到 example.com 免費開始。 | Logo + 網址置中 |

---

## 2. <a id="narration"></a>寫旁白（`script.md`）

### 語速與長度

| 語言 | 語速 | 5 秒約可說 |
|---|---|---|
| 中文 | 約 4 字／秒 | 20 字 |
| 英文 | 約 2.5 詞／秒（150 wpm） | 12 詞 |
| 日文 | 約 6 假名／秒 | 30 假名 |

- 所有 scene 旁白總時長應在 `project.format.targetDurationSec` 的 ±10% 內；每個 scene 另預留約 0.5 秒緩衝。
- 超出時**刪減內容**，不要靠加快語速（`narration.speed` 保持 1.0，除非使用者要求）。

### 寫作規則

1. **口語**：寫給耳朵聽，不是給眼睛看。避免括號、縮寫、符號（「&」「/」「→」）。
2. **短句**：中文每句 ≤ 20 字、英文 ≤ 15 詞。字幕每行上限中文 16 字、英文 42 字元，短句能自然斷行。
3. **一個 scene 一個重點**。
4. **講好處，不講規格**：「匯出只要一秒」勝過「採用多執行緒匯出引擎」。
5. **具體**：數字、情境、動作。避免「強大」「革命性」「無縫」這類空泛形容詞。
6. **符合受眾**：依 brief 的目標受眾決定術語深度。
7. **不捏造**：數據、客戶名稱、評價、獎項只能用 brief「可信證據」中的內容。不寫無法驗證的比較（「業界最快」）。
8. **數字與英文**：中文旁白中的數字寫成念法清楚的形式（「3 倍」而非「3x」）；產品名、技術名詞保留原文，TTS 念錯時再改寫成念法（例如在旁白中寫「G-P-T」）。

### 格式

```markdown
部署一個網站，還要花你半天嗎？
<!-- pause 0.5 -->
設定伺服器、申請憑證、串接 CI，每一步都可能卡關。
```

- 一行一句，空行會被忽略。
- `<!-- pause 秒數 -->` 插入停頓，用於轉折或讓畫面喘息；每個 scene 最多一兩個。
- 不寫畫面說明、講者標記或任何非旁白文字。
- 沒有旁白的 scene（例如純 logo 動畫）：`script.md` 留空，並在 `scene.json` 設定 `durationSec`。

---

## 3. <a id="visual"></a>設計畫面（`scene.json` 的 `visual`）

- **`description`**：用一兩句話描述觀眾會看到什麼，讓使用者在分鏡審閱時能想像畫面。
- **優先用真實產品畫面**：`web-capture` / `screenshot` 比抽象動畫更有說服力。從 brief 的「可用畫面」挑選。
- **`capture.actions`**：
  - 保持簡短（≤ 6 個動作），每個操作後加 `wait` 讓觀眾看清楚（300–800 ms）。
  - 優先使用穩定的 selector（`id`、`data-*`、有語意的 class），避免 `div:nth-child(7)`。也可以用 Playwright 的文字 selector，例如 `button:has-text("免費試用")`。
  - <a id="highlight"></a>**主動 highlight 重點元素**：錄製網頁時，你可以自行決定要框起哪些元素，不必先問使用者；分鏡審閱時在「畫面」欄寫出要框的元素即可（例如「框出『建立專案』按鈕」）。
    - 挑旁白正在講的那個元素：講到「一鍵部署」就框部署按鈕，講到價格就框方案卡片。
    - 每個 scene 1–3 次；一次只框一個（新的 highlight 會自動取消前一個）。
    - 依旁白時間排順序：用 `wait` 把 highlight 推到旁白講到它的時候；`ms` 是框住後停留的毫秒數（預設 1200）。
    - 估算時間時不必算頁面載入：`navigate` 或點連結換頁時，從發出請求到頁面穩定的那段會自動剪掉。
    - <a id="cut"></a>**剪掉沒有意義的畫面**：你判斷某個動作的過程不值得給觀眾看（單頁應用切換路由的過場、載入中的骨架、轉圈圈、為了到達目標而做的中間步驟），就在該動作加 `"cut": true`，不必問使用者。該動作從開始到畫面穩定的整段會剪掉，觀眾直接看到結果；被剪掉的時間也不必算進旁白對時。要讓觀眾看到的操作（例如示範點擊、輸入）不要剪。
    - selector 從 analyze 產生的 `brief/screens/*.elements.txt` 挑，或讀產品原始碼確認；只框可見、有意義的元素，不框整頁或大區塊。
    - 找不到元素時，`capture` 會印出 `warning: highlight … skipped` 並繼續錄製，不會失敗。看到這個警告就修正 selector 重新擷取，或在回報中告訴使用者那個框沒有出現。
  - `type` 只輸入示範用的假資料，絕不輸入真實帳密或個資。
  - <a id="demo-data"></a>**資料很少的報表頁**：儀表板、報表、圖表頁如果只有一兩筆資料或一片空白，錄出來會很空。這時可以**先詢問使用者**能否在錄製時改寫頁面 HTML，畫出合理的畫面（gate `domEditConsent`，每個 scene 分別取得）：
    1. 先說明看到的狀況與打算怎麼補，例如「營收報表目前只有 1 筆訂單，畫面很空。我可以在錄影時暫時把表格填成 12 筆示意訂單、圖表補上 6 個月的趨勢。這只影響錄下來的畫面，不會改到你的產品或資料，畫面角落會標示『示意資料』。可以嗎？」
    2. 同意後，在 scene 目錄寫 `demo-data.js`（在頁面中執行，可用 `await`），並在 `capture.actions` 加入 `{ "do": "script", "file": "demo-data.js" }`，放在 `navigate` 之後、`highlight` 之前；以 `pnpm run state` 寫入 `visual.capture.domEditConsent = { "granted": true, "grantedAt": "<現在時間>" }`。
    3. 示意資料要合理且一致：數字量級符合產品情境、總計與明細對得上、日期連續；用通用名稱（「客戶 A」「範例商店」），不用真實公司或人名，不寫看起來像真實成果的數據（例如「營收成長 300%」）。
    4. 優先改現有元素的文字與表格列，沿用頁面原本的樣式；圖表若是 canvas 無法改，就改用頁面上的 HTML 表格，或請使用者提供截圖。前端框架重新渲染可能把改動蓋掉，執行後加 `wait`，擷取後檢查畫面。
    5. 畫面上加一則 `elements` 文字「示意資料」（`position: top-right`、`size: normal`），除非使用者明確說不需要。
    - 使用者不同意時照實錄製，或請他提供有資料的帳號畫面、截圖。不要在未同意時加 `script` 動作，`capture` 會拒絕執行。
- **`elements`（疊加元素）**：
  - 畫面文字 ≤ 12 個中文字或 6 個英文詞；**不要把旁白原文搬上畫面**（字幕已經有了），而是提煉關鍵字。
  - `at` 對齊旁白中提到該關鍵字的時間點（依語速估算）。
  - 品牌 logo 用 `@/assets/brand/…`。
  - **字級 `size`**：`normal`（預設）、`large`、`xl`。只有短而重要的字才放大：hook 的提問、benefit 的數字、cta 的網址，或風格是活潑短片、直式影片時。渲染器會把放大的字自動縮回到不超過兩行、不超出畫面，所以不會嚴重跑版；但字太長時縮回後就和 `normal` 差不多，放大前先把文字精簡到 8 字以內。疊在網頁錄影上、或同一畫面已有兩則文字時維持 `normal`。
- <a id="custom-motion"></a>**自訂動畫與 SVG 插圖**：`motion-graphic` 除了用 `elements` 排文字和圖片，還可以由你寫一支動畫模組（`visual.motion`，用 SVG、Canvas、GSAP、Three.js、GLSL shader、粒子特效畫出整個畫面），或畫 SVG 插圖存成檔案當 `image` 元素。做法見 [rendering-guide.md#motion](rendering-guide.md#motion) 與 [#svg](rendering-guide.md#svg)。
  - **適合**：抽象概念或看不到的過程（資料流動、架構、前後對比、數字成長）、沒有產品畫面可錄的 hook / benefit、品牌感的開場與結尾。能錄到真實產品畫面時仍優先錄影。
  - **耗用量**：寫動畫模組或畫新的 SVG 插圖要花較多 token 與時間，所以依 `project.customMotion` 決定能不能用：

    | 設定 | 做法 |
    |---|---|
    | `allow` | 依需要自行使用，分鏡審閱時在「畫面」欄標示「自訂動畫」即可 |
    | `ask`（預設） | 規劃時可以提議，但在分鏡審閱時逐段請使用者決定（見 [§5](#review)）；使用者沒同意的段落改用 `elements` 排版，不寫 `visual.motion` |
    | `deny` | 不寫 `visual.motion`，也不畫新的 SVG 插圖；只用 `elements`、現有的圖檔與 logo |

  - 不算自訂動畫、不必問的：重複使用 `@/assets/svg/` 已存好的 SVG、複製產品原始碼裡現成的 svg/png、簡單的形狀或圖示（幾行 SVG，例如箭頭、勾勾、圓點）。
  - 製作途中（`/video-scene`、`/video-sync`）才想加分鏡沒列出的自訂動畫時，`ask` 先問、`deny` 不加。
  - 一部影片的自訂動畫段落沿用同一套配色與畫法（`ctx.theme`、同一組 SVG 圖示），看起來才像同一支影片。
- **`transitionIn`**：預設 `none`（直接切換）；同一段落內的 scene 之間可用 `fade`。全片不超過兩種轉場。
- **`durationSec`**：一般保持 `null`（由旁白決定）；只有無旁白或需要與音樂對拍時才指定。

### 最小的 draft scene.json

```json
{
  "$schema": "../../schemas/scene.schema.json",
  "id": "scene-004",
  "title": "分支預覽",
  "purpose": "feature",
  "narration": { "scriptFile": "script.md" },
  "visual": {
    "type": "web-capture",
    "description": "PR 頁面出現預覽網址，點擊後開啟預覽站",
    "capture": {
      "url": "https://example.com/demo/pull/42",
      "actions": [
        { "do": "wait", "ms": 500 },
        { "do": "highlight", "selector": "[data-testid=preview-link]" },
        { "do": "wait", "ms": 800 },
        { "do": "click", "selector": "[data-testid=preview-link]" },
        { "do": "wait", "ms": 1200 }
      ]
    },
    "elements": [
      { "type": "text", "content": "每個分支自動預覽", "at": 0.5, "position": "top" }
    ]
  },
  "durationSec": null,
  "status": "draft",
  "locked": false
}
```

---

## 4. <a id="files"></a>建立檔案

1. scene id 依建立順序編號：`scene-001`、`scene-002`…；目錄為 `scenes/{三位數}-{purpose 或簡短英文 slug}/`，例如 `scenes/004-branch-preview/`。
2. 每個 scene 寫入 `scene.json` 與 `script.md`（新建檔案可直接寫入）。
3. 以 `pnpm run state project --patch-file <檔案>` 把 scene 依播放順序加入 `video.project.json` 的 `scenes`：

   ```json
   [
     { "op": "add", "path": "/scenes/-", "value": { "id": "scene-001", "dir": "scenes/001-hook" } },
     { "op": "add", "path": "/scenes/-", "value": { "id": "scene-002", "dir": "scenes/002-problem" } }
   ]
   ```

4. 執行 `pnpm run validate`，並將 project 狀態設為 `script_generated`（只在第一次規劃時；重新規劃見 [§6](#revise)）。

---

## 5. <a id="review"></a>分鏡審閱（checkpoint）

完成後**必須停下**，請使用者確認分鏡與完整旁白稿。使用者明確同意前，不執行 `tts`、`capture`、`render:scene`。先以表格呈現總覽：

```text
目標 45 秒｜預估 43.5 秒｜6 個 scene

| # | scene     | 用途         | 旁白                                   | 畫面                         | 秒數 |
|---|-----------|--------------|----------------------------------------|------------------------------|------|
| 1 | scene-001 | hook         | 部署一個網站，還要花你半天嗎？           | 時鐘快轉 + 終端機報錯        | 4.0  |
| 2 | scene-002 | problem      | 設定伺服器、申請憑證、串接 CI，…        | 三張卡片依序出現並打叉       | 7.5  |
| … |           |              |                                        |                              |      |

需要調整哪幾段？確認後我會開始逐段產生（/video-scene all）。
```

表格之後，逐段列出**完整的旁白稿**（不要用「…」省略）與畫面文字，讓使用者能逐字確認：

```text
【1 hook｜約 4 秒】
旁白：部署一個網站，還要花你半天嗎？
畫面：時鐘快轉 + 終端機報錯；大字「部署要半天？」
```

- 秒數為估算值，實際以 TTS 產生後的音長為準。
- 用到[自訂動畫](#custom-motion)的段落，在「畫面」欄開頭標示「〔自訂動畫〕」。`project.customMotion` 是 `ask` 時，表格後面另外列出這些段落請使用者逐段決定，並附上不用自訂動畫時的替代畫面：

  ```text
  以下段落我想自己寫程式畫動畫，比較生動，但每段會多花一些 AI 用量與製作時間。要哪幾段？（沒選的我改用文字與圖片排版）
  ① scene-002 problem：三張卡片翻轉後碎裂成粒子 ｜ 不用的話：三張卡片依序出現並打叉
  ② scene-005 benefit：數字從 0 跳到 10 倍，背景光線流動 ｜ 不用的話：大字「快 10 倍」放大進場
  ```

  使用者選定後才寫入 scene；沒選的段落不寫 `visual.motion`。這個決定只在本次分鏡有效，之後重新規劃時新增的自訂動畫要再問。
- 預估總長與已確認的目標長度相差超過 10% 時，在表格上方說明原因，並問使用者要刪減內容還是調整目標長度。
- 可以提醒使用者也能在網頁工作台直接修改旁白，改完說「我改好了」即可。
- 使用者提出修改時，**只改被點名的 scene**，改完再呈現一次更新後的表格。
- 使用者要求新增或刪除 scene 時，同步更新 `video.project.json` 的 `scenes`；刪除的 scene 目錄保留，由使用者自行決定是否刪除。

---

## 6. <a id="revise"></a>重新規劃分鏡（已有 scene 時）

專案已經有 scene（包括 `output/final.mp4` 已合成）時，使用者說「重新規劃分鏡」「開場和結尾換掉、中間加一段比較」等，也是執行 `/video-storyboard`，但改為**修訂現有分鏡**：沒被點名的段落原樣保留，之後只重做有變更的段落。

1. **讀取現況**：執行 `pnpm run status`，讀取每個 scene 的 `scene.json` 與 `script.md`（Web UI 或使用者可能剛改過）。
2. **提出修訂，先不寫檔**：只改使用者要求的部分，其餘照舊。總覽表多一欄「變更」：

   ```text
   目標 45 秒｜預估 47.0 秒｜6 個 scene（保留 3、修改 1、新增 1、移除 1）

   | # | scene     | 變更 | 用途    | 旁白                         | 畫面               | 秒數 |
   |---|-----------|------|---------|------------------------------|--------------------|------|
   | 1 | scene-001 | 修改 | hook    | 還在手動部署嗎？             | 終端機報錯         | 3.5  |
   | 2 | scene-002 | 保留 | problem | （不變）                     | （不變）           | 7.5  |
   | 3 | scene-007 | 新增 | feature | 推上 GitHub，預覽網址就好了。 | 錄製 PR 頁面       | 8.0  |
   | … |           |      |         |                              |                    |      |
   | — | scene-004 | 移除 | feature | —                            | —                  | —    |
   ```

   修改與新增的段落逐段列出完整旁白稿與畫面文字（同 [§5](#review)）；保留的段落不必重列。說明哪些段落會重做、其餘沿用現有影片，再請使用者確認。**確認前不寫入任何檔案**，避免使用者反悔時已做好的段落被改掉。
3. **寫入**（使用者確認後）：
   - **保留**：不動。scene id 與目錄都不改，即使播放順序變了，也不要為了讓編號連續而重新命名目錄；目錄名稱算在內容指紋（`inputHash`）裡，改名會讓該段變成需要重做。
   - **修改**：直接改 `script.md`；`scene.json` 以 `pnpm run state <id> --patch-file` 修改。
   - **新增**：id 與目錄編號接在目前最大的編號後面（已有 `scene-006` 就從 `scene-007`、`scenes/007-…` 開始），依 [§4](#files) 建立檔案。
   - **移除**：只從 `scenes` 陣列移除，目錄保留，由使用者自行決定是否刪除。
   - **順序**：用一個 `pnpm run state project --patch-file` 一次寫入新的 `scenes` 陣列（例如 `{ "op": "replace", "path": "/scenes", "value": [...] }`）。**不要**再把 project 設為 `script_generated`：`state` 會依各 scene 狀態自動重算，且只要 scene 清單變了，就不會再是 `completed`。
4. **重做與合成**：執行 `pnpm run validate`，再依 [workflow.md#sync](workflow.md#sync) 執行 sync：只重做修改與新增的段落，然後重新合成。只調整順序或移除段落時，不重做任何段落，直接重新合成。

- `locked: true` 或 `approved` 的段落，使用者沒有明確點名就不修改；修訂內容涉及它們時先問。
- 修訂後預估總長與目標長度相差超過 10% 時，和 §5 一樣先說明並詢問。
