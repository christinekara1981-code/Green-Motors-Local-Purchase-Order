"use strict";

const STORAGE_KEY = "greenMotorsLpoRecordsV1";
const SETTINGS_KEY = "greenMotorsLpoSettingsV1";
const COUNTER_KEY = "greenMotorsLpoNextNumberV1";
const START_NUMBER = 261;
const DEFAULT_DELETE_PASSWORD = "GM@2026";
const VAT_RATE = 0.05;

const UOMS = [
  ["EA", "Each"], ["PC", "Piece"], ["PCS", "Pieces"], ["UNIT", "Unit"], ["SET", "Set"],
  ["PAIR", "Pair"], ["DOZ", "Dozen"], ["PK", "Pack"], ["PKT", "Packet"], ["BOX", "Box"],
  ["CTN", "Carton"], ["CASE", "Case"], ["BAG", "Bag"], ["SACK", "Sack"], ["ROLL", "Roll"],
  ["COIL", "Coil"], ["SHEET", "Sheet"], ["REAM", "Ream"], ["PAD", "Pad"], ["BOOK", "Book"],
  ["BOTTLE", "Bottle"], ["CAN", "Can"], ["DRUM", "Drum"], ["BARREL", "Barrel"], ["TUBE", "Tube"],
  ["TANK", "Tank"], ["PALLET", "Pallet"], ["CONTAINER", "Container"], ["LOT", "Lot"], ["BATCH", "Batch"],
  ["KIT", "Kit"], ["ASSEMBLY", "Assembly"], ["JOB", "Job"], ["SERVICE", "Service"], ["HOUR", "Hour"],
  ["DAY", "Day"], ["WEEK", "Week"], ["MONTH", "Month"], ["YEAR", "Year"], ["TRIP", "Trip"],
  ["M", "Metre"], ["CM", "Centimetre"], ["MM", "Millimetre"], ["KM", "Kilometre"], ["IN", "Inch"],
  ["FT", "Foot"], ["YD", "Yard"], ["M2", "Square metre"], ["CM2", "Square centimetre"], ["FT2", "Square foot"],
  ["M3", "Cubic metre"], ["CM3", "Cubic centimetre"], ["FT3", "Cubic foot"], ["L", "Litre"], ["ML", "Millilitre"],
  ["CL", "Centilitre"], ["GAL", "Gallon"], ["QT", "Quart"], ["PT", "Pint"], ["KG", "Kilogram"],
  ["G", "Gram"], ["MG", "Milligram"], ["MT", "Metric tonne"], ["TON", "Ton"], ["LB", "Pound"],
  ["OZ", "Ounce"], ["KW", "Kilowatt"], ["KWH", "Kilowatt-hour"], ["MW", "Megawatt"], ["HP", "Horsepower"],
  ["V", "Volt"], ["A", "Ampere"], ["MTR", "Metre (trade)"], ["LM", "Linear metre"], ["LS", "Lump sum"]
];

const form = document.querySelector("#lpoForm");
const fields = form.elements;
const itemsBody = document.querySelector("#itemsBody");
const itemTemplate = document.querySelector("#itemRowTemplate");
const statusEl = document.querySelector("#saveStatus");
const settingsDialog = document.querySelector("#settingsDialog");
let currentId = null;
let isLocked = false;
let signatures = { ordered: "", hr: "", finance: "" };

function records() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function storeRecords(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function settings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

function nextNumberValue() {
  const value = Number(localStorage.getItem(COUNTER_KEY) || START_NUMBER);
  return Math.max(START_NUMBER, value);
}

function formatLpoNumber(value) {
  return `GMSP/LPO/${String(value).padStart(6, "0")}`;
}

function isHostedApp() {
  return location.protocol === "https:" || location.protocol === "http:";
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.style.color = error ? "#ffb8b8" : "#cdd7cf";
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addItem(item = {}) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  const uom = row.querySelector(".uom");
  UOMS.forEach(([code, label]) => {
    const option = new Option(`${code} — ${label}`, code);
    uom.add(option);
  });
  row.querySelector(".item-code").value = item.itemCode || "";
  row.querySelector(".description").value = item.description || "";
  row.querySelector(".qty").value = item.qty ?? 1;
  uom.value = item.uom || "EA";
  row.querySelector(".unit-price").value = item.unitPrice ?? 0;
  row.querySelectorAll("input, textarea, select").forEach(el => el.addEventListener("input", calculate));
  row.querySelector(".remove-line").addEventListener("click", () => {
    if (itemsBody.children.length === 1) return;
    row.remove();
    renumberRows();
    calculate();
  });
  itemsBody.append(row);
  renumberRows();
  calculate();
}

function renumberRows() {
  [...itemsBody.rows].forEach((row, index) => row.querySelector(".serial").textContent = index + 1);
}

function itemData() {
  return [...itemsBody.rows].map((row, index) => ({
    line: index + 1,
    itemCode: row.querySelector(".item-code").value.trim(),
    description: row.querySelector(".description").value.trim(),
    qty: Number(row.querySelector(".qty").value || 0),
    uom: row.querySelector(".uom").value,
    unitPrice: Number(row.querySelector(".unit-price").value || 0),
    total: Number(row.querySelector(".qty").value || 0) * Number(row.querySelector(".unit-price").value || 0)
  }));
}

function money(value, currency) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(value);
}

function calculate() {
  const currency = fields.purchaseType.value === "international" ? "USD" : "AED";
  let subtotal = 0;
  [...itemsBody.rows].forEach(row => {
    const total = Number(row.querySelector(".qty").value || 0) * Number(row.querySelector(".unit-price").value || 0);
    row.querySelector(".line-total").textContent = total.toFixed(2);
    subtotal += total;
  });
  const vatApplicable = fields.purchaseType.value === "local" && fields.vatApplicable.checked;
  const vat = vatApplicable ? subtotal * VAT_RATE : 0;
  const total = subtotal + vat;
  document.querySelector("#subtotal").textContent = money(subtotal, currency);
  document.querySelector("#vatAmount").textContent = money(vat, currency);
  document.querySelector("#netTotal").textContent = money(total, currency);
  document.querySelector("#vatRow").hidden = !vatApplicable;
  document.querySelector("#amountWords").textContent = amountInWords(total, currency);
  return { currency, subtotal, vat, total };
}

function smallNumberWords(number) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (number < 20) return ones[number];
  if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ""}`;
  return `${ones[Math.floor(number / 100)]} Hundred${number % 100 ? ` ${smallNumberWords(number % 100)}` : ""}`;
}

function integerWords(number) {
  if (number === 0) return "Zero";
  const scales = [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]];
  let value = Math.floor(number);
  const words = [];
  scales.forEach(([scale, name]) => {
    if (value >= scale) {
      words.push(`${integerWords(Math.floor(value / scale))} ${name}`);
      value %= scale;
    }
  });
  if (value) words.push(smallNumberWords(value));
  return words.join(" ");
}

function amountInWords(value, currency) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100);
  const whole = Math.floor(rounded / 100);
  const fraction = rounded % 100;
  const major = currency === "USD" ? (whole === 1 ? "US Dollar" : "US Dollars") : (whole === 1 ? "UAE Dirham" : "UAE Dirhams");
  const minor = currency === "USD" ? (fraction === 1 ? "Cent" : "Cents") : (fraction === 1 ? "Fil" : "Fils");
  return `${integerWords(whole)} ${major}${fraction ? ` and ${integerWords(fraction)} ${minor}` : ""} Only`;
}

function setPurchaseRules() {
  const international = fields.purchaseType.value === "international";
  if (international) fields.vatApplicable.checked = false;
  fields.vatApplicable.disabled = international || isLocked;
  fields.vatApplicable.closest("label").classList.toggle("disabled", international);
  calculate();
}

function setSignatoryRules() {
  const hideFinance = fields.secondSignatoryRole.value === "National Aftersales Manager";
  const financeCard = document.querySelector("#financeSignatureCard");
  const signatureGrid = document.querySelector(".signature-grid");
  financeCard.hidden = hideFinance;
  signatureGrid.classList.toggle("two-signatories", hideFinance);
}

function collectRecord() {
  const totals = calculate();
  return {
    id: currentId || crypto.randomUUID(),
    lpoNumber: fields.lpoNumber.value,
    date: fields.date.value,
    supplier: fields.supplier.value.trim(),
    poBox: fields.poBox.value.trim(),
    address: fields.address.value.trim(),
    quotationReference: fields.quotationReference.value.trim(),
    subject: fields.subject.value.trim(),
    purchaseType: fields.purchaseType.value,
    vatApplicable: fields.vatApplicable.checked,
    paymentTerms: fields.paymentTerms.value.trim(),
    orderedName: fields.orderedName.value.trim(),
    secondSignatoryRole: fields.secondSignatoryRole.value,
    hrName: fields.hrName.value.trim(),
    financeName: fields.secondSignatoryRole.value === "National Aftersales Manager" ? "" : fields.financeName.value.trim(),
    signatures: {
      ...signatures,
      finance: fields.secondSignatoryRole.value === "National Aftersales Manager" ? "" : signatures.finance
    },
    items: itemData(),
    ...totals,
    updatedAt: new Date().toISOString()
  };
}

function validateRecord() {
  if (!form.reportValidity()) return false;
  const validItems = itemData().filter(item => item.description && item.qty > 0);
  if (!validItems.length) {
    alert("Add at least one line item with a description and quantity.");
    return false;
  }
  return true;
}

async function syncToGoogle(action, record, deletePassword = "") {
  if (isHostedApp()) {
    try {
      const response = await fetch("/api/lpo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, record, deletePassword })
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) {
        return { sent: false, reason: "server-error", error: result.error || "Google Sheets sync failed." };
      }
      return { sent: true, response: result };
    } catch (error) {
      return { sent: false, reason: "network-error", error: error.message };
    }
  }

  const url = settings().webAppUrl;
  if (!url) return { sent: false, reason: "missing-url" };
  const payload = { action, record, deletePassword };
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return { sent: true };
  } catch (error) {
    console.error(error);
    return { sent: false, reason: "network-error" };
  }
}

async function saveRecord() {
  if (isLocked) return;
  if (!validateRecord()) return;
  const record = collectRecord();
  const all = records();
  const existingIndex = all.findIndex(entry => entry.id === record.id);
  const isNew = existingIndex < 0;
  if (isNew) all.unshift(record);
  else all[existingIndex] = record;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  if (isNew) localStorage.setItem(COUNTER_KEY, String(nextNumberValue() + 1));
  currentId = record.id;
  setLocked(true);
  renderRecordList();
  setStatus("Saved locally; syncing...");
  const sync = await syncToGoogle("upsert", record);
  if (sync.sent) {
    if (sync.response && sync.response.lpoNumber && sync.response.lpoNumber !== record.lpoNumber) {
      record.lpoNumber = sync.response.lpoNumber;
      fields.lpoNumber.value = record.lpoNumber;
      const saved = records();
      const savedIndex = saved.findIndex(entry => entry.id === record.id);
      if (savedIndex >= 0) saved[savedIndex] = record;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      renderRecordList();
    }
    setStatus("Saved locally and sent to Google Sheets");
    loadSharedRecords();
  } else if (sync.reason === "missing-url") {
    setStatus("Saved locally only - add the Google Apps Script URL in Settings", true);
    alert("The LPO was saved in this browser, but Google Sheets is not connected. Open Settings and paste the Apps Script Web App URL ending in /exec.");
  } else {
    setStatus("Saved locally; Google Sheets connection failed", true);
    alert(`The LPO was saved locally, but it could not be sent to Google Sheets.\n\n${sync.error || "Check the Railway Google Sheets connection."}`);
  }
}

async function requestSharedLpoNumber() {
  if (!isHostedApp()) return;
  try {
    fields.lpoNumber.value = "Generating...";
    const response = await fetch("/api/lpo/next", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.lpoNumber) throw new Error(result.error || "Unable to generate LPO number.");
    fields.lpoNumber.value = result.lpoNumber;
  } catch (error) {
    fields.lpoNumber.value = formatLpoNumber(nextNumberValue());
    setStatus(error.message, true);
  }
}

async function loadSharedRecords() {
  if (!isHostedApp()) return;
  try {
    setStatus("Loading shared LPO records...");
    const response = await fetch("/api/lpo", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.ok === false || !Array.isArray(result.records)) {
      throw new Error(result.error || "Unable to load shared records.");
    }
    const merged = new Map(records().map(record => [record.id, record]));
    result.records.forEach(record => merged.set(record.id, record));
    const allRecords = [...merged.values()].sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    );
    storeRecords(allRecords);
    renderRecordList();
    setStatus(`Loaded ${result.records.length} shared LPO${result.records.length === 1 ? "" : "s"}`);
  } catch (error) {
    setStatus(`Shared records unavailable: ${error.message}`, true);
  }
}

function clearForm() {
  currentId = null;
  form.reset();
  fields.lpoNumber.value = formatLpoNumber(nextNumberValue());
  fields.date.value = today();
  fields.purchaseType.value = "local";
  itemsBody.innerHTML = "";
  signatures = { ordered: "", hr: "", finance: "" };
  document.querySelectorAll("canvas").forEach(clearCanvas);
  addItem();
  setLocked(false);
  setPurchaseRules();
  setSignatoryRules();
  renderRecordList();
  setStatus("New LPO");
  requestSharedLpoNumber();
}

function loadRecord(id) {
  const record = records().find(entry => entry.id === id);
  if (!record) return;
  currentId = record.id;
  ["lpoNumber", "date", "supplier", "poBox", "address", "quotationReference", "subject",
    "purchaseType", "paymentTerms", "orderedName", "hrName", "financeName"].forEach(name => {
      form.elements[name].value = record[name] || "";
    });
  fields.secondSignatoryRole.value = record.secondSignatoryRole || "HR & Admin Manager";
  fields.vatApplicable.checked = Boolean(record.vatApplicable);
  itemsBody.innerHTML = "";
  (record.items || []).forEach(addItem);
  if (!itemsBody.children.length) addItem();
  signatures = { ordered: "", hr: "", finance: "", ...(record.signatures || {}) };
  document.querySelectorAll(".signature-card").forEach(card => restoreSignature(card.dataset.signature));
  setLocked(true);
  setPurchaseRules();
  setSignatoryRules();
  renderRecordList();
  setStatus(`Loaded ${record.lpoNumber}`);
}

function setLocked(locked) {
  isLocked = locked;
  form.querySelectorAll("input:not([name=lpoNumber]), textarea, select").forEach(el => el.disabled = locked);
  document.querySelector("#addItemBtn").disabled = locked;
  document.querySelectorAll(".remove-line, .clear-signature").forEach(el => el.disabled = locked);
  document.querySelector("#saveBtn").disabled = locked;
  document.querySelector("#editBtn").disabled = !locked || !currentId;
  setPurchaseRules();
}

async function deleteRecord() {
  if (!currentId) return alert("Select a saved LPO first.");
  const password = prompt("Enter the delete password:");
  if (password === null) return;
  const configuredHash = settings().deletePasswordHash || await sha256(DEFAULT_DELETE_PASSWORD);
  if (await sha256(password) !== configuredHash) return alert("Incorrect delete password.");
  const record = records().find(entry => entry.id === currentId);
  if (!confirm(`Permanently delete ${record.lpoNumber}?`)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records().filter(entry => entry.id !== currentId)));
  await syncToGoogle("delete", record, password);
  clearForm();
  setStatus(`${record.lpoNumber} deleted`);
}

function renderRecordList() {
  const query = document.querySelector("#recordSearch").value.trim().toLowerCase();
  const list = document.querySelector("#recordList");
  list.innerHTML = "";
  records().filter(record =>
    !query || `${record.lpoNumber} ${record.supplier} ${record.quotationReference}`.toLowerCase().includes(query)
  ).forEach(record => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `record${record.id === currentId ? " active" : ""}`;
    button.innerHTML = `${escapeHtml(record.lpoNumber)}<span>${escapeHtml(record.supplier || "No supplier")} · ${escapeHtml(record.date || "")}</span>`;
    button.addEventListener("click", () => loadRecord(record.id));
    list.append(button);
  });
  if (!list.children.length) list.innerHTML = "<small>No saved LPOs found.</small>";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function prepareCanvas(card) {
  const canvas = card.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#172019";
  let drawing = false;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  };
  canvas.addEventListener("pointerdown", event => {
    if (isLocked) return;
    event.preventDefault();
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    event.preventDefault();
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    signatures[card.dataset.signature] = canvas.toDataURL("image/png");
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
  card.querySelector(".clear-signature").addEventListener("click", () => {
    clearCanvas(canvas);
    signatures[card.dataset.signature] = "";
  });
}

function clearCanvas(canvas) {
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

function restoreSignature(key) {
  const card = document.querySelector(`[data-signature="${key}"]`);
  const canvas = card.querySelector("canvas");
  clearCanvas(canvas);
  if (!signatures[key]) return;
  const image = new Image();
  image.onload = () => canvas.getContext("2d").drawImage(image, 0, 0);
  image.src = signatures[key];
}

document.querySelector("#newBtn").addEventListener("click", () => {
  if (!isLocked && (fields.supplier.value || itemData().some(item => item.description)) && !confirm("Discard the current unsaved changes?")) return;
  clearForm();
});
document.querySelector("#saveBtn").addEventListener("click", saveRecord);
document.querySelector("#editBtn").addEventListener("click", () => { setLocked(false); setStatus("Editing"); });
document.querySelector("#deleteBtn").addEventListener("click", deleteRecord);
document.querySelector("#printBtn").addEventListener("click", () => window.print());
document.querySelector("#addItemBtn").addEventListener("click", () => addItem());
document.querySelector("#recordSearch").addEventListener("input", renderRecordList);
fields.purchaseType.addEventListener("change", setPurchaseRules);
fields.vatApplicable.addEventListener("change", calculate);
fields.secondSignatoryRole.addEventListener("change", setSignatoryRules);
window.addEventListener("beforeprint", () => {
  const itemCount = itemsBody.rows.length;
  form.classList.toggle("standard-page-print", itemCount <= 10);
  form.classList.toggle("compact-page-print", itemCount > 10 && itemCount <= 20);
});
window.addEventListener("afterprint", () => {
  form.classList.remove("standard-page-print", "compact-page-print");
});
document.querySelector("#settingsBtn").addEventListener("click", () => {
  document.querySelector("#webAppUrl").value = settings().webAppUrl || "";
  document.querySelector("#webAppUrl").disabled = isHostedApp();
  document.querySelector("#connectionHelp").innerHTML = isHostedApp()
    ? "The hosted app uses the shared Railway <code>GOOGLE_APPS_SCRIPT_URL</code> variable. Configure it once in Railway Variables."
    : "Paste the deployed Web App URL ending in <code>/exec</code>.";
  document.querySelector("#deletePassword").value = "";
  settingsDialog.showModal();
});
document.querySelector("#saveSettingsBtn").addEventListener("click", async event => {
  event.preventDefault();
  const current = settings();
  const webAppUrl = document.querySelector("#webAppUrl").value.trim();
  if (webAppUrl && (!webAppUrl.startsWith("https://script.google.com/macros/s/") || !webAppUrl.endsWith("/exec"))) {
    alert("Please paste the deployed Google Apps Script Web App URL. It must begin with https://script.google.com/macros/s/ and end with /exec.");
    return;
  }
  current.webAppUrl = webAppUrl;
  const password = document.querySelector("#deletePassword").value;
  if (password) current.deletePasswordHash = await sha256(password);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  settingsDialog.close();
  setStatus(webAppUrl ? "Google Sheets connection saved" : "Google Sheets is not connected", !webAppUrl);
});

document.querySelectorAll(".signature-card").forEach(prepareCanvas);
clearForm();
loadSharedRecords();
if (!isHostedApp() && !settings().webAppUrl) {
  setStatus("Google Sheets not connected - open Settings", true);
}
