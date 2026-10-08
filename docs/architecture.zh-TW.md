# AOFA: Agent-Offloaded Frontend Architecture

[English](architecture.md) \| **繁體中文**

> **代理卸載式前端架構：純前端協議皮囊與本機 Agent 執行引擎的共生設計**

*本文為英文版 [architecture.md](architecture.md) 的翻譯，內容如有出入以英文版為準。*

---

## 1. 摘要 (Executive Summary)

**AOFA (Agent-Offloaded Frontend Architecture，代理卸載式前端架構)** 是一種針對 AI Agent 時代提出的現代軟體架構模式。

在傳統生成式 AI 產品（SaaS）模式中，服務商必須在雲端承擔高昂的推論算力、多媒體轉碼與儲存成本，同時使用者必須承擔隱私外洩與資料被雲端綁定的風險。

AOFA 提出責任邊界的反轉與重構：
- **前端（Presentation Layer）** 不依賴後端執行推論與運算，簡化為一份純靜態的**「協議皮囊（Protocol Shell & Workbench）」**，可零成本託管於 GitHub Pages 等靜態平台。
- **推論與執行（Execution & Inference Layer）** 卸載（Offloaded）給使用者自備的 **Coding Agent**（如 Claude Code, Cursor, Codex, Gemini CLI, Pi）與本地開源工具鏈（如 FFmpeg, Playwright）。
  - **推論**：一般情況下由使用者既有的 Agent 方案在其供應商雲端執行，成本由使用者的 Agent 訂閱 / API 額度承擔，而非本服務；有需要時，也可如 Pi Agent 般改接本機自建模型（如 Ollama / llama.cpp 上的 LLM、Piper / Kokoro 等本機 TTS），達成完全離線。
  - **執行**：檔案讀寫、擷取、轉碼、合成等重度運算在使用者本機完成。
- **通訊與儲存匯流排（Bus & SSOT）** 則藉由現代瀏覽器的 **File System Access API** 搭配結構化規範（JSON Schema），以本機檔案系統作為唯一的真實來源（Single Source of Truth）。

---

## 2. 背景與痛點：傳統 AI 系統的困境

### 2.1 雲端 AI SaaS 的三大代價
1. **算力稅 (Compute Tax)**：每次模型推理、圖像生成、語音合成或影片渲染，都在燃燒服務商的伺服器成本，迫使產品採取昂貴的訂閱制或點數制。
2. **隱私與安全黑盒 (Privacy Black Box)**：使用者的產品原始碼、機密資料、個人聲音與自訂素材必須上傳至服務商雲端處理與保存，企業與個人顧慮重重。
3. **成品難以微調 (Rigid Outputs)**：SaaS 產出的成片或素材無法精準細修，一旦不滿意只能重新花費點數重新生成。

### 2.2 本地運算與 Coding Agent 的普及
近年來，使用者的本機開發環境發生了劇變：
- 一般開發機已足以負擔擷取、轉碼、合成等執行層工作；部分高階機器甚至能跑本機 LLM / TTS 模型。
- 本地開源管線（如 FFmpeg 音視訊合成、Playwright 瀏覽器渲染）極其成熟且完全免費。
- **Coding Agent** 普及，具備強大的檔案讀寫、指令調度、邏輯推理與自動修復能力，且使用者多半已為其付費。

**核心反思**：既然使用者手上已有一具能推理、能操作本機工具的 Agent，前端為何還要在雲端架設後端、重複支付一次推論與運算成本？

---

## 3. 核心隱喻：皮囊與心臟 (Shell & Heart)

> *「前端如同一副精緻的外骨骼或車殼（Shell），沒有引擎它只是一具空殼；而使用者的 Agent 則是注入這副皮囊的心臟與動力引擎（Heart & Engine）。」*

```
┌────────────────────────────────────────────────────────┐
│                   Web Browser                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │     AOFA Frontend (靜態工作台 / 協議載體)          │  │
│  │     - 零推論 (Zero-Inference)                    │  │
│  │     - 協議驗證器 (Schema Validator)              │  │
│  │     - 狀態視覺化與編輯器 (Visualizer & Editor)    │  │
│  └────────────────────────┬─────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │ File System Access API
                            │ (Local Directory Handle)
┌───────────────────────────┼────────────────────────────┐
│ User Local Machine        │                            │
│                           ▼                            │
│    ┌──────────────────────────────────────────────┐    │
│    │ Local Filesystem (Shared SSOT)               │    │
│    │ ├── specs / schemas                          │    │
│    │ ├── project.json / scene.json                │    │
│    │ ├── activity.json (進度訊號)                 │    │
│    │ └── assets / output                          │    │
│    └──────────────────────▲───────────────────────┘    │
│                           │                            │
│    ┌──────────────────────┴───────────────────────┐    │
│    │ Local Coding Agent (調度心臟 & 執行引擎)     │    │
│    │ - 推論規劃 (LLM Reasoning)                   │    │
│    │   雲端 LLM (預設) / 本機模型 (可選)          │    │
│    │ - 本機工具 (FFmpeg, Playwright, TTS)         │    │
│    │ - 協議遵守者 (Protocol Conformant)           │    │
│    └──────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

---

## 4. AOFA 四大核心架構原則 (Core Principles)

### 原則一：Compute-Asymmetric Decoupling（算力非對稱解耦 / 零推論控制層）
- **算力邊界徹底分離**：應用層（不論是純靜態前端，或是包含帳號、計費的雲端後端控制層）**完全不承擔 AI 模型推理、音視訊轉碼與巨型運算**。
- **服務商邊際算力成本趨近於零**：雲端或展現層專注於提供極致的人機互動（HCI）、工作流程導引、協同中繼資料與協議校驗；推論與重度運算全數交由使用者端的 Agent 處理（推論可走使用者自己的雲端方案或本機模型）。

### 原則二：Schema as the Contract（Schema 即合約）
- 展現/控制層與執行 Agent 之間**不以不透明的私有指令或黑盒 API 耦合**。
- 雙方的唯一通訊與狀態轉換合約是一組嚴格定義、開源公開的 **JSON Schema / 規格定義**。
- 介面負責將人類意圖結構化為符合 Schema 的規格；Agent 則依照 Schema 規範讀取環境、產出檔案與更新狀態機。

### 原則三：Filesystem-Centric SSOT & Bus（以檔案系統為核心的真實來源與匯流排）
- **本地執行真實來源 (Local SSOT)**：所有具體的原始碼、中間素材、暫存檔與生成產物，均以本機檔案系統為唯一真實來源。
- **檔案即通訊訊號**：
  - 在純前端場景，前端透過 File System Access API 讀寫檔案，並以中繼資料特徵碼輪詢（Fingerprint Polling）偵測 Agent 的產出；Agent 端則由使用者手動觸發（見模式 A）或由 Companion 推動（見模式 B）。
  - 在具後端協同場景，雲端僅同步脫敏後的專案中繼資料（Metadata Plane），核心資料（Data Plane）永遠扎根本機。
  - 雙方寫入遵守鎖定約定（如 lock 檔、先寫暫存檔再改名的 write-temp-then-rename），以降低並行競態風險。File System Access API 本身不提供跨行程檔案鎖，Agent 是否遵守約定亦需驗證，因此前端讀取時仍應做 Schema 驗證與容錯。

### 原則四：Local-First & Data Sovereignty（本地優先與資料主權）
- **資產不經過本服務**：專利代碼、私有素材、內部網站登入憑證與創作原稿保存在使用者受控環境，本服務的伺服器（若有）不經手這些資料。
- **隱私邊界由使用者選擇**：Agent 推論時，必要的上下文會送往使用者所選的 LLM 供應商，隱私邊界等同該供應商的資料政策；若需完全不出本機，可改用本機 LLM / TTS。
- **自給自足（Self-Sustaining）**：即便雲端後端斷線或服務停止營運，本機專案與產出資產依然完整可讀、可透過本地工具鏈獨立編譯與運行。

---

## 5. 協同通訊模式 (Communication Paradigms)

AOFA 在前端與本機環境的通訊上，支援漸進式的三種模式：

### 模式 A：純工作台模式（Pure Workbench / File-Driven）
*最純粹的 AOFA 形式，無需本機安裝任何額外伺服器。*
1. 前端透過 File System Access API 取得 Handle。
2. 前端每 N 秒比對關鍵檔案中繼資料（`lastModified` 與檔案大小計算的 Fingerprint）。
3. 當 Agent 完成分鏡或生成音訊時，特徵碼變更，前端無感自動更新。
4. 前端需要 Agent 介入時（例如修改了文案），在狀態檔標註 `stale`，並提供標準指令（如 `/video-sync`），使用者在終端機貼上執行。

### 模式 B：伴侶增強模式（Companion-Enhanced / Push-Driven）
*當環境允許時，啟用極致的無感體驗。*
1. 本機隨專案啟動微型 WebSocket Companion（僅綁定 `127.0.0.1`，不對外暴露）。
2. 安全配對機制：WebSocket 不受 CORS 保護，Companion 必須驗證連線的 `Origin` header 並搭配一次性配對 Token，以防範跨站連線劫持。
3. Companion 提供即時事件推播（Push），取代輪詢。
4. 前端可直接點擊「立即重新渲染」，由 Companion 執行白名單內的本機確定性指令。

> 注意：從公開 HTTPS 網站（如 GitHub Pages）連線至 `127.0.0.1`，新版 Chromium 的 Local Network Access 機制會要求使用者授權，前端需處理授權被拒時退回模式 A 的流程。

### 模式 C：具後端混合架構（Backend-Enabled / Hybrid AOFA）
*適用於需要團隊協作、帳號權限或企業級管理的多租戶系統。*

**重要觀念**：AOFA 並不排斥後端伺服器！在具後端的系統中，AOFA 實現了**「控制平面（Control Plane）與算力平面（Compute Plane）的徹底解耦」**：

```
[ Cloud Backend (控制平面) ]
  ├── 帳號認證 (Auth) & 訂閱計費 (Billing)
  ├── 團隊協同 (Team Sync) & 專案中繼資料 (Metadata)
  └── 共享範本庫 (Shared Protocol / Prompt Registry)
         ▲
         │ (輕量 JSON / Schema Sync)
         ▼
[ Web UI / Native App ] <──(本地協議匯流排)──> [ Local SSOT ] <──> [ Local Agent ]
                                                 └── 私有代碼、素材與重度執行算力
```

1. **雲端後端只做薄控制層**：
   - 後端專注於用戶權限、協同通知、計費與方案管理，以及發布標準化 Schema 與 Prompt 模組。
   - **後端完全不跑高耗能的模型推論與多媒體渲染，服務商的邊際算力成本趨近於零（Near-Zero Marginal Compute Cost）**。
2. **算力與資料留存使用者端 (BYOA - Bring Your Own Agent)**：
   - 企業用戶的專利原始碼、商業機密與龐大影音素材，留在員工本地由 Agent 運算與渲染，不經過本服務後端。
   - 推論則走企業自選的 LLM 供應商（可為已簽署資料協議的企業方案）或內部自建模型。
   - 只有經過脫敏、通過 Schema 驗證的「最終專案中繼資料」或使用者明確同意發布的成片，才會上傳同步至雲端後端，大幅簡化企業的隱私合規範圍。

---

## 6. AOFA 實踐案例：Index URL Director (Agent Video Producer)

Index URL Director 即為 AOFA 的完整參考實作：
- **前端工作台**：Vue 3 + Tailwind 靜態網站，託管於 GitHub Pages。提供產品規格填寫、分鏡看板、旁白編輯與成片預覽。
- **協議庫**：`specs/*.schema.json` 定義了 `project`、`scene`、`workflow` 與 `activity` 格式。
- **本機 Agent**：由 Claude Code 讀取線上 Guide 與本機 Skill，調用本機 Playwright 擷取網頁、Edge-TTS（微軟線上語音服務，可替換為 Piper / Kokoro 等本機 TTS）生成語音、FFmpeg 合成 60fps 影片。
- **效益**：
  - 開發者：0 伺服器月租、0 GPU 帳單、免維護資料庫。
  - 使用者：本服務不收費（推論成本由使用者既有的 Agent 方案負擔）；素材不經過本服務伺服器，原始碼與音訊素材完整可控。

---

## 7. 適用場景與限制 (When to Use & Limitations)

### 適合採用的場景
- **重度依賴本機工具鏈的生成任務**：如程式碼生成、本地測試、音視訊後製、文件編排。
- **高度隱私敏感型產品**：企業內部系統分析、私人故事繪本/動畫、個人隱私資料處理（搭配企業級 LLM 方案或本機模型效果最佳）。
- **開發者工具與生產力套件**：專為已有 Coding Agent 的工程師或專業用戶設計的工具。

### 局限性與邊界
- **瀏覽器相容性**：依賴 File System Access API（`showDirectoryPicker`），目前僅桌面版 Chrome、Edge 等 Chromium 瀏覽器支援；Brave 預設停用，Firefox 與 Safari 不支援。
- **依賴使用者本機環境**：使用者環境需具備基本執行環境（如 Node.js、Coding Agent 等），並自行負擔 Agent 的訂閱或 API 費用。
- **Agent 輸出不具確定性**：Agent 產出未必完全符合 Schema，前端需驗證並提供重試或修復指引。
- **模式 A 需人工觸發**：無 Companion 時，使用者需手動在終端機執行指令才能推動 Agent。
- **目錄授權需重新取得**：重新整理頁面後，目錄 Handle 的讀寫權限通常需使用者再次授權。

---

## 8. 結論 (Conclusion)

AOFA（代理卸載式前端架構）打破了「AI 產品必須等於雲端 SaaS」的固有思維。它將前端還原為純粹的互動介面與協議標準，把推論成本、執行權與資料主權交還給使用者自備的 Agent——推論要走雲端還是本機模型，也由使用者決定。

這是一條兼顧**服務商零維護成本**、**使用者可控的資料隱私**與**靈活擴展能力**的全新架構路徑。
