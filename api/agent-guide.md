# Agent Video Producer — Agent 指引

> 給任何能讀檔、執行指令的 Coding Agent。本文件與 product-video Skill 的 `SKILL.md` 內容相同；支援 Agent Skills 的 Agent 可改為安裝 Skill（見文末）。
> 網站只提供規則與範本，不執行任何 AI 或渲染；所有工作都在使用者的電腦上完成。

以 Agent Video Producer 協議（specVersion 1.0）在本機製作產品介紹影片。影片拆成多個獨立 scene，每段可單獨修改與重做；所有檔案與運算都留在使用者電腦上。

**先假設使用者不懂電腦操作**：他只會開 Agent 和網頁，不會開終端機、打指令或看懂路徑。所有指令由你執行；需要使用者動手時，給點擊式的逐步說明（見 §5）。

## 1. 判斷目前在哪裡

依序檢查：

1. **目前目錄有 `video.project.json`** → 已是影片專案。先依下面「既有專案：同步範本」把專案的工具更新到網站上的版本，再讀取專案根目錄的 `AGENTS.md`，**之後一律以它的規則為準**；`project.kind` 是 `story` 時這是故事影片，改照 story-video Skill（未安裝時讀取 https://aofa.tigernaxo.com/api/story-guide.md）；執行 `pnpm run status` 取得各 scene 狀態與建議的下一步，再依使用者要求執行對應步驟（§3）。
2. **使用者說網頁已準備好資料夾「X」並給了識別碼** → 專案要建在那個資料夾。目前目錄的 `video.start.json` 的 `id` 與識別碼相同時就是這裡，執行 §2 初始化。否則它在別處（使用者開對話時不必選它）：先在目前目錄底下（往下約 4 層）、再到使用者的「文件」「桌面」「下載」與家目錄尋找名為 `video.start.json`、`id` 相同的檔案（跳過 `node_modules`、`.git` 等大型目錄）。找到就切換到它所在的資料夾（那裡已經有 `video.project.json` 時，它是做到一半的專案，改照第 1 點）：Agent 能切換工作目錄時就切換，否則之後所有指令都先 `cd` 到那裡、檔案用完整路徑讀寫；用白話告訴使用者「我找到了『文件 > X』，接下來都在那裡工作」，然後執行 §2。找不到就請使用者把資料夾從檔案總管／Finder 拖進對話框，或開一個新對話並選擇 X。
3. **目前目錄有 `video.start.json`、沒有 `video.project.json`**（使用者沒給識別碼）→ 網頁準備好的就是這個資料夾，執行 §2 初始化，專案就建在目前目錄。
4. **目前目錄沒有 `video.project.json`，但使用者提到某個影片專案目錄** → 請使用者確認後切換到該目錄，回到第 1 點。
5. **都沒有** → 這是新專案，執行 §2 初始化。

### <a id="sync-template"></a>既有專案：同步範本

專案裡的腳本、Schema、`AGENTS.md` 等工具檔來自建立當時的範本；網站上的範本之後可能更新過。每次進入既有專案（§1 第 1 點），開始工作前都先檢查一次，有差異就把線上版本同步下來，不必先問使用者：

1. 取得線上 manifest，列出和本機不同的範本檔（`video.project.json` 是影片內容，不算範本檔）：
   ```bash
   mkdir -p .tmp
   curl -fsSL -o .tmp/template-manifest.json https://aofa.tigernaxo.com/api/templates/product-video/manifest.json
   node -e "const fs=require('fs'),c=require('crypto');const m=JSON.parse(fs.readFileSync('.tmp/template-manifest.json'));const d=m.files.filter(f=>f.path!=='video.project.json'&&(!fs.existsSync(f.path)||c.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex')!==f.sha256)).map(f=>f.path);console.log(d.length?d.join('
'):'UP_TO_DATE');console.log('specVersion',m.specVersion)"
   ```
   印出 `UP_TO_DATE` 就跳過這一節。
2. 有差異時：先確認沒有其他程式正在處理專案（專案根目錄沒有 `.video-agent.lock`；有的話等它消失，或問使用者網頁上的本機助手是否還在執行），然後寫 `video.activity.json` 並用白話告訴使用者：「網站上的製作工具有新版本，我先更新，不會動到你的影片內容。」
3. 下載範本 zip 到 `.tmp/`，以 manifest 的 `zip.sha256` 驗證（雜湊不符就停止並告知使用者），解壓到 `.tmp/template/`（macOS / Linux `unzip -q .tmp/product-video.zip -d .tmp/template`；Windows PowerShell `Expand-Archive .tmp/product-video.zip -DestinationPath .tmp/template`），再把除了 `video.project.json` 以外的檔案覆蓋到專案：
   ```bash
   node -e "const p=require('path');require('fs').cpSync('.tmp/template','.',{recursive:true,filter:s=>p.basename(s)!=='video.project.json'})"
   ```
   只會覆蓋範本本身的檔案；`scenes/`、`brief/`、`assets/`、`output/` 等影片內容不在範本裡，不會被動到。
4. 清單裡有 `package.json` 或 `pnpm-lock.yaml` 時執行 `pnpm install`。
5. manifest 的 `specVersion` 和 `video.project.json` 的 `specVersion` 不同時，以新的 `schemas/` 為準把專案資料調整成新格式，再用 `pnpm run state project --patch '[{"op":"replace","path":"/specVersion","value":"<新版本>"}]'` 更新版本；會刪除或改寫使用者內容（旁白、分鏡）的調整要先問使用者。
6. 執行 `pnpm run validate`，刪除 `.tmp/template*` 與下載的 zip，用一句白話告訴使用者更新了什麼（例如「已更新製作工具，影片內容沒有變動」）。更新後 `pnpm run status` 若顯示某些 scene 需要重做，照實告訴使用者，等他同意再重做。
7. 本機助手（§6）正在執行、且第 1 步的清單裡有 `scripts/` 底下的檔案或 `package.json` 時，它還在用舊版程式：停掉它（是你在背景啟動的就停止那個背景工作），再照 §6 用同一個指令重新啟動。用了 `--persist-token` 時網頁會自己重新連上，不必再點配對連結；告訴使用者一句「本機助手也更新好了」即可。不確定它有沒有在執行時，問使用者網頁右上角是否顯示本機助手已連線。

## <a id="init"></a>2. 初始化新專案（init）

1. **確認位置**：專案資料夾有 `video.start.json`（§1 第 2、3 點）時，專案就建在目前目錄，不另建子資料夾（網頁已確認它除了這個檔案以外是空的；網頁會一直顯示這個資料夾的進度，所以不能換位置）。否則預設在目前的工作資料夾裡建立新資料夾 `<產品名稱英文小寫>-video`（例如 `acme-video`），用白話向使用者確認：「我會在『文件』資料夾裡建立 acme-video 來放影片專案，可以嗎？」。不要要求使用者提供路徑。目錄必須是空的或不存在；不要建立在產品原始碼資料夾裡面。之後的指令都在這個專案資料夾中執行。
2. **取得範本**：在專案目錄下載範本，以 manifest 的 `zip.sha256` 驗證後解壓，再刪除 zip。雜湊不符就停止並告知使用者，不使用該檔案。
   ```bash
   curl -fsSL -o product-video.zip https://aofa.tigernaxo.com/api/templates/product-video.zip
   curl -fsSL https://aofa.tigernaxo.com/api/templates/product-video/manifest.json
   node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('product-video.zip')).digest('hex'))"
   ```
   解壓：macOS / Linux 用 `unzip -q product-video.zip`；Windows 用 PowerShell `Expand-Archive product-video.zip -DestinationPath .`（Git Bash 內的 `tar` 無法解 zip）。
3. **收集來源**：有 `video.start.json` 時先讀它，欄位與下面相同，另有 `sourceFolder`（見原始碼路徑）；它是網頁表單的內容，以它為準，不必再問已經填寫的項目。至少需要以下一項，缺少時詢問使用者：
   - 產品網址（`sources.productUrl`）。`video.start.json` 的 `requiresLogin` 為 true 表示要登入才看得到，寫入 `sources.requiresLogin`。沒有 `video.start.json` 時問一句：「這個網站要登入才看得到嗎？」**絕對不要問帳號密碼**；使用者主動貼出來時，請他不要提供、之後改密碼，也不要把它寫進任何檔案。
   - 產品原始碼路徑（`sources.sourceCodePath`，唯讀，不修改該目錄）。先確認路徑存在。使用者可能只給資料夾名稱（網頁無法取得完整路徑），或路徑不存在：依序在工作資料夾、它的上一層、使用者的「文件」「桌面」「下載」與常見程式碼資料夾（如 `~/code`、`~/source/repos`）尋找同名資料夾。`video.start.json` 的 `sourceFolder` 記有該資料夾的 `packageName`（package.json 的 name）、`gitRemote`（`.git/config` 的遠端網址）與 `entries`（最上層的檔案與資料夾名稱），用來比對候選資料夾、排除只是同名的。找到一個就用白話確認，找到多個請使用者選，找不到就請使用者把資料夾從檔案總管／Finder 拖進對話框，或說出它放在哪裡。
   - 產品文字描述（`sources.description`）
   - （可選）風格參考影片網址（`sources.referenceVideoUrl`）
4. **確認對象、風格與格式**：即使 `video.start.json` 已填寫，**對象與風格也要用白話向使用者確認一次**，一次問一件事並附建議：
   - **觀看對象**：例如「潛在客戶（不懂技術）」「開發者」「公司內部主管」。
   - **影片風格**：給 2–3 個選項並標出建議，例如「專業簡報（沉穩、資訊清楚）」「活潑社群短片（節奏快、字大）」「產品操作教學（步驟清楚）」。
   - 語言、畫面比例（16:9 橫式 / 9:16 直式 / 1:1 / 4:5）：沒有偏好時沿用範本預設（zh-TW、16:9、1920×1080、30fps）。
   - **字幕要不要直接印在畫面上**：「印在畫面上（社群播放常靜音，比較保險）」或「另附字幕檔（YouTube 等平台可開關，畫面乾淨）」；兩種都會產生字幕檔。前者寫入 `project.captions.mode: burn`，後者為預設 `srt`。要在渲染 scene 前決定：印在畫面上的字幕是在每個 scene 渲染時畫進去的，之後改字幕樣式或改選項都要重新渲染所有 scene。
   - **目標長度先不定案**：使用者已有明確要求就照用；否則先填預設 45 秒，告訴他「看完產品內容後我會建議適合的長度再跟你確認」，在 analyze 結束時決定（見 [workflow.md#confirm](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#confirm)）。
   使用者不確定對象或風格時，可以先填暫定值，分析完再一起確認。
5. **填寫專案檔**：範本的 `video.project.json` 是可通過驗證的佔位內容，必須替換：
   - `project.id`：產生新的 UUID v4（範本為全 0，`pnpm run validate` 會視為未初始化）
   - `project.name`、`project.sources`、`project.language`、`project.targetAudience`、`project.style`、`project.format`、`project.captions`（選擇印在畫面上時）
   - `project.tts.voice`：依語言選擇（見 §4）
   - `updatedAt`：目前時間
   新專案沒有其他寫入者，這一次可以直接編輯 `video.project.json`；之後一律依 `AGENTS.md` 透過 `pnpm run state` 修改。
6. **安裝與檢查**：由你執行，不要請使用者打指令。
   - **Node.js**（20.12 以上，`node -v`）：沒有時先說明「需要安裝一個叫 Node.js 的免費工具」並取得同意。可以代為安裝時（Windows `winget install OpenJS.NodeJS.LTS`、macOS `brew install node`）就代為執行；不行時給點擊式步驟：「打開 https://nodejs.org → 按左邊綠色的 LTS 下載 → 打開下載的檔案 → 一直按『下一步』直到完成 → 完成後告訴我」。安裝後可能需要重新開啟 Agent 的對話。
   - **pnpm**（安裝套件用的工具，`pnpm -v`）：沒有時說明並取得同意後代為安裝（Windows `winget install pnpm.pnpm`、macOS `brew install pnpm`；兩者都不能用時 `npm install -g pnpm`）。安裝後可能需要重新開啟 Agent 的對話。
   - 執行 `pnpm install`（會一併取得 FFmpeg）。
   - 瀏覽器：已有 Chrome 或 Edge 就不需要其他動作；都沒有時，取得同意後執行 `pnpm exec playwright install chromium`。
   - 不使用系統管理員權限、不修改系統設定；安裝需要使用者點擊確認時，告訴他會看到什麼視窗、要按哪個按鈕。
7. **Gates**：依 `schemas/workflow.json` 的 `gates`，用白話說明並取得確認：
   - `onlineTtsConsent`：例如「旁白語音會用微軟的線上語音服務產生，旁白文字會傳給微軟。可以嗎？不行的話可以改用電腦內建的語音或自己錄音。」。使用者不同意時，改選離線 provider 或 `manual`。
   以 `pnpm run state` 寫入結果。
   - `productLogin`（`sources.requiresLogin` 為 true 時）：在這裡就請使用者登入，不要等到分析時才發現，做法見 [workflow.md#login](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#login)。登入結果不寫入 JSON。
8. **驗證**：執行 `pnpm run validate`，通過後告知使用者專案已建立、資料夾在哪裡（用「文件 > acme-video」這種說法），並直接問他是否要開始分析產品（即 analyze 步驟），不必要求他輸入指令。

## 3. 各步驟的做法

工作流程的權威定義是專案內的 `schemas/workflow.json`（步驟順序、前置狀態、狀態轉換、checkpoint）。以下檔案說明每一步**怎麼做好**：

| 步驟 / 操作 | 參考 |
|---|---|
| `/video-analyze` 分析產品 | [workflow.md#analyze](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#analyze) |
| `/video-storyboard` 分鏡與旁白 | [script-guide.md](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md)；已有 scene 時重新規劃見 [script-guide.md#revise](https://aofa.tigernaxo.com/api/skills/product-video/script-guide.md#revise) |
| `/video-music` 配樂（分鏡確認後） | [music-guide.md](https://aofa.tigernaxo.com/api/skills/product-video/music-guide.md) |
| `/video-scene` 產生 scene | [rendering-guide.md](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md) |
| `/video-assemble` 合成 | [rendering-guide.md#assemble](https://aofa.tigernaxo.com/api/skills/product-video/rendering-guide.md#assemble) |
| `/video-sync` 同步變更 | [workflow.md#sync](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#sync) |
| `/video-translate` 翻譯 | [workflow.md#translate](https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#translate) |

只在執行到該步驟時才讀取對應檔案。

## <a id="voices"></a>4. 預設聲音

| language | edge-tts 聲音 |
|---|---|
| `zh-TW` | `zh-TW-HsiaoChenNeural`（女）、`zh-TW-YunJheNeural`（男） |
| `zh-CN` | `zh-CN-XiaoxiaoNeural`（女）、`zh-CN-YunxiNeural`（男） |
| `en-US` / `en` | `en-US-AriaNeural`（女）、`en-US-GuyNeural`（男） |
| `ja` | `ja-JP-NanamiNeural`（女）、`ja-JP-KeitaNeural`（男） |

其他語言執行 `pnpm run tts --list-voices` 查詢目前 provider 可用的聲音。使用其他 provider 時，聲音名稱依該 provider 的格式。

## <a id="interaction"></a>5. 與使用者互動的原則

- **使用者不需要知道任何指令**：他用白話說「繼續」「第三段文案改成…」「重做開場」即可，你對應到工作流程的步驟（`/video-…` 指令只是有經驗的人的捷徑）。所有 `pnpm run …` 都由你執行。
- **說白話**：避免 JSON、pnpm、scene、render、commit 等術語；必須提到時順便解釋（例如「scene，也就是影片的一段」）。一次只問一件事，給選項時附上建議。
- **需要使用者動手時**（安裝軟體、允許權限、在網頁上按按鈕）：寫成編號步驟，說明會看到什麼、按哪裡、完成後回覆什麼。

- **checkpoint 一定停下**：分析完成後（確認對象、風格與長度）、分鏡與旁白完成後、每個 scene 渲染後，列出結果並等使用者確認或提出修改。使用者沒有明確說「可以」「繼續」之前，不產生語音、不渲染。
- **讓網頁知道你在做什麼**：專案資料夾裡的 `video.activity.json`（格式見 https://aofa.tigernaxo.com/api/schemas/activity.schema.json）會顯示在網頁工作台上。每開始一個步驟或一個 scene、每次停下來等使用者回覆（checkpoint、gate、任何提問）之前，都直接覆寫這個檔案：`{ "message": "正在錄第 3 段的畫面", "waitingForUser": false, "step": "build_scene", "scene": "scene-003", "updatedAt": "<現在時間，含時區>" }`。`message` 是給使用者看的一句白話；等使用者時 `waitingForUser` 為 `true`，`message` 說明要他回答什麼（例如「分鏡寫好了，請在對話中確認或告訴我要改哪裡」）。專案建立前（§1、§2）也要寫，網頁從使用者準備資料夾時就在看。工作全部完成時寫一句結果，`waitingForUser` 為 `false`。這個檔案不需要鎖、不經過 `pnpm run state`。
- **修改只重做受影響的部分**：使用者說「第三段文案改成…」，只改該 scene 的 `script.md`，只重做該 scene，再重新合成。
- **告訴使用者怎麼看成果**：用「文件 > acme-video > scenes > 003-solution > output > scene.mp4」這種資料夾順序描述位置，並建議打開網頁工作台 https://aofa.tigernaxo.com/video/ 預覽每一段、直接修改旁白。專案是網頁準備的（有 `video.start.json`）時，網頁已經開著這個資料夾，會自動顯示；否則請他在網頁步驟 1 選擇這個專案資料夾。
- **Web UI**：使用者可能同時開著 Agent Video Producer 網頁工作台，它會直接修改專案檔。使用者說「我在網頁上改好了」時，執行 `/video-sync`；完成後視情況提議開啟本機助手（§6）。

## <a id="companion"></a>6. 本機助手（可選）

本機助手（Companion）是專案裡附的小程式（`pnpm run companion`），隨範本下載、隨「同步範本」更新，不需要另外安裝。網頁配對後會出現「立即重新產生」「立即重做並合成」「立即合成」按鈕，使用者在網頁改完就能直接重做，不必回到對話；專案檔變動也會即時顯示在網頁上。沒有它一切照常運作，只是網頁上的修改要回到對話請你同步。

**什麼時候提**：不要在初始化時提，那時還沒有東西可以重做。使用者**第一次**在網頁上修改、並由你完成 `/video-sync` 之後，在回報的最後用一句白話問一次，例如：「之後在網頁上改完，想直接按按鈕重做、不用回來找我嗎？我可以幫你開啟『本機助手』。」使用者拒絕或沒有回應就不再主動提；他之後主動要求時再做。

不要從 npm 下載任何「video-agent」套件來代替它：npm 上名為 `video-agent` 的套件與本專案無關。

**開啟方式**：

1. 在專案資料夾於**背景**執行（不要等它結束，它會一直執行）：`pnpm run companion --persist-token`。`--persist-token` 讓之後重新開啟時不必再配對。出現 `scripts/companion.mjs not found` 或缺少 `ws` 時，先依「既有專案：同步範本」更新。
2. 從輸出找到 `open this link to pair the web UI:` 下一行的配對連結（`…/#pair=<port>:<token>`），請使用者點開。這個連結只在本機有效，**不要寫進任何檔案**。告訴使用者：「點開這個連結，網頁右上角顯示『本機助手已連線』就完成了。」
3. 開啟後，你和本機助手可能同時處理專案；開始修改專案前，照常檢查 `.video-agent.lock`。

**關閉與重開**：本機助手可能隨這次對話結束而停止。使用者說網頁顯示「本機助手未連線」時，告訴他先按網頁上的「重新連線本機助手」；仍然不行就請他跟你說「幫我開啟本機助手」，你再照上面的方式啟動（已配對過的不必再點連結）。不要設定開機自動啟動，那會修改系統設定。

## 安裝 Skill（可選）

下載 https://aofa.tigernaxo.com/api/skills/product-video.zip，解壓到 Agent 的 skills 目錄（Claude Code：使用者層級 `~/.claude/skills/`，或專案內 `.claude/skills/`）。zip 的 SHA-256 在 https://aofa.tigernaxo.com/api/index.json 的 `checksums.skill`。

## 資源

| 資源 | 網址 |
|---|---|
| 資源索引 | https://aofa.tigernaxo.com/api/index.json |
| 工作流程 | https://aofa.tigernaxo.com/api/workflow.json |
| 專案範本 | https://aofa.tigernaxo.com/api/templates/product-video.zip（雜湊：https://aofa.tigernaxo.com/api/templates/product-video/manifest.json） |
| Skill 文件 | https://aofa.tigernaxo.com/api/skills/product-video/SKILL.md |
