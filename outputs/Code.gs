const DELETE_PASSWORD = 'GM@2026'; // Change this to match the password configured in the local app.
const MASTER_SHEET = 'LPO Masterlist';
const ITEMS_SHEET = 'LPO Line Items';

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'next-number') {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return jsonResponse_({ ok: true, lpoNumber: nextLpoNumber_() });
    } finally {
      lock.releaseLock();
    }
  }
  return jsonResponse_({ ok: true, message: 'Green Motors LPO endpoint is active.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const record = payload.record || {};
    if (!record.id || !record.lpoNumber) throw new Error('Missing record ID or LPO number.');

    if (payload.action === 'delete') {
      if (payload.deletePassword !== DELETE_PASSWORD) throw new Error('Incorrect delete password.');
      deleteRecord_(record.id);
      return jsonResponse_({ ok: true, action: 'delete' });
    }

    upsertRecord_(record);
    return jsonResponse_({ ok: true, action: 'upsert', lpoNumber: record.lpoNumber });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function upsertRecord_(record) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const master = getOrCreateSheet_(spreadsheet, MASTER_SHEET, [
    'Record ID', 'LPO Number', 'Date', 'Supplier', 'PO Box', 'Address',
    'Quotation Reference', 'Subject', 'Purchase Type', 'Currency',
    'VAT Applicable', 'Subtotal', 'VAT Amount', 'Net Total', 'Amount in Words',
    'Payment Terms', 'Ordered & Checked By', 'Second Signatory Name', 'Finance Manager',
    'Last Updated', 'Second Signatory Role'
  ]);
  const items = getOrCreateSheet_(spreadsheet, ITEMS_SHEET, [
    'Record ID', 'LPO Number', 'Line No.', 'Item Code', 'Description',
    'Quantity', 'UOM', 'Unit Price', 'Line Total'
  ]);
  record.lpoNumber = assignedLpoNumber_(master, record);

  const amountWords = amountInWords_(Number(record.total || 0), record.currency || 'AED');
  const row = [
    record.id, record.lpoNumber, record.date, record.supplier, record.poBox, record.address,
    record.quotationReference, record.subject, record.purchaseType, record.currency,
    record.vatApplicable ? 'Yes' : 'No', Number(record.subtotal || 0), Number(record.vat || 0),
    Number(record.total || 0), amountWords, record.paymentTerms, record.orderedName,
    record.hrName, record.financeName, new Date(), record.secondSignatoryRole || 'HR & Admin Manager'
  ];

  const rowNumber = findRow_(master, record.id);
  if (rowNumber) master.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else master.appendRow(row);

  deleteItemRows_(items, record.id);
  const itemRows = (record.items || []).map(item => [
    record.id, record.lpoNumber, item.line, item.itemCode, item.description,
    Number(item.qty || 0), item.uom, Number(item.unitPrice || 0), Number(item.total || 0)
  ]);
  if (itemRows.length) items.getRange(items.getLastRow() + 1, 1, itemRows.length, itemRows[0].length).setValues(itemRows);
  formatSheets_(master, items);
}

function assignedLpoNumber_(master, record) {
  const existingRow = findRow_(master, record.id);
  if (existingRow) return String(master.getRange(existingRow, 2).getValue());

  const requested = String(record.lpoNumber || '');
  if (requested && !lpoNumberExists_(master, requested)) return requested;
  return nextLpoNumber_(master);
}

function lpoNumberExists_(sheet, lpoNumber) {
  if (sheet.getLastRow() < 2) return false;
  return Boolean(sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(lpoNumber).matchEntireCell(true).findNext());
}

function nextLpoNumber_(existingMaster) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const master = existingMaster || getOrCreateSheet_(spreadsheet, MASTER_SHEET, [
    'Record ID', 'LPO Number', 'Date', 'Supplier', 'PO Box', 'Address',
    'Quotation Reference', 'Subject', 'Purchase Type', 'Currency',
    'VAT Applicable', 'Subtotal', 'VAT Amount', 'Net Total', 'Amount in Words',
    'Payment Terms', 'Ordered & Checked By', 'Second Signatory Name', 'Finance Manager',
    'Last Updated', 'Second Signatory Role'
  ]);
  let highest = 260;
  if (master.getLastRow() > 1) {
    master.getRange(2, 2, master.getLastRow() - 1, 1).getDisplayValues().forEach(function(row) {
      const match = String(row[0]).match(/GMSP\/LPO\/(\d+)$/);
      if (match) highest = Math.max(highest, Number(match[1]));
    });
  }
  return 'GMSP/LPO/' + String(highest + 1).padStart(6, '0');
}

function deleteRecord_(recordId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const master = spreadsheet.getSheetByName(MASTER_SHEET);
  const items = spreadsheet.getSheetByName(ITEMS_SHEET);
  if (master) {
    const row = findRow_(master, recordId);
    if (row) master.deleteRow(row);
  }
  if (items) deleteItemRows_(items, recordId);
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4f7d12').setFontColor('#ffffff').setFontWeight('bold');
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function findRow_(sheet, recordId) {
  if (sheet.getLastRow() < 2) return 0;
  const finder = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(recordId).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : 0;
}

function deleteItemRows_(sheet, recordId) {
  if (sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index][0] === recordId) sheet.deleteRow(index + 2);
  }
}

function formatSheets_(master, items) {
  master.autoResizeColumns(1, master.getLastColumn());
  items.autoResizeColumns(1, items.getLastColumn());
  if (master.getLastRow() > 1) {
    master.getRange(2, 12, master.getLastRow() - 1, 3).setNumberFormat('#,##0.00');
    master.getRange(2, 20, master.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  }
  if (items.getLastRow() > 1) items.getRange(2, 6, items.getLastRow() - 1, 4).setNumberFormat('#,##0.00');
}

function amountInWords_(value, currency) {
  const rounded = Math.round((value + Number.EPSILON) * 100);
  const whole = Math.floor(rounded / 100);
  const fraction = rounded % 100;
  const major = currency === 'USD' ? (whole === 1 ? 'US Dollar' : 'US Dollars') : (whole === 1 ? 'UAE Dirham' : 'UAE Dirhams');
  const minor = currency === 'USD' ? (fraction === 1 ? 'Cent' : 'Cents') : (fraction === 1 ? 'Fil' : 'Fils');
  return integerWords_(whole) + ' ' + major + (fraction ? ' and ' + integerWords_(fraction) + ' ' + minor : '') + ' Only';
}

function integerWords_(number) {
  if (number === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function underThousand_(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + underThousand_(n % 100) : '');
  }
  let remaining = Math.floor(number);
  const words = [];
  [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']].forEach(function(scale) {
    if (remaining >= scale[0]) {
      words.push(integerWords_(Math.floor(remaining / scale[0])) + ' ' + scale[1]);
      remaining %= scale[0];
    }
  });
  if (remaining) words.push(underThousand_(remaining));
  return words.join(' ');
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
