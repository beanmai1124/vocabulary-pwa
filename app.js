const DATA_KEY = "vocab-pf-data-v3";
const PROGRESS_KEY = "vocab-pf-progress-v3";
const REVIEW_STEPS = [1, 3, 7, 14, 30, 60, 120];

let words = [];
let view = [];
let currentIndex = 0;
let flipped = false;
let progress = {};

const $ = (id) => document.getElementById(id);

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return localDateString();
}

function addDays(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
  const delimiters = [",", ";", "\t"];
  return delimiters.reduce((best, delimiter) => {
    const count = firstLine.split(delimiter).length - 1;
    return count > best.count ? { delimiter, count } : best;
  }, { delimiter: ",", count: -1 }).delimiter;
}

function parseDelimitedText(text) {
  // Correctly remove a UTF-8 BOM at the beginning of the CSV.
  text = String(text ?? "").replace(/^\uFEFF/, "");

  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let position = 0; position < text.length; position += 1) {
    const character = text[position];
    const nextCharacter = text[position + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      position += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") {
        position += 1;
      }
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      cell += character;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function parseCSV(text) {
  const rows = parseDelimitedText(text);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const aliases = {
    English: ["english", "word", "單字", "英文"],
    Chinese: ["chinese", "meaning", "中文", "意思"],
    example: ["example", "例句"],
    example_zh: ["examplezh", "例句中文", "中文例句"],
    category: ["category", "分類"],
    Pass: ["pass"],
    Fail: ["fail"],
    NextReview: ["nextreview"],
    LastReviewed: ["lastreviewed"],
    IntervalDays: ["intervaldays"]
  };

  function columnIndex(key) {
    const acceptedNames = aliases[key].map(normalizeHeader);
    return headers.findIndex((header) => acceptedNames.includes(header));
  }

  const englishIndex = columnIndex("English");
  if (englishIndex < 0) {
    throw new Error("找不到 English 欄位，請確認 CSV 第一列欄位名稱");
  }

  function valueAt(row, key, fallback = "") {
    const index = columnIndex(key);
    return index >= 0 ? (row[index] ?? fallback) : fallback;
  }

  return rows.slice(1).map((row, index) => {
    const english = String(row[englishIndex] ?? "").trim();
    return {
      id: `${english.toLowerCase()}-${index}`,
      English: english,
      Chinese: valueAt(row, "Chinese"),
      example: valueAt(row, "example"),
      example_zh: valueAt(row, "example_zh"),
      category: valueAt(row, "category", "未分類") || "未分類",
      Pass: Number(valueAt(row, "Pass", 0)) || 0,
      Fail: Number(valueAt(row, "Fail", 0)) || 0,
      NextReview: valueAt(row, "NextReview"),
      LastReviewed: valueAt(row, "LastReviewed"),
      IntervalDays: Number(valueAt(row, "IntervalDays", 0)) || 0
    };
  }).filter((word) => word.English !== "");
}

function saveLocalData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(words));
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function loadLocalData() {
  try {
    words = JSON.parse(localStorage.getItem(DATA_KEY)) || [];
  } catch {
    words = [];
  }

  try {
    progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    progress = {};
  }

  words.forEach((word) => {
    if (progress[word.id]) {
      Object.assign(word, progress[word.id]);
    }
  });

  rebuildCategories();
  applyFilter();
}

function rebuildCategories() {
  const categoryElement = $("category");
  if (!categoryElement) return;

  const previousValue = categoryElement.value;
  const categories = [...new Set(words.map((word) => word.category))].sort();

  categoryElement.innerHTML =
    '<option value="all">全部分類</option>' +
    categories.map((category) =>
      `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
    ).join("");

  if (categories.includes(previousValue)) {
    categoryElement.value = previousValue;
  }
}

function isDue(word) {
  return !word.NextReview || word.NextReview <= today();
}

function applyFilter() {
  const categoryElement = $("category");
  const selectedCategory = categoryElement ? categoryElement.value : "all";

  view = words.filter((word) =>
    (selectedCategory === "all" || word.category === selectedCategory) && isDue(word)
  );

  // If nothing is due today, keep the cards visible for optional review.
  if (view.length === 0) {
    view = words.filter((word) =>
      selectedCategory === "all" || word.category === selectedCategory
    );
  }

  currentIndex = Math.min(currentIndex, Math.max(0, view.length - 1));
  setFlipped(false);
  render();
}

function setFlipped(value) {
  flipped = value;
  $("card")?.classList.toggle("flipped", value);
  if ($("front")) $("front").hidden = value;
  if ($("back")) $("back").hidden = !value;
}

function render() {
  const word = view[currentIndex];

  if (!word) {
    if ($("english")) $("english").textContent = "請匯入 CSV";
    if ($("meta")) $("meta").textContent = "尚未匯入";
    if ($("chinese")) $("chinese").textContent = "";
    if ($("example")) $("example").textContent = "";
    if ($("exampleZh")) $("exampleZh").textContent = "";
    if ($("wordPass")) $("wordPass").textContent = "0";
    if ($("wordFail")) $("wordFail").textContent = "0";
    if ($("nextReview")) $("nextReview").textContent = "-";
  } else {
    $("english").textContent = word.English;
    $("chinese").textContent = word.Chinese;
    $("example").textContent = word.example;
    $("exampleZh").textContent = word.example_zh;
    $("meta").textContent = `${word.category} · ${currentIndex + 1}/${view.length}`;
    $("wordPass").textContent = word.Pass || 0;
    $("wordFail").textContent = word.Fail || 0;
    $("nextReview").textContent = word.NextReview || "今天";
  }

  updateStats();
}

function updateStats() {
  if ($("dueCount")) $("dueCount").textContent = words.filter(isDue).length;
  if ($("passTotal")) {
    $("passTotal").textContent = words.reduce((sum, word) => sum + (Number(word.Pass) || 0), 0);
  }
  if ($("failTotal")) {
    $("failTotal").textContent = words.reduce((sum, word) => sum + (Number(word.Fail) || 0), 0);
  }
}

function move(offset) {
  if (view.length === 0) return;
  currentIndex = (currentIndex + offset + view.length) % view.length;
  setFlipped(false);
  render();
}

function recordAnswer(passed) {
  const word = view[currentIndex];
  if (!word) return;

  if (passed) {
    word.Pass = (Number(word.Pass) || 0) + 1;
    const currentInterval = Number(word.IntervalDays) || 0;
    const nextStepIndex = REVIEW_STEPS.findIndex((days) => days > currentInterval);
    const nextInterval = nextStepIndex < 0
      ? REVIEW_STEPS[REVIEW_STEPS.length - 1]
      : REVIEW_STEPS[nextStepIndex];

    word.IntervalDays = nextInterval;
    word.NextReview = addDays(nextInterval);
  } else {
    word.Fail = (Number(word.Fail) || 0) + 1;
    word.IntervalDays = 0;
    word.NextReview = today();
  }

  word.LastReviewed = today();
  progress[word.id] = {
    Pass: word.Pass,
    Fail: word.Fail,
    NextReview: word.NextReview,
    LastReviewed: word.LastReviewed,
    IntervalDays: word.IntervalDays
  };

  saveLocalData();
  const message = passed
    ? `Pass，下次 ${word.NextReview} 複習`
    : "Fail，今天再複習一次";

  applyFilter();
  if ($("status")) $("status").textContent = message;
}

function csvQuote(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadFile(fileName, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

$("csvInput")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const importedWords = parseCSV(await file.text());
    if (importedWords.length === 0) {
      throw new Error("CSV 沒有可用的單字資料");
    }

    // Preserve existing learning progress when the English word already exists.
    const oldProgressByEnglish = new Map(
      words.map((word) => [word.English.trim().toLowerCase(), {
        Pass: word.Pass,
        Fail: word.Fail,
        NextReview: word.NextReview,
        LastReviewed: word.LastReviewed,
        IntervalDays: word.IntervalDays
      }])
    );

    words = importedWords.map((word) => {
      const previous = oldProgressByEnglish.get(word.English.trim().toLowerCase());
      const csvHasProgress = word.Pass || word.Fail || word.NextReview || word.LastReviewed || word.IntervalDays;
      return previous && !csvHasProgress ? { ...word, ...previous } : word;
    });

    progress = {};
    words.forEach((word) => {
      progress[word.id] = {
        Pass: word.Pass,
        Fail: word.Fail,
        NextReview: word.NextReview,
        LastReviewed: word.LastReviewed,
        IntervalDays: word.IntervalDays
      };
    });

    currentIndex = 0;
    saveLocalData();
    rebuildCategories();
    applyFilter();
    $("status").textContent = `已匯入 ${words.length} 個單字`;
  } catch (error) {
    $("status").textContent = `匯入失敗：${error.message}`;
  }

  event.target.value = "";
});

$("exportCsv")?.addEventListener("click", () => {
  const headers = [
    "English", "Chinese", "example", "example_zh", "category",
    "Pass", "Fail", "NextReview", "LastReviewed", "IntervalDays"
  ];

  const lines = [
    headers.join(","),
    ...words.map((word) => headers.map((header) => csvQuote(word[header])).join(","))
  ];

  downloadFile(
    "vocabulary-progress.csv",
    "text/csv;charset=utf-8",
    "\uFEFF" + lines.join("\r\n")
  );
});

$("exportBackup")?.addEventListener("click", () => {
  downloadFile(
    "vocabulary-backup.json",
    "application/json",
    JSON.stringify({ version: 3, words, progress }, null, 2)
  );
});

$("backupInput")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    if (!Array.isArray(backup.words)) {
      throw new Error("備份格式不正確");
    }

    words = backup.words;
    progress = backup.progress || {};
    saveLocalData();
    rebuildCategories();
    applyFilter();
    $("status").textContent = "備份已還原";
  } catch (error) {
    $("status").textContent = `還原失敗：${error.message}`;
  }

  event.target.value = "";
});

$("category")?.addEventListener("change", applyFilter);
$("card")?.addEventListener("click", () => setFlipped(!flipped));
$("card")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setFlipped(!flipped);
  }
});
$("prev")?.addEventListener("click", () => move(-1));
$("next")?.addEventListener("click", () => move(1));
$("random")?.addEventListener("click", () => {
  if (view.length === 0) return;
  currentIndex = Math.floor(Math.random() * view.length);
  setFlipped(false);
  render();
});
$("pass")?.addEventListener("click", () => recordAnswer(true));
$("fail")?.addEventListener("click", () => recordAnswer(false));
$("speak")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const word = view[currentIndex];
  if (!word || !("speechSynthesis" in window)) return;

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.English);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
});

function updateNetworkStatus() {
  if ($("network")) {
    $("network").textContent = navigator.onLine ? "目前有網路" : "離線模式";
  }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

updateNetworkStatus();
loadLocalData();
