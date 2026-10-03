---
name: story-video
description: 在使用者本機把故事做成 SVG 動畫影片：引導使用者把點子或大綱補成完整故事、設計角色與場景、為旁白與每個角色配上不同聲音、逐段畫出動畫並渲染，最後用 FFmpeg 合成。當使用者要把故事、童話、繪本、寓言、劇本或點子做成動畫影片，或目錄中的 video.project.json 的 project.kind 是 story 並要求繼續、修改、重做某段、合成時使用。
---

# Story Video

以 Agent Video Producer 協議（specVersion 1.0）在本機把使用者的故事做成動畫影片。整部片由你用 SVG 畫出來：先和使用者把故事整理好，再定下角色長相與聲音，然後逐段（scene）畫動畫、配旁白與對白。每段可單獨修改與重做；所有檔案與運算都留在使用者電腦上。

這和產品介紹影片（Skill `product-video`）共用同一套專案範本與工具，只有流程不同：**沒有產品要分析，故事與角色才是素材**。

**先假設使用者不懂電腦操作**：他只會開 Agent 和網頁，不會開終端機、打指令或看懂路徑。所有指令由你執行；需要使用者動手時，給點擊式的逐步說明。

## 1. 判斷目前在哪裡

和產品影片相同，依 [product-video SKILL.md §1](https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md) 的順序找專案資料夾（`video.start.json` 的識別碼、拖進對話框的資料夾等），只是：

- **已有 `video.project.json`**：先依 [同步範本](https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md#sync-template) 把專案工具更新到網站上的版本，再讀專案根目錄的 `AGENTS.md`，**之後一律以它的規則為準**。`project.kind` 是 `story` 就照本 Skill 繼續；是 `product`（或沒有 `kind`）就是產品影片，改照 product-video Skill。執行 `pnpm run status` 取得建議的下一步。
- **新專案**：執行 §2。

## 2. <a id="init"></a>初始化新專案（init）

1. **確認位置**：有 `video.start.json` 時專案就建在目前目錄。否則在目前的工作資料夾裡建立 `<故事名英文小寫>-video`（例如 `moon-fox-video`），用白話確認：「我會在『文件』資料夾裡建立 moon-fox-video 來放這部影片，可以嗎？」不要要求使用者提供路徑。
2. **取得範本**：和產品影片用同一份範本，做法見 [product-video SKILL.md §2 第 2 點](https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md#init)（下載 `product-video.zip`、以 manifest 的 SHA-256 驗證、解壓、刪除 zip）。
3. **收集故事**：有 `video.start.json` 時先讀它（`kind` 為 `story`；`story` 是使用者在網頁填的故事或點子，`audience` 是觀看對象，可能是 `null`），已填的不要再問。沒有時問一句：「想做成影片的故事是什麼？可以貼整篇故事，也可以只說一個點子，例如『一隻怕黑的小貓學會看星星』。」
   - 故事不論長短，原文寫入 `sources.story`；這一步**不改寫**，整理是下一步的事。
   - 使用者給的是檔案（Word、PDF、文字檔）時，讀出文字放進 `sources.story`，告訴他「我讀到了，共約 N 字」。
4. **確認對象、畫風與格式**：一次問一件事並附建議：
   - **觀看對象**（`video.start.json` 有 `audience` 時只要確認一句）：例如「學齡前小朋友」「國小學生」「大人（社群短片）」「家人朋友（紀念用）」。對象決定用詞、長度與節奏。
   - **畫風**：給 2–3 個選項並標出建議，例如「溫暖繪本風（柔和色塊、圓潤線條）」「扁平可愛風（高彩度、粗外框）」「剪紙風（紙張質感、分層）」「簡筆線條風（黑白線條加一個重點色）」。寫入 `project.style`，細節在美術步驟再定。
   - 語言、畫面比例：沒有偏好時用 zh-TW、16:9（1920×1080、30fps）；要放上短影音平台時建議 9:16。
   - **字幕**：故事影片常給小朋友看，建議「印在畫面上」（`project.captions.mode: burn`）；不要的話用預設 `srt`。
   - **目標長度先不定案**：先填 60 秒，整理完故事再依故事長度建議。
5. **填寫專案檔**：範本的 `video.project.json` 是佔位內容，必須替換：
   - `project.id`：新的 UUID v4；`project.kind`：`"story"`；`project.name`：故事名
   - `project.sources`：`{ "story": "<原文>" }`（不需要 `productUrl` 等產品欄位）
   - `project.customMotion`：`"allow"`（故事的每一段都是你畫的動畫，不逐段詢問）
   - `project.language`、`project.targetAudience`、`project.style`、`project.format`、`project.captions`
   - `project.tts`：旁白的聲音（§4）；角色的聲音在美術步驟才決定，寫在 `project.cast`
   - `updatedAt`：目前時間
   新專案沒有其他寫入者，這一次可以直接編輯 `video.project.json`；之後一律依 `AGENTS.md` 透過 `pnpm run state` 修改。
6. **安裝與檢查**：照 [product-video SKILL.md §2 第 6 點](https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md#init)（Node.js、pnpm、`pnpm install`、瀏覽器）。故事影片不錄網頁，但渲染動畫仍需要瀏覽器。
7. **Gate `onlineTtsConsent`**：例如「旁白和角色的聲音會用微軟的線上語音服務產生，故事文字會傳給微軟。可以嗎？不行的話可以改用電腦內建的語音或自己錄音。」以 `pnpm run state` 寫入結果。故事影片沒有 `productLogin`、`domEditConsent`。
8. **驗證**：`pnpm run validate`，通過後告訴使用者專案建好了、資料夾在哪裡，並直接問他要不要開始整理故事。

## 3. 各步驟的做法

工作流程的權威定義是專案內的 `schemas/workflow.json`；有 `kinds` 的步驟只適用於該類型（故事專案跳過 `analyze`）。

| 步驟 / 操作 | 完成後狀態 | 參考 |
|---|---|---|
| `/video-story` 整理故事 | `analyzed` | [story-guide.md#develop](story-guide.md#develop) |
| `/video-design` 美術與角色 | `designed` | [design-guide.md](design-guide.md) |
| `/video-storyboard` 分鏡、旁白與對白 | `script_generated` | [story-guide.md#storyboard](story-guide.md#storyboard)；已有 scene 時見 [story-guide.md#revise](story-guide.md#revise) |
| `/video-scene` 產生 scene | `producing` → `ready_to_assemble` | [design-guide.md#animate](design-guide.md#animate)，渲染流程見 [rendering-guide.md](rendering-guide.md) |
| `/video-assemble` 合成 | `completed` | [rendering-guide.md#assemble](rendering-guide.md#assemble) |
| `/video-sync` 同步變更 | — | [workflow.md#sync](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#sync) |
| `/video-translate` 翻譯 | — | [workflow.md#translate](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#translate)；`project.cast` 的 `name` 要一起翻譯，`script.md` 的【角色名】也要跟著改 |

只在執行到該步驟時才讀取對應檔案。

## 4. <a id="voices"></a>聲音

旁白用 `project.tts`，每個角色在 `project.cast` 裡有自己的 `voice`（必要時也可以有自己的 `provider`）。同一部片裡，旁白和每個角色的聲音要聽得出差別。

| language | edge-tts 聲音 |
|---|---|
| `zh-TW` | `zh-TW-HsiaoChenNeural`（女，溫和，適合旁白）、`zh-TW-HsiaoYuNeural`（女，較年輕）、`zh-TW-YunJheNeural`（男） |
| `zh-CN` | `zh-CN-XiaoxiaoNeural`（女）、`zh-CN-XiaoyiNeural`（女，活潑）、`zh-CN-YunxiNeural`（男，年輕）、`zh-CN-YunxiaNeural`（男孩）、`zh-CN-YunjianNeural`（男，渾厚）、`zh-CN-YunyangNeural`（男，播報） |
| `en-US` / `en` | `en-US-AriaNeural`、`en-US-JennyNeural`、`en-US-AnaNeural`（女孩）、`en-US-GuyNeural`、`en-US-DavisNeural`、`en-US-ChristopherNeural` |
| `ja` | `ja-JP-NanamiNeural`（女）、`ja-JP-KeitaNeural`（男） |

- 台灣華語的聲音只有三個；角色多時可以借用 `zh-CN` 的聲音（例如小男孩用 `zh-CN-YunxiaNeural`），但要先告訴使用者「這個聲音是中國大陸口音」，讓他決定。
- 其他語言執行 `pnpm run tts --list-voices` 查詢。
- 選好後用 `pnpm run tts --sample <角色id>`（旁白用 `narrator`）產生試聽檔給使用者聽，見 [design-guide.md#voices](design-guide.md#voices)。

## 5. 與使用者互動的原則

共通原則（說白話、一次問一件事、checkpoint 一定停下、更新 `video.activity.json`、告訴使用者怎麼看成果、網頁工作台）見 [product-video SKILL.md §5](https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md#interaction)。故事影片另外注意：

- **故事是使用者的**。可以提議情節、補細節，但主角是誰、結局怎麼走、想傳達什麼，由使用者決定；他的原句盡量保留在旁白或對白裡。
- **三個 checkpoint**：故事定稿（`/video-story`）、角色長相與聲音（`/video-design`）、分鏡與完整稿（`/video-storyboard`）。之後每段渲染完都請使用者預覽。使用者沒有明確說「可以」之前，不往下一步。
- **給看得到、聽得到的東西**：講故事時用白話從頭講一次；講角色時給設定稿（`brief/design-sheet.svg`）與試聽檔，用「文件 > moon-fox-video > brief > design-sheet.svg」這種方式告訴他在哪裡。
- **改角色很貴**：角色長相或聲音一改，用到的每一段都要重做。美術步驟要讓使用者看清楚再確認；之後他想改角色時，先說明會重做哪幾段、大約多久。
- 給小朋友看的故事：避免恐怖、血腥的畫面與用詞；衝突用誇張可愛的方式表現。

## 6. 本機助手（可選）

和產品影片相同，見 [product-video SKILL.md §6](https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md#companion)。
