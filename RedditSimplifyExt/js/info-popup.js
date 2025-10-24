(() => {
  "use strict";

  (() => {
    // Set up variables for Chrome or Firefox extension APIs
    let storage, api = chrome;

    // Compatibility: Use Firefox's 'browser' API if available
    if (typeof browser === "object" && typeof browser.runtime === "object") {
      api = browser;
    }

    // By default, use local storage; use sync if available
    storage = api.storage.local;
    if (typeof api.storage.sync === "object") {
      storage = api.storage.sync;
    }

    /**
     * Function to get a value from storage, with fallback to local storage on error
     * @param {Function} callback - function to run with retrieved values
     * @param {Array|null} keys - keys to retrieve
     * @param {Array} extraArgs - any additional arguments for callback
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

    // Load settings and set 'dark_mode' attribute on the HTML root accordingly
    getFromStorage(
      function (result) {
        document.documentElement.setAttribute(
          "dark_mode",
          result.popup_settings.dark_mode
        );
      },
      ["popup_settings"]
    );
  })();
})();
