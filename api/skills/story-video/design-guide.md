# 美術、角色與動畫指引

用於 `/video-design`（定下畫風、畫角色與場景、挑聲音），以及 `/video-scene` 時為每一段寫動畫模組（[§6](#animate)）。

整部片的畫面都是你用 SVG 畫的。**角色只畫一次**：在這一步畫好可以動的角色檔，之後每一段都載入同一個檔案、只改姿勢和表情。這樣角色從頭到尾長得一樣，每段也不用重畫，省時間和用量。

---

## 1. <a id="style"></a>畫風設定 `brief/design.md`

依 `project.style` 與 `brief/story.md` 寫下整部片共用的規則，之後每段動畫都照它畫：

```markdown
# 美術設定：小狐狸找月亮

畫風：溫暖繪本風。圓潤、無尖角，色塊為主，線條只用在輪廓。
畫面：16:9，地平線在畫面高度 70% 處；角色站在地平線上。
配色：
- 夜空 #1e2a4a → #3b4a7a（由上往下漸層）、月光 #fde68a
- 草地 #3f6b4a、池水 #2c4f6e
- 小狐狸 #f97316 / #fdba74（肚子）、貓頭鷹 #8b5e3c / #e7d3b0
輪廓：#2b1d14、2.5px（以 1920 寬為準）、round linecap / linejoin
比例：小狐狸高 = 畫面高 35%；貓頭鷹高 = 畫面高 25%
光影：每個物件最多一層陰影色（同色相、暗 15%），不用漸層描邊、不用濾鏡
字：畫面上不畫字；標題用 scene 的 elements
```

- 色票控制在 10–14 個，寫出色碼。
- 「比例」與「地平線」是讓每段畫面接得起來的關鍵，一定要寫。

## 2. <a id="rig"></a>角色檔 `assets/cast/<id>/<id>.svg`

每個角色一個資料夾（`id` 用英文小寫，例如 `fox`），主檔是 `<id>.svg`：**一個 SVG 裡用 `<g id>` 分出可以動的部件**，動畫模組用範本的 `src/lib/rig.js` 載入後逐格擺姿勢。

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
  <g id="tail" data-pivot="120 470">…</g>
  <g id="leg-l" data-pivot="170 500">…</g>
  <g id="leg-r" data-pivot="230 500">…</g>
  <g id="body">…</g>
  <g id="arm-l" data-pivot="150 380">…</g>
  <g id="arm-r" data-pivot="250 380">…</g>
  <g id="head" data-pivot="200 300">
    <g id="ear-l" data-pivot="150 150">…</g>
    <g id="ear-r" data-pivot="250 150">…</g>
    <g id="face">…</g>
    <g id="eye-open">…</g>
    <g id="eye-closed">…</g>
    <g id="eye-happy">…</g>
    <g id="mouth-closed">…</g>
    <g id="mouth-open">…</g>
    <g id="mouth-smile">…</g>
  </g>
</svg>
```

規則：

- **畫布**：`viewBox` 讓角色站在畫布底部正中間（腳底在 `y` = 高度、`x` = 寬度一半），四周留 5% 空白。所有角色用同樣的慣例，動畫裡才好放到地平線上。
- **部件 id**：用上面的名稱（`head`、`body`、`arm-l`、`arm-r`、`leg-l`、`leg-r`、`tail`、`eye-*`、`mouth-*`）；角色特有的部件（`wing-l`、`hat`）用英文小寫加連字號。`-l` / `-r` 是**畫面上的**左右。
- **`data-pivot="x y"`**：部件旋轉、縮放的支點，用 viewBox 座標：手臂是肩膀、腿是髖、頭是脖子、尾巴是根部。沒寫時支點是 (0, 0)，轉起來會飛走。
- **疊放順序**：寫在後面的蓋在前面。手、腳和身體的接縫處要互相重疊一點，轉動時才不會露出縫。
- **表情是互斥的一組**：`eye-open` / `eye-closed` / `eye-happy`…、`mouth-closed` / `mouth-open` / `mouth-smile`…，同一組同一時間只顯示一個（`rig.only()`）。至少要有 `eye-open`、`eye-closed`、`mouth-closed`、`mouth-open`，說話和眨眼才做得出來。
- **側面角色**：大多數故事角色畫成四分之三側面朝右即可；要朝左時在動畫裡把整個角色水平翻轉（`scale(-1, 1)`），不要另畫一份。
- 和 [rendering-guide.md#svg](rendering-guide.md#svg) 相同：要有 `xmlns`、`viewBox`、`width`、`height`；不放 `<script>`、SMIL / CSS 動畫、外部連結與外部字型；不用文字。顏色只用 `brief/design.md` 的色票。
- 每個檔案保持在 30 KB 以內；路徑點數太多的形狀簡化掉，畫面看不出差別。

在專案的 `project.cast` 記下角色（`art` 指向資料夾）：

```json
{ "id": "fox", "name": "小狐狸", "description": "橘色、大尾巴、好奇又急性子", "voice": "zh-TW-HsiaoYuNeural", "art": "@/assets/cast/fox/" }
```

`name` 是 `script.md` 裡【】中的名字，要和故事裡的稱呼一致。

## 3. <a id="sets"></a>場景與道具 `assets/sets/`

- 每個地點一個背景檔（`forest-night.svg`、`pond.svg`），大小和影片畫面一樣（16:9 用 `viewBox="0 0 1920 1080"`）；地平線位置照 `brief/design.md`。
- 會動的東西（月亮、水波、螢火蟲、飄落的葉子）不要畫死在背景裡：分成獨立的 `<g id>`，或在動畫模組裡用程式畫。
- 道具（`basket.svg`、`lantern.svg`）和角色一樣畫成獨立檔，需要時加 `data-pivot`。
- 背景可以分前景、中景、遠景三個 `<g id="far">`、`<g id="mid">`、`<g id="near">`，鏡頭移動時讓它們以不同速度移動，畫面會有深度。

## 4. <a id="sheet"></a>設定稿與確認

畫完後寫一張 `brief/design-sheet.svg`（1920×1080）給使用者看：所有角色並排站在地平線上（顯示真實比例），每個角色旁邊列出表情（睜眼、閉眼、張嘴…），下方放每個場景的縮圖。用 `<use href>` 或直接嵌入部件都可以，這張圖只給人看，不會進影片。

告訴使用者「設定稿在『文件 > moon-fox-video > brief > design-sheet.svg』，用瀏覽器打開就能看」，請他逐個角色確認長相；要改的地方改好再給一次。

## 5. <a id="voices"></a>挑聲音與試聽

1. 依角色的年紀、個性，從 [SKILL.md §4](SKILL.md#voices) 挑聲音，寫進 `project.cast[].voice`。旁白的聲音和任何一個角色都要不同。
2. 產生試聽檔，每個角色一句符合他個性的台詞：

   ```bash
   pnpm run tts --sample narrator
   pnpm run tts --sample fox --text "哇！月亮掉進水裡了！"
   pnpm run tts --sample owl --text "孩子，抬頭看看。"
   ```

   檔案在 `brief/voices/<id>.mp3`。連網的聲音服務要先過 `onlineTtsConsent`（初始化時已問過）。
3. 告訴使用者試聽檔在哪裡，請他逐個確認；不喜歡的換一個再產生。

### checkpoint

角色長相與聲音**都**確認後，才 `pnpm run state project --status designed`，接著問使用者要不要開始寫分鏡。

## 6. <a id="animate"></a>寫每一段的動畫模組（`/video-scene`）

每段的 `assets/motion.js` 是一個動畫模組，基本規則（預設匯出 `setup(ctx)`、回傳 `seek(t)`、畫面只能由 `t` 決定、不用 `requestAnimationFrame` 與 CSS 動畫、亂數要固定種子）見 [rendering-guide.md#motion](rendering-guide.md#motion)。故事專案的 `ctx` 另外有：

| 欄位 | 內容 |
|---|---|
| `cues` | 這段的字幕時間軸 `[{ start, end, text, speaker? }]`；`speaker` 是說話的角色名，旁白沒有 |
| `cast` | `[{ id, name }]` |

先執行 `pnpm run tts <id>` 產生語音，`cues` 才有時間；動作要對著台詞的時間做。

### 範例

```js
import { blinking, loadSvg, mouthOpen, rig, speakerAt, tween, wave } from '../../../src/lib/rig.js'

const asset = (p) => new URL(`../../../assets/${p}`, import.meta.url)

export default async function setup({ root, width, height, cues }) {
  // 背景：場景 SVG 鋪滿畫面
  const set = await loadSvg(asset('sets/pond.svg'))
  Object.assign(set.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
  // 角色：高度照 brief/design.md 的比例，腳底放在地平線（畫面高 70%）
  const svg = await loadSvg(asset('cast/fox/fox.svg'))
  const h = height * 0.35
  Object.assign(svg.style, { position: 'absolute', height: `${h}px`, width: 'auto', top: `${height * 0.7 - h}px` })
  root.append(set, svg)
  const fox = rig(svg)
  const moon = set.querySelector('#moon-reflection')

  return (t) => {
    const talking = speakerAt(cues, t) === '小狐狸'
    // 0–1.5 秒從左邊跑進來，之後停在 30% 處
    const x = tween(t, 0, 1.5, -h, width * 0.3)
    const running = t < 1.5
    svg.style.left = `${x}px`
    svg.style.transform = `translateY(${running ? -Math.abs(wave(t, 12, 3)) : 0}px)`
    fox.pose('leg-l', { rotate: running ? wave(t, 25, 3) : 0 })
    fox.pose('leg-r', { rotate: running ? -wave(t, 25, 3) : 0 })
    fox.pose('tail', { rotate: wave(t, talking ? 15 : 6, talking ? 2 : 0.5) })
    fox.pose('head', { rotate: talking ? wave(t, 3, 1.5) : 0 })
    fox.only(['mouth-open', 'mouth-closed'], mouthOpen(t, talking) ? 'mouth-open' : 'mouth-closed')
    fox.only(['eye-open', 'eye-closed'], blinking(t, 1) ? 'eye-closed' : 'eye-open')
    // 4 秒起伸爪撈水，水中月亮跟著晃散
    fox.pose('arm-r', { rotate: tween(t, 4, 4.6, 0, 50) })
    moon.setAttribute('transform', `translate(0 ${wave(t, t > 4.6 ? 6 : 1, 1.2)})`)
    moon.style.opacity = String(tween(t, 4.6, 6, 1, 0.3))
  }
}
```

`src/lib/rig.js` 提供：

| 函式 | 用途 |
|---|---|
| `loadSvg(url)` | 載入 SVG 檔成可操作的 `<svg>` 元素 |
| `rig(svg)` | `pose(id, { x, y, rotate, scale })` 依支點擺姿勢、`only(ids, id)` 切換表情、`show(id, bool)`、`part(id)` |
| `speakerAt(cues, t)`、`cueAt(cues, t)` | 這個時間誰在說話、正在說哪句 |
| `mouthOpen(t, speaking)` | 說話時嘴巴開合 |
| `blinking(t, seed)` | 自然的眨眼；每個角色用不同 `seed` |
| `tween(t, t0, t1, a, b, ease)`、`ease` | 在 t0–t1 之間從 a 變到 b |
| `wave(t, amplitude, hz)` | 搖擺、呼吸、跑步的週期動作 |
| `mulberry32(seed)` | 固定種子的亂數 |

### 讓角色活起來

- **一直有一點動**：靜止的角色看起來像貼紙。站著時尾巴、耳朵慢慢晃（`wave` 0.3–0.6 Hz），身體有呼吸般的上下 1–2%。
- **說話的人要動**：說話時嘴巴開合、頭或手有小動作；**沒說話的人**偶爾眨眼、看向說話的人（頭轉向那邊）。
- **動作先預備再動**：跳之前先蹲一下、轉身前先停一下，動作結束時稍微過頭再回來（`ease.out` 之後補一點反向）。
- **配合台詞時間**：用 `cues` 的 `start` 安排動作，例如角色開口前 0.2 秒先轉頭；旁白說「水面碎成好多片」時正好讓水波散開。
- **鏡頭**：要推近或平移時，把整個場景放在一個容器裡，對容器做 `transform`（例如 2 秒內 `scale` 1 → 1.15），角色跟背景一起動。一段最多一個鏡頭動作。
- **控制份量**：一段只做 3–5 個重點動作；太多動作搶戲，也會拖慢渲染。

### 共用美術與 `motion.uses`

動畫模組讀進的每個共用檔都要列在 `scene.json` 的 `visual.motion.uses`（角色資料夾以 `/` 結尾），例如 `["@/assets/cast/fox/", "@/assets/sets/pond.svg"]`。列了，角色或場景改了這段就會自動標示需要重做；沒列的檔案改了，系統不知道。`src/lib/rig.js` 是範本的一部分，不用列。

### 渲染與預覽

依 [rendering-guide.md#flow](rendering-guide.md#flow)：`tts` → 寫 `assets/motion.js` → `render:scene` → `state --rendered`。故事專案沒有 `capture`。第一次寫某個角色的動畫時，先把這段 `durationSec` 設短（例如 3 秒）渲染一次確認角色擺得對，再改回 `null`。

渲染完請使用者預覽。使用者說「狐狸的手轉錯方向」這類意見時，多半是 `data-pivot` 或旋轉方向的問題，改角色檔會影響所有用到它的段落，改動畫模組只影響這一段，先判斷是哪一種再改。

## 7. <a id="changes"></a>之後要改角色

- **改長相**：改 `assets/cast/<id>/` 的檔案。所有在 `motion.uses` 列了這個資料夾的段落都會變成需要重做；先告訴使用者有幾段、大約多久，同意後再改，改完用 `/video-sync` 重做。
- **改聲音**：用 `pnpm run state project --patch-file` 改 `project.cast[].voice`。只有這個角色有說話的段落會變成需要重做（重新 `tts` 與渲染）；先告訴使用者是哪幾段。改旁白的聲音（`project.tts.voice`）不會自動標示，要自己把所有段落標為 `stale`。
- **改名字**：`project.cast[].name` 和每個 `script.md` 的【舊名】要一起改，否則 `pnpm run validate` 會報錯。
