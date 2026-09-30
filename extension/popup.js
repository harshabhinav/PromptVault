/**
 * PromptVault Extension — Popup Logic & Data Store
 *
 * Full interactive logic, local storage repository, state transitions:
 * 1. Quick Save to existing blueprint on list item click.
 * 2. Save to new blueprint via "+ New Blueprint" view transition & input field.
 * 3. Robust JSON local storage schema supporting versioning & prompt history.
 */

"use strict";

const $ = (id) => document.getElementById(id);

// Default seed blueprints for initial load if storage is empty
const DEFAULT_BLUEPRINTS = [
  {
    id: "bp_cust_support",
    name: "Customer Support",
    lastUpdated: new Date(Date.now() - 120000).toISOString(), // 2 mins ago
    prompts: [
      { id: "p1", text: "Draft an empathetic response to a customer query...", timestamp: new Date(Date.now() - 3600000).toISOString(), version: 1 }
    ]
  },
  {
    id: "bp_mktg",
    name: "Marketing",
    lastUpdated: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    prompts: [
      { id: "p2", text: "Create 5 catchy headlines for a SaaS product launch...", timestamp: new Date(Date.now() - 86400000).toISOString(), version: 1 }
    ]
  },
  {
    id: "bp_resume",
    name: "Resume Builder",
    lastUpdated: new Date().toISOString(), // Today
    prompts: [
      { id: "p3", text: "Optimize bullet points for a Senior Frontend Engineer resume...", timestamp: new Date().toISOString(), version: 1 }
    ]
  }
];

// State variables
let currentBlueprints = [];
let selectedBlueprintId = null;
let sourceSite = "ChatGPT";
let autoCloseTimer = null;

// ── Storage Repository API (chrome.storage.local with localStorage fallback) ──

async function getStoredData() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["blueprints", "pv_pending_prompt", "pv_source_site"], (result) => {
        let blueprints = result.blueprints;
        if (!blueprints || !Array.isArray(blueprints) || blueprints.length === 0) {
          blueprints = DEFAULT_BLUEPRINTS;
          chrome.storage.local.set({ blueprints });
        }
        resolve({
          blueprints,
          pendingPrompt: result.pv_pending_prompt || "",
          sourceSite: result.pv_source_site || "ChatGPT"
        });
      });
    } else {
      // LocalStorage fallback for standalone / prototype environment
      let raw = localStorage.getItem("promptvault_data");
      let blueprints = raw ? JSON.parse(raw).blueprints : null;
      if (!blueprints || !Array.isArray(blueprints) || blueprints.length === 0) {
        blueprints = DEFAULT_BLUEPRINTS;
        localStorage.setItem("promptvault_data", JSON.stringify({ blueprints }));
      }
      resolve({
        blueprints,
        pendingPrompt: localStorage.getItem("pv_pending_prompt") || "",
        sourceSite: localStorage.getItem("pv_source_site") || "ChatGPT"
      });
    }
  });
}

async function saveStoredBlueprints(blueprints) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ blueprints }, () => resolve(true));
    } else {
      localStorage.setItem("promptvault_data", JSON.stringify({ blueprints }));
      resolve(true);
    }
  });
}

// Send background message if available (with fallback)
function sendMsg(type, payload = {}) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type, ...payload }, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    } else {
      resolve(null);
    }
  });
}

// ── UI View Helpers ──────────────────────────────────────────────────────────

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
}

function showError(msg) {
  $("error-msg").textContent = msg;
  $("error-toast").classList.remove("hidden");
  setTimeout(() => $("error-toast").classList.add("hidden"), 4000);
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay} days ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── App Initialization ────────────────────────────────────────────────────────

async function init() {
  const authRes = await sendMsg("CHECK_AUTH");

  if (!authRes || !authRes.authenticated) {
    showView("view-auth");
    return;
  }

  // Fetch blueprints from background
  const bpRes = await sendMsg("GET_BLUEPRINTS");
  if (bpRes && bpRes.success && Array.isArray(bpRes.blueprints)) {
    currentBlueprints = bpRes.blueprints;
  } else {
    const { blueprints } = await getStoredData();
    currentBlueprints = blueprints;
  }

  const { pendingPrompt, sourceSite: site } = await getStoredData();
  sourceSite = site || "ChatGPT";

  const textarea = $("prompt-text");
  if (textarea && pendingPrompt) {
    textarea.value = pendingPrompt;
  }
  $("source-site-label").textContent = sourceSite;

  renderBlueprintList(currentBlueprints);
  showView("view-list");
}

// ── Render Blueprint List ─────────────────────────────────────────────────────

function renderBlueprintList(blueprints) {
  const list = $("blueprint-list");
  list.innerHTML = "";

  if (!blueprints || blueprints.length === 0) {
    list.innerHTML = `<div class="empty-state">No blueprints found.</div>`;
    return;
  }

  // Sort by lastUpdated descending
  const sorted = [...blueprints].sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

  sorted.forEach((bp) => {
    const versionCount = bp.prompts ? bp.prompts.length : 1;
    const nextVer = versionCount + 1;
    const isSelected = String(bp.id) === String(selectedBlueprintId);
    const item = document.createElement("div");
    item.className = `blueprint-item${isSelected ? " selected" : ""}`;
    item.dataset.id = bp.id;

    item.innerHTML = `
      <span class="bp-folder-icon">📁</span>
      <div class="bp-info">
        <div class="bp-name">${escapeHtml(bp.name)}</div>
        <div class="bp-meta">Updated ${formatDate(bp.lastUpdated)} &bull; V${versionCount}</div>
      </div>
      <span class="bp-quick-tag">Save → V${nextVer}</span>
    `;

    // Toggle selection on click
    item.addEventListener("click", () => selectPopupBlueprint(bp.id));
    list.appendChild(item);
  });
  updateQuickSaveState();
}

// ── Blueprint Selection Toggle ────────────────────────────────────────────────

function selectPopupBlueprint(blueprintId) {
  const isSame = String(selectedBlueprintId) === String(blueprintId);

  if (isSame) {
    // Deselect
    selectedBlueprintId = null;
    document.querySelectorAll(".blueprint-item").forEach((el) => el.classList.remove("selected"));
    $("btn-save-static").disabled = true;
  } else {
    // Select new
    selectedBlueprintId = blueprintId;
    document.querySelectorAll(".blueprint-item").forEach((el) => {
      el.classList.toggle("selected", String(el.dataset.id) === String(blueprintId));
    });
    $("btn-save-static").disabled = false;
  }
  updateQuickSaveState();
}

function updateQuickSaveState() {
  const qsBtn = $("btn-quick-save");
  if (!qsBtn) return;
  if (selectedBlueprintId !== null) {
    qsBtn.classList.add("pv-qs-disabled");
    qsBtn.disabled = true;
  } else {
    qsBtn.classList.remove("pv-qs-disabled");
    qsBtn.disabled = false;
  }
}

// ── WORKFLOW 1: Save to Selected Blueprint ────────────────────────────────────

async function quickSaveToBlueprint(blueprintId) {
  const promptText = $("prompt-text").value.trim();
  if (!promptText) {
    showError("Please enter or paste a prompt to save.");
    return;
  }

  const saveBtn = $("btn-save-static");
  const origText = saveBtn ? saveBtn.textContent : "Save";
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  const res = await sendMsg("QUICK_SAVE", {
    payload: {
      blueprint_id: parseInt(blueprintId) || null,
      system_prompt: promptText,
      source_site: sourceSite
    }
  });

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  }

  if (res && res.success) {
    showSuccessState(res.blueprint_name || "Blueprint", res.version || "V1");
  } else {
    showError(res?.error || "Save failed. Please try again.");
  }
}

async function autoQuickSave() {
  if (selectedBlueprintId !== null) return;
  const promptText = $("prompt-text").value.trim();
  if (!promptText) {
    showError("Please enter or paste a prompt to save.");
    return;
  }

  const qsBtn = $("btn-quick-save");
  const origText = qsBtn ? qsBtn.textContent : "Quick Save";
  if (qsBtn) {
    qsBtn.disabled = true;
    qsBtn.textContent = "Saving...";
  }

  const res = await sendMsg("QUICK_SAVE", {
    payload: {
      blueprint_name: "Quick Save",
      system_prompt: promptText,
      source_site: sourceSite
    }
  });

  if (qsBtn) {
    qsBtn.disabled = false;
    qsBtn.textContent = origText;
  }

  if (res && res.success) {
    showSuccessState(res.blueprint_name || "Quick Save", res.version || "V1");
  } else {
    showError(res?.error || "Save failed. Please try again.");
  }
}

// ── WORKFLOW 2: Save to New Blueprint ─────────────────────────────────────────

function switchToNewBlueprintView() {
  // Clear search and name input
  $("new-bp-name").value = "";
  $("btn-save-new").disabled = true;
  showView("view-new-blueprint");
  setTimeout(() => $("new-bp-name").focus(), 50);
}

async function handleSaveNewBlueprint() {
  const nameInput = $("new-bp-name");
  const name = nameInput.value.trim();
  const promptText = $("prompt-text").value.trim();

  if (!name) {
    showError("Please enter a blueprint name.");
    nameInput.focus();
    return;
  }
  if (!promptText) {
    showError("Please enter a prompt to save.");
    return;
  }

  // Create new blueprint object in local storage
  const newBp = {
    id: "bp_" + Date.now(),
    name: name,
    lastUpdated: new Date().toISOString(),
    prompts: [
      {
        id: "p_1",
        text: promptText,
        timestamp: new Date().toISOString(),
        version: 1
      }
    ]
  };

  currentBlueprints.push(newBp);
  await saveStoredBlueprints(currentBlueprints);

  // Sync backend if available
  sendMsg("QUICK_SAVE", {
    payload: {
      blueprint_name: name,
      system_prompt: promptText,
      source_site: sourceSite
    }
  });

  // Show Success state
  showSuccessState(name, "V1");
}

// ── SUCCESS STATE TRANSITION ─────────────────────────────────────────────────

function showSuccessState(blueprintName, versionTag) {
  $("success-title").textContent = `Saved to ${blueprintName}!`;
  $("success-sub").textContent = `Version ${versionTag} saved successfully.`;
  $("success-blueprint").textContent = blueprintName;
  $("success-version").textContent = versionTag;
  $("success-source").textContent = sourceSite;

  showView("view-success");

  // Re-render list for when it returns
  renderBlueprintList(currentBlueprints);

  // Auto close or revert after 2 seconds
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(() => {
    if (typeof window !== "undefined" && window.close) {
      window.close();
    } else {
      showView("view-list");
    }
  }, 2000);
}

// ── SEARCH FILTER ────────────────────────────────────────────────────────────

function handleSearch(query) {
  const q = query.trim().toLowerCase();
  $("search-clear").classList.toggle("hidden", q.length === 0);

  if (!q) {
    renderBlueprintList(currentBlueprints);
    return;
  }

  const filtered = currentBlueprints.filter((bp) =>
    bp.name.toLowerCase().includes(q)
  );
  renderBlueprintList(filtered);
}

// ── EVENT BINDINGS ───────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // New Blueprint Button click -> Transitions view to New Blueprint form
  $("btn-new-blueprint")?.addEventListener("click", switchToNewBlueprintView);

  // New Blueprint name input listener -> activates [Save] button when typed
  $("new-bp-name")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    $("btn-save-new").disabled = val.length === 0;
  });

  // Save button click on New Blueprint view
  $("btn-save-new")?.addEventListener("click", handleSaveNewBlueprint);

  // Enter key press in New Blueprint name input
  $("new-bp-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && $("new-bp-name").value.trim().length > 0) {
      handleSaveNewBlueprint();
    }
  });

  // Back button on New Blueprint view -> Returns to list
  $("btn-back")?.addEventListener("click", () => {
    showView("view-list");
  });

  // Save button on main list view -> saves to selected blueprint
  $("btn-save-static")?.addEventListener("click", () => {
    if (selectedBlueprintId) quickSaveToBlueprint(selectedBlueprintId);
  });

  // Quick Save button click -> saves automatically to "Quick Save" blueprint
  $("btn-quick-save")?.addEventListener("click", autoQuickSave);

  // Cancel button -> closes popup
  $("btn-cancel")?.addEventListener("click", () => {
    if (typeof window !== "undefined" && window.close) {
      window.close();
    }
  });

  // Search filter
  $("blueprint-search")?.addEventListener("input", (e) => handleSearch(e.target.value));
  $("search-clear")?.addEventListener("click", () => {
    $("blueprint-search").value = "";
    renderBlueprintList(currentBlueprints);
    $("search-clear").classList.add("hidden");
  });

  // Options settings icon
  $("btn-open-options")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  // Sign in button
  $("btn-sign-in")?.addEventListener("click", () => {
    const btn = $("btn-sign-in");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Opening PromptVault...";
    }
    sendMsg("OPEN_LOGIN");
  });

  // Initialize popup
  init();
});
