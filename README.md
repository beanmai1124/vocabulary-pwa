# Vocabulary PWA v25

- 修正上方 Overdue 為 0，但單字卡仍顯示 Overdue 標籤的 UI 問題。
- Today = Next Review Date 時不顯示 Overdue。
- 只有 Today > Next Review Date 才顯示 Overdue。
- 強制 hidden 的 Overdue 標籤使用 display:none，避免 CSS display:inline-block 蓋過隱藏狀態。
- 保留查看全部單字預覽翻面功能，預覽不計算 Pass / Fail。
- vocabulary.xlsx 維持直接讀取 GitHub Pages 最新內容。

上傳時請保留 GitHub 上自己的 vocabulary.xlsx，不要用 ZIP 內範例檔覆蓋。
