# 簡報視覺增強指南 (visual-guide.md)

本指南指導 Agent 如何結合前端視覺能力與 Slidev 生態系打造世界級質感的簡報。

---

## 1. 原生向量 SVG 繪製守則

- **內嵌 SVG 代碼**：直接在 `slides.md` 內嵌 `<svg viewBox="0 0 800 400">...</svg>`，利用 Tailwind 樣式自適應容器。
- **統一色彩基調**：
  - 邊框：`#38bdf8`（Sky 400）、`#34d399`（Emerald 400）、`#a855f7`（Purple 500）。
  - 文字：`#f8fafc`（Slate 50）、`#94a3b8`（Slate 400）。
  - 背景：`#1e293b`（Slate 800 半透明）。
- **箭頭與連接線**：使用 `<defs><marker id="arrow">...</marker></defs>` 保持架構圖與流程圖整潔美觀。

---

## 2. Three.js / WebGL 3D 組件規範

- **自動載入機制**：Slidev 自動將 `components/*.vue` 註冊為全域組件，Agent 無需在 Markdown 中寫 `import`。
- **可重用 3D 組件範例**：
  - `<ThreeGlobe />`：旋轉線框地球，適合展示全球化、雲端運算、網路通訊主題。
- **撰寫新的 3D 組件注意事項**：
  - 必須在 `onBeforeUnmount` 執行 `cancelAnimationFrame` 與 `renderer.dispose()`，避免記憶體洩漏與多頁切換卡頓。
  - 建立 renderer 時設定 `new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })`：`alpha` 讓畫布融入主題背景；`preserveDrawingBuffer` 讓匯出 PDF 時畫面不會是空白。
  - WebGL 畫面在 PDF 中是點陣圖（不是向量），只用來營造氛圍；需要讀的文字與數據放在 HTML / SVG 裡。

---

## 3. Clicks 與動畫過渡

- **逐步列點**：用 `<v-clicks>` 包住清單，每按一次出現一項：
  ```markdown
  <v-clicks>

  - 項目一
  - 項目二

  </v-clicks>
  ```
- **單一元素**：在元素上加 `v-click`，例如 `<div v-click>第二步才出現</div>`。
- **指定步驟**：`v-click="2"` 在第 2 次點擊時出現；`v-after` 與前一個元素同時出現。
