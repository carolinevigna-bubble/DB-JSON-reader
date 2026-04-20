// Runs in the PAGE context (not content script context).
// Patches fetch and XHR to capture any JSON response containing user_types,
// then relays it to the content script via postMessage.
;(function () {
  function relay(json) {
    window.postMessage({ type: "BUBBLE_APP_DATA", payload: json }, "*")
  }

  // ── Patch fetch ─────────────────────────────────────────────────────────────
  const originalFetch = window.fetch
  window.fetch = function (...args) {
    return originalFetch.apply(this, args).then((response) => {
      const clone = response.clone()
      clone
        .json()
        .then((json) => {
          if (json && json.user_types) relay(json)
        })
        .catch(() => {})
      return response
    })
  }

  // ── Patch XHR ───────────────────────────────────────────────────────────────
  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const json = JSON.parse(this.responseText)
        if (json && json.user_types) relay(json)
      } catch (_) {}
    })
    return originalSend.apply(this, args)
  }
})()
