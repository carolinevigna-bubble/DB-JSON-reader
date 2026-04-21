// Open the viewer in a new tab when the toolbar icon is clicked (no popup).
chrome.action.onClicked.addListener((tab) => {
  const url = new URL(chrome.runtime.getURL("popup.html"))
  if (tab?.id != null) {
    url.searchParams.set("editorTab", String(tab.id))
  }
  chrome.tabs.create({ url: url.href })
})
