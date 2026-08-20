"use strict";

const DEFAULT_API_BASE = "http://localhost:8000/api";

const apiBaseInput = document.getElementById("api-base");
const statusMsg = document.getElementById("status-msg");

// Load saved settings
chrome.storage.local.get(["pv_api_base"], (result) => {
  apiBaseInput.value = result.pv_api_base || DEFAULT_API_BASE;
});

function showStatus(msg, type = "success") {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  statusMsg.style.display = "block";
  setTimeout(() => { statusMsg.style.display = "none"; }, 3000);
}

document.getElementById("btn-save").addEventListener("click", () => {
  const val = apiBaseInput.value.trim();
  if (!val) {
    showStatus("URL cannot be empty.", "error");
    return;
  }
  try {
    new URL(val);
  } catch {
    showStatus("Please enter a valid URL.", "error");
    return;
  }
  chrome.storage.local.set({ pv_api_base: val }, () => {
    showStatus("Settings saved successfully.");
  });
});

document.getElementById("btn-reset").addEventListener("click", () => {
  apiBaseInput.value = DEFAULT_API_BASE;
  chrome.storage.local.set({ pv_api_base: DEFAULT_API_BASE }, () => {
    showStatus("Reset to default.");
  });
});
