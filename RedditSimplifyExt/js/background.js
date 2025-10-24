(() => {
  "use strict";

  // Set up Chrome/Firefox compatibility for APIs
  let storage, api = chrome;

  /**
   * Helper: Get from storage (sync preferred, fallback to local)
   * @param {Function} callback
   * @param {Array|null} keys
   * @param {Array} extraArgs
   */
  function getFromStorage(callback, keys = null, extraArgs = []) {
    storage.get(keys, (result) => {
      if (api.runtime.lastError) {
        storage = api.storage.local;
        storage.get(keys, (fallbackResult) => {
          callback(fallbackResult, ...extraArgs);
        });
      } else {
        callback(result, ...extraArgs);
      }
    });
  }

  /**
   * Helper: Set to storage with fallback
   * @param {Object} obj
   */
  function setToStorage(obj) {
    storage.set(obj, () => {
      if (api.runtime.lastError) {
        storage = api.storage.local;
        storage.set(obj);
      }
    });
  }

  // Use Firefox's API if available
  if (typeof browser === "object" && typeof browser.runtime === "object") {
    api = browser;
  }
  storage = api.storage.local;
  if (typeof api.storage.sync === "object") {
    storage = api.storage.sync;
  }


  // Use MV3 'action' when available; fall back to 'browserAction' (Firefox/MV2)
  const actionApi = (api.action && typeof api.action.setIcon === "function")
    ? api.action
    : api.browserAction;



  // Extension default settings (shown on first install)
  const DEFAULT_SETTINGS = {
    hide_header: false,
    hide_nav_bar: false,
    hide_nav_new_user: true,
    hide_sidebar_contents: false,
    hide_post_avatar: false,
    hide_share_button: true,
    hide_comment_search_sort: false,
    hide_comment_avatar: false,
    hide_comment_react: false,
    hide_comment_age: false,
    hide_award: true,
    hide_promoted: true,
    hide_auto_search: true,
    hide_trending_topics: true,
    hide_app_nags: true,
    hide_promo_modules: false,
    hide_recirc_modules: false,
    hide_create_post_box: true,
    hide_community_spotlights: true,
    hide_happening_now: false,
    hide_geolocation: false,
    redd_on: true, // Extension enabled by default
    popup_settings: {
      dark_mode: false,
      tree_states: {
        tree_everywhere: false,
        tree_front_search: false,
        tree_thread: false
      }
      }
    };

    /**
     * Change the extension's icon (on/off state)
     * @param {boolean} enabled
     */
    function setIcon(enabled) {
      const offSuffix = enabled ? "" : "-off";
  actionApi.setIcon({
    path: {
      16: `images/icon${offSuffix}-16.png`,
      32: `images/icon${offSuffix}-32.png`,
      48: `images/icon${offSuffix}-48.png`,
      128: `images/icon${offSuffix}-128.png`
    }
  });
}

  // On install, open welcome page
  api.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    api.tabs.create({ url: "https://beetle.rodeo" });
  }
});

// Set uninstall survey page
api.runtime.setUninstallURL("https://beetle.rodeo");

// Settings cache for fast lookup
let state = {
  hide_header: false,
  hide_nav_bar: false,
  hide_sidebar_contents: false,
  hide_comment_search_sort: false,
  hide_promoted: true,
  redd_on: true
};
const watchKeys = Object.keys(state);

/**
 * Update state cache from storage for fast lookup in URL redirect
 */
function updateStateCache() {
  getFromStorage((data) => { state = data; }, watchKeys);
}

/**
 * Redirect the user to a given URL in the current tab
 * @param {string} url
 * @param {number} tabId
 */
function redirect(url, tabId) {
  api.tabs.update(tabId, { url: url });
}

/**
 * On extension load, initialize settings and set icon
 * (Runs only once when extension starts or settings need to be synced)
 */
getFromStorage(function (storedSettings) {
  const numSettings = Object.keys(storedSettings).length;

  // First install: no settings in storage, so set defaults
  if (numSettings === 0) {
    setToStorage(DEFAULT_SETTINGS);

    // If settings schema mismatches (update or corruption), reset settings
  } else if (
    numSettings !== Object.keys(DEFAULT_SETTINGS).length ||
    Object.keys(DEFAULT_SETTINGS).some(key => !Object.prototype.hasOwnProperty.call(storedSettings, key)) ||
    Object.keys(storedSettings.popup_settings).length !== Object.keys(DEFAULT_SETTINGS.popup_settings).length
  ) {
    // Merge in current values where possible
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(storedSettings, key)) {
        if (typeof DEFAULT_SETTINGS[key] === "boolean") {
          DEFAULT_SETTINGS[key] = storedSettings[key];
        } else {
          Object.keys(DEFAULT_SETTINGS[key]).forEach(subKey => {
            if (Object.prototype.hasOwnProperty.call(storedSettings[key], subKey)) {
              DEFAULT_SETTINGS[key][subKey] = storedSettings[key][subKey];
            }
          });
        }
      }
    });
    storage.clear(() => {
      if (api.runtime.lastError) {
        storage = api.storage.local;
        storage.clear();
      }
    });
    setToStorage(DEFAULT_SETTINGS);
  }

  // Set icon (on/off)
  setIcon(storedSettings.redd_on || DEFAULT_SETTINGS.redd_on);

});

// Keep state cache up to date
updateStateCache();

// Listen for changes in main feature toggles, and update cache + icon
api.storage.onChanged.addListener(changes => {
  for (let i = 0; i < watchKeys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(changes, watchKeys[i])) {
      if (watchKeys[i] === "redd_on") {
        setIcon(changes.redd_on.newValue);
      }
      updateStateCache();
      break;
    }
  }
});

// Handle "reset to defaults" from the popup
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "reset_to_defaults") {
    // Clear then set defaults to ensure schema is fresh
    storage.clear(() => {
      if (api.runtime.lastError) {
        storage = api.storage.local;
        storage.clear(() => { });
      }
      setToStorage(DEFAULT_SETTINGS);
      setIcon(DEFAULT_SETTINGS.redd_on);
      sendResponse({ ok: true });
    });
    return true; // async response
  }
});



}) ();
