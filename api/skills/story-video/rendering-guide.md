# 渲染指引

用於 `/video-scene`：為單一 scene 產生旁白與素材，渲染成 `output/scene.mp4`。每個 scene 獨立處理，修改只重做受影響的 scene。

---

## <a id="flow"></a>1. 流程

```bash
pnpm run state project --status producing          # 專案仍是 script_generated 等狀態時
pnpm run tts scene-003                             # 旁白 → assets/narration.mp3、assets/captions.json
pnpm run capture scene-003                         # 只有 web-capture / screenshot 需要
pnpm run manim scene-003                           # 只有 manim 需要（在 tts 之後）
pnpm run state scene-003 --status assets_ready
pnpm run state scene-003 --status rendering
pnpm run render:scene scene-003                    # → output/scene.mp4
pnpm run state scene-003 --rendered                # 寫入 inputHash、實際秒數
pnpm run validate
```

完成後回報 `scenes/<dir>/output/scene.mp4` 的路徑與實際秒數（`render.actualDurationSec`），請使用者預覽。這是 checkpoint，必須等使用者確認。

- 旁白沒有改動、`assets/narration.mp3` 仍在時，可以跳過 `tts`。擷取素材也一樣。
- `render:scene` 只產生檔案，不改 JSON。狀態一律用 `pnpm run state` 寫回。

### 多個 scene 一起渲染

`/video-scene all` 或 `/video-sync` 有多個 scene 要渲染時，先對每個 scene 做完 `tts`、`capture`，狀態依序設為 `assets_ready`、`rendering`，再把它們一次交給 `render:scene`，會平行渲染（預設同時跑 CPU 核心數一半的 scene）：

```bash
pnpm run render:scene scene-001 scene-002 scene-003   # 可加 --jobs 2 限制同時數量
```

最後一行列出 `rendered:` 與 `failed:` 的 scene。成功的各自 `pnpm run state <id> --rendered`；失敗的依第 6 節以 `--failed render …` 記錄（錯誤訊息在該 scene id 開頭的輸出行）。電腦記憶體不足或很卡時，用 `--jobs 1 --pages 1`。

## <a id="duration"></a>2. 時長

| `durationSec` | 實際長度 |
|---|---|
| `null` | 旁白音長 + 0.5 秒。沒有旁白音檔時 `render:scene` 會失敗，要先執行 `tts` 或設定秒數 |
| 數值 | 固定秒數；旁白比它長時會被截掉，`render:scene` 會印出警告 |

幀數由秒數 × `format.fps` 推得，不儲存。

### <a id="pacing"></a>節奏太趕時

產生旁白或渲染後，出現以下任一情況就算太趕：

- `render:scene` 警告錄影比 scene 長（`the recording … is longer than the scene`）：操作還沒做完畫面就切走。
- 旁白一講完就換下一段，畫面上的操作、highlight 或疊加文字來不及看清楚（例如最後一個元素在結束前不到 1 秒才出現）。
- 實際總長超出目標長度 10% 以上。

依 `project.durationAdjust` 處理：

| 設定 | 可以自行做的 | 做完 |
|---|---|---|
| `auto` | 只改**長度**：把該 scene 的 `durationSec` 設為「旁白音長 + 0.5 秒 + 需要的緩衝」，每段最多多加 3 秒；或在 `script.md` 句子之間加 `<!-- pause -->`；或縮短 `capture.actions` 中的 `wait`。全片總長不超過目標長度的 +15% | 在該 scene 的預覽回報中說明調了什麼、為什麼（例如「第 4 段操作比旁白長，多留了 2 秒」） |
| `ask`（預設） | 不改，先停下 | 說明哪一段太趕、建議的調整與調整後的總長，等使用者選擇 |

不論哪種設定，以下都**必須先問使用者**：刪改旁白文字（使用者已確認過稿子）、增減 scene、超出上述限度、改目標長度。也不要靠加快語速解決（`narration.speed` 保持 1.0）。

改 `durationSec` 用 `pnpm run state <id> --patch-file`，再依第 1 節重做該 scene（旁白沒改時不必重做 `tts`）。

## <a id="visual-types"></a>3. 各 visual.type 的畫面

| `visual.type` | 背景 | 需要的素材 |
|---|---|---|
| `web-capture` | 網頁操作錄影，完整顯示在畫面內 | `assets/capture.mp4`（`pnpm run capture`） |
| `screenshot` | 截圖填滿畫面，整段緩慢放大 | `assets/capture.png`（`pnpm run capture`） |
| `motion-graphic` | 深色漸層背景，畫面由 `elements` 構成；有 `motion` 時改由動畫模組畫出（[#motion](#motion)） | 無；有 `motion` 時為 `motion.file` |
| `code` | 程式碼面板置中；`highlightLines` 以外的行會變淡 | `code.file` 或 `code.content` |
| `user-asset` | 使用者的圖片或影片，依 `fit`（`contain` / `cover`）縮放 | `asset.src` |
| `manim` | Manim 渲染出的動畫影片（[#manim](#manim)） | `manim.file`；`assets/manim.mp4`（`pnpm run manim`） |

影片素材（錄影、`user-asset` 影片、影片元素）比它應在畫面上的時間短時，停在最後一格；比較長時截掉。`trimStartSec` / `trimEndSec` 先裁切，再套用上述規則。影片素材的原聲不會使用，scene 的聲音只有旁白。

### <a id="recipes"></a>動畫範本 `src/recipes/`（先找這裡）

範本內附一組可直接用的動畫，`motion.js` 只要匯入一個範本、填好設定，通常不到 10 行。要做的畫面和下表相近時一律先用範本；只有範本做不到時才從零寫模組（[#motion](#motion)）。

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
- Manim 也有範本，見 [#manim](#manim)。

### <a id="motion"></a>自訂動畫模組 `visual.motion`

`motion-graphic` 可以用你寫的 JavaScript 模組畫整個背景，取代預設漸層；`elements` 仍疊在上面。先看[動畫範本](#recipes)有沒有合用的；從零寫算〔自訂動畫〕，依 `project.customMotion` 處理（[script-guide.md#custom-motion](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#custom-motion)）。

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

[Manim Community](https://www.manim.community/)（Python）擅長**數學與演算法的講解**：公式推導與變形（`MathTex` / `TransformMatchingTex`）、幾何證明、函數圖形、座標轉換、排序與圖論的逐步過程、矩陣運算。這類畫面用 Manim 比 SVG / GSAP 精準又省事；產品畫面、3D、品牌動態、粒子光影仍用 [`motion-graphic`](#motion)。用 Manim 範本算〔動畫〕，自己寫 `construct()` 算〔自訂動畫〕，依 `project.customMotion` 處理（[script-guide.md#custom-motion](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#custom-motion)）。

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

## <a id="render"></a>5. 渲染器

`pnpm run render:scene <id>` 用 Playwright 瀏覽器（與 capture 相同）逐幀截圖，再以 FFmpeg 編碼。單一 scene 也會開幾個瀏覽器分攤影格（`--pages N`，預設依 CPU 核心數，最多 4 個），1080p 約每秒 10–15 幀，長的 scene 要先告訴使用者需要等幾分鐘。

- 輸出一律是 H.264 + AAC 48 kHz 立體聲、BT.709。沒有旁白的 scene 也會有靜音音軌，合成時才能直接串接。
- 渲染失敗時，既有的 `output/scene.mp4` 不會被刪除或覆蓋。
- 轉場（`transitionIn`）、字幕與 BGM 不在這裡處理，而是在合成時處理。

## <a id="errors"></a>6. 失敗處理

| 訊息 | 原因 | 處理 | `--failed` 的 step |
|---|---|---|---|
| `durationSec is null and there is no narration audio` | 沒有旁白音檔 | 執行 `tts`，或設定 `durationSec` | `render` |
| `… (run pnpm run capture) not found` | 缺擷取素材 | 執行 `capture` | `capture` |
| `gate productLogin: …` | 產品要登入，還沒登入或登入已過期 | 依 [workflow.md#login](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#login) 請使用者登入後重新 capture；不算失敗，不記 `--failed` | — |
| `no usable browser` | 找不到瀏覽器 | 告知使用者執行 `pnpm exec playwright install chromium` 或安裝 Chrome / Edge | `render` |
| `player did not start: …`、`player error: …` | 動畫模組（`visual.motion`）載入或執行出錯，訊息為瀏覽器中的錯誤 | 修正模組後重新渲染；同一錯誤修不好時改用 `elements` 排版並告訴使用者 | `render` |
| `visual.motion.file not found` | 動畫模組檔不存在 | 寫好模組，或移除 `visual.motion` | `render` |
| `Manim is not installed` | 找不到 Manim | 依 gate `manimInstall` 取得同意後安裝（[#manim](#manim)）；不算失敗，不記 `--failed` | — |
| `manim exited with code …` | Python 程式出錯，錯誤在前面的輸出 | 修正 `scene.py` 後重跑 `manim`；同一錯誤修不好時改用 `motion-graphic` 並告訴使用者 | `manim` |
| `manim video … not found (run pnpm run manim)` | 還沒產生 Manim 影片 | 執行 `manim` | `manim` |
| `ffmpeg failed: …` | 素材格式無法讀取 | 檢查該素材能否播放；請使用者提供其他格式 | `render` |
| `… is not a readable video`（`state --rendered`） | 輸出檔損壞 | 重新渲染 | `render` |

記錄方式：`pnpm run state <id> --failed render "<訊息>" --hint "<給使用者的建議>"`。同一 scene 自動重試至多 2 次。

## <a id="customize"></a>7. 客製外觀

配色、字型、字級都在 `src/lib/motion.js` 的 `THEME` 與 `styles()`；版面在 `src/html/player.js`。

字型只用 `src/fonts/` 內附的檔案，不依賴使用者電腦上的字型，所以各平台畫面相同。要換字型時，把靜態字重的 OTF／TTF（不能是 woff2 或可變字型）放進 `src/fonts/`，在 `player.js` 的 `FONTS` 登記，再改 `THEME`；燒入字幕的 `captions.style.fontFamily` 也會先從 `src/fonts/` 找。

`src/` 不納入 `inputHash`，所以改了 `src/` 之後，已渲染的 scene 不會自動被標為過期。只有在使用者要求時才改 `src/`；改完後告訴使用者哪些 scene 需要重做，經同意後對這些 scene 執行 `pnpm run state <id> --status stale`，再依第 1 節重做。`approved` 或 `locked` 的 scene 必須由使用者明確指定才重做。

---

## <a id="assemble"></a>8. 合成最終影片

用於 `/video-assemble`。所有 scene 都必須是 `rendered` 或 `approved`，而且渲染後輸入沒有變動。

```bash
pnpm run status                                   # 確認沒有未完成或過期的 scene
pnpm run music                                    # 有 audio.music 時：依目前長度產生 assets/music.mp3
pnpm run assemble                                 # → output/final.mp4、output/final.srt
pnpm run state project --status completed
```

`assemble` 發現有 scene 未就緒時，會列出 scene id 與原因（狀態、缺輸出、輸入已變更）並停止，不產生任何檔案。把列出的 scene 依第 1 節重做，或執行 `/video-sync`。

### 合成內容

| 項目 | 來源 | 行為 |
|---|---|---|
| 順序 | `video.project.json` 的 `scenes` | 依陣列順序串接 |
| 轉場 | 各 scene 的 `visual.transitionIn` | `fade`、`slide-left`、`slide-right`、`wipe`、`zoom` 與前一個 scene 重疊 0.5 秒（scene 很短時縮短）；`none` 直接切換；第一個 scene 的轉場不使用。聲音在轉場期間交叉淡化 |
| 字幕 | 各 scene 的 `assets/captions.json` | 依 scene 在成片中的起點位移，寫成 `output/final.srt`；跨到下一個 scene 的字幕會被截斷 |
| 燒入字幕 | `captions.mode: burn` | 字幕在 `render:scene` 時就畫進各 scene，assemble 不再處理；`captions.style` 的 `fontSize` 以成片像素為單位，`position` 為 `bottom` / `middle` / `top` |
| BGM | `audio.bgm` | 循環播放到影片結束，音量 `bgmVolume`，頭尾各淡入淡出 1 秒；`ducking: true` 時旁白出現處自動壓低 |

- `captions.mode: none` 不產生 `final.srt`。
- `audio.bgm` 指定的檔案不存在時，略過 BGM 並警告，不算失敗。不要替使用者從網路下載音樂；使用者沒有自備音樂時，可以用下面的方式產生。

### <a id="music"></a>產生 BGM

`audio.music` 有設定時，assemble 前先執行 `pnpm run music`，依目前各 scene 長度產生 `assets/music.mp3`。怎麼和使用者決定配樂、怎麼逐段作曲，見 [music-guide.md](https://aofa.tigernaxo.com/api/skills/product-video/music-guide.md)；產生與重跑的時機見 [music-guide.md#generate](https://aofa.tigernaxo.com/api/skills/product-video/music-guide.md#generate)。

### 完成

回報 `output/final.mp4` 的路徑與總長度（`assemble` 最後一行會印出），以及有無字幕檔、BGM。`assemble` 印出的 `warning:`（例如缺少字幕、找不到 BGM）要一併告訴使用者。有保存登入資料（`sources.requiresLogin`）時，問使用者要不要清除（見 [workflow.md#login](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#login) 第 4 點）。
