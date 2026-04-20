// ── DOM refs ──────────────────────────────────────────────────────────────────

const loadSection = document.getElementById("load-section")
const typesView = document.getElementById("types-view")
const fieldsView = document.getElementById("fields-view")
const fileInput = document.getElementById("file-input")
const dropZone = document.getElementById("drop-zone")
const loadFromPageBtn = document.getElementById("load-from-page")
const errorMsg = document.getElementById("error-msg")
const appNameEl = document.getElementById("app-name")

const typesCount = document.getElementById("types-count")
const typesTbody = document.getElementById("types-tbody")
const typesEmpty = document.getElementById("types-empty")

const backBtn = document.getElementById("back-btn")
const typeDisplayName = document.getElementById("type-display-name")
const typePostgresName = document.getElementById("type-postgres-name")
const fieldsCount = document.getElementById("fields-count")
const fieldsTbody = document.getElementById("fields-tbody")
const fieldsEmpty = document.getElementById("fields-empty")

// ── State ─────────────────────────────────────────────────────────────────────

let currentView = "load"

// ── View management ───────────────────────────────────────────────────────────

function showView(view) {
  loadSection.classList.toggle("hidden", view !== "load")
  typesView.classList.toggle("hidden", view !== "types")
  fieldsView.classList.toggle("hidden", view !== "fields")
  currentView = view
}

function showError(msg) {
  errorMsg.textContent = msg
  errorMsg.classList.remove("hidden")
}

function clearError() {
  errorMsg.classList.add("hidden")
  errorMsg.textContent = ""
}

// ── Bubble data format helpers ────────────────────────────────────────────────

// Bubble stores user-defined data types in postgres as custom$0{typeKey}
function postgresTableName(typeKey) {
  return `custom$0${typeKey}`
}

// ── Render types list ─────────────────────────────────────────────────────────

function renderTypes(json) {
  clearError()

  const userTypes = json.user_types
  if (!userTypes || typeof userTypes !== "object") {
    showError("No user_types section found in this JSON.")
    return
  }

  const entries = Object.entries(userTypes)

  // Show app name if present
  if (json.name) {
    appNameEl.textContent = json.name
  }

  typesTbody.innerHTML = ""
  typesCount.textContent = `${entries.length} type${entries.length !== 1 ? "s" : ""}`

  if (entries.length === 0) {
    typesEmpty.classList.remove("hidden")
    showView("types")
    return
  }

  typesEmpty.classList.add("hidden")

  // Sort alphabetically by display name for easier scanning
  entries
    .sort(([, a], [, b]) => {
      const nameA = (a.display || "").toLowerCase()
      const nameB = (b.display || "").toLowerCase()
      return nameA.localeCompare(nameB)
    })
    .forEach(([key, typeData]) => {
      const tr = document.createElement("tr")
      tr.className = "clickable"

      const fieldCount = Object.keys(typeData.fields || {}).length

      tr.innerHTML = `
        <td class="col-display">${escHtml(typeData.display || key)}</td>
        <td><span class="col-key">${escHtml(postgresTableName(key))}</span></td>
        <td class="arrow">${fieldCount} field${fieldCount !== 1 ? "s" : ""} ›</td>
      `
      tr.addEventListener("click", () => renderFields(key, typeData))
      typesTbody.appendChild(tr)
    })

  showView("types")
}

// ── Render fields detail ──────────────────────────────────────────────────────

function renderFields(typeKey, typeData) {
  clearError()

  const tableName = postgresTableName(typeKey)
  typeDisplayName.textContent = typeData.display || typeKey
  typePostgresName.textContent = tableName

  const fields = typeData.fields || {}
  const entries = Object.entries(fields)

  fieldsCount.textContent = `${entries.length} field${entries.length !== 1 ? "s" : ""}`
  fieldsTbody.innerHTML = ""

  if (entries.length === 0) {
    fieldsEmpty.classList.remove("hidden")
    showView("fields")
    return
  }

  fieldsEmpty.classList.add("hidden")

  // Sort alphabetically by display name
  entries
    .sort(([, a], [, b]) => {
      const nameA = (a.display || "").toLowerCase()
      const nameB = (b.display || "").toLowerCase()
      return nameA.localeCompare(nameB)
    })
    .forEach(([fieldKey, fieldData]) => {
      const tr = document.createElement("tr")
      tr.innerHTML = `
        <td class="col-display">${escHtml(fieldData.display || fieldKey)}</td>
        <td><span class="col-key">${escHtml(fieldKey)}</span></td>
        <td><span class="col-type">${escHtml(fieldData.value || "")}</span></td>
      `
      fieldsTbody.appendChild(tr)
    })

  showView("fields")
}

// ── Parse JSON from text ──────────────────────────────────────────────────────

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (_) {
    showError("Could not parse JSON — make sure the file is valid JSON.")
    return null
  }
}

// ── File upload ───────────────────────────────────────────────────────────────

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0]
  if (!file) return
  readFile(file)
  // reset so re-uploading same file triggers change again
  fileInput.value = ""
})

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault()
  dropZone.classList.add("drag-over")
})

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over")
})

dropZone.addEventListener("drop", (e) => {
  e.preventDefault()
  dropZone.classList.remove("drag-over")
  const file = e.dataTransfer.files[0]
  if (file) readFile(file)
})

function readFile(file) {
  const reader = new FileReader()
  reader.onload = (evt) => {
    const json = parseJson(evt.target.result)
    if (json) renderTypes(json)
  }
  reader.readAsText(file)
}

// ── Load from active editor tab ───────────────────────────────────────────────

loadFromPageBtn.addEventListener("click", async () => {
  clearError()
  loadFromPageBtn.disabled = true
  loadFromPageBtn.textContent = "Loading…"

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab) {
      showError("No active tab found.")
      return
    }

    // First try messaging the content script (already injected on bubble pages)
    let appData = await tryContentScript(tab.id)

    // Fallback: inject a one-shot script into the page context
    if (!appData) {
      appData = await tryInjectedScript(tab.id)
    }

    if (appData) {
      renderTypes(appData)
    } else {
      showError(
        "App data not captured yet. " +
          "Make sure you are on a Bubble editor tab with the app fully loaded, " +
          "then try again. If this keeps failing, upload the JSON manually.",
      )
    }
  } catch (err) {
    showError(
      "Could not access the page. " +
        "If this is a non-Bubble page, please upload the JSON manually.",
    )
  } finally {
    loadFromPageBtn.disabled = false
    loadFromPageBtn.textContent = "⚡ Load from Editor (active tab)"
  }
})

async function tryContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_APP_DATA" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        resolve(null)
      } else {
        resolve(response.data)
      }
    })
  })
}

async function tryInjectedScript(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractFromPageContext,
    })
    return results?.[0]?.result ?? null
  } catch (_) {
    return null
  }
}

// Runs inside the page's JS context — no closure variables allowed
function extractFromPageContext() {
  const keys = Object.keys(window)
  for (const k of keys) {
    try {
      const val = window[k]
      if (val && typeof val === "object" && !Array.isArray(val) && val.user_types) {
        return val
      }
    } catch (_) {
      // skip non-readable properties
    }
  }
  return null
}

// ── Back button ───────────────────────────────────────────────────────────────

backBtn.addEventListener("click", () => {
  showView("types")
})

// ── Utility ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── Init ──────────────────────────────────────────────────────────────────────

showView("load")
