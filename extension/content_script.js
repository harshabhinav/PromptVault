/**
 * PromptVault Content Script
 * Injects floating trigger on supported AI platforms and invokes in-page floating glass panel.
 */

(function () {
  "use strict";

  if (window.__pvInjected) return;
  window.__pvInjected = true;

  // ── Site Detection ──────────────────────────────────────────────────────────

  const SITES = {
    chatgpt: {
      name: "ChatGPT",
      match: /chat\.openai\.com|chatgpt\.com/,
      selectors: [
        "#prompt-textarea",
        "textarea[data-id='prompt-textarea']",
        "textarea[placeholder*='Message']",
        "div[contenteditable='true'][data-placeholder]",
      ],
    },
    claude: {
      name: "Claude",
      match: /claude\.ai/,
      selectors: [
        "div[contenteditable='true'].ProseMirror",
        "div[contenteditable='true']",
        "textarea",
      ],
    },
    gemini: {
      name: "Gemini",
      match: /gemini\.google\.com/,
      selectors: [
        "rich-textarea .ql-editor",
        ".ql-editor[contenteditable='true']",
        "textarea",
        "div[contenteditable='true']",
      ],
    },
    perplexity: {
      name: "Perplexity",
      match: /perplexity\.ai/,
      selectors: [
        "textarea[placeholder*='Ask']",
        "textarea",
        "div[contenteditable='true']",
      ],
    },
    grok: {
      name: "Grok",
      match: /grok\.com|x\.com\/i\/grok/,
      selectors: [
        "textarea[placeholder*='Ask']",
        "textarea",
        "div[contenteditable='true']",
        "div[data-testid='grok-composer']",
      ],
    },
  };

  const hostname = window.location.hostname;
  const currentSite = Object.values(SITES).find((s) => s.match.test(hostname));
  if (!currentSite) return;

  // ── Extract Prompt Text ─────────────────────────────────────────────────────

  function extractPromptText() {
    for (const sel of currentSite.selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = el.value || el.innerText || el.textContent || "";
      if (text.trim()) return text.trim();
    }
    return "";
  }

  // ── Create Floating Save Pill Trigger ──────────────────────────────────────

  function createSaveButton() {
    if (document.getElementById("pv-save-btn")) return;

    const btn = document.createElement("button");
    btn.id = "pv-save-btn";
    btn.className = "pv-save-btn";
    btn.setAttribute("title", "Save to PromptVault");
    btn.innerHTML = `
      <svg class="pv-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="7 3 7 8 15 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Save to PromptVault</span>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const promptText = extractPromptText();
      
      // Store in storage
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          pv_pending_prompt: promptText,
          pv_source_site: currentSite.name,
        });
      }

      // Invoke floating glass panel if loaded
      if (typeof window.openPromptVaultPopup === "function") {
        window.openPromptVaultPopup(promptText);
      } else if (window.promptVaultPanel && typeof window.promptVaultPanel.openPromptVaultPopup === "function") {
        window.promptVaultPanel.openPromptVaultPopup(promptText);
      }
    });

    document.body.appendChild(btn);
    return btn;
  }

  // ── DOM Observer ─────────────────────────────────────────────────────────────

  let injected = false;
  const observer = new MutationObserver(() => {
    if (injected) return;
    const hasInput = currentSite.selectors.some((sel) => document.querySelector(sel));
    if (hasInput) {
      createSaveButton();
      injected = true;
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const hasInput = currentSite.selectors.some((sel) => document.querySelector(sel));
  if (hasInput) {
    createSaveButton();
    injected = true;
    observer.disconnect();
  }

})();
