// Runs in the Bubble editor page context.
// Scans global variables for an object containing user_types and caches it
// so the popup can retrieve it without needing a separate injection.

(function () {
  function findAppData() {
    const keys = Object.keys(window)
    for (const k of keys) {
      try {
        const val = window[k]
        if (val && typeof val === "object" && val.user_types) {
          return val
        }
      } catch (_) {
        // skip non-accessible vars
      }
    }
    return null
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "GET_APP_DATA") return

    const data = findAppData()
    if (data) {
      sendResponse({ success: true, data })
    } else {
      sendResponse({ success: false })
    }
  })
})()
