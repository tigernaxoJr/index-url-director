---
name: slidev-deck
description: 協助使用者在本機建立高質感 Slidev 簡報，結合 HTML/Tailwind、SVG 向量圖、Three.js 3D 視覺並匯出無損向量 PDF。
---

# Slidev Deck Skill

本 Skill 指引 Coding Agent（如 Claude Code）在使用者本機使用 Slidev 生成與排版現代化簡報，並透過 Slidev CLI 匯出高解析 PDF。

---

## 1. 核心流程

1. **規劃結構 (`/slide-outline`)**
   - 根據使用者提供的主題、受眾與資料，擬定分頁大綱。
   - 決定頁數與每頁的核心傳達訊息與排版模式。
   - 執行 `node scripts/state.mjs activity --message "大綱規劃完成，等待使用者確認" --step outline --waiting` 並向使用者展示大綱。
2. **編寫簡報 (`/slide-draft`)**
   - 編輯 `slides.md`，使用 `---` 切換分頁。
   - 靈活選擇 Slidev 內建 layout：
     - `cover`：首頁與大標題。
     - `two-cols`：左右雙欄比對或圖文排列。
     - `center`：聚焦單一重點。
     - `quote`：引用名言或關鍵宣言。
   - 於頁面底部以 `<!-- notes -->` 撰寫講者備忘錄。
3. **視覺升級 (`/slide-visual`)**
   - 詳見 [visual-guide.md](visual-guide.md)。
   - 內嵌原生向量 SVG 架構圖與流程圖。
   - 關鍵頁面引用 `<ThreeGlobe />` 等立體 3D 視覺組件。
   - 加入 `v-click` 動態逐點揭示效果。
4. **匯出 PDF (`/slide-export`)**
   - 詳見 [export-guide.md](export-guide.md)。
   - 執行 `pnpm run export` 產出 `output/slides.pdf`。
   - 執行 `node scripts/state.mjs project --status exported`。

---

## 2. 嚴格規則

1. **零後端安全**：不將使用者資料上傳至任何外部非授權端點。
2. **單一真理來源**：所有簡報內容以 `slides.md` 為核心。
3. **向量優先**：圖表與圖示優先使用 SVG 或 Iconify，避免產生低解析模糊點陣圖。
