/* ============================================================
   KXS SARI-SARI STORE POS — settings.js
   Store profile + receipt + app preferences
   ============================================================ */

const DEFAULT_SETTINGS = {
  store_name: "My Sari-Sari Store",
  address: "",
  contact: "",
  logo: "",              // base64 data URL, optional
  currency: "\u20B1",     // PHP peso sign
  receipt_footer: "Thank you for shopping with us!",
  default_min_stock: 5
};

const Settings = (() => {

  async function getAll() {
    const rows = await DB.getAll("settings");
    const map = { ...DEFAULT_SETTINGS };
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  async function get(key) {
    const rec = await DB.get("settings", key);
    return rec ? rec.value : DEFAULT_SETTINGS[key];
  }

  async function set(key, value) {
    await DB.put("settings", { key, value });
    return { ok: true };
  }

  async function setMany(obj) {
    for (const [key, value] of Object.entries(obj)) {
      await DB.put("settings", { key, value });
    }
    return { ok: true, message: "Settings saved." };
  }

  return { getAll, get, set, setMany, DEFAULT_SETTINGS };
})();
