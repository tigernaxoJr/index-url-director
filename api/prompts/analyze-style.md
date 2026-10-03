# 分析參考影片風格

> 由 Skill 文件產生，請勿直接修改。來源：https://aofa.tigernaxo.com/api/skills/product-video/workflow.md#style

### <a id="style"></a>風格分析（可選）

只在有參考影片時進行：

1. **取得影片**：使用者提供本機檔案最好。只有網址時，詢問使用者能否自行下載，或本機已有下載工具且使用者同意使用；不要繞過平台的下載限制。取得不到就跳過，在 brief 的「來源與不確定處」註明。
2. **抽取關鍵影格**：
   ```bash
   ffmpeg -i brief/reference.mp4 -vf "select='gt(scene,0.3)',scale=640:-1" -vsync vfr brief/reference-frames/%03d.png
   ffprobe -v error -show_entries format=duration -of csv=p=0 brief/reference.mp4
   ```
   影格數除以總長度即可估算平均鏡頭長度。
3. **寫入 `brief/style.json`**：

   ```json
   {
     "source": "brief/reference.mp4",
     "avgShotSec": 2.8,
     "pacing": "fast",
     "palette": ["#0F172A", "#38BDF8", "#FFFFFF"],
     "typography": { "headline": "粗體無襯線、大字置中", "body": "細體" },
     "captions": { "present": true, "position": "bottom", "style": "白字黑底半透明" },
     "transitions": ["cut", "fade"],
     "music": "輕快電子，約 120 BPM",
     "notes": "開場 3 秒內出現產品畫面"
   }
   ```

   `pacing`：`slow`（平均鏡頭 > 4 秒）、`medium`（2.5–4 秒）、`fast`（< 2.5 秒）。只記錄從影格與音訊實際觀察到的特徵。
