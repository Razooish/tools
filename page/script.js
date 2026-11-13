
const titleInput = document.getElementById("noteTitle");
const contentInput = document.getElementById("noteContent");
const notesList = document.getElementById("notesList");
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");

const STORAGE_KEY = "page_notes";
const THEME_KEY = "page_theme";
const SPELL_KEY = "page_spellcheck";

let notes = [];
let currentNoteId = null;
let pendingDeleteId = null;

let saveTimer = null;
let activeSince = null;
let timerInterval = null;

// --------------------------------
// UNIQUE IDS AND TITLES
// --------------------------------

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) +
      Math.random().toString(36).slice(2);
}

function generateTitle() {
  let number = 1;
  let title = "Untitled note";

  while (notes.some(note => note.title === title)) {
    number++;
    title = `Untitled note ${number}`;
  }

  return title;
}

// --------------------------------
// DATE AND TIME FORMATTING
// --------------------------------

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0")
  ].join(":");
}

function formatShortTime(seconds) {
  if (seconds < 60) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

// --------------------------------
// LOCAL STORAGE
// --------------------------------

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    document.getElementById("saveStatus").textContent = "Saved";
    return true;
  } catch (error) {
    console.error("Storage error:", error);
    document.getElementById("saveStatus").textContent =
      "Unable to save";
    return false;
  }
}

function loadNotes() {
  try {
    // Also support migration from the previous version.
    let saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      saved = localStorage.getItem("still_notes");
    }

    const parsed = saved ? JSON.parse(saved) : [];

    notes = Array.isArray(parsed)
      ? parsed.filter(note =>
          note &&
          typeof note.id === "string" &&
          typeof note.title === "string" &&
          typeof note.content === "string"
        )
      : [];

    // Normalize old notes
    notes = notes.map(note => {
      const isDefaultTitle =
        /^Untitled note(?: \d+)?$/.test(note.title);

      return {
        ...note,
        createdAt: note.createdAt || Date.now(),
        updatedAt: note.updatedAt || Date.now(),
        timeSpent: Math.max(0, Number(note.timeSpent) || 0),
        defaultTitle: note.defaultTitle ||
          (isDefaultTitle ? note.title : "Untitled note"),
        started: typeof note.started === "boolean"
          ? note.started
          : (Boolean(note.content.trim()) ||
             (!isDefaultTitle && Boolean(note.title.trim())))
      };
    });

  } catch (error) {
    notes = [];
  }

  notes.sort((a, b) => b.updatedAt - a.updatedAt);

  if (notes.length === 0) {
    createNote(false);
  } else {
    openNote(notes[0].id);
  }

  renderNotes();
}

// --------------------------------
// NOTE CREATION
// --------------------------------

function createNote(closeMenu = true) {
  const now = Date.now();
  const defaultTitle = generateTitle();

  const note = {
    id: generateId(),
    title: defaultTitle,
    defaultTitle,
    content: "",
    createdAt: now,
    updatedAt: now,
    timeSpent: 0,
    started: false
  };

  notes.unshift(note);

  saveToStorage();
  openNote(note.id);
  renderNotes();

  if (closeMenu) {
    closeDrawer();
  }

  // Select the default title so it can be replaced immediately.
  titleInput.focus();
  titleInput.select();

  updateNewNoteButton();
}

// --------------------------------
// NOTE SWITCHING
// --------------------------------

function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  clearTimeout(saveTimer);
  stopTracking();

  currentNoteId = id;

  titleInput.value = note.title;
  contentInput.value = note.content;

  resizeTextarea();
  updateWordCount();
  updateDate();
  updateTimerDisplay();
  updateNewNoteButton();
  renderNotes();

  document.getElementById("saveStatus").textContent = "Saved";

  startTracking();
}

// --------------------------------
// NOTE SAVING
// --------------------------------

function saveCurrentNote() {
  const note = notes.find(n => n.id === currentNoteId);
  if (!note) return;

  note.title = titleInput.value;
  note.content = contentInput.value;
  note.updatedAt = Date.now();

  // A note becomes started only after actual writing.
  if (
    contentInput.value.trim().length > 0 ||
    (
      titleInput.value.trim().length > 0 &&
      titleInput.value.trim() !== note.defaultTitle
    )
  ) {
    note.started = true;
  }

  notes.sort((a, b) => b.updatedAt - a.updatedAt);

  saveToStorage();
  renderNotes();
  updateNewNoteButton();
}

function scheduleSave() {
  document.getElementById("saveStatus").textContent = "Saving...";

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveCurrentNote();
  }, 500);
}

function flushSave() {
  clearTimeout(saveTimer);
  saveCurrentNote();
}

// --------------------------------
// NEW NOTE BUTTON CONTROL
// --------------------------------

function updateNewNoteButton() {
  const button = document.getElementById("newNoteBtn");

  const note = notes.find(n => n.id === currentNoteId);

  // Cannot create another note until this one has been started.
  button.disabled = !note || !note.started;
}

// --------------------------------
// LIVE TIME TRACKING
// --------------------------------

function startTracking() {
  if (!currentNoteId || document.hidden) return;

  activeSince = Date.now();
  updateTimerDisplay();

  if (!timerInterval) {
    timerInterval = setInterval(() => {
      updateTimerDisplay();

      // Persist elapsed time every 10 seconds.
      if (
        activeSince &&
        Date.now() - activeSince >= 10000
      ) {
        commitElapsedTime();
      }
    }, 1000);
  }
}

function commitElapsedTime() {
  if (!activeSince || !currentNoteId) return;

  const note = notes.find(n => n.id === currentNoteId);

  if (!note) {
    activeSince = null;
    return;
  }

  const elapsed = Math.floor(
    (Date.now() - activeSince) / 1000
  );

  if (elapsed <= 0) return;

  note.timeSpent += elapsed;

  // Keep any fractional second for the next update.
  activeSince += elapsed * 1000;

  saveToStorage();
  updateTimerDisplay();
  renderNotes();
}

function stopTracking() {
  commitElapsedTime();
  activeSince = null;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const note = notes.find(n => n.id === currentNoteId);

  if (!note) {
    document.getElementById("timeDisplay").textContent = "00:00:00";
    return;
  }

  let total = note.timeSpent || 0;

  if (activeSince) {
    total += Math.floor((Date.now() - activeSince) / 1000);
  }

  document.getElementById("timeDisplay").textContent =
    formatTime(total);
}

// Pause timer when tab is hidden.
// Resume when the user returns.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopTracking();
  } else {
    startTracking();
  }
});

// --------------------------------
// WORD COUNT AND TEXTAREA
// --------------------------------

function updateWordCount() {
  const text = contentInput.value.trim();

  const count = text
    ? text.split(/\s+/).length
    : 0;

  document.getElementById("wordCount").textContent =
    `${count} ${count === 1 ? "word" : "words"}`;
}

function resizeTextarea() {
  contentInput.style.height = "auto";

  contentInput.style.height =
    Math.max(
      contentInput.scrollHeight,
      window.innerHeight * 0.65
    ) + "px";
}

// --------------------------------
// DATE
// --------------------------------

function updateDate() {
  document.getElementById("currentDate").textContent =
    new Date().toLocaleDateString("en", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
}

// --------------------------------
// NOTES DRAWER
// --------------------------------

function renderNotes() {
  notesList.replaceChildren();

  document.getElementById("noteCount").textContent = notes.length;

  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Your notes will appear here.";

    notesList.appendChild(empty);
    return;
  }

  notes.forEach(note => {
    const item = document.createElement("div");
    item.className = "note-item";

    if (note.id === currentNoteId) {
      item.classList.add("selected");
    }

    const title = document.createElement("div");
    title.className = "note-item-title";
    title.textContent = note.title.trim() || "Untitled note";

    const preview = document.createElement("div");
    preview.className = "note-item-preview";
    preview.textContent = note.content.trim() || "No content yet...";

    const info = document.createElement("div");
    info.className = "note-item-info";

    const date = document.createElement("span");
    date.textContent = formatDate(note.updatedAt);

    const time = document.createElement("span");
    time.textContent = `${formatShortTime(note.timeSpent || 0)} spent`;

    info.append(date, time);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-note";
    deleteBtn.title = "Delete note";
    deleteBtn.setAttribute("aria-label", "Delete note");

    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16M10 11v6m4-6v6"/>
        <path d="m5 7 1 14h12l1-14M9 7V4h6v3"/>
      </svg>
    `;

    deleteBtn.addEventListener("click", event => {
      event.stopPropagation();
      showDeleteModal(note.id);
    });

    item.append(title, preview, info, deleteBtn);

    item.addEventListener("click", () => {
      flushSave();
      openNote(note.id);
      closeDrawer();
    });

    notesList.appendChild(item);
  });
}

// --------------------------------
// CUSTOM DELETE CONFIRMATION
// --------------------------------

function showDeleteModal(id) {
  pendingDeleteId = id;

  const modal = document.getElementById("deleteModal");

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  pendingDeleteId = null;

  const modal = document.getElementById("deleteModal");

  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

function deleteNote() {
  if (!pendingDeleteId) return;

  const id = pendingDeleteId;
  const isCurrent = id === currentNoteId;

  if (isCurrent) {
    clearTimeout(saveTimer);
    stopTracking();
  }

  notes = notes.filter(note => note.id !== id);

  closeDeleteModal();

  if (isCurrent) {
    currentNoteId = null;

    if (notes.length > 0) {
      openNote(notes[0].id);
    } else {
      createNote(false);
    }
  }

  saveToStorage();
  renderNotes();
  updateNewNoteButton();
}

// --------------------------------
// DRAWER CONTROLS
// --------------------------------

function openDrawer() {
  drawer.classList.add("active");
  overlay.classList.add("active");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("active");
  overlay.classList.remove("active");
  drawer.setAttribute("aria-hidden", "true");
}

// --------------------------------
// THEME
// --------------------------------

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const icon = document.getElementById("themeIcon");

  if (theme === "dark") {
    icon.innerHTML = `
      <path d="M20.9 13A9 9 0 0 1 11 3.1
      9 9 0 1 0 20.9 13Z"/>
    `;
  } else {
    icon.innerHTML = `
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42
      m11.3 11.3 1.42 1.42M2 12h2m16 0h2
      M4.93 19.07l1.42-1.42m11.3-11.3
      1.42-1.42"/>
    `;
  }

  localStorage.setItem(THEME_KEY, theme);
}

// --------------------------------
// SPELLCHECK
// --------------------------------

function setSpellcheck(enabled) {
  contentInput.spellcheck = enabled;

  const button = document.getElementById("spellToggle");

  button.classList.toggle("active", enabled);
  button.title = `Spellcheck: ${enabled ? "On" : "Off"}`;
  button.setAttribute("aria-pressed", String(enabled));

  localStorage.setItem(SPELL_KEY, String(enabled));
}

// --------------------------------
// EVENT LISTENERS
// --------------------------------

// Title typing
titleInput.addEventListener("input", () => {
  scheduleSave();
  updateNewNoteButton();
});

// Content typing
contentInput.addEventListener("input", () => {
  resizeTextarea();
  updateWordCount();
  scheduleSave();
  updateNewNoteButton();
});

// New note
document.getElementById("newNoteBtn").addEventListener("click", () => {
  const note = notes.find(n => n.id === currentNoteId);

  if (!note || !note.started) return;

  flushSave();
  createNote();
});

// Drawer
document.getElementById("menuToggle").addEventListener("click", () => {
  flushSave();
  openDrawer();
});

document.getElementById("closeDrawer").addEventListener(
  "click",
  closeDrawer
);

overlay.addEventListener("click", closeDrawer);

// Delete modal
document.getElementById("cancelDelete").addEventListener(
  "click",
  closeDeleteModal
);

document.getElementById("confirmDelete").addEventListener(
  "click",
  deleteNote
);

document.getElementById("deleteModal").addEventListener("click", event => {
  if (event.target.id === "deleteModal") {
    closeDeleteModal();
  }
});

// Theme
document.getElementById("themeToggle").addEventListener("click", () => {
  const current =
    document.documentElement.getAttribute("data-theme");

  setTheme(current === "dark" ? "light" : "dark");
});

// Spellcheck
document.getElementById("spellToggle").addEventListener("click", () => {
  setSpellcheck(!contentInput.spellcheck);
});

// Keyboard shortcuts
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDrawer();
    closeDeleteModal();
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "n"
  ) {
    event.preventDefault();

    const note = notes.find(n => n.id === currentNoteId);

    if (note?.started) {
      flushSave();
      createNote();
    }
  }
});

// Save and stop timer before leaving page
window.addEventListener("pagehide", () => {
  clearTimeout(saveTimer);
  saveCurrentNote();
  stopTracking();
});

// --------------------------------
// INITIALIZATION
// --------------------------------

setTheme(localStorage.getItem(THEME_KEY) || "light");

setSpellcheck(
  localStorage.getItem(SPELL_KEY) !== "false"
);

updateDate();
loadNotes();
