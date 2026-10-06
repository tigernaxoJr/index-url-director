# Video Project — Agent 規則

本目錄是一個影片專案，遵循 Agent Video Producer 協議（specVersion 1.0）。`video.project.json` 的 `project.kind` 決定類型：

- `product`（預設）：產品介紹影片，詳細做法在 Skill `product-video`。
- `story`：把使用者的故事做成 SVG 動畫影片，旁白與角色各自配音，詳細做法在 Skill `story-video`。

你的任務是依工作流程，在本機一步步產生影片。所有運算與檔案都留在本機。

---

## 1. 先讀這些

| 檔案 | 用途 |
|---|---|
| `schemas/workflow.json` | 工作流程：步驟、前置條件、狀態轉換、checkpoint、gates |
| `schemas/project.schema.json` | `video.project.json` 的格式 |
| `schemas/scene.schema.json` | `scenes/*/scene.json` 的格式 |
| `video.project.json` | 專案設定與 scene 播放順序 |
| `brief/product-brief.md` | 產品分析結果（product，analyze 之後才存在） |
| `brief/story.md`、`brief/design.md` | 故事定稿、美術設定（story） |

詳細做法（文案寫法、渲染實作）在上述 Skill 中；`workflow.json` 每個步驟的 `guide` 欄位指出對應章節。步驟有 `kinds` 時只適用於那些 `project.kind`。

## 2. 工作流程

產品介紹（`product`）：

| 步驟 | 指令 | 完成後 project.status | 需停下確認 |
|---|---|---|---|
| 1 初始化 | 由 Skill 或網站 `agent-guide.md` 執行（專案建立前沒有專案指令） | `initialized` | — |
| 2 分析產品 | `/video-analyze` | `analyzed` | **是**：確認對象、風格與影片長度 |
| 3 分鏡與旁白 | `/video-storyboard` | `script_generated` | **是**：分鏡與完整旁白稿審閱 |
| 4 產生 scene | `/video-scene <id\|all>` | `producing` → `ready_to_assemble` | **是**：每個 scene 預覽 |
| 5 合成 | `/video-assemble` | `completed` | 回報結果 |

故事（`story`）：

| 步驟 | 指令 | 完成後 project.status | 需停下確認 |
|---|---|---|---|
| 1 初始化 | 由 Skill 或網站 `story-guide.md` 執行 | `initialized` | — |
| 2 整理故事 | `/video-story` | `analyzed` | **是**：故事定稿、對象、風格與長度 |
| 3 美術與角色 | `/video-design` | `designed` | **是**：角色設定稿與每個角色的聲音 |
| 4 分鏡、旁白與對白 | `/video-storyboard` | `script_generated` | **是**：分鏡與完整稿審閱 |
| 5 產生 scene | `/video-scene <id\|all>` | `producing` → `ready_to_assemble` | **是**：每個 scene 預覽 |
| 6 合成 | `/video-assemble` | `completed` | 回報結果 |

故事專案的 `script.md` 中，以 `【角色名】` 開頭的行由 `project.cast` 裡同名的角色、用他的聲音說；其餘是旁白。動畫模組匯入的共用美術（`@/assets/cast/…`、`@/assets/sets/…`）要列在 `visual.motion.uses`，改了美術才會自動標示需要重做。

影片做到一半或已合成後，仍可再執行 `/video-storyboard` 重新規劃分鏡：只修改被點名的段落，保留的段落沿用現有影片，確認後以 `/video-sync` 只重做有變更的段落並重新合成。

隨時可用：`/video-status`（狀態摘要）、`/video-sync`（只重做有變更的 scene 並重新合成）、`/video-approve <id>`（核准）、`/video-translate <locale>`（複製專案並翻譯）。

不確定下一步時，執行 `pnpm run status`，它會列出每個 scene 的狀態、是否過期，以及建議的下一個指令。

## 3. 硬性規則

1. **依步驟執行，不跳步。** 遇到 checkpoint 必須停下，等使用者明確確認後才繼續。
2. **修改既有 JSON 一律透過 `pnpm run state`**（見 §4），不得直接編輯 `video.project.json` 或既有的 `scene.json`。只有新建 `scene.json` 時可直接寫入檔案，寫完立即執行 `pnpm run validate`。
3. **只重做受影響的 scene。** 修改只重做受影響的 scene，不重新產生整部影片。多個 scene 都要渲染時，可一次交給 `render:scene` 平行處理。
4. **不動鎖定或已核准的 scene。** `locked: true` 或 `status: approved` 的 scene，除非使用者明確要求，否則不修改、不重做。
5. **尊重使用者的修改。** 編輯任何檔案前先重新讀取（Web UI 或使用者可能剛改過）。不覆蓋使用者寫的內容；原樣保留所有 `x-` 開頭的欄位。
6. **路徑規則。**
   - 一律使用正斜線的相對路徑；不得使用絕對路徑或 `..`。
   - `scene.json` 內的路徑相對於該 scene 目錄；引用專案共用素材用 `@/` 開頭（如 `@/assets/logo.png`）。
   - 產生的素材只能放在 `assets/` 或 `scenes/*/assets/`；渲染結果只能放在 `output/` 或 `scenes/*/output/`。
7. **不儲存幀數。** 時長一律以秒記錄（`durationSec`），`null` 表示由旁白音長決定。
8. **資料不離開本機。** 不上傳使用者的原始碼、素材或影片到任何遠端服務。使用連網 TTS 前必須通過 `onlineTtsConsent` gate（§5）。
9. **不處理機密。** 不讀取 `.env` 與 `.auth/`（保存的登入資料），不把 API key、密碼、token 寫進任何 JSON 或旁白稿。不向使用者索取帳號密碼，`capture` 的 `type` 動作也不輸入密碼。需要登入的產品頁面，以 `pnpm run login` 打開視窗，由使用者自己登入（gate `productLogin`，§5）。
10. **失敗時保留現場。** 不刪除既有檔案；以 `pnpm run state <id> --failed …` 記錄錯誤。同一 scene 自動重試至多 2 次（看 `attempts`），之後停下並告訴使用者原因與重試方式。
11. **未經同意不安裝工具。** 缺少 Node.js、Playwright 瀏覽器或 TTS 工具時，用白話說明用途並取得同意；同意後可代為執行一般安裝，不使用系統管理員權限、不改系統設定。需要使用者點擊確認時，給逐步說明。
12. **太趕時依 `project.durationAdjust` 處理。** `auto` 時可自行在限度內拉長 scene 並事後回報，`ask` 時先問；刪改已確認的旁白、增減 scene 一律先問。做法見 Skill `rendering-guide.md#pacing`。
13. **錄不到的內容用動畫呈現，依 `project.customMotion` 處理。** 數字、流程、前後對比、抽象概念、公式，預設用動畫而不是只放文字卡片；先用 `src/recipes/` 的動畫範本（〔動畫〕，只填設定），範本做不到才從零寫模組、Manim 程式或 SVG 插圖（〔自訂動畫〕）。`allow`（預設）依需要使用；`ask` 範本照用，〔自訂動畫〕在分鏡審閱時逐段請使用者決定；`deny` 不使用動畫。`story` 專案每段都是自訂動畫，設為 `allow`。重複使用 `assets/svg/` 已存的 SVG 不受限。做法見 Skill `script-guide.md#choose-visual`、`rendering-guide.md#recipes`、`#motion`、`#manim`。
14. **假設使用者不懂電腦操作。** 所有指令由你執行，不要求使用者開終端機或打指令；使用者用白話下指示（「繼續」「第三段改成…」），由你對應到工作流程步驟。說明避免術語，回報檔案位置用「文件 > 專案 > output > final.mp4」這類資料夾順序，並可建議用網頁工作台預覽。
15. **隨時更新 `video.activity.json`。** 網頁工作台用它顯示你正在做什麼、是否在等使用者。每開始一個步驟或 scene、每次停下來等使用者回覆（checkpoint、gate、提問）之前，直接覆寫整個檔案（格式見 `schemas/activity.schema.json`）：`message` 是一句白話，等使用者時 `waitingForUser: true` 並說明要他回答什麼，`step` 為 `workflow.json` 的步驟 id，`scene` 為正在處理的 scene id（沒有時為 `null`），`updatedAt` 為現在時間。它不經過 `pnpm run state`、不需要鎖、不納入版本控制。

## 4. 寫入狀態：`pnpm run state`

`state` 會取得鎖檔、重新讀取目標檔、套用修改、原子寫入、執行驗證，並自動更新 `updatedAt` 與 `updatedBy: "agent"`。寫入 scene 後，或以 patch 修改 `video.project.json` 的 `scenes`（新增、移除、調整順序）時，會依 `workflow.json` 的 `derivedProjectStatus` 重算 `project.status`；scene 清單變了就不會是 `completed`，需要重新合成。

```bash
# 改狀態
pnpm run state project --status analyzed
pnpm run state scene-003 --status assets_ready

# 渲染成功：計算 inputHash、寫入 render、狀態設為 rendered、attempts 歸零
pnpm run state scene-003 --rendered

# 失敗：狀態設為 failed、寫入 error、attempts + 1
pnpm run state scene-003 --failed tts "edge-tts timeout" --hint "稍後重試或改用 manual"

# 其他修改：JSON Patch（RFC 6902），寫成檔案再套用，避免 shell 引號問題
pnpm run state scene-003 --patch-file .tmp/patch.json
```

`--patch-file` 範例（`.tmp/` 不納入版本控制，用完可刪）：

```json
[
  { "op": "replace", "path": "/title", "value": "三步完成部署" },
  { "op": "replace", "path": "/durationSec", "value": null }
]
```

`state` 失敗（驗證不過、鎖定逾時）時不會寫入任何東西；讀錯誤訊息、修正後重試。

## 5. Gates：執行前必須取得使用者確認

| Gate | 何時需要 | 未通過時不得執行 |
|---|---|---|
| `onlineTtsConsent` | TTS provider 為 `edge-tts`、`azure`、`openai`、`elevenlabs` | `tts` |
| `productLogin` | `sources.requiresLogin` 為 true，或 `capture` 輸出 `gate productLogin`（被導到登入頁、登入過期） | `capture`；以 `pnpm run login` 讓使用者自己登入，不寫入 JSON |
| `domEditConsent` | scene 的 `capture.actions` 有 `script`（錄製時改寫頁面，例如報表資料太少時填入示意資料） | 該 scene 的 `capture` |
| `manimInstall` | 有 scene 的 `visual.type` 為 `manim`，而 `pnpm run manim` 輸出 `Manim is not installed` | `manim`；安裝 Python 套件前先取得同意，需要 sudo 的系統套件請使用者自己裝，不寫入 JSON |

要向使用者說明的內容、使用者拒絕時的處理方式，見 `schemas/workflow.json` 的 `gates`。確認結果以 `pnpm run state` 寫入 `project.tts.consent` 或該 scene 的 `visual.capture.domEditConsent`。

## 6. Scene 狀態

```text
draft → assets_ready → rendering → rendered → approved
                                        ↘          ↘
                              內容被修改 → stale（需重做）
任一步驟失敗 → failed（修正後可重試）
```

- `render.inputHash` 與目前內容不符時，scene 視為過期，即使 `status` 仍是 `rendered`。`pnpm run status` 會標示出來。
- BGM 只在合成時使用，改它不需要重做 scene，只要重新合成。字幕樣式也是，除非 `captions.mode` 是 `burn`（字幕畫在每個 scene 裡，改了要重新渲染所有 scene）。

## 7. 常用指令

| 指令 | 作用 |
|---|---|
| `pnpm run status` | 各 scene 狀態、是否過期、下一步建議 |
| `pnpm run validate` | 驗證所有 JSON 與路徑；非 0 代表有錯 |
| `pnpm run tts <id>` | 產生旁白音檔與字幕時間軸（【角色】的行用角色的聲音） |
| `pnpm run tts --sample <角色id\|narrator>` | 產生試聽檔 `brief/voices/<id>.mp3`；`--text "…"` 指定句子 |
| `pnpm run capture <id>` | 擷取網頁畫面 |
| `pnpm run manim <id>` | `visual.type` 為 `manim` 的 scene：以 Manim 渲染 `assets/manim.mp4`（先 `tts`，動畫才能對齊旁白） |
| `pnpm run login` | 打開瀏覽器視窗讓使用者自己登入產品；`--clear` 清除保存的登入 |
| `pnpm run render:scene <id>…` | 渲染 scene；多個 id 時平行渲染（`--jobs N`）；單一 scene 也以多個瀏覽器分攤影格（`--pages N`） |
| `pnpm run assemble` | 依順序合成 `output/final.mp4` |
| `pnpm run companion` | 啟動本機助手（讓網頁工作台直接重做 scene、合成）；會一直執行，要在背景啟動。只在使用者同意後執行，見 Skill `SKILL.md` §6 |
