# PDF 與多元格式匯出指南 (export-guide.md)

本指南說明如何透過 Slidev 的 Playwright 匯出引擎輸出 PDF、含動畫步驟的 PDF 與圖片。

---

## 1. 匯出標準 PDF

```bash
pnpm run export
```

產出 `output/slides.pdf`（每頁一張）。Slidev 以 Chromium 列印頁面：文字、CSS 與 SVG 保持向量，放大不失真；WebGL / `<canvas>`（Three.js）會以點陣圖嵌入。

## 2. 匯出動畫步驟 PDF

簡報有許多 `v-click` 逐步出現效果，且使用者希望列印版保留每個步驟時，直接呼叫 Slidev CLI（`pnpm run export` 已固定輸出檔名，再加 `--output` 會重複）：

```bash
pnpm exec slidev export --with-clicks --output output/slides-clicks.pdf
```

## 3. 匯出 PNG 圖片

適合分享到社群或製作縮圖：

```bash
pnpm run export:png
```

---

## 4. 排錯與注意事項

- **Playwright 瀏覽器未安裝**：出現 `Executable doesn't exist at...` 時執行 `pnpm exec playwright install chromium`。
- **Three.js 畫面在 PDF 中空白**：`WebGLRenderer` 必須設定 `preserveDrawingBuffer: true`（範本的 `ThreeGlobe.vue` 已設定），否則列印時畫布已被清空。
- **匯出逾時或缺頁**：先 `pnpm run dev` 在瀏覽器確認每頁都能正常顯示，再匯出；組件不要依賴滑鼠互動才完成渲染。
- 匯出成功後執行 `pnpm run state project --status exported`，網頁工作台會自動偵測並預覽 `output/slides.pdf`。
