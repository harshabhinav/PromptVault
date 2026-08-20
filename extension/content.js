/**
 * PromptVault Content Script — Real Prompt Extractor & Platform Detector
 * Supports ChatGPT, Claude, Gemini, Perplexity, and Grok.
 */

(function () {
  "use strict";

  if (window.__pvContentInjected) return;
  window.__pvContentInjected = true;

  // ── Supported AI Platforms ──────────────────────────────────────────────────

  const PLATFORMS = {
    chatgpt: {
      name: "ChatGPT",
      match: /chat\.openai\.com|chatgpt\.com/,
      selectors: [
        "#prompt-textarea",
        "textarea[data-id='prompt-textarea']",
        "textarea[placeholder*='Message']",
        "div[contenteditable='true'][data-placeholder]",
        "div[contenteditable='true']"
      ]
    },
    claude: {
      name: "Claude",
      match: /claude\.ai/,
      selectors: [
        "div[contenteditable='true'].ProseMirror",
        "div[contenteditable='true']",
        "textarea"
      ]
    },
    gemini: {
      name: "Gemini",
      match: /gemini\.google\.com/,
      selectors: [
        "rich-textarea .ql-editor",
        ".ql-editor[contenteditable='true']",
        "textarea",
        "div[contenteditable='true']"
      ]
    },
    perplexity: {
      name: "Perplexity",
      match: /perplexity\.ai/,
      selectors: [
        "textarea[placeholder*='Ask']",
        "textarea",
        "div[contenteditable='true']"
      ]
    },
    grok: {
      name: "Grok",
      match: /grok\.com|x\.com\/i\/grok/,
      selectors: [
        "textarea[placeholder*='Ask']",
        "textarea",
        "div[contenteditable='true']",
        "div[data-testid='grok-composer']"
      ]
    }
  };

  // Detect platform
  const hostname = window.location.hostname;
  const currentPlatform = Object.values(PLATFORMS).find((p) => p.match.test(hostname)) || {
    name: "Web Platform",
    selectors: ["textarea", "div[contenteditable='true']"]
  };

  // ── State Management ────────────────────────────────────────────────────────

  let lastSubmittedPrompt = "";
  let activePromptText = "";
  
  // Throttle updates to avoid spamming CustomEvents
  let updateTimeout = null;

  function extractComposerText() {
    let text = "";
    for (const sel of currentPlatform.selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      text = el.value || el.innerText || el.textContent || "";
      if (text.trim()) break;
    }
    return text.trim();
  }

  function resolveAndDispatch() {
    const currentText = extractComposerText();

    const newActive = currentText || lastSubmittedPrompt;

    if (newActive !== activePromptText) {
      activePromptText = newActive;
      
      // Dispatch live update for widget.js
      window.dispatchEvent(new CustomEvent("pv-prompt-updated", { 
        detail: window.getCurrentPrompt() 
      }));
    }
  }

  function scheduleUpdate() {
    if (updateTimeout) cancelAnimationFrame(updateTimeout);
    updateTimeout = requestAnimationFrame(() => resolveAndDispatch());
  }

  // ── Event Listeners ─────────────────────────────────────────────────────────

  // Detect typing (BEFORE SEND)
  document.addEventListener("input", scheduleUpdate, { capture: true, passive: true });
  document.addEventListener("keyup", scheduleUpdate, { capture: true, passive: true });

  // Detect Submission (AFTER SEND)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const currentText = extractComposerText();
      if (currentText) {
        lastSubmittedPrompt = currentText;
        scheduleUpdate();
      }
    }
  }, { capture: true, passive: true });

  document.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (target) {
      const aria = (target.getAttribute("aria-label") || "").toLowerCase();
      const hasSvg = target.querySelector("svg") !== null;
      // Heuristic to detect send buttons
      if (aria.includes("send") || aria.includes("message") || hasSvg) {
        const currentText = extractComposerText();
        if (currentText) {
          lastSubmittedPrompt = currentText;
          scheduleUpdate();
        }
      }
    }
  }, { capture: true, passive: true });


  /**
   * Prompt Extraction API
   * returns { text: "", platform: "", url: "", timestamp: "" }
   */
  window.getCurrentPrompt = function getCurrentPrompt() {
    const currentText = extractComposerText();
    const finalPrompt = currentText || lastSubmittedPrompt;

    return {
      text: finalPrompt,
      platform: currentPlatform.name,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  };

  // ── Inject Floating Trigger Pill ────────────────────────────────────────────

  function createSaveButton() {
    if (document.getElementById("pv-save-btn")) return;

    const btn = document.createElement("button");
    btn.id = "pv-save-btn";
    btn.className = "pv-save-btn";
    btn.setAttribute("title", "Save to PromptVault");
    btn.innerHTML = `
      <img src="${chrome.runtime.getURL('pv-logo.png')}" class="pv-icon-logo" style="width: 15px; height: 15px; object-fit: contain; flex-shrink: 0;" alt="Logo" />
      <span>Save to PromptVault</span>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      resolveAndDispatch(); // force latest state
      const promptData = window.getCurrentPrompt();

      // Store in chrome.storage.local for popup sync
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          pv_pending_prompt: promptData.text,
          pv_source_site: promptData.platform
        });
      }

      // Open floating in-page glass widget if loaded
      if (typeof window.openPromptVaultWidget === "function") {
        window.openPromptVaultWidget(promptData);
      } else if (typeof window.openPromptVaultPopup === "function") {
        window.openPromptVaultPopup(promptData.text);
      }
    });

    document.body.appendChild(btn);
  }

  // DOM Observer for input readiness
  let injected = false;
  const observer = new MutationObserver(() => {
    if (injected) return;
    const hasInput = currentPlatform.selectors.some((sel) => document.querySelector(sel));
    if (hasInput) {
      createSaveButton();
      injected = true;
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const hasInput = currentPlatform.selectors.some((sel) => document.querySelector(sel));
  if (hasInput) {
    createSaveButton();
    injected = true;
    observer.disconnect();
  }

})();
