/**
 * PromptVault Application Configuration
 */

// Chrome Web Store official extension URL (Configurable for local dev vs production)
export const PROMPTVAULT_EXTENSION_STORE_URL = "https://chromewebstore.google.com/";

// GitHub Release distribution (free, "Load unpacked" install).
// DOWNLOAD_URL always resolves to the asset named PromptVault-Extension.zip on the latest release,
// so it only works once a release with that asset has been published.
export const PROMPTVAULT_EXTENSION_RELEASES_URL = "https://github.com/harshabhinav/PromptVault/releases/latest";
export const PROMPTVAULT_EXTENSION_DOWNLOAD_URL = `${PROMPTVAULT_EXTENSION_RELEASES_URL}/download/PromptVault-Extension.zip`;
