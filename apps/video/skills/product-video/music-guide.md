# 配樂指引

用於 `/video-music`：引導使用者決定背景音樂，並依故事或產品內容逐段作曲。產品影片與故事影片都適用。

配樂由 `pnpm run music` 在本機產生，是純樂器、不連網，長度剛好等於成片。你負責音樂上的決策：每段的強度、調式、樂器、主題旋律、重擊與靜音。引擎負責讓和聲不衝突、對齊小節，再合成出聲音。

---

## 1. <a id="when"></a>什麼時候做

- **預設時機**：分鏡確認後（`/video-storyboard` 的 checkpoint 之後）、開始製作 scene 之前，`project.audio` 還沒有 `bgm` 也沒有 `music` 時。這時段落已經定了，可以逐段設計，又還沒開始等渲染。
- **使用者主動提起時**：隨時都可以做，例如「換個音樂」「不要音樂了」「結尾想要感人一點」。
- 正式的 `assets/music.mp3` 要等所有 scene 都有旁白音檔後才產生，在 assemble 之前做，見 [§5](#generate)。

## 2. <a id="ask"></a>引導使用者決定

一次只問一件事，每題都附上你的建議。用白話描述聲音給人的感覺，不要用 BPM、調式這類術語；要讓使用者決定時，給他試聽檔。每次停下來等使用者回答前，都要更新 `video.activity.json`（`waitingForUser: true`）。

### 2.1 要不要背景音樂

> 影片要不要加背景音樂？我建議**幫你配一段專屬的音樂**：會跟著每段內容變化，長度剛好，也不會有版權問題。另外兩個選擇是：用你自己的音樂檔，或是不加音樂。

| 使用者選擇 | 做法 |
|---|---|
| 自動配樂 | 繼續 §2.2 |
| 自己的音樂 | 請他把檔案放進專案的 `assets/` 資料夾（用「文件 > 專案 > assets」這類路徑說明），提醒要確認有使用授權。以 `pnpm run state` 設定 `/project/audio/bgm`，移除 `/project/audio/music`。不要替使用者從網路下載音樂 |
| 不要音樂 | 以 `pnpm run state` 把 `/project/audio/bgm` 設為 `null`、移除 `/project/audio/music`，之後不再主動詢問 |

### 2.2 選整體感覺

依 brief 提出 1–2 個風格，說明為什麼適合。每個風格用 2 個不同的 `seed` 各做一個試聽檔：寫入 `audio.music` 後執行 `pnpm run music --sample`，再把 `brief/music/sample.mp3` 改名為 `brief/music/<preset>-<seed>.mp3`。最後請使用者挑一首。

| preset | 白話描述 | 適合 | 預設樂器 |
|---|---|---|---|
| `corporate` | 明亮、有朝氣 | 科技產品、SaaS、教學 | piano、pad、pluck、bass、drums |
| `ambient` | 安靜、空靈、留白多 | 冥想、設計、高質感品牌、旁白很多的影片 | pad、bell、bass |
| `lofi` | 慵懶、溫暖、放鬆 | 生活風格、咖啡、讀書、日常故事 | piano、bass、drums（搖擺節奏） |
| `cinematic` | 壯闊、有故事感 | 品牌故事、願景、冒險故事；加上 `mode: "minor"` 會變成沉重、懸疑 | strings、piano、bass、drums |
| `playful` | 輕快、可愛、跳躍 | 兒童故事、遊戲、輕鬆的 App | marimba、pluck、bass、drums |

試聽檔是由弱到強各 8 秒，介紹時說「前面安靜、後面會越來越熱鬧」。使用者說「都不喜歡」時，問他哪裡不喜歡（太吵、太慢、太悲傷…），依 [§3.1](#mood) 調整後再做兩首。挑定之後，那首的 `preset` 與 `seed` 就固定下來。

### 2.3 逐段配樂計畫

讀 brief（故事專案另讀 `brief/story.md` 與 `project.cast`）和每段的 `script.md`，依 [§3](#compose) 寫出計畫，先用表格給使用者看：

| 段落 | 內容 | 音樂 | 為什麼 |
|---|---|---|---|
| 1 開場 | 咪咪望著天空 | 安靜、溫暖，鋼琴輕輕帶出咪咪的主題 | 先讓觀眾認識主角 |
| 3 衝突 | 暴風雨來了 | 轉成小調，只留弦樂和低音；結尾漸強，靜一拍後重擊 | 緊張感，接到高潮 |
| 5 結局 | 咪咪飛起來 | 回到大調，最熱鬧，主題完整出現 | 情緒的釋放 |

只寫有特色的段落；其他段落一句「其餘段落維持溫暖的中等強度」帶過即可。

### 2.4 試聽整首

以 `pnpm run state project --patch-file` 寫入 `/project/audio/music`，並把 `/project/audio/bgm` 設為 `assets/music.mp3`，接著執行 `pnpm run music --preview`。這會依 `script.md` 的字數估算長度（每秒約 4 字），產生 `brief/music/preview.mp3`；scene 已有旁白音檔時改用實際長度。指令輸出的每一行列出一段的起點與內容，可以拿來對照表格。請使用者聽完整首。

### 2.5 旋律與音量

- 旁白很密的段落，旋律可能讓人分心：先自己判斷，旁白幾乎不停的段落設 `energy: "low"` 或 `melody: false`。使用者覺得吵時，再問他要拿掉旋律還是降低音量。
- 音量預設 `bgmVolume: 0.25`，旁白出現時會自動壓低（`ducking`）。使用者說「音樂太大聲」時調到 0.15–0.2，「聽不太到」時調到 0.3–0.35。音量只影響合成，不必重做 scene。

### 2.6 修改

使用者用白話提出修改時，只改對應的部分，再跑一次 `--preview`：

| 使用者說 | 改什麼 |
|---|---|
| 「第三段再緊張一點」 | 該段 `mode: "minor"`、`energy` 提高一級，或在段尾加 `swell` |
| 「這段太吵」 | 該段 `energy` 降一級，或 `melody: false` |
| 「高潮不夠有力」 | 高潮開頭加 `dropout`（1 拍）＋ `hit`，`energy: "high"` |
| 「整首太快／太慢」 | `bpm` ±10–15 |
| 「旋律不好聽」 | 改寫主題（§3.3），或沒有主題時換 `seed`（這樣調性、和弦、節奏都會跟著換） |
| 「換一首」 | 換 `seed`，或回到 §2.2 |

## 3. <a id="compose"></a>作曲

`audio.music` 的完整格式見 `schemas/project.schema.json`。沒寫到的欄位都有預設值，所以只寫有意圖的部分。

### 3.1 <a id="mood"></a>情緒對應

| 想要的感覺 | 設定 |
|---|---|
| 明亮、希望、勝利 | `mode: "major"`，`energy: "high"` |
| 悲傷、孤單、懸疑 | `mode: "minor"`，`energy: "low"`，樂器少（`["strings", "bass"]` 或 `["pad", "bell"]`） |
| 緊張、危機 | `mode: "minor"`、`energy: "mid"`～`"high"`，段尾 `swell` |
| 溫暖、回憶 | `instruments: ["piano", "strings"]`，`energy: "low"`～`"mid"` |
| 夢幻、魔法 | 加 `bell`，`progression: ["I", "iii", "IV", "IV"]` |
| 驚喜、揭曉 | 揭曉那一刻 `dropout`（1–2 拍）＋ `hit` |

### 3.2 段落（`sections`）

`sections` 以 scene id 為 key，每段可以設定 `energy`、`mode`、`key`、`progression`、`instruments`、`theme`、`melody`。每段的音樂從離它起點最近的小節線開始，和弦進行從第一個和弦重新開始。

- **強度要有起伏**：不要每段都 `high`。常見的形狀是 低 → 中 → 高 → 低 → 高（結尾）。
- **產品影片**：hook `high`（或 `mid` 再接 `hit`）、problem `low`（可轉 `minor`）、solution 用 `mid` 回到大調（「問題解決了」的轉折）、feature `mid`、cta `high`。
- **故事影片（起承轉合）**：opening `low` 帶出主角主題、setup `mid`、conflict 轉 `minor` 並減少樂器、climax `high` 或先 `dropout` 再 `hit`、resolution 回到大調的 `mid`、ending `low`～`mid` 讓主題溫柔地再出現一次。
- **轉調**：換 `key` 會讓聽感明顯變化，整支影片最多用一次，例如結尾升高 2 個半音（C → D）帶出高潮。

### 3.3 主題旋律（`themes`）

主題是你寫的短旋律，最長 4 小節（16 拍）。綁定角色（`cast`）的主題，會在該角色說話（`script.md` 有【名字】行）的段落演奏，就像電影裡每個角色有自己的音樂；沒綁角色的主題是主旋律，用在其他段落。都沒有寫時，由 `seed` 產生旋律。

```json
"themes": [
  {
    "id": "mimi",
    "cast": "mimi",
    "instrument": "piano",
    "notes": [
      { "beat": 0, "beats": 1, "degree": 1 },
      { "beat": 1, "beats": 1, "degree": 3 },
      { "beat": 2, "beats": 1, "degree": 5 },
      { "beat": 3, "beats": 1, "degree": 6 },
      { "beat": 4, "beats": 3, "degree": 5 }
    ]
  }
]
```

- `degree` 是簡譜的數字：1 = do、3 = mi、5 = sol，8 = 高音 do，0 = 低音 si。用簡譜想旋律最直覺。
- 主題會依每段的調式演奏：在 `minor` 的段落，3 和 6 自動變成小調的音，同一個主題就成了悲傷版本。不需要另外寫小調版。
- 每小節第一拍的音如果不是和弦音，會移到最近的和弦音，所以不會和伴奏打架。小節中間的音照寫的演奏。
- **好記的寫法**：4–8 個音；以級進（相鄰的音）為主，偶爾跳一次（例如 1 → 5）；音域不超過 8 度；結尾停在 1、3 或 5 的長音上。節奏簡單一點，第一拍要有音。
- 主要角色最多 2–3 個主題，太多觀眾記不住。反派或危機可以用一個以 1、2、3 級進為主、音少而重複的短主題，放在 `minor` 的段落（3 會變成小三度，聽起來陰暗）。
- 主題預設由該段的主奏樂器演奏；用 `instrument` 指定（`piano`、`pluck`、`marimba`、`bell`、`strings`），該段要有那個樂器才會生效。
- 某段要指定別的主題時，用 `sections.<id>.theme`；該段不要旋律時用 `melody: false`。

### 3.4 事件（`cues`）

```json
"cues": [
  { "scene": "scene-004", "at": 0, "type": "swell", "beats": 4 },
  { "scene": "scene-004", "at": 0, "type": "dropout", "beats": 1 },
  { "scene": "scene-004", "at": 0, "type": "hit" }
]
```

- `at` 是從該 scene 開頭算起的秒數，會對齊到最近的拍點。可以對照 `assets/captions.json` 找到某句話出現的時間。
- `swell`：在該時間點之前漸強（預設 4 拍）。`dropout`：在該時間點之前全部靜音（預設 1 拍）。`hit`：在該時間點重擊。
- 三個一起用（漸強 → 靜一拍 → 重擊）最有戲劇性，適合高潮、揭曉、產品名稱出現。
- 整支影片 1–3 個就夠，太多會失去效果。

## 4. <a id="example"></a>完整範例

故事影片，主角咪咪，6 段起承轉合：

```json
"audio": {
  "bgm": "assets/music.mp3",
  "bgmVolume": 0.25,
  "music": {
    "preset": "cinematic",
    "seed": 3,
    "themes": [
      { "id": "mimi", "cast": "mimi", "notes": [
        { "beat": 0, "beats": 1, "degree": 1 }, { "beat": 1, "beats": 1, "degree": 3 },
        { "beat": 2, "beats": 1, "degree": 5 }, { "beat": 3, "beats": 1, "degree": 6 },
        { "beat": 4, "beats": 3, "degree": 5 }
      ] }
    ],
    "sections": {
      "scene-001": { "energy": "low", "instruments": ["piano", "strings"] },
      "scene-003": { "energy": "mid", "mode": "minor", "instruments": ["strings", "bass"] },
      "scene-004": { "energy": "high", "mode": "minor" },
      "scene-005": { "energy": "high" },
      "scene-006": { "energy": "low", "theme": "mimi" }
    },
    "cues": [
      { "scene": "scene-004", "type": "swell" },
      { "scene": "scene-005", "type": "dropout" },
      { "scene": "scene-005", "type": "hit" }
    ]
  }
}
```

## 5. <a id="generate"></a>產生正式配樂

所有 scene 都有旁白音檔（或 `durationSec`）之後，在 assemble 前執行：

```bash
pnpm run music        # → assets/music.mp3、assets/music.json
pnpm run assemble
```

- `audio.bgm` 要是 `assets/music.mp3`。指令最後印出 `next: set audio.bgm …` 時，表示還沒設定。
- scene 長度或順序改了，assemble 會警告 `assets/music.mp3 was made for …`，重跑 `pnpm run music` 再合成即可。只改 `audio` 也一樣：不必重做 scene。
- 同樣的設定與 `seed` 一定產生同樣的音樂，所以重跑只會調整長度與段落，使用者挑好的曲子不會變。
- 回報時告訴使用者有加配樂，並提醒他可以說「音樂太大聲」或「某段換個感覺」來調整。
