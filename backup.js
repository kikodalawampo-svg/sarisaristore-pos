/* ============================================================
   KXS SARI-SARI STORE POS — backup.js
   Full local backup / restore + factory reset.
   ============================================================ */

const Backup = (() => {

  function todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  async function exportBackup() {
    const dump = await DB.exportAll();
    return dump;
  }

  function downloadBackupFile(dump) {
    const filename = `SARI-SARI-BACKUP-${todayStamp()}.json`;
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  }

  // Validates a parsed backup object's basic shape before restoring.
  function validateBackup(dump) {
    if (!dump || typeof dump !== "object") return { ok: false, message: "This file is not a valid backup." };
    if (!dump._meta || dump._meta.app !== "kxs_sarisari_pos") {
      return { ok: false, message: "This file was not created by KXS Sari-Sari Store POS." };
    }
    const expectedStores = Object.keys(STORES);
    const hasAnyKnownStore = expectedStores.some(s => Array.isArray(dump[s]));
    if (!hasAnyKnownStore) return { ok: false, message: "Backup file has no recognizable data." };
    return { ok: true, message: "Backup file looks valid." };
  }

  async function restoreFromFile(file, mode = "replace") {
    let text;
    try {
      text = await file.text();
    } catch (e) {
      return { ok: false, message: "Could not read the selected file." };
    }
    let dump;
    try {
      dump = JSON.parse(text);
    } catch (e) {
      return { ok: false, message: "This file is not valid JSON. Restore cancelled — your current data is untouched." };
    }
    const check = validateBackup(dump);
    if (!check.ok) return { ok: false, message: check.message + " Restore cancelled — your current data is untouched." };

    try {
      await DB.importAll(dump, mode);
    } catch (e) {
      return { ok: false, message: "Restore failed while writing data. Some data may be partially restored — please check Products and Sales." };
    }
    return { ok: true, message: "Backup restored successfully." };
  }

  // Requires the exact confirmation phrase before wiping data.
  async function factoryReset(confirmationText) {
    if (confirmationText !== "DELETE ALL DATA") {
      return { ok: false, message: 'Type "DELETE ALL DATA" exactly to confirm.' };
    }
    await DB.wipeAllData();
    return { ok: true, message: "All data has been deleted. The app has been reset to a fresh state." };
  }

  return { exportBackup, downloadBackupFile, validateBackup, restoreFromFile, factoryReset };
})();
