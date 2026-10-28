# tarot-images

tarot-images use to create a html platform for tarot to do the magic. Only for personal use.

## 星空塔羅 Star Tarot

純前端的互動塔羅網頁，打開 `index.html` 即可使用（建議用本機伺服器，例如 `python3 -m http.server`，或放上 GitHub Pages）。

- **洗牌儀式**：點擊牌堆或按「洗牌」，手機可以搖一搖
- **扇形抽牌**：78 張牌展開成弧形，憑直覺點選，牌會飛到牌位並 3D 翻面
- **三種牌陣**：每日一牌、時間之流（過去／現在／未來）、凱爾特十字
- **星座連線**：抽完後牌與牌之間連起發光的線，點中間的星星看兩張牌的元素關係
- **全息閃卡**：滑鼠移到牌上會有彩虹反光與傾斜效果
- **完整解讀**：列出每個牌位的正逆位關鍵字、主導元素、大阿爾克那比例
- **牌卡畫廊**：78 張牌排成可拖曳旋轉的 3D 圓柱

檔案：`index.html`、`style.css`、`app.js`（互動與動畫）、`cards.js`（牌義資料），`thumbs/` 是給網頁用的縮圖。
