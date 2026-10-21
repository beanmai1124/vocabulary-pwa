# Vocabulary PWA stable

此版本開始不再使用任何版本編號。

固定檔名：
- index.html
- app.js
- style.css
- sw.js
- manifest.webmanifest
- fflate.min.js
- vocabulary.xlsx

固定瀏覽器儲存名稱：
- vocabulary-words
- vocabulary-progress

第一次開啟會自動尋找並合併 v6 到 v25 的舊 Pass / Fail 紀錄，再存入固定的 vocabulary-progress。之後更新程式不會再因版本名稱改變而看不到紀錄。

vocabulary.xlsx 永遠直接讀取 GitHub Pages 最新內容。上傳程式時請保留 GitHub 上自己的 vocabulary.xlsx。
