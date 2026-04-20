// Runs in the content script context on Bubble editor pages.
// Injects interceptor.js into the page context so it can patch fetch/XHR,
// then listens for the relayed app data and caches it for the popup.

let cachedAppData = null

// Inject interceptor into the page's JS context
const script = document.createElement("script")
script.src = chrome.runtime.getURL("interceptor.js")
document.documentElement.appendChild(script)
script.remove()

// Receive app data relayed from the interceptor
window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.type === "BUBBLE_APP_DATA" && event.data.payload?.user_types) {
    cachedAppData = event.data.payload
  }
})

// Respond to popup requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GET_APP_DATA") return
  if (cachedAppData) {
    sendResponse({ success: true, data: cachedAppData })
  } else {
    sendResponse({ success: false })
  }
})
