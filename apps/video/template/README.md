# 影片專案

這個目錄是一個以 [Agent Video Producer]({{SITE_URL}}/video/) 協議建立的影片專案：產品介紹影片，或把故事做成的動畫影片（`video.project.json` 的 `project.kind` 為 `story`）。影片拆成多個 scene，每段可以單獨修改、重做，所有檔案和運算都留在你的電腦上。

## 怎麼使用

直接用白話告訴 Agent 你想做什麼就好，例如「繼續」、「第三段的旁白改成……」、「開場重做」、「把影片合成起來」。所有操作都由 Agent 替你執行。

想看進度、預覽影片或直接修改旁白，可以打開網頁工作台 {{SITE_URL}}/video/ ，在步驟 1 選擇這個資料夾。

熟悉的人也可以直接輸入以下指令：

| 指令 | 作用 |
|---|---|
| `/video-analyze` | 產品影片：分析產品，產生 `brief/product-brief.md` |
| `/video-story` | 故事影片：和你一起把故事整理完整，產生 `brief/story.md` |
| `/video-design` | 故事影片：畫角色與場景、挑每個角色的聲音，給你看設定稿和試聽 |
| `/video-storyboard` | 規劃分鏡與旁白，完成後會請你審閱；影片合成後也能重新規劃，只重做有變更的段落 |
| `/video-scene <id\|all>` | 產生 scene 的旁白、畫面與影片，每段完成後請你預覽 |
| `/video-assemble` | 合成 `output/final.mp4` 與字幕檔 |
| `/video-sync` | 你改過文案或設定後，只重做受影響的部分 |
| `/video-status` | 查看目前進度 |
| `/video-music` | 決定背景音樂：自動配樂、用自己的音樂或不要音樂，並試聽 |
| `/video-approve <id>` | 核准某個 scene |
| `/video-translate <locale>` | 複製一份專案並翻譯成其他語言 |

不確定下一步時，執行 `pnpm run status`。

## 可以直接修改的檔案

- `scenes/*/script.md`：各段旁白，純文字。改完執行 `/video-sync`。
- `video.project.json` 的 `scenes` 順序：影片播放順序。改完執行 `/video-assemble`。
- `assets/`：放 logo、BGM 等共用素材。BGM 檔名填在 `video.project.json` 的 `project.audio.bgm`。

其他 JSON 請透過 Agent 或 `pnpm run state` 修改，它會負責鎖定與驗證。

## 需要的工具

- Node.js 20.12 以上與 pnpm。執行 `pnpm install` 會一併取得 FFmpeg。
- 瀏覽器：Playwright 內建的 Chromium，或系統安裝的 Chrome / Edge。

## 產出

| 檔案 | 內容 |
|---|---|
| `scenes/*/output/scene.mp4` | 各段影片 |
| `output/final.mp4` | 完整影片 |
| `output/final.srt` | 字幕檔 |

規則與細節見 `AGENTS.md`。
