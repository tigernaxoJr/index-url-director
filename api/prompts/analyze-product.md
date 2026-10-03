# 分析產品

> 由 Skill 文件產生，請勿直接修改。來源：https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#analyze

## <a id="analyze"></a>analyze：分析產品

目標：產出一份足以寫出分鏡的 `brief/product-brief.md`。寧可短而準確，不要長而臆測。

### 讀取來源

**產品網址**（`sources.productUrl`）

1. 讀取頁面文字：首頁、功能頁、定價頁、關於頁（若有連結）。只讀使用者給的網域，不追到第三方網站。
2. 擷取截圖作為分析與後續素材：
   ```bash
   pnpm run capture --url <網址> --out brief/screens/
   ```
   會輸出整頁截圖、首屏截圖、頁面文字，以及 `<slug>.elements.txt`：頁面上可見的標題、按鈕、連結、輸入框與它們的 selector，寫分鏡時用來挑選要 highlight 的元素（見 [script-guide.md#highlight](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#highlight)）。`sources.requiresLogin` 為 true 時，擷取前先依 [login](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#login) 請使用者自己登入；擷取時出現 `gate productLogin`（被導到登入頁）也一樣。

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

   估算方式：每個要講的重點約 6–10 秒，hook 與 CTA 各約 4 秒；以 [script-guide.md](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#structure) 的 scene 數對照表為準。對象越不懂技術、風格越活潑，越偏向短版。
4. **太趕時怎麼處理**：「製作時如果某一段太趕（例如操作還沒做完就換下一段），要讓我自己把那段稍微拉長、事後告訴你，還是每次先問你？」寫入 `project.durationAdjust`（`auto` / `ask`；沒回答就是 `ask`）。規則見 [rendering-guide.md#pacing](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#pacing)。
5. **自訂動畫**：「有些段落我可以自己寫程式畫動畫（例如資料流動、3D 產品展示、粒子特效），比單純的文字和圖片生動，但每段要花比較多的 AI 用量，也比較慢。要全部放行、都不要，還是規劃分鏡時一段一段問你？」寫入 `project.customMotion`（`allow` / `deny` / `ask`；沒回答就是 `ask`）。規則見 [script-guide.md#custom-motion](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#custom-motion)。

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
