// FatHopes PUSH Meta lead sync
// Install this as a container-bound Apps Script in the source "Leads" workbook.

const DEST_SPREADSHEET_ID = '1KOA1mUjq_1YZK__ukPG4qvaOmPOs4Iu6onsbG46MPL4';
const DEST_SHEET = 'Form Responses 1';
const SOURCE_TABS = ['VIDEO', 'POSTER'];
const HEADER_ROWS = 1;
const POLL_MINUTES = 5;
const SOURCE_VALUE = 'meta';
const SYNC_LOG_SHEET = '__META_SYNC_LOG';

const FIELD_MAP = [
  { key: 'time',    src: ['created_time', 'created time', 'timestamp'], dest: 'Timestamp' },
  { key: 'name',    src: ['full_name', 'full name', 'name', 'nama'], dest: 'Full Name' },
  { key: 'phone',   src: ['phone_number', 'phone number', 'phone', 'contact_number', 'contact', 'mobile', 'no_telefon'], dest: 'Contact No' },
  { key: 'license', src: ['driving_license', 'driving license', 'license', 'lesen'], dest: 'Driving Licens' },
  { key: 'loc',     src: ['location_and_state', 'location and state', 'location', 'state', 'lokasi'], dest: 'Location and State' },
  { key: 'age',     src: ['age', 'umur'], dest: 'Age' },
];

const LEAD_ID_HEADERS = ['id', 'lead_id', 'lead id', 'leadgen_id', 'leadgen id'];

/**
 * Run this once. It imports every missing VIDEO/POSTER lead first, then installs
 * an on-change trigger plus a reliable five-minute polling trigger.
 */
function setupAndBackfill() {
  syncMetaLeads();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers()
    .filter(t => ['syncMetaLeads', 'processNewRows', 'onSourceChange'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncMetaLeads').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('syncMetaLeads').timeBased().everyMinutes(POLL_MINUTES).create();
  Logger.log('Backfill complete. VIDEO and POSTER now sync every ' + POLL_MINUTES + ' minutes.');
}

/**
 * Safe to run repeatedly. It scans both source tabs because Meta/connector
 * refreshes are not guaranteed to behave like simple row appends.
 */
function syncMetaLeads() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    const sourceBook = SpreadsheetApp.getActiveSpreadsheet();
    const dest = getDestSheet_();
    const ctx = buildDestContext_(dest);
    const syncLog = getSyncLog_(sourceBook);
    const loggedIds = getLoggedIds_(syncLog);
    const idsToLog = [];
    const rowsToAppend = [];

    SOURCE_TABS.forEach(tabName => {
      const src = sourceBook.getSheetByName(tabName);
      if (!src || src.getLastRow() <= HEADER_ROWS) return;

      const headers = headerRow_(src);
      const idIndexes = pickAllIdx_(headers, LEAD_ID_HEADERS);
      const rows = src.getRange(
        HEADER_ROWS + 1,
        1,
        src.getLastRow() - HEADER_ROWS,
        src.getLastColumn()
      ).getValues();

      rows.forEach(row => {
        const leadId = firstValue_(row, idIndexes).replace(/^l:/i, '').trim();
        // This is a Meta sync: ignore legacy/manual rows that have no Meta ID.
        if (!leadId) return;
        if (leadId && loggedIds.has(leadId)) return;

        const lead = sourceLead_(headers, row);
        if ((!lead.name && !lead.phone) || !hasValidTimestamp_(lead.time)) return;

        const fingerprint = leadFingerprint_(lead.time, lead.phone, lead.name);
        if (!ctx.fingerprints.has(fingerprint)) {
          const out = buildDestinationRow_(ctx, lead);
          const phoneKey = normPhone_(lead.phone);
          if (ctx.duplicateCol > 0 && phoneKey && ctx.phones.has(phoneKey)) {
            out[ctx.duplicateCol - 1] = 'DUPLICATE';
          }
          if (phoneKey) ctx.phones.add(phoneKey);
          ctx.fingerprints.add(fingerprint);
          rowsToAppend.push(out);
        }

        if (leadId) {
          loggedIds.add(leadId);
          idsToLog.push([leadId, tabName, new Date()]);
        }
      });
    });

    if (rowsToAppend.length) {
      const startRow = nextDataRow_(dest, ctx.columns.time);
      const destinationRange = dest.getRange(startRow, 1, rowsToAppend.length, ctx.headers.length);
      if (ctx.contactCol > 0) {
        dest.getRange(startRow, ctx.contactCol, rowsToAppend.length, 1).setNumberFormat('@');
      }
      destinationRange.setValues(rowsToAppend);
    }

    if (idsToLog.length) {
      const logRange = syncLog.getRange(syncLog.getLastRow() + 1, 1, idsToLog.length, 3);
      logRange.offset(0, 0, idsToLog.length, 1).setNumberFormat('@');
      logRange.setValues(idsToLog);
    }

    Logger.log('Added ' + rowsToAppend.length + ' missing lead(s); logged ' + idsToLog.length + ' Meta lead ID(s).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * One-time repair for the 22 July poster cutoff. The destination currently ends
 * at source POSTER row 1404, so this deliberately imports row 1405 onward and
 * ignores the old checkpoint/sync-log state.
 */
function recoverPosterAfterRow1404() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  const sourceBook = SpreadsheetApp.getActiveSpreadsheet();
  const audit = getAuditSheet_(sourceBook);
  try {
    const source = sourceBook.getSheetByName('POSTER');
    if (!source) throw new Error('POSTER tab not found.');

    const firstMissingRow = 1405;
    const lastSourceRow = source.getLastRow();
    if (lastSourceRow < firstMissingRow) {
      Logger.log('No poster rows exist after row 1404.');
      return;
    }

    const headers = headerRow_(source);
    const sourceRows = source.getRange(
      firstMissingRow,
      1,
      lastSourceRow - firstMissingRow + 1,
      source.getLastColumn()
    ).getValues();

    const dest = getDestSheet_();
    const ctx = buildDestContext_(dest);
    const output = sourceRows
      .map(row => sourceLead_(headers, row))
      .filter(lead => (lead.name || lead.phone) && hasValidTimestamp_(lead.time))
      .map(lead => buildDestinationRow_(ctx, lead));

    if (!output.length) {
      Logger.log('No valid poster leads found after row 1404.');
      return;
    }

    const startRow = nextDataRow_(dest, ctx.columns.time);
    if (ctx.contactCol > 0) {
      dest.getRange(startRow, ctx.contactCol, output.length, 1).setNumberFormat('@');
    }
    dest.getRange(startRow, 1, output.length, ctx.headers.length).setValues(output);
    SpreadsheetApp.flush();

    const writtenTimestamps = dest.getRange(startRow, ctx.columns.time, output.length, 1)
      .getDisplayValues()
      .filter(row => String(row[0]).trim() !== '').length;
    if (writtenTimestamps !== output.length) {
      throw new Error('Verification failed: expected ' + output.length +
        ' timestamps but found ' + writtenTimestamps + ' at destination row ' + startRow + '.');
    }

    writeAudit_(audit, 'SUCCESS', [
      ['Source rows', firstMissingRow + '-' + lastSourceRow],
      ['Destination rows', startRow + '-' + (startRow + output.length - 1)],
      ['Rows written and verified', output.length],
      ['Destination sheet', dest.getName()],
    ]);
    Logger.log('Recovered ' + output.length + ' poster lead(s) into destination rows ' +
      startRow + '-' + (startRow + output.length - 1) + '.');
  } catch (error) {
    writeAudit_(audit, 'ERROR', [
      ['Message', String(error && error.message ? error.message : error)],
      ['Stack', String(error && error.stack ? error.stack : '')],
    ]);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/** Run once to restore Malaysian leading zeroes in the destination Contact No column. */
function normalizeDestinationPhoneNumbers() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  const sourceBook = SpreadsheetApp.getActiveSpreadsheet();
  const audit = getAuditSheet_(sourceBook);
  try {
    const dest = getDestSheet_();
    const ctx = buildDestContext_(dest);
    if (ctx.contactCol < 1) throw new Error('Destination Contact No column not found.');

    const lastRow = dest.getLastRow();
    if (lastRow <= 1) return;

    const range = dest.getRange(2, ctx.contactCol, lastRow - 1, 1);
    const current = range.getDisplayValues();
    let changed = 0;
    const normalized = current.map(row => {
      const before = String(row[0] || '').trim();
      const after = cleanPhone_(before);
      if (before !== after) changed++;
      return [after];
    });

    // Text formatting must be applied before values are written, otherwise
    // Google Sheets converts 011... into a number and drops the first zero.
    range.setNumberFormat('@');
    range.setValues(normalized);
    SpreadsheetApp.flush();

    writeAudit_(audit, 'SUCCESS', [
      ['Phone rows checked', normalized.length],
      ['Phone numbers normalized', changed],
      ['Destination column', ctx.contactCol],
    ]);
  } catch (error) {
    writeAudit_(audit, 'ERROR', [
      ['Message', String(error && error.message ? error.message : error)],
      ['Stack', String(error && error.stack ? error.stack : '')],
    ]);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run once after the 22 July recovery. Exact duplicate leads and trailing rows
 * with no timestamp are copied to a quarantine tab before removal.
 */
function quarantineDuplicateAndIncompleteSyncRows() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  const sourceBook = SpreadsheetApp.getActiveSpreadsheet();
  const audit = getAuditSheet_(sourceBook);
  try {
    const dest = getDestSheet_();
    const ctx = buildDestContext_(dest);
    const lastRow = dest.getLastRow();
    if (lastRow <= HEADER_ROWS) return;

    const values = dest.getRange(2, 1, lastRow - 1, ctx.headers.length).getValues();
    const seen = new Set();
    const removals = [];
    let lastTimestampRow = 1;

    values.forEach((row, offset) => {
      const rowNumber = offset + 2;
      const timestamp = ctx.columns.time > 0 ? row[ctx.columns.time - 1] : '';
      if (hasValidTimestamp_(timestamp)) lastTimestampRow = rowNumber;
    });

    values.forEach((row, offset) => {
      const rowNumber = offset + 2;
      const timestamp = ctx.columns.time > 0 ? row[ctx.columns.time - 1] : '';
      const phone = ctx.contactCol > 0 ? row[ctx.contactCol - 1] : '';
      const name = ctx.columns.name > 0 ? row[ctx.columns.name - 1] : '';
      let reason = '';

      if (!hasValidTimestamp_(timestamp)) {
        if (rowNumber > lastTimestampRow && (String(name).trim() || String(phone).trim())) {
          reason = 'INCOMPLETE_NO_TIMESTAMP';
        }
      } else {
        const fingerprint = leadFingerprint_(timestamp, phone, name);
        if (seen.has(fingerprint)) reason = 'EXACT_DUPLICATE';
        else seen.add(fingerprint);
      }

      if (reason) removals.push({ rowNumber, reason, values: row });
    });

    if (!removals.length) {
      writeAudit_(audit, 'SUCCESS', [['Cleanup', 'No duplicate or incomplete rows found']]);
      return;
    }

    const destBook = dest.getParent();
    const quarantineName = '__SYNC_QUARANTINE';
    let quarantine = destBook.getSheetByName(quarantineName);
    if (!quarantine) {
      quarantine = destBook.insertSheet(quarantineName);
      quarantine.getRange(1, 1, 1, ctx.headers.length + 2)
        .setValues([['Reason', 'Original Row'].concat(ctx.headers)]);
    }

    const quarantineRows = removals.map(item => [item.reason, item.rowNumber].concat(item.values));
    quarantine.getRange(
      quarantine.getLastRow() + 1,
      1,
      quarantineRows.length,
      ctx.headers.length + 2
    ).setValues(quarantineRows);

    const rowNumbers = removals.map(item => item.rowNumber).sort((a, b) => a - b);
    const groups = consecutiveGroups_(rowNumbers);
    groups.reverse().forEach(group => dest.deleteRows(group.start, group.count));
    SpreadsheetApp.flush();

    const duplicateCount = removals.filter(item => item.reason === 'EXACT_DUPLICATE').length;
    const incompleteCount = removals.filter(item => item.reason === 'INCOMPLETE_NO_TIMESTAMP').length;
    writeAudit_(audit, 'SUCCESS', [
      ['Cleanup quarantined', removals.length],
      ['Exact duplicates removed', duplicateCount],
      ['Incomplete rows removed', incompleteCount],
      ['Quarantine sheet', quarantineName],
    ]);
  } catch (error) {
    writeAudit_(audit, 'ERROR', [
      ['Message', String(error && error.message ? error.message : error)],
      ['Stack', String(error && error.stack ? error.stack : '')],
    ]);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/** Logs the latest source timestamps and trigger status without changing data. */
function diagnoseSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SOURCE_TABS.forEach(tabName => {
    const sh = ss.getSheetByName(tabName);
    if (!sh || sh.getLastRow() <= HEADER_ROWS) {
      Logger.log(tabName + ': no source rows');
      return;
    }
    const headers = headerRow_(sh);
    const timeIndexes = pickAllIdx_(headers, FIELD_MAP.find(m => m.key === 'time').src);
    const rows = sh.getRange(HEADER_ROWS + 1, 1, sh.getLastRow() - HEADER_ROWS, sh.getLastColumn()).getValues();
    let latest = null;
    rows.forEach(row => {
      const d = new Date(firstRawValue_(row, timeIndexes));
      if (!isNaN(d) && (!latest || d > latest)) latest = d;
    });
    Logger.log(tabName + ': ' + rows.length + ' lead rows; newest=' + (latest ? latest.toISOString() : 'unknown'));
  });
  Logger.log('Installed sync triggers: ' + ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncMetaLeads').length);
}

function sourceLead_(headers, row) {
  const get = key => {
    const aliases = FIELD_MAP.find(m => m.key === key).src;
    return firstRawValue_(row, pickAllIdx_(headers, aliases));
  };

  const rawTime = get('time');
  const parsedTime = new Date(rawTime);
  return {
    time: isNaN(parsedTime) ? rawTime : parsedTime,
    name: String(get('name') || '').trim(),
    phone: cleanPhone_(get('phone')),
    license: String(get('license') || '').trim().toUpperCase(),
    loc: String(get('loc') || '').trim(),
    age: get('age'),
  };
}

function buildDestinationRow_(ctx, lead) {
  const out = new Array(ctx.headers.length).fill('');
  FIELD_MAP.forEach(map => {
    const col = ctx.columns[map.key];
    if (col > 0) out[col - 1] = lead[map.key];
  });
  if (ctx.sourceCol > 0) out[ctx.sourceCol - 1] = SOURCE_VALUE;
  return out;
}

function buildDestContext_(dest) {
  const headers = dest.getRange(1, 1, 1, dest.getLastColumn()).getValues()[0].map(v => String(v).trim());
  const lower = headers.map(v => v.toLowerCase());
  const findDest = name => {
    const index = pickIdx_(lower, [name]);
    return index < 0 ? -1 : index + 1;
  };
  const columns = {};
  FIELD_MAP.forEach(map => columns[map.key] = findDest(map.dest));

  const contactCol = columns.phone;
  const sourceCol = findDest('Source');
  const duplicateCol = findDest('Double Entry');
  const phones = new Set();
  const fingerprints = new Set();

  if (dest.getLastRow() > 1) {
    const values = dest.getRange(2, 1, dest.getLastRow() - 1, headers.length).getValues();
    values.forEach(row => {
      const phone = contactCol > 0 ? row[contactCol - 1] : '';
      const phoneKey = normPhone_(phone);
      if (phoneKey) phones.add(phoneKey);
      fingerprints.add(leadFingerprint_(
        columns.time > 0 ? row[columns.time - 1] : '',
        phone,
        columns.name > 0 ? row[columns.name - 1] : ''
      ));
    });
  }

  return { headers, columns, contactCol, sourceCol, duplicateCol, phones, fingerprints };
}

function getDestSheet_() {
  const book = SpreadsheetApp.openById(DEST_SPREADSHEET_ID);
  const exact = book.getSheetByName(DEST_SHEET);
  const fallback = book.getSheets().find(sh => sh.getName().toLowerCase().startsWith('form responses'));
  if (!exact && !fallback) throw new Error('Destination response tab not found.');
  return exact || fallback;
}

function nextDataRow_(sheet, timestampCol) {
  if (timestampCol < 1) return sheet.getLastRow() + 1;
  const scanTo = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(2, timestampCol, scanTo - 1, 1).getDisplayValues();
  let lastUsedOffset = -1;
  values.forEach((row, i) => { if (String(row[0]).trim() !== '') lastUsedOffset = i; });
  return lastUsedOffset < 0 ? 2 : lastUsedOffset + 3;
}

function getSyncLog_(sourceBook) {
  let sh = sourceBook.getSheetByName(SYNC_LOG_SHEET);
  if (!sh) {
    sh = sourceBook.insertSheet(SYNC_LOG_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([['Meta Lead ID', 'Source Tab', 'Synced At']]);
    sh.hideSheet();
  }
  return sh;
}

function getAuditSheet_(sourceBook) {
  const name = '__SYNC_AUDIT';
  return sourceBook.getSheetByName(name) || sourceBook.insertSheet(name);
}

function writeAudit_(sheet, status, details) {
  const rows = [
    ['Last run', new Date()],
    ['Status', status],
  ].concat(details || []);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.autoResizeColumns(1, 2);
}

function getLoggedIds_(logSheet) {
  const ids = new Set();
  if (logSheet.getLastRow() > 1) {
    logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 1).getDisplayValues()
      .forEach(row => { if (row[0]) ids.add(String(row[0]).trim()); });
  }
  return ids;
}

function leadFingerprint_(time, phone, name) {
  const d = time instanceof Date ? time : new Date(time);
  const timeKey = isNaN(d) ? String(time || '').trim().toLowerCase() : String(Math.floor(d.getTime() / 1000));
  return [timeKey, normPhone_(phone), String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')].join('|');
}

function hasValidTimestamp_(value) {
  if (value === '' || value == null) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !isNaN(date);
}

function consecutiveGroups_(numbers) {
  if (!numbers.length) return [];
  const groups = [];
  let start = numbers[0];
  let previous = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === previous + 1) {
      previous = numbers[i];
      continue;
    }
    groups.push({ start, count: previous - start + 1 });
    start = previous = numbers[i];
  }
  groups.push({ start, count: previous - start + 1 });
  return groups;
}

function headerRow_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(v => String(v).trim().toLowerCase());
}

function firstRawValue_(row, indexes) {
  for (const i of indexes) if (row[i] !== '' && row[i] != null) return row[i];
  return '';
}

function firstValue_(row, indexes) {
  return String(firstRawValue_(row, indexes) || '');
}

function pickIdx_(headers, names) {
  for (const name of names) {
    const i = headers.indexOf(String(name).toLowerCase());
    if (i > -1) return i;
  }
  for (const name of names) {
    const key = String(name).toLowerCase();
    const i = headers.findIndex(header => header.startsWith(key));
    if (i > -1) return i;
  }
  for (const name of names) {
    const key = String(name).toLowerCase();
    const i = headers.findIndex(header => header.includes(key));
    if (i > -1) return i;
  }
  return -1;
}

function pickAllIdx_(headers, names) {
  const indexes = [];
  const add = i => { if (i > -1 && !indexes.includes(i)) indexes.push(i); };
  names.forEach(name => headers.forEach((header, i) => { if (header === String(name).toLowerCase()) add(i); }));
  names.forEach(name => {
    const key = String(name).toLowerCase();
    headers.forEach((header, i) => { if (header.startsWith(key)) add(i); });
  });
  names.forEach(name => {
    const key = String(name).toLowerCase();
    headers.forEach((header, i) => { if (header.includes(key)) add(i); });
  });
  return indexes;
}

function cleanPhone_(value) {
  let phone = String(value == null ? '' : value).trim().replace(/^p:/i, '').replace(/\D/g, '');
  if (!phone) return '';
  if (phone.startsWith('60')) phone = '0' + phone.slice(2);
  else if (!phone.startsWith('0')) phone = '0' + phone;
  return phone;
}

function normPhone_(value) {
  return String(value == null ? '' : value).replace(/\D/g, '').replace(/^60/, '0');
}
