/**
 * PromptVault Floating Widget Component Script
 *
 * Implements:
 * 1. Read-only Prompt Preview box.
 * 2. Draggable floating panel from the header handle (pointer events + requestAnimationFrame).
 * 3. Position storage using chrome.storage.local.
 * 4. Real-time blueprint loading with zero mock data.
 */

class PromptVaultWidget {
  constructor() {
    this.containerId = "promptvault-panel-root";
    this.hostElement = null;
    this.shadowRoot = null;
    
    // State
    this.blueprints = []; 
    this.selectedBlueprintId = null;
    this.currentPrompt = null; // { text, platform, url, timestamp }
    this.isOpen = false;

    // Draggable State
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.panelStartX = 0;
    this.panelStartY = 0;
    this.dragDistance = 0;

    this.init();
  }

  /**
   * Initializes Shadow DOM container and mounts stylesheet & HTML layout
   */
  async init() {
    if (document.getElementById(this.containerId)) {
      this.hostElement = document.getElementById(this.containerId);
      this.shadowRoot = this.hostElement.shadowRoot;
      return;
    }

    // Create Host Element with isolation style
    this.hostElement = document.createElement("div");
    this.hostElement.id = this.containerId;
    this.hostElement.style.cssText = "position: fixed; z-index: 2147483647; pointer-events: none;";
    document.body.appendChild(this.hostElement);

    // Attach Shadow Root
    this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });

    // Load widget stylesheet
    try {
      const cssUrl = chrome.runtime.getURL("widget.css");
      const res = await fetch(cssUrl);
      const cssText = await res.text();
      const styleEl = document.createElement("style");
      styleEl.textContent = cssText;
      this.shadowRoot.appendChild(styleEl);
    } catch (e) {
      const linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = chrome.runtime.getURL("widget.css");
      this.shadowRoot.appendChild(linkEl);
    }

    // Load widget HTML Layout
    let htmlContent = "";
    try {
      const htmlUrl = chrome.runtime.getURL("widget.html");
      const res = await fetch(htmlUrl);
      htmlContent = await res.text();
    } catch (e) {
      console.error("[PromptVault] Could not fetch widget.html layout:", e);
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = htmlContent;
    this.shadowRoot.appendChild(wrapper);

    // Dynamic Logo Assignment
    try {
      const logoUrl = chrome.runtime.getURL("pv-logo.png");
      if (this.$("#pv-logo-img")) this.$("#pv-logo-img").src = logoUrl;
      if (this.$("#pv-toast-logo-img")) this.$("#pv-toast-logo-img").src = logoUrl;
    } catch (e) {
      console.warn("[PromptVault] Could not load local logo resource:", e);
    }

    // Restore panel coordinates from local storage
    this.restorePosition();

    // Bind event handlers
    this.bindEvents();
    this.setupDragAndDrop();
  }

  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }

  /**
   * Restores saved x,y coordinates or positions panel in right-center of viewport
   */
  restorePosition() {
    const panel = this.$("#pv-widget-panel");
    if (!panel) return;

    chrome.storage.local.get(["pv_panel_x", "pv_panel_y"], (stored) => {
      const width = 420;
      const height = 480;
      const defaultX = window.innerWidth - width - 28;
      const defaultY = (window.innerHeight - height) / 2;

      let x = stored.pv_panel_x !== undefined ? stored.pv_panel_x : defaultX;
      let y = stored.pv_panel_y !== undefined ? stored.pv_panel_y : defaultY;

      // Keep panel within screen bounds
      x = Math.max(0, Math.min(x, window.innerWidth - width));
      y = Math.max(0, Math.min(y, window.innerHeight - height));

      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    });
  }

  /**
   * Binds shadow DOM event listeners
   */
  bindEvents() {
    this.$("#pv-close-btn")?.addEventListener("click", () => this.closePromptVaultPopup());
    this.$("#pv-cancel-btn")?.addEventListener("click", () => this.closePromptVaultPopup());

    // Search bar listener
    this.$("#pv-search-input")?.addEventListener("input", (e) => {
      const q = e.target.value;
      this.$("#pv-search-clear")?.classList.toggle("pv-hidden", q.length === 0);
      this.searchBlueprints(q);
    });

    this.$("#pv-search-clear")?.addEventListener("click", () => {
      this.$("#pv-search-input").value = "";
      this.$("#pv-search-clear").classList.add("pv-hidden");
      this.searchBlueprints("");
    });

    // New blueprint modal triggers
    this.$("#pv-new-bp-btn")?.addEventListener("click", () => {
      this.$("#pv-modal-overlay")?.classList.remove("pv-hidden");
      this.$("#pv-modal-input").value = "";
      this.$("#pv-modal-create").disabled = true;
      setTimeout(() => this.$("#pv-modal-input")?.focus(), 50);
    });

    this.$("#pv-modal-cancel")?.addEventListener("click", () => {
      this.$("#pv-modal-overlay")?.classList.add("pv-hidden");
    });

    this.$("#pv-modal-input")?.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      this.$("#pv-modal-create").disabled = val.length === 0;
      this.$("#pv-modal-error")?.classList.add("pv-hidden");
    });

    this.$("#pv-modal-create")?.addEventListener("click", () => {
      const name = this.$("#pv-modal-input").value.trim();
      if (name) {
        this.createBlueprint(name);
      }
    });

    this.$("#pv-modal-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const name = this.$("#pv-modal-input").value.trim();
        if (name) {
          this.createBlueprint(name);
        }
      }
    });

    // Save button clicks
    this.$("#pv-quick-save-btn")?.addEventListener("click", () => this.quickSave());
    this.$("#pv-save-btn")?.addEventListener("click", () => this.savePrompt());
    this.$("#pv-retry-load-btn")?.addEventListener("click", () => this.loadBlueprints());

    // Live update listener from content.js
    window.addEventListener("pv-prompt-updated", (e) => {
      if (!this.isOpen) return;
      const promptData = e.detail;
      this.currentPrompt = promptData;

      const previewBox = this.$("#pv-prompt-preview");
      if (previewBox) {
        if (this.currentPrompt && this.currentPrompt.text) {
          previewBox.textContent = this.currentPrompt.text;
        } else {
          previewBox.innerHTML = '<span class="pv-placeholder">No prompt detected</span>';
        }
      }
    });
  }

  /**
   * Smooth 60 FPS panel header dragging using Pointer Capture & requestAnimationFrame
   */
  setupDragAndDrop() {
    const handle = this.$(".pv-header");
    const panel = this.$("#pv-widget-panel");
    if (!handle || !panel) return;

    handle.addEventListener("pointerdown", (e) => {
      // Allow only primary mouse button drags
      if (e.button !== 0) return;
      if (e.target.id === "pv-close-btn") return;

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragDistance = 0;

      const rect = panel.getBoundingClientRect();
      this.panelStartX = rect.left;
      this.panelStartY = rect.top;

      panel.classList.add("pv-dragging");
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.dragStartX;
      const deltaY = e.clientY - this.dragStartY;
      this.dragDistance = Math.max(this.dragDistance, Math.sqrt(deltaX * deltaX + deltaY * deltaY));

      requestAnimationFrame(() => {
        if (!this.isDragging) return;

        let newX = this.panelStartX + deltaX;
        let newY = this.panelStartY + deltaY;

        // Keep panel within screen bounds
        newX = Math.max(0, Math.min(newX, window.innerWidth - panel.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - panel.offsetHeight));

        panel.style.left = `${newX}px`;
        panel.style.top = `${newY}px`;
      });
    });

    handle.addEventListener("pointerup", (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      panel.classList.remove("pv-dragging");
      handle.releasePointerCapture(e.pointerId);

      // Persist coordinate position
      const rect = panel.getBoundingClientRect();
      chrome.storage.local.set({
        pv_panel_x: rect.left,
        pv_panel_y: rect.top
      });

      // Cancel button action/close click checks if user dragged > 8px
      if (this.dragDistance > 8) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  getUserStorageKey(key) {
    if (!this.activeUserId) return key;
    return `promptvault_user_${this.activeUserId}_${key}`;
  }

  /**
   * Opens the widget panel and initiates auth + blueprint loading
   */
  async openPromptVaultPopup(promptTextOrData) {
    if (typeof promptTextOrData === "object" && promptTextOrData !== null) {
      this.currentPrompt = promptTextOrData;
    } else {
      this.currentPrompt = {
        text: (promptTextOrData || "").trim(),
        platform: "Extension",
        url: window.location.href,
        timestamp: new Date().toISOString()
      };
    }

    // Read-only prompt preview box (sets textContent on the div container)
    const previewBox = this.$("#pv-prompt-preview");
    if (previewBox) {
      if (this.currentPrompt.text) {
        previewBox.textContent = this.currentPrompt.text;
      } else {
        previewBox.innerHTML = '<span class="pv-placeholder">No prompt detected</span>';
      }
    }

    // Refresh positioning in case viewport dimensions changed
    this.restorePosition();

    const overlay = this.$("#pv-widget-overlay");
    const panel = this.$("#pv-widget-panel");

    overlay.classList.remove("pv-hidden");
    this.isOpen = true;

    requestAnimationFrame(() => {
      panel.classList.add("pv-open");
    });

    // Verify authentication
    chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (res) => {
      if (chrome.runtime.lastError || !res?.authenticated) {
        this.activeUserId = null;
        this.$("#pv-blueprints-loading")?.classList.add("pv-hidden");
        this.showToastError("Auth Required", "Opening PromptVault Login...");
        chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
        this.closePromptVaultPopup();
        return;
      }

      this.activeUserId = res.user.id;
      // Load user blueprints
      this.loadBlueprints();
    });
  }

  /**
   * Closes the widget panel with scale transitions
   */
  closePromptVaultPopup() {
    const overlay = this.$("#pv-widget-overlay");
    const panel = this.$("#pv-widget-panel");

    panel.classList.remove("pv-open");
    this.isOpen = false;

    setTimeout(() => {
      if (!this.isOpen) {
        overlay.classList.add("pv-hidden");
      }
    }, 250);
  }

  /**
   * Loads user blueprints from database
   */
  async loadBlueprints() {
    console.log("[PromptVault] Loading blueprints for current user");
    this.$("#pv-blueprints-loading").classList.remove("pv-hidden");
    this.$("#pv-blueprints-error").classList.add("pv-hidden");
    this.$("#pv-blueprints-empty").classList.add("pv-hidden");
    this.$("#pv-blueprint-list").classList.add("pv-hidden");

    chrome.runtime.sendMessage({ type: "GET_BLUEPRINTS" }, (res) => {
      this.$("#pv-blueprints-loading").classList.add("pv-hidden");

      if (chrome.runtime.lastError || !res || res.success === false) {
        console.error("[PromptVault] Failed to load blueprints:", chrome.runtime.lastError || res?.error);
        this.$("#pv-blueprints-error").classList.remove("pv-hidden");
        return;
      }

      this.blueprints = Array.isArray(res.blueprints) ? res.blueprints : [];
      console.log("[PromptVault] Blueprints loaded:", this.blueprints.length);

      if (this.blueprints.length === 0) {
        this.$("#pv-blueprints-empty").classList.remove("pv-hidden");
        return;
      }

      // Restore last selected OR set to null if it does not exist
      const bpKey = this.getUserStorageKey("lastBlueprintId");
      const bpKeyLegacy = this.getUserStorageKey("last_selected_blueprint_id");

      chrome.storage.local.get([bpKey, bpKeyLegacy], (stored) => {
        let defaultId = stored[bpKey] || stored[bpKeyLegacy] || null;
        if (defaultId) {
          const exists = this.blueprints.some((b) => b.id === defaultId);
          if (!exists) {
            defaultId = null;
          }
        }
        
        // Restore last selected, or set to null if it does not exist (do not auto-select first blueprint)
        this.selectedBlueprintId = defaultId;
        this.$("#pv-save-btn").disabled = false;
        
        this.renderBlueprintList(this.blueprints);
      });
    });
  }

  /**
   * Renders dynamic blueprint list cards
   */
  renderBlueprintList(items) {
    const list = this.$("#pv-blueprint-list");
    list.innerHTML = "";
    list.classList.remove("pv-hidden");

    if (items.length === 0) {
      list.innerHTML = `<div style="padding: 16px; text-align: center; color: #64748b; font-size: 12px;">No blueprints match search.</div>`;
      return;
    }

    items.forEach((bp) => {
      const card = document.createElement("div");
      card.className = `pv-bp-card ${String(bp.id) === String(this.selectedBlueprintId) ? "pv-selected" : ""}`;
      card.dataset.id = bp.id;

      card.innerHTML = `
        <span class="pv-bp-icon">📁</span>
        <div class="pv-bp-info">
          <div class="pv-bp-name">${this.escapeHtml(bp.name)}</div>
          <div class="pv-bp-meta">Updated ${this.formatDate(bp.updated_at)} • ${bp.version}</div>
        </div>
      `;

      card.addEventListener("click", () => this.selectBlueprint(bp.id));
      list.appendChild(card);
    });
  }

  /**
   * Filters the blueprint list locally
   */
  searchBlueprints(query = "") {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.renderBlueprintList(this.blueprints);
      return;
    }
    const filtered = this.blueprints.filter((bp) => bp.name.toLowerCase().includes(q));
    this.renderBlueprintList(filtered);
  }

  selectBlueprint(id) {
    // Toggle: tapping the already-selected blueprint deselects it
    if (String(this.selectedBlueprintId) === String(id)) {
      this.selectedBlueprintId = null;
      this.$$(".pv-bp-card").forEach((card) => card.classList.remove("pv-selected"));
      this.$("#pv-save-btn").disabled = true;
      console.log("[PromptVault] Blueprint deselected");
      return;
    }

    // Select new blueprint
    this.selectedBlueprintId = id;
    this.$$(".pv-bp-card").forEach((card) => {
      card.classList.toggle("pv-selected", String(card.dataset.id) === String(id));
    });
    this.$("#pv-save-btn").disabled = false;

    console.log("[PromptVault] Blueprint selected:", id);
    const bpKey = this.getUserStorageKey("lastBlueprintId");
    const bpKeyLegacy = this.getUserStorageKey("last_selected_blueprint_id");
    const data = {};
    data[bpKey] = id;
    data[bpKeyLegacy] = id;
    chrome.storage.local.set(data);
  }

  /**
   * POSTs version save request to database
   */
  async savePrompt() {
    if (!this.selectedBlueprintId) {
      this.showToastError("Selection Required", "Select a blueprint to save your prompt.");
      return;
    }

    // Use currentPrompt text directly as prompt preview is read-only
    const promptText = this.currentPrompt ? this.currentPrompt.text : "";

    if (!promptText) {
      this.showToastError("Empty Prompt", "Please enter a prompt to save.");
      return;
    }

    console.log("[PromptVault] Creating version");
    this.setButtonLoading("pv-save-btn", true);

    chrome.runtime.sendMessage({
      type: "SAVE_VERSION",
      payload: {
        blueprint_id: this.selectedBlueprintId,
        prompt_text: promptText,
        platform: this.currentPrompt.platform,
        source_url: this.currentPrompt.url
      }
    }, (res) => {
      this.setButtonLoading("pv-save-btn", false);

      if (chrome.runtime.lastError || !res || !res.success) {
        console.error("[PromptVault] Save failed:", chrome.runtime.lastError || res?.error);
        this.showToastError("Save Failed", "Please try again");
        return;
      }

      console.log("[PromptVault] Saving last blueprint");
      const bpKey = this.getUserStorageKey("lastBlueprintId");
      const bpKeyLegacy = this.getUserStorageKey("last_selected_blueprint_id");
      const data = {};
      data[bpKey] = res.blueprint_id;
      data[bpKeyLegacy] = res.blueprint_id;
      chrome.storage.local.set(data);

      console.log("[PromptVault] Version created successfully");
      this.showToastSuccess(`Prompt saved in ${res.blueprint_name}`, `Version ${res.version}`);
      setTimeout(() => this.closePromptVaultPopup(), 1800);
    });
  }

  async quickSave() {
    const promptText = this.currentPrompt ? this.currentPrompt.text : "";

    if (!promptText) {
      this.showToastError("Empty Prompt", "Please enter a prompt to save.");
      return;
    }

    console.log("[PromptVault] Quick saving to 'Quick Save' blueprint...");
    this.setButtonLoading("pv-quick-save-btn", true);

    chrome.runtime.sendMessage({
      type: "QUICK_SAVE",
      payload: {
        blueprint_name: "Quick Save",
        prompt_text: promptText,
        platform: this.currentPrompt ? this.currentPrompt.platform : "Unknown",
        source_url: this.currentPrompt ? this.currentPrompt.url : ""
      }
    }, (res) => {
      this.setButtonLoading("pv-quick-save-btn", false);

      if (chrome.runtime.lastError || !res || !res.success) {
        console.error("[PromptVault] Quick Save failed:", chrome.runtime.lastError || res?.error);
        const errMsg = res?.error || "Please try again";
        if (errMsg.toLowerCase().includes("sign in") || errMsg.toLowerCase().includes("auth")) {
          this.showToastError("Auth Required", "Please sign in to PromptVault");
        } else {
          this.showToastError("Save Failed", errMsg);
        }
        return;
      }

      console.log("[PromptVault] Quick Save successful");
      this.showToastSuccess("✓ Quick Saved", `Saved to ${res.blueprint_name} (${res.version})`);
      setTimeout(() => this.closePromptVaultPopup(), 1800);
    });
  }

  /**
   * Creates a new blueprint and Version V1 in database
   */
  async createBlueprint(name) {
    const promptText = this.currentPrompt ? this.currentPrompt.text : "";

    if (!promptText) {
      this.showToastError("Empty Prompt", "Please enter a prompt to save.");
      return;
    }

    console.log("[PromptVault] Checking duplicate blueprint");
    this.setButtonLoading("pv-modal-create", true);

    chrome.runtime.sendMessage({
      type: "SAVE_VERSION",
      payload: {
        blueprint_name: name,
        prompt_text: promptText,
        platform: this.currentPrompt.platform,
        source_url: this.currentPrompt.url
      }
    }, (res) => {
      this.setButtonLoading("pv-modal-create", false);

      if (chrome.runtime.lastError || !res || !res.success) {
        console.error("[PromptVault] Save failed:", chrome.runtime.lastError || res?.error);
        const errMsg = res?.error || "";
        if (errMsg.toLowerCase().includes("already exists")) {
          console.log("[PromptVault] Duplicate blueprint detected");
          const modalError = this.$("#pv-modal-error");
          if (modalError) {
            modalError.classList.remove("pv-hidden");
          }
        } else {
          this.showToastError("Save Failed", errMsg || "Please try again");
          this.$("#pv-modal-overlay")?.classList.add("pv-hidden");
        }
        return;
      }

      console.log("[PromptVault] Saving last blueprint");
      const bpKey = this.getUserStorageKey("lastBlueprintId");
      const bpKeyLegacy = this.getUserStorageKey("last_selected_blueprint_id");
      const data = {};
      data[bpKey] = res.blueprint_id;
      data[bpKeyLegacy] = res.blueprint_id;
      chrome.storage.local.set(data);

      console.log("[PromptVault] Version created successfully");
      this.selectedBlueprintId = res.blueprint_id;
      
      this.$("#pv-modal-overlay")?.classList.add("pv-hidden");
      this.showToastSuccess(`Prompt saved in ${res.blueprint_name}`, `Version ${res.version}`);
      setTimeout(() => this.closePromptVaultPopup(), 1800);
    });
  }

  // ── TOAST NOTIFICATIONS ─────────────────────────────────────────────

  showToastSuccess(title, sub) {
    const toast = this.$("#pv-toast");
    toast.className = "pv-toast pv-toast-success";
    this.$("#pv-toast-icon").textContent = "✓";
    this.$("#pv-toast-title").textContent = title;
    this.$("#pv-toast-sub").textContent = sub;
    toast.classList.remove("pv-hidden");
    setTimeout(() => toast.classList.add("pv-hidden"), 2200);
  }

  showToastError(title, sub) {
    const toast = this.$("#pv-toast");
    toast.className = "pv-toast pv-toast-error";
    this.$("#pv-toast-icon").textContent = "⚠";
    this.$("#pv-toast-title").textContent = title;
    this.$("#pv-toast-sub").textContent = sub;
    toast.classList.remove("pv-hidden");
    setTimeout(() => toast.classList.add("pv-hidden"), 2200);
  }

  setButtonLoading(btnId, loading) {
    const btn = this.$(`#${btnId}`);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = `<div class="pv-spinner" style="width:12px;height:12px;border-width:2px;"></div>`;
    } else if (btn.dataset.original) {
      btn.innerHTML = btn.dataset.original;
    }
  }

  formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.max(0, Math.floor(diffMs / 1000));
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) {
        return "Just now";
      }
      if (diffMin < 60) {
        return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
      }
      if (diffHr < 24) {
        return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
      }
      if (diffDay === 1) {
        return "Yesterday";
      }
      return `${diffDay} days ago`;
    } catch {
      return "—";
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}

// Auto-initialize component singleton
window.promptVaultWidget = new PromptVaultWidget();

// Expose public API methods
window.openPromptVaultWidget = (data) => window.promptVaultWidget.openPromptVaultPopup(data);
window.openPromptVaultPopup = (text) => window.promptVaultWidget.openPromptVaultPopup(text);
window.closePromptVaultPopup = () => window.promptVaultWidget.closePromptVaultPopup();
window.searchBlueprints = (q) => window.promptVaultWidget.searchBlueprints(q);
window.selectBlueprint = (id) => window.promptVaultWidget.selectBlueprint(id);
window.createBlueprint = (name) => window.promptVaultWidget.createBlueprint(name);
window.savePrompt = () => window.promptVaultWidget.savePrompt();
window.quickSave = () => window.promptVaultWidget.quickSave();
