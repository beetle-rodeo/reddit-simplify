(() => {
  "use strict";

  (() => {
    // Set up Chrome/Firefox API compatibility
    let storage, api = chrome;

    // Helper: Retrieve settings from storage (sync preferred, fallback to local)
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

    // Pick API and storage type
    if (typeof browser === "object" && typeof browser.runtime === "object") {
      api = browser;
    }
    storage = api.storage.local;
    if (typeof api.storage.sync === "object") {
      storage = api.storage.sync;
    }
    const extensionApi = api;
    const root = document.documentElement;

// --- Ensures re-injection if turning extension off and on ---
function ensureInjected() {
  if (!document.getElementById("reddit-simplify")) {
    const script = document.createElement("script");
    script.src = extensionApi.runtime.getURL("js/reddit-simplify.js");
    script.id = "reddit-simplify";
    root.appendChild(script);
  }
}

    /**
     * Helper: Apply "hide" attributes to the HTML root based on settings.
     * Example: Sets 'hide_comments', 'hide_sidebar', etc., as attributes.
     * @param {Object} settings
     */
    function applyHideAttributes(settings) {
      Object.keys(settings).forEach((key) => {
        if (key.indexOf("hide") !== -1) {
          root.setAttribute(key, settings[key]);
        }
      });
    }

    /**
     * On extension "on" state, apply attributes and inject the main script.
     * @param {Object} settings
     */
    function enableReddSimp(settings) {
      if (settings.redd_on === true) {
        applyHideAttributes(settings);
       // Inject the main extension script into the page (reddit-simplify.js)
        ensureInjection();
      }
      }


    /**
     * Remove all "hide*" attributes from the HTML root.
     * @param {Object} settings
     */
    function removeHideAttributes(settings) {
      Object.keys(settings).forEach((key) => {
        if (key.indexOf("hide") !== -1) {
          root.removeAttribute(key);
        }
      });
    }

    /**
     * Main runner: Get settings, apply attributes, inject script,
     * and set up a listener for storage changes.
     */
    function runReddSimp() {
      // Initial run: load and apply
      getFromStorage(enableReddSimp);

      // Listen for changes to extension settings and update page instantly
      extensionApi.storage.onChanged.addListener((changes) => {
        // If extension on/off changed
        if (Object.prototype.hasOwnProperty.call(changes, "redd_on")) {
          if (changes.redd_on.newValue) {
            getFromStorage(applyHideAttributes);
            ensureInjected();
          } else {
            getFromStorage(removeHideAttributes);
          }
        } else {
          // For any other "hide*" option, update attribute on the fly
          Object.keys(changes).forEach((key) => {
            if (key.indexOf("hide") !== -1) {
              root.setAttribute(key, changes[key].newValue);
            }
          });
        }
      });
    }

    // Only run once per document
    if (!document.reddsimpRunning) {
      document.reddsimpRunning = true;
      // If not in an iframe, run now. If in an iframe, wait for DOMContentLoaded and for the player to exist.
      if (window === window.parent) {
        runReddSimp();
      } else {
        window.addEventListener("DOMContentLoaded", () => {
          if (document.getElementById("player")) {
            runReddSimp();
          }
        });
      }
    }
  })();
})();
