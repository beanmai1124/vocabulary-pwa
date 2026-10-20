# GitHub Excel 唯讀來源版 v9（完全不依賴 CDN）

- `fflate.min.js` 已放在專案內，用來解壓 `.xlsx`。
- App 開啟時自動讀取同目錄的 `vocabulary.xlsx`。
- Excel 工作表名稱：`Vocabulary`。
- 必填欄位：`ID`、`English`、`Chinese`。
- Pass/Fail 與複習日期只存 iPhone。
- 修改 Excel 後，覆蓋 GitHub 根目錄的 `vocabulary.xlsx`，再按「同步 GitHub Excel」。
