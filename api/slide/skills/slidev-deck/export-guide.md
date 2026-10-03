# PDF 與多元格式匯出指南 (export-guide.md)

本指南說明如何透過 Slidev Headless 引擎匯出向量 PDF、動畫分步 PDF 與圖片。

---

## 1. 匯出標準向量 PDF

Slidev 底層使用 Playwright 進行高解析向量截幀輸出：

```bash
# 產出標準單一 PDF (每頁一張)
pnpm run export --output output/slides.pdf
```

## 2. 匯出動畫步驟 PDF

若簡報有許多 `v-click` 逐步出現效果，且使用者希望在 PDF 列印版中保留每個步驟：

```bash
pnpm run export --output output/slides-clicks.pdf --with-clicks
```

## 3. 匯出高清 PNG 圖片包

適合用於分享到社交媒體或製作投影片縮圖：

```bash
pnpm run export:png
```

---

## 4. 排錯與注意事項

- **Playwright 瀏覽器未安裝**：若遇到 `Executable doesn't exist at...`，執行 `npx playwright install chromium`。
- **Three.js 匯出截圖黑屏**：確保 Three.js 的 `WebGLRenderer` 初始化時設定 `preserveDrawingBuffer: true`，以確保 Playwright 截幀時 WebGL 畫布內容不被清空。
