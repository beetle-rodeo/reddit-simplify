(() => {
  "use strict";

  // All other flat "hide_*" options
  const hideOptions = [
    "hide_header",
    "hide_nav_bar",
    "hide_nav_new_user",
    "hide_sidebar_contents",
    "hide_share_button",
    "hide_post_avatar",
    "hide_comment_avatar",
    "hide_comment_search_sort",
    "hide_comment_react",
    "hide_comment_age",
    "hide_award",
    "hide_promoted",
    "hide_auto_search",
    "hide_trending_topics",
    "hide_app_nags",
    "hide_promo_modules",
    "hide_recirc_modules",
    "hide_create_post_box",
    "hide_community_spotlights",
    "hide_happening_now",
    "hide_geolocation"
  ];

  // Run on load (immediately invoked function expression)
  (() => {
    // Variables for extension storage
    let storage, chromeApi = chrome;

    /**
     * Helper function to get values from extension storage.
     * Falls back to local storage if sync is not available.
     * @param {Function} callback - called with retrieved data
     * @param {Array|null} keys - keys to retrieve
     * @param {Array} extraArgs - additional args for callback
     */
    function getFromStorage(callback, keys = null, extraArgs = []) {
      storage.get(keys, (result) => {
        // If error, fall back to local storage
        if (chromeApi.runtime.lastError) {
          storage = chromeApi.storage.local;
          storage.get(keys, (fallbackResult) => {
            callback(fallbackResult, ...extraArgs);
          });
        } else {
          callback(result, ...extraArgs);
        }
      });
    }

    /**
     * Helper function to set values to storage, falling back if needed
     * @param {Object} obj - values to store
     */
    function setToStorage(obj) {
      storage.set(obj, () => {
        if (chromeApi.runtime.lastError) {
          storage = chromeApi.storage.local;
          storage.set(obj);
        }
      });
    }

    // Compatibility for Firefox (browser.* API)
    if (typeof browser === "object" && typeof browser.runtime === "object") {
      chromeApi = browser;
    }
    storage = chromeApi.storage.local;
    if (typeof chromeApi.storage.sync === "object") {
      storage = chromeApi.storage.sync;
    }

    // Reference to the root HTML element (for toggling attributes)
    const root = document.documentElement;

    /**
     * Set parent option's state to "indeterminate" if any children are checked.
     * @param {Element} parent - parent element
     */

    function updateParentCheckState(parent) {
      const checks = parent.getElementsByClassName("check");
      if (!checks.length) return;
      const mainCheck = checks[0];
      const childChecks = Array.prototype.slice.call(checks, 1);
      const anyOn = childChecks.some(c => c.checked || c.indeterminate);
      const allOn = childChecks.length > 0 && childChecks.every(c => c.checked);
      // reflect children -> parent
      mainCheck.indeterminate = anyOn && !allOn;
      mainCheck.checked = allOn;
    }

    // Recompute Toggle All's checked/indeterminate state based on real hide_* boxes
    function updateToggleAllState() {
      const allToggle = document.getElementById("toggle_all");
      if (!allToggle) return;
      const states = hideOptions.map(id => !!document.getElementById(id)?.checked);
      const allOn = states.every(Boolean);
      const allOff = states.every(x => !x);
      allToggle.checked = allOn;
      allToggle.indeterminate = !(allOn || allOff);
    }

    // Update the three section master checkboxes to reflect their children
    function updateAllSectionMasters() {
      // Each section is a top-level LI with .check-tree + nested UL
      const sections = Array.from(document.querySelectorAll("#options > ul > li"))
        .filter(li => li.querySelector(".check-tree") && li.querySelector("ul"));
      sections.forEach(li => updateParentCheckState(li));
    }



    // === Persist and restore plus/minus (tree-switch) states ===
    function saveTreeStates(storage, chromeApi) {
      const states = {};
      document.querySelectorAll(".tree-switch").forEach(sw => {
        states[sw.id] = sw.checked;
      });

      storage.get(["popup_settings"], data => {
        const popupSettings = data.popup_settings || {};
        popupSettings.tree_states = states;
        storage.set({ popup_settings: popupSettings }, () => {
          if (chromeApi.runtime.lastError) {
            storage = chromeApi.storage.local;
            storage.set({ popup_settings: popupSettings });
          }
        });
      });
    }

    function restoreTreeStates(data) {
      if (!data.popup_settings || !data.popup_settings.tree_states) return;
      const states = data.popup_settings.tree_states;
      for (const [id, checked] of Object.entries(states)) {
        const sw = document.getElementById(id);
        if (sw) {
          sw.checked = checked;
          const li = sw.closest("li");
          const ul = li && li.querySelector("ul");
          if (ul) {
            if (checked) ul.classList.add("hidden");
            else ul.classList.remove("hidden");
          }
        }
      }
    }



    /**
     * Loads settings into checkboxes
     * @param {Object} data
     */
    function applySettingsToUI(data) {
      const root = document.documentElement;

      // Master on/off
      const mainSwitch = document.getElementById("redd_on");
      if (mainSwitch && typeof data.redd_on === "boolean") {
        mainSwitch.checked = data.redd_on;
        root.setAttribute("redd_on", data.redd_on);
      }

      // Dark mode (nested under popup_settings)
      const darkToggle = document.getElementById("dark_mode");
      if (
        darkToggle &&
        data.popup_settings &&
        typeof data.popup_settings.dark_mode === "boolean"
      ) {
        darkToggle.checked = data.popup_settings.dark_mode;
        root.setAttribute("dark_mode", data.popup_settings.dark_mode);
      }



      hideOptions.forEach((id) => {
        const el = document.getElementById(id);
        if (el && typeof data[id] === "boolean") {
          el.checked = data[id];
        }
      });

      // Master “Toggle All” for hide_* options
      const allToggle = document.getElementById("toggle_all");
      if (allToggle) {
        // Are all hideOptions true?
        const states = hideOptions.map(id => !!document.getElementById(id)?.checked);
        const allOn = states.every(x => x === true);
        const allOff = states.every(x => x === false);

        allToggle.checked = allOn;
        allToggle.indeterminate = !(allOn || allOff);
      }

      // Re-compute any indeterminate parent states…
      const optionGroups = document.getElementById("options").getElementsByTagName("ul");
      for (let i = 1; i < optionGroups.length; i += 1) {
        updateParentCheckState(optionGroups[i].parentNode);
      }
      updateAllSectionMasters();
      updateToggleAllState();
      restoreTreeStates(data);


    }

    /**
     * Save change from a tree-switch or checkbox
     * @param {Object} data - storage object
     * @param {string} id - checkbox id
     * @param {boolean} value - new checked state
     */
    function updateSetting(data, id, value) {
      const popupSettings = data.popup_settings || {};
      popupSettings[id] = value;
      setToStorage({ popup_settings: popupSettings });
    }

    /**
     * Called when a tree-switch or checkbox is changed
     */
    function onSettingChange() {
      const checked = this.checked;
      const id = this.id;
      getFromStorage(updateSetting, ["popup_settings"], [id, checked]);
      if (id === "dark_mode") {
        root.setAttribute(id, checked);
      } else {
        // Show/hide sub-options for tree switches
        const ul = this.parentNode.parentNode.parentNode.getElementsByTagName("ul")[0];
        if (checked) {
          ul.classList.add("hidden");
        } else {
          ul.classList.remove("hidden");
        }
      }
    }

    // Initialize popup once DOM is ready
    document.addEventListener("DOMContentLoaded", function () {
      // Load settings and paint UI
      getFromStorage(applySettingsToUI);

      // Bind tree-switch expand/collapse
      bindTreeSwitches();

      // Bind "Toggle All"
      const toggleAll = document.getElementById("toggle_all");
      if (toggleAll) {
        toggleAll.addEventListener("change", function () {
          const on = this.checked;

          // 1) Update all real hide_* checkboxes in the UI
          hideOptions.forEach(id => {
            const cb = document.getElementById(id);
            if (cb) cb.checked = on;
          });

          // 2) Persist to storage (only real hide_* keys)
          const newSettings = {};
          hideOptions.forEach(id => (newSettings[id] = on));
          setToStorage(newSettings);

          // 3) Section masters reflect children (UI-only; not persisted)
          ["section_everywhere", "section_front_search", "section_thread"].forEach(id => {
            const m = document.getElementById(id);
            if (m) {
              m.checked = on;
              m.indeterminate = false;
            }
          });

          // 4) Expand all sublists after bulk toggle (so changes are visible)
          ["tree_everywhere", "tree_front_search", "tree_thread"].forEach(id => {
            const t = document.getElementById(id);
            if (!t) return;
            t.checked = false; // unchecked = expanded in your UI
            const li = t.closest("li");
            const ul = li && li.querySelector("ul");
            if (ul) ul.classList.remove("hidden");
          });

          // 5) Recompute indeterminate/checked states
          updateAllSectionMasters();
          updateToggleAllState();

          // 6) Ensure the master isn't indeterminate after an exact all-on/all-off
          this.indeterminate = false;

        })
      };

      // Bind settings toggles (dark mode / section masters)
      Array.from(document.getElementsByClassName("redd-setting"))
        .forEach(el => el.addEventListener("change", onSettingChange));

      // Bind all option checkboxes
      Array.from(document.getElementsByClassName("check"))
        .forEach(el => el.addEventListener("change", onOptionChange));

      // Master switch for enabling/disabling the extension
      const mainSwitch = document.getElementById("redd_on");
      if (mainSwitch) {
        mainSwitch.addEventListener("change", function () {
          this.checked ? setExtensionEnabled(true) : setExtensionEnabled(false);
        });
      }
      const off = document.getElementById("off");
      if (off && mainSwitch) {
        off.addEventListener("click", function () {
          mainSwitch.click();
        });
      }

      const darkToggle = document.getElementById("dark_mode");
      if (darkToggle) {
        darkToggle.addEventListener("change", function () {
          const on = this.checked;
          root.setAttribute("dark_mode", on);
          getFromStorage((data) => {
            const popupSettings = data.popup_settings || {};
            popupSettings.dark_mode = on;
            setToStorage({ popup_settings: popupSettings });
          }, ["popup_settings"]);
        });
      }

      // Reset to defaults
      const resetBtn = document.getElementById("reset_defaults");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          chromeApi.runtime.sendMessage({ type: "reset_to_defaults" }, () => {
            // Re-read settings and repaint the UI
            getFromStorage(applySettingsToUI);
          });
        });
      }


    });


    // Expand/collapse section sublists when tree-switch toggles (UI-only, not persisted)
    function bindTreeSwitches() {
      const ts = document.getElementsByClassName("tree-switch");
      for (let i = 0; i < ts.length; i += 1) {
        ts[i].addEventListener("change", function () {
          // tree-switch is inside: <div class="check-tree">…</div>
          const checkTree = this.parentNode && this.parentNode.parentNode; // span -> .check-tree
          if (!checkTree) return;
          const li = checkTree.parentNode; // the <li> that contains this section
          const ul = li && li.querySelector("ul");
          if (!ul) return;
          // checked = collapsed; unchecked = expanded (matches your previous behavior)
          if (this.checked) ul.classList.add("hidden");
          else ul.classList.remove("hidden");
          saveTreeStates(storage, chromeApi);

        });
      }
    }

    /**
     * Update parent state if all children are unchecked, else set indeterminate
     * @param {Element} li - parent LI element
     * @param {boolean} checked - new state
     */
    function updateTreeParent(li, checked) {
      const parent = li;
      const mainCheck = parent.getElementsByClassName("check")[0];
      if (checked === false) {
        mainCheck.indeterminate = false;
        mainCheck.checked = false;
        updateParentCheckState(parent);
      } else {
        mainCheck.indeterminate = true;
      }
      // Recursively update further up the tree
      const superParent = parent.parentNode.parentNode;
      if (superParent.tagName === "LI") {
        updateTreeParent(superParent, checked);
      }
    }

    /**
     * Collect checked states and save any changed settings to storage
     * @param {Object} oldData - previous storage data
     */
    function saveChangedSettings(oldData) {
      const changes = {};
      hideOptions.forEach((id) => {
        const el = document.getElementById(id);
        if (el && typeof el.checked === "boolean" && oldData[id] !== el.checked) {
          changes[id] = el.checked;
        }
      });
      setToStorage(changes);
    }

    /**
     * When a feature option is checked/unchecked
     */
    function onOptionChange() {
      const checked = this.checked;
      const parent = this.parentNode.parentNode;
      // If part of a check-tree group, set all siblings
      if (parent.classList.contains("check-tree")) {
        const checkboxes = parent.parentNode.getElementsByClassName("check");
        for (let i = 1; i < checkboxes.length; i += 1) {
          checkboxes[i].checked = checked;
        }
      }
      // If within an UL inside an LI, update parent tree
      else if (parent.tagName === "UL" && parent.parentNode.tagName === "LI") {
        updateTreeParent(parent.parentNode, checked);
      }
      getFromStorage(saveChangedSettings);
      updateAllSectionMasters();
      updateToggleAllState();
    }

    /**
     * Enable or disable the extension as a whole
     * @param {boolean} state - true = on, false = off
     */
    function setExtensionEnabled(state) {
      root.setAttribute("redd_on", state);
      setToStorage({ redd_on: state });
    }


  })();
})();
