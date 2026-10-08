# 視覺規則

> 由 Skill 文件產生，請勿直接修改。來源：https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#visual、https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#visual-types、https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#elements

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
- <a id="custom-motion"></a>**動畫**：`motion-graphic` 可以用動畫模組（`visual.motion`）畫出整個畫面，`elements` 疊在上面；講解公式、幾何、演算法步驟時改用 `visual.type: manim`。什麼時候用、用哪種見 [§1 選畫面的原則](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#choose-visual)，做法見 [rendering-guide.md#recipes](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#recipes)、[#motion](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#motion)、[#manim](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#manim) 與 [#svg](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#svg)。
  - **兩種動畫**：
    - **〔動畫〕**：使用 `src/recipes/` 的範本，或 Manim 的 `FormulaSteps` / `FunctionGraph` 範本，只填設定。
    - **〔自訂動畫〕**：從零寫模組、自己寫 Manim 的 `construct()`、畫新的 SVG 插圖，要花較多時間與 AI 用量。
  - 依 `project.customMotion`：

    | 設定 | 〔動畫〕（範本） | 〔自訂動畫〕 |
    |---|---|---|
    | `allow`（預設） | 依需要使用 | 依需要使用 |
    | `ask` | 依需要使用 | 分鏡審閱時逐段請使用者決定（見 [§5](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#review)）；沒同意的段落改用範本或 `elements` |
    | `deny` | 不使用 | 不使用；只用 `elements`、現有的圖檔與 logo |

  - 不算動畫、任何設定都可以用的：重複使用 `@/assets/svg/` 已存好的 SVG、複製產品原始碼裡現成的 svg/png、簡單的形狀或圖示（幾行 SVG，例如箭頭、勾勾、圓點）。
  - 製作途中（`/video-scene`、`/video-sync`）才想加分鏡沒列出的〔自訂動畫〕時，`ask` 先問、`deny` 不加。
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

## <a id="visual-types"></a>3. 各 visual.type 的畫面

| `visual.type` | 背景 | 需要的素材 |
|---|---|---|
| `web-capture` | 網頁操作錄影，完整顯示在畫面內 | `assets/capture.mp4`（`pnpm run capture`） |
| `screenshot` | 截圖填滿畫面，整段緩慢放大 | `assets/capture.png`（`pnpm run capture`） |
| `motion-graphic` | 深色漸層背景，畫面由 `elements` 構成；有 `motion` 時改由動畫模組畫出（[#motion](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#motion)） | 無；有 `motion` 時為 `motion.file` |
| `code` | 程式碼面板置中；`highlightLines` 以外的行會變淡 | `code.file` 或 `code.content` |
| `user-asset` | 使用者的圖片或影片，依 `fit`（`contain` / `cover`）縮放 | `asset.src` |
| `manim` | Manim 渲染出的動畫影片（[#manim](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#manim)） | `manim.file`；`assets/manim.mp4`（`pnpm run manim`） |

影片素材（錄影、`user-asset` 影片、影片元素）比它應在畫面上的時間短時，停在最後一格；比較長時截掉。`trimStartSec` / `trimEndSec` 先裁切，再套用上述規則。影片素材的原聲不會使用，scene 的聲音只有旁白。

### <a id="recipes"></a>動畫範本 `src/recipes/`（先找這裡）

範本內附一組可直接用的動畫，`motion.js` 只要匯入一個範本、填好設定，通常不到 10 行。要做的畫面和下表相近時一律先用範本；只有範本做不到時才從零寫模組（[#motion](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#motion)）。

| 範本 | 畫面 | 適合 | 主要設定 |
|---|---|---|---|
| `count-up.js` | 大數字從 0 跳到目標值，外圈進度環填滿 | benefit、social-proof（「快 10 倍」「98% 滿意」） | `to`、`prefix`、`suffix`、`decimals`、`label` |
| `bars.js` | 長條依序長高，數值跟著跳，可標亮一條 | problem / benefit 的前後對比、競品比較 | `bars: [{ label, value, highlight }]`、`unit` |
| `compare.js` | 左卡「以前」逐項打叉劃掉，右卡「現在」打勾滑入 | problem → solution | `before`、`after`（`{ title, items }`）、`afterAt` |
| `flow.js` | 方塊依序出現、連線自己畫出、光點沿線流動 | how-it-works、架構、資料流（2–5 步） | `nodes`（字串或 `{ label, highlight }`）、`step`、`times` |
| `particles.js` | 散落的粒子聚成一個詞；不給 `text` 時是緩慢漂動的光點背景 | hook、cta、品牌名稱 | `text`、`duration`、`count` |
| `shader.js` | GLSL 流動光帶背景（原生 WebGL，不需套件），上面疊 `elements` 文字 | hook、cta、段落開場 | `colors`、`speed`、`fragment`（自訂 shader） |
| `kinetic-text.js` | 一行行文字逐字彈入，可標亮關鍵詞（**需要 `gsap`**） | 文字本身就是畫面的 hook / benefit / cta | `lines`、`highlight`、`times` |
| `device-3d.js` | 產品截圖放進 3D 筆電或手機，緩緩轉向鏡頭（**需要 `three`**） | solution、feature（截圖太平淡時） | `image`、`kind: 'laptop' \| 'phone'` |

```js
// scenes/005-benefit/assets/motion.js
import countUp from '../../../src/recipes/count-up.js'
export default countUp({ to: 10, suffix: '×', label: '部署速度', at: { cue: 1 } })
```

- **時間對齊旁白**：各範本的時間設定（`at`、`times`、`afterAt`）可以填秒數，或 `{ cue: i, offset }` 表示「旁白第 i 句（從 0 起算）開始時」。先 `tts` 再寫 `motion.js`，畫面才會跟著聲音走。
- 每個範本檔開頭的註解列出全部設定。標題、說明文字仍用 `elements` 疊在上面。
- `kinetic-text.js`、`device-3d.js` 用到 GSAP / Three.js，第一次用時依下方說明安裝（`pnpm add gsap`、`pnpm add three`）。
- 範本不夠用時，把範本檔複製到該 scene 的 `assets/` 再修改（相對路徑改成 `../../../src/recipes/util.js`），不要改 `src/recipes/` 本身：`src/` 不納入 `inputHash`，改了已渲染的段落不會自動標示需要重做。`util.js` 有 `progress`、`ease`、`random`（固定種子）、`timeOf`、`svg` 等工具可直接用。
- Manim 也有範本，見 [#manim](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#manim)。

### <a id="motion"></a>自訂動畫模組 `visual.motion`

`motion-graphic` 可以用你寫的 JavaScript 模組畫整個背景，取代預設漸層；`elements` 仍疊在上面。先看[動畫範本](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#recipes)有沒有合用的；從零寫算〔自訂動畫〕，依 `project.customMotion` 處理（[script-guide.md#custom-motion](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#custom-motion)）。

```json
"visual": { "type": "motion-graphic", "description": "粒子沿連線流向雲端", "motion": { "file": "assets/motion.js" } }
```

模組放在該 scene 的 `assets/`（例如 `assets/motion.js`），預設匯出 `setup(ctx)`，回傳 `seek(t)`：

```js
export default async function setup({ root, width, height, fps, durationSec, theme }) {
  // root：鋪滿畫面的 <div>，把 <svg>、<canvas> 等放進去。theme：配色與字型（src/lib/motion.js 的 THEME）
  // 在這裡建立所有節點、載入所有圖片（await 完成），之後不再載入任何東西
  return (t) => {
    // t：scene 內秒數。依 t 畫出這一格；可以是 async
  }
}
```

渲染器對每一格呼叫 `seek(t)` 再截圖，所以**畫面只能由 `t` 決定**：

- 不用 `requestAnimationFrame`、`setTimeout`、`Date.now()`、`performance.now()`、CSS animation / transition（截圖時會被停用），也不讓函式庫自己跑時間。
- 隨機一律用固定種子的亂數（例如自寫 mulberry32），粒子位置用 `t` 直接算出來，不要逐格累加。
- 素材用相對於模組的網址載入：`new URL('./logo.png', import.meta.url)`、`new URL('../../../assets/svg/cloud.svg', import.meta.url)`。不從網路（CDN、外部圖片）載入任何東西。
- 文字用內附字型 `theme.fontFamily`、`theme.monoFamily`；畫面上的主要標題仍建議用 `elements` 的文字元素（會自動排版、縮放）。
- 沒有聲音：scene 的聲音只有旁白，不用 Web Audio，也不要做需要音效才成立的畫面。
- 單一畫面不要過重：渲染器逐格截圖，Three.js / shader 在沒有顯示卡的電腦上很慢；粒子數千顆以內，避免後製特效疊很多層。

可用的做法：

| 做法 | 適合 | 寫法重點 |
|---|---|---|
| SVG | 圖示、流程圖、線條描繪、圖表 | 在 `root` 建 `<svg>`；`seek` 依 `t` 設定屬性。線條描繪用 `stroke-dasharray` + `stroke-dashoffset` |
| Canvas 2D | 粒子、大量圖形、數字跳動 | `seek` 每次清空重畫整張 |
| GSAP | 多段編排的動畫（依序進場、彈性緩動） | `const tl = gsap.timeline({ paused: true })` 編排好，`seek` 裡 `tl.seek(t)` |
| Three.js | 3D 物件、產品展示、空間感 | `new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })`，`seek` 依 `t` 設定位置與相機後 `renderer.render(scene, camera)` |
| GLSL shader | 光線流動、漸層波紋、背景質感 | Three.js 的 `ShaderMaterial` 或原生 WebGL，把 `t` 傳進 uniform（例如 `uTime`） |

GSAP 與 Three.js 不在範本裡，要用時先在專案安裝（`pnpm add gsap`、`pnpm add three`，依硬性規則 11 先用白話取得同意），模組裡直接 `import { gsap } from 'gsap'`、`import * as THREE from 'three'`、`import { OrbitControls } from 'three/addons/controls/OrbitControls.js'`，渲染器會從專案的 `node_modules` 提供，不需要網路。其他函式庫不支援 bare import；需要時把單一 ES module 檔放在 `assets/` 以相對路徑匯入。

寫完先渲染這一段確認畫面（短的 scene 可以先把 `durationSec` 設短測試，確認後改回）。`motion.js` 與 scene `assets/` 內的檔案都納入 `inputHash`，修改後該 scene 會自動變成需要重做；模組匯入的共用檔案（`@/assets/` 下）不在內，改了要自己把用到它的 scene 標為 `stale`。

### <a id="manim"></a>Manim 動畫 `visual.type: manim`

[Manim Community](https://www.manim.community/)（Python）擅長**數學與演算法的講解**：公式推導與變形（`MathTex` / `TransformMatchingTex`）、幾何證明、函數圖形、座標轉換、排序與圖論的逐步過程、矩陣運算。這類畫面用 Manim 比 SVG / GSAP 精準又省事；產品畫面、3D、品牌動態、粒子光影仍用 [`motion-graphic`](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#motion)。用 Manim 範本算〔動畫〕，自己寫 `construct()` 算〔自訂動畫〕，依 `project.customMotion` 處理（[script-guide.md#custom-motion](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#custom-motion)）。

```json
"visual": {
  "type": "manim",
  "description": "從 a² + b² = c² 推導出斜邊長",
  "manim": { "file": "assets/scene.py", "class": "Main" }
}
```

`pnpm run manim <id>` 用專案的寬高與 fps 渲染出 `assets/manim.mp4`，`render:scene` 再把它當背景，`elements` 照常疊在上面。流程是 `tts` → 寫 `assets/scene.py` → `manim` → `render:scene`；必須先有旁白，程式才知道每句話的時間點。

```python
from manim import *
from manim_timing import FONTS, timing, wait_until, finish   # 範本的 src/lib/manim_timing.py

class Main(Scene):
    def construct(self):
        cues = timing()["cues"]          # 旁白每句的 {"start", "end", "text"}（秒）
        eq = MathTex("a^2", "+", "b^2", "=", "c^2").scale(1.6)
        self.play(Write(eq), run_time=1.5)
        wait_until(self, cues[1]["start"] if len(cues) > 1 else 3)   # 等旁白講到第二句
        self.play(eq.animate.set_color_by_tex("c^2", "#38bdf8"))
        finish(self)                     # 停在最後一格直到這段結束
```

- **先用範本**：`src/lib/manim_recipes.py` 有 `FormulaSteps`（公式逐步變形，每一步對齊一句旁白）與 `FunctionGraph`（畫座標軸與函數圖形、點沿曲線移動）。`assets/scene.py` 只要繼承並設定欄位：

  ```python
  from manim_recipes import FormulaSteps

  class Main(FormulaSteps):
      STEPS = [r"{{a^2}} + {{b^2}} = {{c^2}}", r"{{c}} = \sqrt{ {{a^2}} + {{b^2}} }"]
      CAPTION = "畢氏定理"
  ```

  公式中用 `{{ }}` 包住的部分會在步驟之間滑到新位置。做不到時才自己寫 `construct()`。
- **時間對齊旁白**：`timing()` 回傳 `durationSec`、`fps`、`width`、`height`、`cues`。用 `wait_until(self, 秒數)` 等到旁白講到某句再動作，最後一定呼叫 `finish(self)`，影片長度才會剛好等於這段的長度。動畫比這段短時停在最後一格，比較長時截掉，`manim` 與 `render:scene` 都會印出警告。
- **改了旁白就要重跑 `manim`**：時間點來自 `assets/captions.json`。`tts` 重做後依序執行 `manim`、`render:scene`。
- **配色與字型**：背景預設為深藍 `#0f172a`（與其他段落一致），主色白字、強調色 `#38bdf8`。中文用範本內附的字型：`with register_font(str(FONTS / "NotoSansTC-Bold.otf")):` 區塊裡建立 `Text("…", font="Noto Sans TC")`（`FONTS` 從 `manim_timing` 匯入）；較長的中文標題仍建議交給 `elements`。公式用 `MathTex`，需要 LaTeX；沒有 LaTeX 時改用 `Text` 或 `elements`。
- **不從網路載入任何東西**；隨機用固定種子（`random.seed(0)`）。共用的 Python 檔或圖片放在 `@/assets/manim/`，列在 `manim.uses`（資料夾以 `/` 結尾），改了才會自動標示需要重做。
- **不要做的**：不寫 `config.pixel_width` 等設定（解析度、fps 由 `manim` 指令決定）、不加聲音（`add_sound`）、不用 `ThreeDScene` 做大量 3D（很慢，3D 改用 Three.js）。
- **安裝**：第一次執行若輸出 `Manim is not installed`，依 gate `manimInstall` 用白話取得同意後在專案安裝：`uv venv .venv --python 3.12`，接著 `uv pip install --python .venv manim`（`manim` 會自動使用專案的 `.venv`）。Linux 還需要系統套件 `libcairo2-dev libpango1.0-dev pkg-config`，要用 sudo，請使用者自己執行；macOS 用 `brew install cairo pango pkg-config`。使用者不想安裝時，改用 `motion-graphic`。
- 先單獨試畫面：`durationSec` 暫設短一點跑 `manim`，看 `assets/manim.mp4`；也可以在專案根目錄手動執行 `PYTHONPATH=src/lib .venv/bin/manim render -ql scenes/<dir>/assets/scene.py Main`（此時 `timing()` 沒有旁白資料，`cues` 是空陣列，程式要能照常跑完）。

### <a id="svg"></a>SVG 插圖（可存檔重複使用）

需要圖示、示意圖、插圖而產品裡沒有現成圖檔時，可以自己寫 SVG：

- 存成檔案再引用，不要每段重畫。只用在一段的放在該 scene 的 `assets/`；會重複使用的（品牌風格的圖示、背景圖形）放在專案 `assets/svg/`，檔名用說明用途的英文（`cloud-sync.svg`、`check-circle.svg`），以 `@/assets/svg/<檔名>` 引用。畫新的之前先看 `assets/svg/` 有沒有能直接用的。
- 用法：`elements` 的 `image`（`"src": "@/assets/svg/cloud-sync.svg"`），或 `user-asset` 的 `image` 背景，或在動畫模組中載入、內嵌後逐格控制。
- 檔案本身要能單獨顯示：寫 `xmlns="http://www.w3.org/2000/svg"`、`viewBox`，以及 `width`、`height`（決定元素顯示大小）。
- 檔案內不放 `<script>`、SMIL / CSS 動畫、外部連結與外部字型；要動就用元素的 `animation`，或在動畫模組中依 `t` 控制。文字盡量轉成路徑或交給 `elements`，避免字型不同。
- 配色沿用 `THEME`（深色背景、白字、強調色 `#38bdf8`），同一部影片的圖示線條粗細、圓角一致。
- 繪製新的插圖算[自訂動畫](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#custom-motion)，受 `project.customMotion` 限制；重複使用已存的 SVG 與簡單圖形不受限。

---

## <a id="elements"></a>4. 疊加元素 `visual.elements`

| 欄位 | 說明 |
|---|---|
| `at` | 出現時間（scene 內秒數）。超過 scene 長度的元素會被略過並警告 |
| `duration` | 顯示秒數，結束前 0.3 秒淡出；省略則留到 scene 結束 |
| `animation` | 進場 0.5 秒：`fadeIn`（預設）· `slideInLeft/Right/Up/Down` · `zoomIn` · `typewriter`（只用於文字，逐字出現）· `none` |
| `size` | 文字字級：`normal`（預設，畫面短邊 6.2%）、`large`（×1.35）、`xl`（×1.7）。放大的字若超過兩行或超出畫面，會逐步縮小，最小回到 `normal` |
| `position` | `center`（預設）、`top`、`bottom`、`left`、`right`、四個角落，或 `{ "x": 30, "y": 70 }`（元素中心點，畫面百分比）。預設位置保留 8% 安全邊距 |

寫法建議：

- 文字元素是畫面上的標題，不是字幕：一則 12 字以內，同一時間最多兩則。字幕由 assemble 從旁白產生。
- 文字的出現時間對齊旁白中對應的詞；可以參考 `assets/captions.json` 的時間。
- 圖片元素最大約畫面的 42%，影片元素約 50%；需要更大的畫面時改用 `user-asset` 當背景。
- 和背景錄影重疊時，把文字放在 `top` 或 `bottom`，避免蓋住操作重點。
