"use strict";

const DATA_KEY = "vocab-pf-data-v6";
const REVIEW_STEPS = [1, 3, 7, 14, 30, 60, 120];
const DEFAULT_CSV_URL = "./vocabulary_template.csv?v=6";

let words = [];
let view = [];
let currentIndex = 0;
let flipped = false;

const $ = (id) => document.getElementById(id);

function setStatus(message) {
  const element = $("status");
  if (element) element.textContent = message;
}

window.addEventListener("error", (event) => {
  setStatus(`程式錯誤：${event.message}`);
});

window.addEventListener("unhandledrejection", (event) => {
  setStatus(`程式錯誤：${event.reason?.message || event.reason}`);
});

function dateText(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateText(date);
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function detectDelimiter(text) {
  const firstLine = String(text).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
  const options = [",", ";", "\t"];
  return options.reduce((best, delimiter) => {
    const count = firstLine.split(delimiter).length - 1;
    return count > best.count ? { delimiter, count } : best;
  }, { delimiter: ",", count: -1 }).delimiter;
}

function parseRows(rawText) {
  const text = String(rawText ?? "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell.trim());
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
}

function parseCSV(text) {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("CSV 沒有資料列");

  const headers = rows[0].map(normalizeHeader);
  const aliases = {
    English: ["english", "word", "英文", "單字"],
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

  const indexOf = (key) => headers.findIndex((h) => aliases[key].map(normalizeHeader).includes(h));
  const englishIndex = indexOf("English");
  if (englishIndex < 0) throw new Error(`找不到 English 欄位。實際欄位：${rows[0].join(" | ")}`);

  const value = (row, key, fallback = "") => {
    const index = indexOf(key);
    return index >= 0 ? (row[index] ?? fallback) : fallback;
  };

  const output = rows.slice(1).map((row) => {
    const English = String(row[englishIndex] ?? "").trim();
    return {
      id: English.toLowerCase(),
      English,
      Chinese: value(row, "Chinese"),
      example: value(row, "example"),
      example_zh: value(row, "example_zh"),
      category: value(row, "category", "未分類") || "未分類",
      Pass: Number(value(row, "Pass", 0)) || 0,
      Fail: Number(value(row, "Fail", 0)) || 0,
      NextReview: value(row, "NextReview"),
      LastReviewed: value(row, "LastReviewed"),
      IntervalDays: Number(value(row, "IntervalDays", 0)) || 0
    };
  }).filter((item) => item.English);

  if (!output.length) throw new Error("CSV 沒有可用的英文單字");
  return output;
}

function save() {
  localStorage.setItem(DATA_KEY, JSON.stringify(words));
}

function loadSaved() {
  try {
    words = JSON.parse(localStorage.getItem(DATA_KEY)) || [];
  } catch {
    words = [];
  }
}

function mergeImported(imported) {
  const existing = new Map(words.map((word) => [word.English.trim().toLowerCase(), word]));
  words = imported.map((word) => {
    const old = existing.get(word.English.trim().toLowerCase());
    const incomingHasProgress = word.Pass || word.Fail || word.NextReview || word.LastReviewed || word.IntervalDays;
    if (!old || incomingHasProgress) return word;
    return {
      ...word,
      Pass: old.Pass || 0,
      Fail: old.Fail || 0,
      NextReview: old.NextReview || "",
      LastReviewed: old.LastReviewed || "",
      IntervalDays: old.IntervalDays || 0
    };
  });
  save();
  rebuildCategories();
  applyFilter();
}

function rebuildCategories() {
  const select = $("category");
  const previous = select.value;
  const categories = [...new Set(words.map((word) => word.category))].sort();
  select.innerHTML = '<option value="all">全部分類</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  if (categories.includes(previous)) select.value = previous;
}

function isDue(word) {
  return !word.NextReview || word.NextReview <= dateText();
}

function applyFilter() {
  const category = $("category").value;
  view = words.filter((word) => (category === "all" || word.category === category) && isDue(word));
  if (!view.length) view = words.filter((word) => category === "all" || word.category === category);
  currentIndex = Math.min(currentIndex, Math.max(0, view.length - 1));
  setFlipped(false);
  render();
}

function setFlipped(value) {
  flipped = value;
  $("card").classList.toggle("flipped", value);
  $("front").hidden = value;
  $("back").hidden = !value;
}

function render() {
  const word = view[currentIndex];
  if (!word) {
    $("english").textContent = "請匯入 CSV";
    $("meta").textContent = "尚未匯入";
    $("chinese").textContent = "";
    $("example").textContent = "";
    $("exampleZh").textContent = "";
    $("wordPass").textContent = "0";
    $("wordFail").textContent = "0";
    $("nextReview").textContent = "-";
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
  $("dueCount").textContent = words.filter(isDue).length;
  $("passTotal").textContent = words.reduce((sum, word) => sum + (Number(word.Pass) || 0), 0);
  $("failTotal").textContent = words.reduce((sum, word) => sum + (Number(word.Fail) || 0), 0);
}

function move(offset) {
  if (!view.length) return;
  currentIndex = (currentIndex + offset + view.length) % view.length;
  setFlipped(false);
  render();
}

function answer(passed) {
  const word = view[currentIndex];
  if (!word) return;
  if (passed) {
    word.Pass = (Number(word.Pass) || 0) + 1;
    const current = Number(word.IntervalDays) || 0;
    const next = REVIEW_STEPS.find((days) => days > current) || REVIEW_STEPS[REVIEW_STEPS.length - 1];
    word.IntervalDays = next;
    word.NextReview = addDays(next);
  } else {
    word.Fail = (Number(word.Fail) || 0) + 1;
    word.IntervalDays = 0;
    word.NextReview = dateText();
  }
  word.LastReviewed = dateText();
  save();
  const message = passed ? `Pass，下次 ${word.NextReview} 複習` : "Fail，今天再複習一次";
  applyFilter();
  setStatus(message);
}

function csvQuote(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importFile(file) {
  setStatus(`正在讀取：${file.name}`);
  const text = await file.text();
  const imported = parseCSV(text);
  mergeImported(imported);
  setStatus(`已匯入 ${imported.length} 個單字`);
}

async function loadGithubCSV(showMessage = true) {
  if (showMessage) setStatus("正在讀取 GitHub CSV...");
  const response = await fetch(DEFAULT_CSV_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`GitHub CSV 讀取失敗：HTTP ${response.status}`);
  const imported = parseCSV(await response.text());
  mergeImported(imported);
  if (showMessage) setStatus(`已從 GitHub 讀取 ${imported.length} 個單字`);
}

function bindEvents() {
  $("csvInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      setStatus("未選擇檔案");
      return;
    }
    try {
      await importFile(file);
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  $("loadGithubCsv").addEventListener("click", async () => {
    try { await loadGithubCSV(true); }
    catch (error) { setStatus(error.message); }
  });

  $("exportCsv").addEventListener("click", () => {
    const headers = ["English","Chinese","example","example_zh","category","Pass","Fail","NextReview","LastReviewed","IntervalDays"];
    const lines = [headers.join(","), ...words.map((word) => headers.map((key) => csvQuote(word[key])).join(","))];
    download("vocabulary-progress.csv", "text/csv;charset=utf-8", "\uFEFF" + lines.join("\r\n"));
    setStatus(`已匯出 ${words.length} 個單字`);
  });

  $("exportBackup").addEventListener("click", () => {
    download("vocabulary-backup.json", "application/json", JSON.stringify({ version: 6, words }, null, 2));
    setStatus("JSON 備份已建立");
  });

  $("backupInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.words)) throw new Error("備份格式不正確");
      words = data.words;
      save(); rebuildCategories(); applyFilter();
      setStatus(`已還原 ${words.length} 個單字`);
    } catch (error) {
      setStatus(`還原失敗：${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  $("category").addEventListener("change", applyFilter);
  $("card").addEventListener("click", () => setFlipped(!flipped));
  $("card").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFlipped(!flipped); }
  });
  $("prev").addEventListener("click", () => move(-1));
  $("next").addEventListener("click", () => move(1));
  $("random").addEventListener("click", () => {
    if (!view.length) return;
    currentIndex = Math.floor(Math.random() * view.length);
    setFlipped(false); render();
  });
  $("pass").addEventListener("click", () => answer(true));
  $("fail").addEventListener("click", () => answer(false));
  $("speak").addEventListener("click", (event) => {
    event.stopPropagation();
    const word = view[currentIndex];
    if (!word || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.English);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
  });
}

function updateNetwork() {
  $("network").textContent = navigator.onLine ? "目前有網路" : "離線模式";
}

async function start() {
  try {
    bindEvents();
    loadSaved();
    rebuildCategories();
    applyFilter();
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    setStatus("程式已載入，可匯入 CSV");

    if (navigator.onLine) {
      try { await loadGithubCSV(false); setStatus(`已自動載入 ${words.length} 個單字`); }
      catch { if (words.length) setStatus(`已載入本機 ${words.length} 個單字`); }
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js?v=6").catch(() => {});
    }
  } catch (error) {
    setStatus(`啟動失敗：${error.message}`);
  }
}

document.addEventListener("DOMContentLoaded", start);
