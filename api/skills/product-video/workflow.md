# 工作流程做法

各步驟的順序、前置狀態與狀態轉換以專案內 `schemas/workflow.json` 為準；本文件說明每一步**怎麼做好**。規則衝突時以專案 `AGENTS.md` 為準。

---

## <a id="init"></a>init：初始化

見 [SKILL.md §2](SKILL.md)。

---

## <a id="analyze"></a>analyze：分析產品

目標：產出一份足以寫出分鏡的 `brief/product-brief.md`。寧可短而準確，不要長而臆測。

### 讀取來源

**產品網址**（`sources.productUrl`）

1. 讀取頁面文字：首頁、功能頁、定價頁、關於頁（若有連結）。只讀使用者給的網域，不追到第三方網站。
2. 擷取截圖作為分析與後續素材：
   ```bash
   pnpm run capture --url <網址> --out brief/screens/
   ```
   會輸出整頁截圖、首屏截圖、頁面文字，以及 `<slug>.elements.txt`：頁面上可見的標題、按鈕、連結、輸入框與它們的 selector，寫分鏡時用來挑選要 highlight 的元素（見 [script-guide.md#highlight](script-guide.md#highlight)）。`sources.requiresLogin` 為 true 時，擷取前先依 [login](#login) 請使用者自己登入；擷取時出現 `gate productLogin`（被導到登入頁）也一樣。

**產品原始碼**（`sources.sourceCodePath`，唯讀）

依序查看，找到足夠資訊就停：

| 檔案 | 看什麼 |
|---|---|
| `README*` | 一句話定位、功能列表、安裝與使用方式 |
| `package.json` / `pyproject.toml` / `*.csproj` 等 | 名稱、描述、關鍵依賴（判斷產品類型） |
| 路由、頁面、CLI 指令定義 | 實際有哪些功能與操作流程 |
| i18n 字串檔、landing page 元件 | 產品自己的用語與標語 |
| Tailwind 設定、CSS 變數、theme 檔 | 品牌色、字型 |
| `CHANGELOG*` | 最近的重點功能 |
| logo（`public/`、`assets/` 下的 svg/png） | 複製到專案 `assets/brand/` |

**不要讀**：`.env*`、憑證、金鑰、`node_modules/`、建置產物、使用者資料。**不要修改**原始碼目錄中的任何檔案。

**使用者描述**（`sources.description`）：與其他來源衝突時，以使用者描述為準，並在 brief 中註明差異。

### 寫 `brief/product-brief.md`

使用以下結構，每一節都要有內容；真的無法得知時寫「未知」並說明缺什麼，**不要編造**：

```markdown
# <產品名稱> 產品簡報

## 一句話定位
<產品是什麼、給誰、解決什麼，一句話>

## 目標受眾
<角色、情境、技術程度>

## 痛點
- <受眾目前遇到的具體問題，1–3 點>

## 核心功能
1. <功能>：<它帶來的好處>   （最多 5 項，依重要性排序）

## 差異化（USP）
<跟替代方案相比，最獨特的一點>

## 可信證據
- <來源中實際存在的數據、客戶、評價、獎項；附出處>   （沒有就寫「無」）

## 品牌
- 主色 / 輔色：<#hex>
- 字型：<字型名稱或「未指定」>
- Logo：<assets/brand/... 或「未取得」>
- 語氣：<專業 / 親切 / 活潑 ...>

## 行動呼籲（CTA）
<希望觀眾做什麼：網址、下載、試用>

## 可用畫面
- <brief/screens/ 中各截圖對應的頁面與適合展示的功能>

## 來源與不確定處
- <讀了哪些來源；哪些資訊是推測的>
```

「可信證據」只能引用來源中確實存在的內容。分鏡中的 social-proof 只能使用這一節列出的證據。

### <a id="style"></a>風格分析（可選）

只在有參考影片時進行：

1. **取得影片**：使用者提供本機檔案最好。只有網址時，詢問使用者能否自行下載，或本機已有下載工具且使用者同意使用；不要繞過平台的下載限制。取得不到就跳過，在 brief 的「來源與不確定處」註明。
2. **抽取關鍵影格**：
   ```bash
   ffmpeg -i brief/reference.mp4 -vf "select='gt(scene,0.3)',scale=640:-1" -vsync vfr brief/reference-frames/%03d.png
   ffprobe -v error -show_entries format=duration -of csv=p=0 brief/reference.mp4
   ```
   影格數除以總長度即可估算平均鏡頭長度。
3. **寫入 `brief/style.json`**：

   ```json
   {
     "source": "brief/reference.mp4",
     "avgShotSec": 2.8,
     "pacing": "fast",
     "palette": ["#0F172A", "#38BDF8", "#FFFFFF"],
     "typography": { "headline": "粗體無襯線、大字置中", "body": "細體" },
     "captions": { "present": true, "position": "bottom", "style": "白字黑底半透明" },
     "transitions": ["cut", "fade"],
     "music": "輕快電子，約 120 BPM",
     "notes": "開場 3 秒內出現產品畫面"
   }
   ```

   `pacing`：`slow`（平均鏡頭 > 4 秒）、`medium`（2.5–4 秒）、`fast`（< 2.5 秒）。只記錄從影格與音訊實際觀察到的特徵。

### <a id="confirm"></a>完成：和使用者確認對象、風格與長度（checkpoint）

```bash
pnpm run state project --status analyzed
```

寫分鏡前**必須停下**，用白話向使用者呈現：

1. **產品摘要**：一句話定位、核心功能、不確定處。
2. **對象與風格**：init 時的設定是否仍合適；分析後有更好的建議就提出（例如「產品偏技術，建議對象改成開發者、風格用操作教學」）。
3. **建議長度**：依內容估算，並說明理由，給 2–3 個選項：

   ```text
   要講的重點：痛點 1 個、核心功能 3 個、CTA
   → 精簡版 30 秒：hook → 產品介紹 → 最重要的 1 個功能 → CTA
   → 標準版 45 秒（建議）：hook → 痛點 → 產品介紹 → 2 個功能 → CTA
   → 完整版 75 秒：再加上操作步驟與第 3 個功能
   ```

   估算方式：每個要講的重點約 6–10 秒，hook 與 CTA 各約 4 秒；以 [script-guide.md](script-guide.md#structure) 的 scene 數對照表為準。對象越不懂技術、風格越活潑，越偏向短版。
4. **太趕時怎麼處理**：「製作時如果某一段太趕（例如操作還沒做完就換下一段），要讓我自己把那段稍微拉長、事後告訴你，還是每次先問你？」寫入 `project.durationAdjust`（`auto` / `ask`；沒回答就是 `ask`）。規則見 [rendering-guide.md#pacing](rendering-guide.md#pacing)。
5. **自訂動畫**：「有些段落我可以自己寫程式畫動畫（例如資料流動、3D 產品展示、粒子特效），比單純的文字和圖片生動，但每段要花比較多的 AI 用量，也比較慢。要全部放行、都不要，還是規劃分鏡時一段一段問你？」寫入 `project.customMotion`（`allow` / `deny` / `ask`；沒回答就是 `ask`）。規則見 [script-guide.md#custom-motion](script-guide.md#custom-motion)。

使用者確認後，把結果寫入專案（`project.targetAudience`、`project.style`、`project.format.targetDurationSec`、`project.durationAdjust`、`project.customMotion`），用 `pnpm run state project --patch-file <檔案>`：

```json
[
  { "op": "replace", "path": "/project/targetAudience", "value": "中小企業老闆，不懂技術" },
  { "op": "add", "path": "/project/style", "value": "活潑社群短片：節奏快、字大" },
  { "op": "replace", "path": "/project/format/targetDurationSec", "value": 30 },
  { "op": "add", "path": "/project/durationAdjust", "value": "auto" },
  { "op": "add", "path": "/project/customMotion", "value": "ask" }
]
```

確認後才進入 `/video-storyboard`。

---

## <a id="login"></a>login：登入產品網站（gate productLogin）

產品網址要登入才看得到（`sources.requiresLogin: true`，或 capture 輸出 `gate productLogin`）時使用。使用者自己在一個瀏覽器視窗裡登入，**你不問、不看、不保存帳號密碼**，也不讀取 `.auth/`。

### 1. 開視窗前先說明（一次說完，等使用者回「好」）

1. **錄影會拍到什麼**：「錄影會拍到登入後畫面上的內容，例如客戶名稱、email、金額。如果有不想公開的資料，建議用展示用的帳號；或者錄影時我可以把那些地方換成示意資料，會先跟你確認。」（換成示意資料的做法同 [script-guide.md#demo-data](script-guide.md#demo-data)，需要 `domEditConsent`。）
2. **接下來會發生什麼**：
   > 「我會打開一個新的瀏覽器視窗。為了安全，它和你平常用的瀏覽器分開，所以要再登入一次。視窗上方可能寫著『Chrome 正受到自動測試軟體控制』，這是正常的。請像平常一樣登入（需要手機驗證碼也照常輸入），帳號密碼只在那個視窗裡輸入，我看不到。畫面下方的藍色提示變成綠色『已經登入了』之後，關掉那個視窗就好。」

### 2. 執行

```bash
pnpm run login            # 預設打開 sources.productUrl；也可給網址：pnpm run login https://app.example.com
```

指令會一直等到使用者關掉視窗（最多 30 分鐘），執行時間長是正常的。不要提醒使用者回終端機按任何鍵。

| 輸出 | 意思 | 接著 |
|---|---|---|
| `login: signed in` | 登入成功並已保存 | 告訴使用者「登入好了」，繼續原本的步驟 |
| `… no sign-in page was seen; ask the user …` | 有保存，但沒看到登入頁（有些網站在首頁直接登入） | 問使用者剛才有沒有登入成功；有就繼續，capture 若再出現 `gate productLogin` 就重新登入一次 |
| `closed before the user signed in` | 沒有登入就關了視窗 | 問使用者要再試一次，還是改用他提供的截圖或錄影 |
| `no usable browser` | 找不到瀏覽器 | 見 SKILL §2 安裝瀏覽器 |

### 3. 登入過期

capture 輸出 `gate productLogin: … the saved sign-in has expired` 時，不要顯示技術訊息，只說：「登入好像過期了，我再開一次視窗，麻煩你重新登入。」再從第 2 步執行。這不算 scene 失敗，不要用 `--failed` 記錄。

### 4. 做完後

合成完成後問使用者：「要不要清除剛才保存的登入資料？之後要重做影片時，再登入一次就好。」建議清除；使用者同意就執行 `pnpm run login --clear`。

使用者不想登入時：只擷取不需登入的公開頁面，或請他提供截圖、錄影（`visual.type: user-asset`）。

---

## <a id="sync"></a>sync：同步變更

使用者在 Web UI 或編輯器改過檔案後執行。原則：**只重做真正受影響的部分。**

### 1. 找出變更

```bash
pnpm run status
```

依變更類型決定要做什麼：

| 變更 | 影響 | 處理 |
|---|---|---|
| `script.md`、scene 的聲音或語速 | 該 scene 旁白與時長 | 重做 tts → render |
| `visual.*`（含 `capture.actions` 的 script 檔）、`durationSec`、scene 素材 | 該 scene 畫面 | 重做 capture（若 capture 設定變了）→ render |
| `project.format` | 所有 scene | 全部 render（旁白不必重做，除非 TTS 設定也變） |
| `project.tts`（專案層） | 未覆寫 provider / voice 的 scene | 這些 scene 重做 tts → render |
| `video.project.json` 的 scene 順序 | 只影響合成 | 只重新 assemble |
| `captions`、`audio` | 只影響合成 | 只重新 assemble |
| 新增 scene | 該 scene | build_scene |
| 刪除 scene | 只影響合成 | 確認使用者要刪除後，從 `scenes` 陣列移除（目錄保留，由使用者自行刪除） |

### 2. 標記與重做

1. `status` 為 `rendered` / `approved`、但 `inputHash` 不相符的 scene：`pnpm run state <id> --status stale`。
2. **`locked: true` 的 scene 即使過期也不重做**，列出來請使用者決定。
3. 依播放順序對每個需要處理的 scene 執行 build_scene。sync 時不在每個 scene 停下，全部完成後一次回報。有多個 scene 要渲染時，先完成各自的 `tts`、`capture` 與狀態，再一次 `render:scene <id> <id>…` 平行渲染（[rendering-guide.md](rendering-guide.md#flow)）。
4. 失敗的 scene 依 `AGENTS.md` 規則處理，不影響其他 scene 繼續；最後在回報中列出。

### 3. 合成

所有 scene 就緒後執行 assemble。有 scene 失敗或被鎖定而過期時，不合成，回報需要使用者處理的項目。

### 4. 回報

```text
已重做：scene-003（旁白修改）、scene-005（畫面修改）
僅重新合成：順序調整
需要你決定：scene-002 已鎖定但內容與上次渲染不同
輸出：output/final.mp4（47.2 秒）
```

這次的變更來自網頁、而且是第一次時，依 [SKILL.md §6](SKILL.md) 判斷是否提議開啟本機助手。

---

## <a id="translate"></a>translate：翻譯為其他語言

### 1. 複製

- 目標目錄：與原專案同層的 `<原目錄名>-<locale>/`，例如 `launch-video-en-US/`。已存在時詢問使用者，不覆蓋。
- 不複製：`output/`、`scenes/*/output/`、`scenes/*/assets/narration.*`、`scenes/*/assets/captions.json`、`node_modules/`、`.tmp/`。
- 在新目錄執行 `pnpm install`。

### 2. 更新專案身分

以下 JSON 修改都寫成 JSON Patch，用 `pnpm run state project --patch-file <檔案>` 套用（`script.md` 是純文字，可直接編輯）。

- `project.id`：新的 UUID v4
- `project.translatedFrom`：`{ "id": "<原專案 id>", "language": "<原語言>" }`
- `project.language`：目標 locale
- `project.name`：翻譯，或加上語言後綴
- `project.tts.voice`：依 [SKILL.md §4](SKILL.md) 選擇目標語言的聲音；連網 TTS 的同意需重新取得（服務相同也要，因為內容不同）
- `captions.style.fontFamily`：確認字型支援目標語言（如 Noto Sans TC → Noto Sans / Noto Sans JP）；內附字型只有 Noto Sans TC，其他語言的字型要放進 `src/fonts/`，否則會用系統字型，各平台結果不同

### 3. 翻譯內容

- `script.md`：**意譯而非直譯**，符合目標語言的口語習慣與 [script-guide.md](script-guide.md) 的語速規則。翻譯後長度變化超過 ±20% 時，改寫到接近原本的時長，讓畫面節奏大致不變。
- `scene.json` 的 `title`、`visual.description`、`visual.elements[].content`：翻譯。畫面文字要更短，因為不同語言的字寬不同。
- 產品名稱、功能名稱：沿用產品在該語言的官方用法；沒有官方翻譯時保留原文。
- `capture.url`：產品有該語言的頁面時（如 `/en/`），改為對應網址，並標記需要重新擷取。

### 4. 重設狀態

所有 scene 設為 `draft`、清除 `render` 與 `error`、`attempts` 歸零；`project.status` 設為 `script_generated`。在新專案執行 `pnpm run validate`。

### 5. Checkpoint

列出新專案路徑與翻譯後的分鏡表（格式同 [script-guide.md 的分鏡審閱](script-guide.md#review)），請使用者審閱。確認後，在新專案中從 `/video-scene all` 繼續。原專案完全不受影響。
