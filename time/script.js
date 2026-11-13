
const $ = id => document.getElementById(id);
const TIMEZONE = "Asia/Kathmandu";

// ------------------------------
// THEME
// ------------------------------

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  $("themeIcon").textContent = theme === "dark" ? "☀" : "☾";

  localStorage.setItem("time_theme", theme);
}

const savedTheme = localStorage.getItem("time_theme") || "light";
applyTheme(savedTheme);

$("themeToggle").addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark")
    ? "light"
    : "dark";

  applyTheme(newTheme);
});

// ------------------------------
// DATE AND CLOCK
// ------------------------------

function getNepalDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = {};

  parts.forEach(part => {
    values[part.type] = part.value;
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function makeLocalDate(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatAD(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getWeekday(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long"
  }).format(date);
}

function updateToday() {
  const now = new Date();
  const today = getNepalDateParts(now);
  const adDate = makeLocalDate(
    today.year,
    today.month,
    today.day
  );

  $("adDate").textContent = formatAD(adDate);
  $("adWeekday").textContent = getWeekday(adDate);

  $("liveClock").textContent = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);

  $("footerDate").textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(now);

  try {
    if (typeof NepaliDate === "undefined") {
      throw new Error("Date library unavailable");
    }

    const bsDate = new NepaliDate(adDate);

    $("bsDate").textContent = bsDate.format("DD MMMM YYYY");
    $("bsWeekday").textContent = bsDate.format("dddd");
  } catch (error) {
    $("bsDate").textContent = "Unavailable";
    $("bsWeekday").textContent = "Check internet connection";
    console.error(error);
  }
}

updateToday();
setInterval(updateToday, 1000);

// ------------------------------
// NAVIGATION
// ------------------------------

const navButtons = document.querySelectorAll(".nav-btn");
const screens = document.querySelectorAll(".screen");

function showScreen(id) {
  screens.forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });

  navButtons.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.screen === id
    );
  });
}

navButtons.forEach(button => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.screen);
  });
});

// ------------------------------
// AD TO BS CONVERTER
// ------------------------------

function setTodayInInput() {
  const today = getNepalDateParts();

  $("adInput").value = [
    today.year,
    String(today.month).padStart(2, "0"),
    String(today.day).padStart(2, "0")
  ].join("-");
}

function convertDate() {
  const value = $("adInput").value;

  if (!value) {
    $("convertedDate").textContent = "Select a date";
    $("convertedWeekday").textContent = "";
    $("convertedAd").textContent = "";
    return;
  }

  const [year, month, day] = value.split("-").map(Number);
  const selectedDate = makeLocalDate(year, month, day);

  if (
    selectedDate.getFullYear() !== year ||
    selectedDate.getMonth() !== month - 1 ||
    selectedDate.getDate() !== day
  ) {
    $("convertedDate").textContent = "Invalid date";
    return;
  }

  try {
    if (typeof NepaliDate === "undefined") {
      throw new Error("Date library unavailable");
    }

    const bsDate = new NepaliDate(selectedDate);

    $("convertedDate").textContent = bsDate.format("DD MMMM YYYY");
    $("convertedWeekday").textContent = bsDate.format("dddd");
    $("convertedAd").textContent = formatAD(selectedDate) + " · AD";
  } catch (error) {
    $("convertedDate").textContent = "Conversion unavailable";
    $("convertedWeekday").textContent = "Check internet connection";
    $("convertedAd").textContent = "";
    console.error(error);
  }
}

setTodayInInput();
convertDate();

$("convertBtn").addEventListener("click", convertDate);
$("adInput").addEventListener("change", convertDate);

// ------------------------------
// STOPWATCH
// ------------------------------

let running = false;
let startTime = 0;
let elapsed = 0;
let laps = [];

function getElapsed() {
  return running
    ? elapsed + performance.now() - startTime
    : elapsed;
}

function formatTime(ms) {
  const totalCentiseconds = Math.floor(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);

  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const cs = String(centiseconds).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");

  return hours > 0
    ? `${hh}:${mm}:${ss}.${cs}`
    : `${mm}:${ss}.${cs}`;
}

function updateStopwatch() {
  $("stopwatchDisplay").textContent = formatTime(getElapsed());
}

function toggleStopwatch() {
  if (running) {
    elapsed = getElapsed();
    running = false;

    $("startBtn").textContent = "Resume";
    $("stopwatchStatus").textContent = "Paused";
    $("lapBtn").disabled = true;
  } else {
    startTime = performance.now();
    running = true;

    $("startBtn").textContent = "Pause";
    $("stopwatchStatus").textContent = "Running";
    $("lapBtn").disabled = false;
    $("resetBtn").disabled = false;
  }

  updateStopwatch();
}

function resetStopwatch() {
  running = false;
  startTime = 0;
  elapsed = 0;
  laps = [];

  $("stopwatchDisplay").textContent = "00:00.00";
  $("stopwatchStatus").textContent = "Ready";
  $("startBtn").textContent = "Start";
  $("resetBtn").disabled = true;
  $("lapBtn").disabled = true;

  renderLaps();
}

function addLap() {
  if (!running) return;

  const total = getElapsed();
  const previousTotal = laps.length
    ? laps[laps.length - 1].total
    : 0;

  laps.unshift({
    total,
    split: total - previousTotal
  });

  renderLaps();
}

function renderLaps() {
  $("lapsList").innerHTML = "";

  if (laps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-laps";
    empty.textContent = "No laps recorded";
    $("lapsList").appendChild(empty);
    return;
  }

  laps.forEach((lap, index) => {
    const row = document.createElement("div");
    row.className = "lap-row";

    const number = document.createElement("span");
    number.className = "lap-number";
    number.textContent = `Lap ${laps.length - index}`;

    const split = document.createElement("span");
    split.textContent = formatTime(lap.split);

    const total = document.createElement("span");
    total.textContent = formatTime(lap.total);

    row.append(number, split, total);
    $("lapsList").appendChild(row);
  });
}

$("startBtn").addEventListener("click", toggleStopwatch);
$("resetBtn").addEventListener("click", resetStopwatch);
$("lapBtn").addEventListener("click", addLap);

setInterval(() => {
  if (running) updateStopwatch();
}, 10);
