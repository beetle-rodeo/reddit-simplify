// reddit-simplify.js

(() => {
  // The document's root element (html)
  const root = document.documentElement;
  // MutationObserver for watching DOM changes
  const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

// --- Hide "reddit gold" type awards ---
  function applyAwardSetting() {
  if (document.documentElement.getAttribute('hide_award') === 'true') {
    resetAwardCounts();
  }
}

// --- Disable Reddit Auto-Search Links (keep text) ---
(function () {
  const ROOT_ATTR = 'hide_auto_search';

  function unwrapElement(el) {
    // Move children out, then remove the wrapper
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  function replaceAnchorWithText(a) {
    // Remove decorative icons inside the link
    a.querySelectorAll('svg, .ms-2xs, [class*="icon"]').forEach(n => n.remove());
    const txt = a.textContent;
    const textNode = document.createTextNode(txt);
    a.replaceWith(textNode);
  }

  function stripInjectedSearch(root) {
    // 1) Unwrap all telemetry wrappers (can be nested)
    root.querySelectorAll('search-telemetry-tracker').forEach(unwrapElement);

    // 2) Replace search anchors with plain text
    root.querySelectorAll(
      'a[href^="/search/?q="], a[href^="https://www.reddit.com/search/?q="], a[href*="origin_element=pdp_comment_highlighted_search_term"]'
    ).forEach(replaceAnchorWithText);
  }

  function processAll() {
    if (document.documentElement.getAttribute(ROOT_ATTR) === 'true') {
      stripInjectedSearch(document.body || document);
    }
  }

  function enableAutoSearchRemoval() {
    // Initial pass
    processAll();

    // React to dynamic loads
    const mo = new MutationObserver(mutations => {
      if (document.documentElement.getAttribute(ROOT_ATTR) !== 'true') return;
      for (const m of mutations) {
        // Process only the changed subtree for efficiency
        if (m.type === 'childList' && m.addedNodes.length) {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 1) stripInjectedSearch(node);
          });
        } else if (m.type === 'characterData') {
          // no-op; textual changes don't re-add wrappers
        }
      }
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: false });

    // If your code already watches attribute changes on <html>, this may be redundant.
    const attrObs = new MutationObserver(() => processAll());
    attrObs.observe(document.documentElement, { attributes: true, attributeFilter: [ROOT_ATTR] });
  }

  // Expose/execute based on your app structure:
  // If you have a central init, call enableAutoSearchRemoval() from there when the toggle is on.
  // Otherwise, invoke immediately and let the attribute gate it:
  enableAutoSearchRemoval();
})();


// Set award-count="0" on all relevant comments
function resetAwardCounts() {
  
    document
    .querySelectorAll('shreddit-comment[award-count]')
    .forEach(c => c.setAttribute('award-count', '0'));
    
}

// MutationObserver to re-apply when new comments load
function observeRedditMutations() {
    const observer = new MutationObserver(() => {
        applyAwardSetting();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

function applyAllSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
        if (typeof value === "boolean") {
            document.documentElement.setAttribute(key, value);
        }
    }
}

const API = (typeof browser === 'object' && browser.runtime) ? browser : chrome;
const STORAGE = (API.storage && API.storage.sync) ? API.storage.sync : API.storage.local;

// Initial load
STORAGE.get(null, applyAllSettings);
observeRedditMutations();

// Listen for live changes
 API.storage.onChanged.addListener((changes/*, area*/ ) => {
   for (const [key, { newValue }] of Object.entries(changes)) {
     if (typeof newValue === "boolean") {
       document.documentElement.setAttribute(key, newValue);
     }
   }
});


  
})();