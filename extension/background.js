/**
 * PromptVault Extension — Background Service Worker
 * Handles real-time authentication, session isolation, and backend proxy routing.
 */

console.log("[PromptVault] Extension initialized");

const DEFAULT_API_BASE = "http://localhost:8000/api";

// ── Storage Helpers ───────────────────────────────────────────────────────────

async function getApiBase() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pv_api_base"], (result) => {
      resolve(result.pv_api_base || DEFAULT_API_BASE);
    });
  });
}

async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pv_token"], (result) => {
      resolve(result.pv_token || null);
    });
  });
}

async function setToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pv_token: token }, resolve);
  });
}

async function getActiveUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pv_active_user_id"], (result) => {
      resolve(result.pv_active_user_id || null);
    });
  });
}

async function setActiveUserId(userId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pv_active_user_id: userId }, resolve);
  });
}

// ── API Fetch Wrapper ─────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const [apiBase, token] = await Promise.all([getApiBase(), getToken()]);
  const url = `${apiBase}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error("[PromptVault] Network / Fetch error:", err);
    return { ok: false, status: 0, data: { detail: "Unable to connect to PromptVault backend." } };
  }
}

// ── Authenticated User Verification ───────────────────────────────────────────

async function checkAuth() {
  const token = await getToken();
  if (!token) return { authenticated: false, user: null };

  const { ok, data } = await apiFetch("/me");
  if (ok && data.id) {
    return { authenticated: true, user: data };
  }
  // Clear if expired
  await handleSetToken(null);
  return { authenticated: false, user: null };
}

// ── Session Switch Logic ──────────────────────────────────────────────────────

async function handleSetToken(token) {
  const previousUserId = await getActiveUserId();

  if (!token) {
    console.log("[PromptVault] Auth state changed");
    console.log("[PromptVault] Previous user:", previousUserId);
    console.log("[PromptVault] Current user: null");
    console.log("[PromptVault] Clearing previous user state");

    await setToken(null);
    await setActiveUserId(null);

    await new Promise((resolve) => {
      chrome.storage.local.remove(["lastBlueprintId", "last_selected_blueprint_id"], resolve);
    });

    return { success: true, authenticated: false, userChanged: true };
  }

  const apiBase = await getApiBase();
  const url = `${apiBase}/me`;

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (res.ok) {
      const user = await res.json();
      const currentUserId = user.id;

      console.log("[PromptVault] Auth state changed");
      console.log("[PromptVault] Previous user:", previousUserId);
      console.log("[PromptVault] Current user:", currentUserId);

      let userChanged = false;
      if (previousUserId !== currentUserId) {
        userChanged = true;
        console.log("[PromptVault] User changed");
        console.log("[PromptVault] Clearing previous user state");

        await new Promise((resolve) => {
          chrome.storage.local.remove(["lastBlueprintId", "last_selected_blueprint_id"], resolve);
        });
      }

      await setToken(token);
      await setActiveUserId(currentUserId);
      console.log("[PromptVault] Active user verified");

      return { success: true, authenticated: true, userId: currentUserId, userChanged };
    }
  } catch (err) {
    console.error("[PromptVault] Failed to verify switch token:", err);
  }

  // Revert / Invalid state
  await setToken(null);
  await setActiveUserId(null);
  return { success: false, authenticated: false };
}

// ── Real Database Blueprint Loading ───────────────────────────────────────────

async function loadUserBlueprints() {
  const currentUserId = await getActiveUserId();
  console.log("[PromptVault] Loading blueprints for current user:", currentUserId);
  
  const { ok, status, data } = await apiFetch("/extension/blueprints");

  if (!ok) {
    console.error("[PromptVault] Failed to load blueprints, status:", status);
    return { success: false, blueprints: [], error: data.detail || "Unable to load blueprints" };
  }

  const blueprints = (Array.isArray(data) ? data : []).map((bp) => {
    const latestVerNum = bp.version_count || bp.latest_version || 1;
    return {
      id: bp.id,
      name: bp.name,
      version: `V${latestVerNum}`,
      version_number: latestVerNum,
      updated_at: bp.updated_at || bp.created_at || new Date().toISOString()
    };
  });

  console.log("[PromptVault] Blueprints loaded:", blueprints.length);
  return { success: true, blueprints };
}

// ── Real Database Save & Version Creation ─────────────────────────────────────

async function savePromptVersion(payload) {
  const promptText = (payload.prompt_text || payload.system_prompt || "").trim();

  if (!promptText) {
    console.warn("[PromptVault] Save failed: Empty prompt text");
    return { success: false, error: "Prompt text cannot be empty." };
  }

  const blueprintId = payload.blueprint_id ? parseInt(payload.blueprint_id) : null;
  const blueprintName = payload.blueprint_name ? payload.blueprint_name.trim() : (blueprintId ? null : "Quick Save");

  console.log("[PromptVault] Single-request Quick Save starting...", { blueprintId, blueprintName });

  const { ok, status, data } = await apiFetch("/quick-save", {
    method: "POST",
    body: JSON.stringify({
      blueprint_id: blueprintId,
      blueprint_name: blueprintName,
      system_prompt: promptText,
      source_site: payload.platform || payload.source_site || "Extension"
    })
  });

  if (ok && (data.success || data.version_number)) {
    const verNum = data.version_number || 1;
    const verLabel = `V${verNum}`;
    console.log("[PromptVault] Quick Save successful:", verLabel);
    return {
      success: true,
      version: verLabel,
      version_number: verNum,
      blueprint_id: data.blueprint_id,
      blueprint_name: data.blueprint_name
    };
  }

  if (status === 401) {
    // Expired or invalid token: clear it so the UI prompts for a fresh sign-in
    await handleSetToken(null);
    return { success: false, error: "Session expired. Please sign in to PromptVault." };
  }

  console.error("[PromptVault] Save failed:", data.detail);
  return { success: false, error: data.detail || "Save failed. Please try again." };
}


async function openLoginTab() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        const existingTab = (tabs || []).find((t) =>
          t.url && (t.url.includes("localhost:3000") || t.url.includes("127.0.0.1:3000"))
        );

        if (existingTab && existingTab.id) {
          chrome.tabs.update(existingTab.id, { url: "http://localhost:3000/login", active: true }, () => {
            if (existingTab.windowId) {
              chrome.windows.update(existingTab.windowId, { focused: true });
            }
            resolve({ success: true, reused: true });
          });
        } else {
          chrome.tabs.create({ url: "http://localhost:3000/login", active: true }, () => {
            resolve({ success: true, reused: false });
          });
        }
      });
    } else {
      resolve({ success: false });
    }
  });
}

// ── Message Listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case "CHECK_AUTH":
        return await checkAuth();

      case "GET_BLUEPRINTS":
        return await loadUserBlueprints();

      case "SAVE_VERSION":
      case "QUICK_SAVE":
        return await savePromptVersion(message.payload || {});

      case "SET_TOKEN":
        return await handleSetToken(message.token);

      case "OPEN_LOGIN":
        return await openLoginTab();

      default:
        return { error: "Unknown message type" };
    }
  };

  handle().then(sendResponse).catch((err) => {
    console.error("[PromptVault] Background exception:", err);
    sendResponse({ success: false, error: err.message });
  });

  return true; // Keep async response channel open
});
