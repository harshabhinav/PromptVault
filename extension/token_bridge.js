/**
 * PromptVault Token Bridge
 * Injected on localhost:3000 only.
 * Reads the JWT from localStorage and passes it to the extension.
 * Supports real-time login, logout, and account switches.
 */
(function () {
  const TOKEN_KEY = "promptvault_token";

  function updateStatus(token) {
    try {
      const isConnected = !!token;
      document.documentElement.setAttribute("data-pv-extension-installed", "true");
      document.documentElement.setAttribute("data-pv-extension-connected", isConnected ? "true" : "false");
      window.__pvExtensionInstalled = true;
      window.__pvExtensionConnected = isConnected;
      
      window.dispatchEvent(new CustomEvent("pv-extension-status", {
        detail: { installed: true, connected: isConnected }
      }));
    } catch (e) {}
  }

  function syncToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    updateStatus(token);
    
    chrome.runtime.sendMessage({ type: "SET_TOKEN", token: token || null }, (res) => {
      if (chrome.runtime.lastError) {
        // Context invalidated or extension not installed — ignore
      }
    });
  }

  // Initial sync on script load
  syncToken();

  // Listen for storage events (captures dashboard logouts/logins in other tabs)
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY) {
      syncToken();
    }
  });

  // Periodically check token as fallback for same-tab updates
  setInterval(syncToken, 2000);
})();
