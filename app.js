/* ============================================================
   KXS SARI-SARI STORE POS — app.js
   Main UI controller: routing, rendering, event wiring.
   ============================================================ */

const App = (() => {
  let state = {
    settings: { ...DEFAULT_SETTINGS },
    route: "dashboard",
    productFilter: "",
    productsSort: "name",
    scannerActive: false
  };

  const root = document.getElementById("app-root");

  // ---------- utils ----------
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function money(n) {
    const cur = state.settings.currency || "\u20B1";
    const v = Number(n) || 0;
    return cur + v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  }
  function toast(msg, type = "info") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.getElementById("toast-stack").appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, 3200);
  }
  function openModal(html, opts = {}) {
    const backdrop = document.getElementById("modal-backdrop");
    const box = document.getElementById("modal-box");
    box.innerHTML = html;
    box.className = "modal-box" + (opts.wide ? " modal-wide" : "");
    backdrop.classList.add("show");
  }
  function closeModal() {
    document.getElementById("modal-backdrop").classList.remove("show");
    document.getElementById("modal-box").innerHTML = "";
    BarcodeScanner.stop();
  }
  function confirmDialog(message, confirmLabel = "Confirm") {
    return new Promise(resolve => {
      openModal(`
        <div class="modal-header"><h3>Please Confirm</h3></div>
        <div class="modal-body"><p>${esc(message)}</p></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cd-cancel">Cancel</button>
          <button class="btn btn-danger" id="cd-ok">${esc(confirmLabel)}</button>
        </div>`);
      document.getElementById("cd-cancel").onclick = () => { closeModal(); resolve(false); };
      document.getElementById("cd-ok").onclick = () => { closeModal(); resolve(true); };
    });
  }

  // ---------- boot ----------
  async function boot() {
    await DB.open();
    await Products.ensureDefaultCategories();
    state.settings = await Settings.getAll();
    const activated = await License.isActivated();
    if (!activated) {
      renderLicenseScreen();
    } else {
      renderShell();
      navigate(location.hash.replace("#", "") || "dashboard");
    }
    window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "")));
  }

  function navigate(route) {
    if (!route) route = "dashboard";
    state.route = route;
    location.hash = route;
    document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.route === route));
    renderRoute();
  }

  async function renderRoute() {
    const content = document.getElementById("app-content");
    content.innerHTML = `<div class="loading">Loading...</div>`;
    try {
      switch (state.route) {
        case "dashboard": return renderDashboard();
        case "pos": return renderPOS();
        case "products": return renderProducts();
        case "inventory": return renderInventory();
        case "sales": return renderSales();
        case "customers": return renderCustomers();
        case "suppliers": return renderSuppliers();
        case "expenses": return renderExpenses();
        case "reports": return renderReports();
        case "backup": return renderBackupPage();
        case "settings": return renderSettingsPage();
        default: return renderDashboard();
      }
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="empty-state"><h3>Something went wrong</h3><p>${esc(err.message || err)}</p></div>`;
    }
  }

  // ============================================================
  // LICENSE SCREEN
  // ============================================================
  function renderLicenseScreen() {
    root.innerHTML = `
      <div class="license-screen">
        <div class="license-card">
          <div class="license-brand">KXS</div>
          <h1>KXS SARI-SARI STORE POS</h1>
          <p class="license-sub">LICENSE ACTIVATION</p>
          <div class="field">
            <label>Enter License Key</label>
            <input id="license-input" type="text" placeholder="KXS-MRP-001-XXXX" autocomplete="off" autocapitalize="characters">
          </div>
          <button class="btn btn-primary btn-block" id="activate-btn">ACTIVATE</button>
          <div id="license-msg" class="license-msg"></div>
          <p class="license-footnote">This app works fully offline. Your license key was provided with your purchase.</p>
        </div>
      </div>`;
    const input = document.getElementById("license-input");
    input.addEventListener("input", () => {
      let v = input.value.toUpperCase();
      input.value = v;
    });
    document.getElementById("activate-btn").onclick = async () => {
      const msg = document.getElementById("license-msg");
      msg.textContent = "";
      const key = input.value.trim();
      const btn = document.getElementById("activate-btn");
      btn.disabled = true; btn.textContent = "Checking...";
      const result = await License.activate(key);
      btn.disabled = false; btn.textContent = "ACTIVATE";
      if (result.ok) {
        msg.className = "license-msg success";
        msg.textContent = "License Activated Successfully";
        setTimeout(async () => {
          renderShell();
          navigate("dashboard");
        }, 700);
      } else {
        msg.className = "license-msg error";
        msg.textContent = result.message;
      }
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("activate-btn").click(); });
  }

  // ============================================================
  // APP SHELL
  // ============================================================
  const NAV_ITEMS = [
    ["dashboard", "Dashboard"], ["pos", "POS"], ["products", "Products"],
    ["inventory", "Inventory"], ["sales", "Sales"], ["customers", "Customers / Utang"],
    ["suppliers", "Suppliers"], ["expenses", "Expenses"], ["reports", "Reports"],
    ["backup", "Backup"], ["settings", "Settings"]
  ];

  function renderShell() {
    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <button class="hamburger" id="hamburger">&#9776;</button>
          <div class="topbar-title">${esc(state.settings.store_name)}</div>
          <div class="topbar-spacer"></div>
        </header>
        <nav class="sidenav" id="sidenav">
          <div class="brand">KXS <span>SARI-SARI POS</span></div>
          ${NAV_ITEMS.map(([r, label]) => `<a href="#${r}" class="nav-link" data-route="${r}">${esc(label)}</a>`).join("")}
        </nav>
        <main id="app-content" class="app-content"></main>
      </div>
      <div class="toast-stack" id="toast-stack"></div>
      <div class="modal-backdrop" id="modal-backdrop"><div class="modal-box" id="modal-box"></div></div>
    `;
    document.getElementById("hamburger").onclick = () => document.getElementById("sidenav").classList.toggle("open");
    document.getElementById("modal-backdrop").addEventListener("click", (e) => {
      if (e.target.id === "modal-backdrop") closeModal();
    });
    document.querySelectorAll(".nav-link").forEach(a => {
      a.addEventListener("click", () => document.getElementById("sidenav").classList.remove("open"));
    });
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  async function renderDashboard() {
    const s = await Reports.dashboardSummary();
    const content = document.getElementById("app-content");
    content.innerHTML = `
      <h2 class="page-title">Dashboard</h2>
      <div class="grid-cards">
        ${dashCard("Today's Sales", money(s.todaysSales))}
        ${dashCard("Transactions", s.transactions)}
        ${dashCard("Estimated Profit", money(s.estimatedProfit))}
        ${dashCard("Expenses", money(s.expenses))}
        ${dashCard("Net Profit", money(s.netProfit))}
        ${dashCard("Low Stock", s.lowStockCount + " products", s.lowStockCount > 0 ? "warn" : "")}
        ${dashCard("Out of Stock", s.outOfStockCount + " products", s.outOfStockCount > 0 ? "danger" : "")}
        ${dashCard("Outstanding Utang", money(s.outstandingUtang))}
        ${dashCard("Inventory Value", money(s.inventoryValue))}
      </div>
      <div class="quick-actions">
        <a href="#pos" class="btn btn-primary">Go to POS</a>
        <a href="#products" class="btn btn-ghost">Add Product</a>
        <a href="#inventory" class="btn btn-ghost">Stock-In</a>
      </div>`;
  }
  function dashCard(label, value, cls = "") {
    return `<div class="card dash-card ${cls}"><div class="dash-value">${value}</div><div class="dash-label">${esc(label)}</div></div>`;
  }

  // ============================================================
  // POS
  // ============================================================
  async function renderPOS() {
    const content = document.getElementById("app-content");
    content.innerHTML = `
      <div class="pos-layout">
        <div class="pos-search-col">
          <h2 class="page-title">POS</h2>
          <div class="pos-search-row">
            <input id="pos-search" type="text" placeholder="Search Product Code, Name, or Barcode" autocomplete="off">
            <button class="btn btn-ghost" id="pos-scan-btn">Scan</button>
          </div>
          <div id="pos-results" class="pos-results"></div>
        </div>
        <div class="pos-cart-col">
          <div class="pos-pricing-toggle">
            <label><input type="radio" name="pricing" value="RETAIL" checked> Retail</label>
            <label><input type="radio" name="pricing" value="WHOLESALE"> Wholesale</label>
          </div>
          <div id="cart-items" class="cart-items"></div>
          <div class="cart-total-row"><span>TOTAL</span><span id="cart-total">${money(0)}</span></div>
          <div class="cart-actions">
            <button class="btn btn-ghost" id="cart-clear">Clear Cart</button>
            <button class="btn btn-primary" id="cart-checkout">Complete Sale</button>
          </div>
        </div>
      </div>`;

    const searchInput = document.getElementById("pos-search");
    searchInput.addEventListener("input", async () => {
      const results = await Products.searchProducts(searchInput.value);
      renderPosResults(results.slice(0, 30), searchInput.value);
    });
    searchInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const term = searchInput.value.trim();
        const byCode = await Products.getProduct(term);
        const byBarcode = await Products.findByBarcode(term);
        const p = byCode || byBarcode;
        if (p) { addToCartFlow(p); searchInput.value = ""; document.getElementById("pos-results").innerHTML = ""; }
        else if (term) { openManualProductModal(term); }
      }
    });
    document.querySelectorAll('input[name="pricing"]').forEach(r => {
      r.addEventListener("change", () => { Cart.setPricingMode(r.value); rerenderCart(); });
    });
    document.getElementById("pos-scan-btn").onclick = () => openScannerModal(async (code) => {
      const p = await Products.findByBarcode(code) || await Products.getProduct(code);
      if (p) { addToCartFlow(p); } else { openManualProductModal(""); }
    });
    document.getElementById("cart-clear").onclick = async () => {
      if (!Cart.getItems().length) return;
      const ok = await confirmDialog("Clear all items from the cart?");
      if (ok) { Cart.clear(); rerenderCart(); }
    };
    document.getElementById("cart-checkout").onclick = () => openCheckoutModal();
    rerenderCart();
  }

  function renderPosResults(list, term = "") {
    const box = document.getElementById("pos-results");
    if (!list.length) {
      box.innerHTML = term.trim() ? `<div class="empty-state small">No product found. <button class="btn btn-ghost" id="manual-product-btn">Manually Enter Product</button></div>` : "";
      document.getElementById("manual-product-btn")?.addEventListener("click", () => openManualProductModal(term));
      return;
    }
    box.innerHTML = list.map(p => `
      <div class="pos-result-row" data-code="${esc(p.product_code)}">
        <div class="pos-result-main">
          <div class="pos-result-name">${esc(p.product_name)}</div>
          <div class="pos-result-sub">${esc(p.product_code)} &middot; ${p.qty} ${esc(p.unit)} in stock</div>
        </div>
        <div class="pos-result-price">${money(p.selling_price)}</div>
      </div>`).join("");
    box.querySelectorAll(".pos-result-row").forEach(row => {
      row.addEventListener("click", async () => {
        const p = await Products.getProduct(row.dataset.code);
        addToCartFlow(p);
      });
    });
  }

  function addToCartFlow(p) {
    if (!p) return;
    const res = Cart.addProduct(p, 1);
    if (!res.ok) { toast(res.message, "error"); return; }
    rerenderCart();
  }

  function openManualProductModal(defaultName = "") {
    const units = ["PCS", "PIECE", "SACHET", "BOTTLE", "CAN", "PACK", "BOX", "BUNDLE", "KILO", "GRAM", "LITER", "OTHER"];
    openModal(`
      <div class="modal-header"><h3>Manually Enter Product</h3></div>
      <div class="modal-body">
        <p class="hint">This is a non-inventory item. It will be included in the sale but will not change product stock.</p>
        <div class="form-grid">
          <div class="field"><label>Product Name</label><input id="manual-name" value="${esc(defaultName)}" autocomplete="off"></div>
          <div class="field"><label>Unit</label><select id="manual-unit">${units.map(unit => `<option value="${unit}">${unit}</option>`).join("")}</select></div>
          <div class="field"><label>Quantity / Number of Pieces</label><input id="manual-qty" type="number" min="0.001" step="any" value="1"></div>
          <div class="field"><label>Amount / Selling Price</label><input id="manual-price" type="number" min="0" step="0.01" inputmode="decimal"></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="manual-cancel">Cancel</button>
        <button class="btn btn-primary" id="manual-add">Add to Cart</button>
      </div>`);
    document.getElementById("manual-cancel").onclick = closeModal;
    document.getElementById("manual-add").onclick = () => {
      const result = Cart.addManualItem(
        document.getElementById("manual-name").value,
        document.getElementById("manual-unit").value,
        document.getElementById("manual-qty").value,
        document.getElementById("manual-price").value
      );
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal();
      document.getElementById("pos-search").value = "";
      document.getElementById("pos-results").innerHTML = "";
      rerenderCart();
      toast(result.message, "success");
    };
    document.getElementById("manual-name").focus();
  }

  function rerenderCart() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    const items = Cart.getItems();
    if (!items.length) {
      box.innerHTML = `<div class="empty-state small">Cart is empty. Search or scan a product to begin.</div>`;
    } else {
      box.innerHTML = items.map(i => `
        <div class="cart-row" data-code="${esc(i.product_code)}">
          <div class="cart-row-main">
            <div class="cart-row-name">${esc(i.product_name)}${i.manual_entry ? " <small>(Manual Entry)</small>" : ""}</div>
            <div class="cart-row-sub">${money(i.price)} &times; <input type="number" min="1" class="qty-input" value="${i.qty}" data-code="${esc(i.product_code)}"> ${esc(i.unit)}</div>
          </div>
          <div class="cart-row-right">
            <div class="cart-row-subtotal">${money(i.subtotal)}</div>
            <button class="link-danger remove-item" data-code="${esc(i.product_code)}">Remove</button>
          </div>
        </div>`).join("");
      box.querySelectorAll(".qty-input").forEach(inp => {
        inp.addEventListener("change", () => {
          const r = Cart.updateQty(inp.dataset.code, Number(inp.value));
          if (!r.ok) toast(r.message, "error");
          rerenderCart();
        });
      });
      box.querySelectorAll(".remove-item").forEach(btn => {
        btn.addEventListener("click", () => { Cart.removeItem(btn.dataset.code); rerenderCart(); });
      });
    }
    document.getElementById("cart-total").textContent = money(Cart.total());
  }

  function openScannerModal(onDetected) {
    openModal(`
      <div class="modal-header"><h3>Scan Barcode</h3></div>
      <div class="modal-body">
        <video id="scan-video" playsinline muted class="scan-video"></video>
        <p class="hint" id="scan-hint">Point the camera at the barcode.</p>
        <div class="field">
          <label>Or enter barcode manually</label>
          <div style="display:flex; gap:8px;">
            <input id="scan-manual" type="text" placeholder="Barcode number">
            <button class="btn btn-ghost" id="scan-manual-go">Find</button>
          </div>
        </div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="scan-cancel">Close</button></div>`);
    const video = document.getElementById("scan-video");
    BarcodeScanner.start(video, (value) => { closeModal(); onDetected(value); }).then(res => {
      if (!res.ok) document.getElementById("scan-hint").textContent = res.message;
    });
    document.getElementById("scan-cancel").onclick = () => closeModal();
    document.getElementById("scan-manual-go").onclick = () => {
      const v = document.getElementById("scan-manual").value.trim();
      if (v) { closeModal(); onDetected(v); }
    };
  }

  async function openCheckoutModal() {
    const items = Cart.getItems();
    if (!items.length) { toast("Cart is empty.", "error"); return; }
    const total = Cart.total();
    const customers = await Customers.getAll();
    openModal(`
      <div class="modal-header"><h3>Complete Sale</h3></div>
      <div class="modal-body">
        <div class="checkout-total">TOTAL <span>${money(total)}</span></div>
        <div class="field">
          <label>Payment Type</label>
          <select id="pay-type">
            <option value="CASH">CASH</option>
            <option value="UTANG">UTANG / CREDIT</option>
          </select>
        </div>
        <div id="pay-cash-fields">
          <div class="field"><label>Cash Received</label><input id="pay-cash" type="number" min="0" step="0.01" placeholder="0.00"></div>
          <div class="field"><label>Change</label><input id="pay-change" type="text" readonly value="${money(0)}"></div>
        </div>
        <div id="pay-utang-fields" style="display:none;">
          <div class="field"><label>Customer</label>
            <select id="pay-customer">
              <option value="">Select customer...</option>
              ${customers.map(c => `<option value="${c.id}">${esc(c.name)} (Bal: ${money(c.balance || 0)})</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="checkout-cancel">Cancel</button>
        <button class="btn btn-primary" id="checkout-confirm">Confirm Sale</button>
      </div>`);

    const payType = document.getElementById("pay-type");
    const cashFields = document.getElementById("pay-cash-fields");
    const utangFields = document.getElementById("pay-utang-fields");
    payType.addEventListener("change", () => {
      const isCash = payType.value === "CASH";
      cashFields.style.display = isCash ? "" : "none";
      utangFields.style.display = isCash ? "none" : "";
    });
    const cashInput = document.getElementById("pay-cash");
    cashInput.addEventListener("input", () => {
      const change = (Number(cashInput.value) || 0) - total;
      document.getElementById("pay-change").value = money(change >= 0 ? change : 0);
    });
    document.getElementById("checkout-cancel").onclick = closeModal;
    document.getElementById("checkout-confirm").onclick = async () => {
      const payment = { type: payType.value, pricing_mode: Cart.getPricingMode() };
      if (payment.type === "CASH") {
        payment.cash_received = Number(cashInput.value) || 0;
      } else {
        payment.customer_id = Number(document.getElementById("pay-customer").value) || null;
      }
      const result = await Sales.completeSale(items, payment);
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal();
      Cart.clear();
      await renderPOS();
      showReceipt(result.sale, result.items);
      toast("Sale completed.", "success");
    };
  }

  async function showReceipt(sale, items) {
    const s = state.settings;
    openModal(`
      <div class="receipt">
        <div class="receipt-header">
          <div class="receipt-store">${esc(s.store_name)}</div>
          ${s.address ? `<div>${esc(s.address)}</div>` : ""}
          ${s.contact ? `<div>${esc(s.contact)}</div>` : ""}
        </div>
        <div class="receipt-meta">
          <div>Txn: ${esc(sale.txn_number)}</div>
          <div>${fmtDate(sale.date)}</div>
        </div>
        <table class="receipt-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amt</th></tr></thead>
          <tbody>
            ${items.map(i => `<tr><td>${esc(i.product_name)}</td><td>${i.qty} ${esc(i.unit)}</td><td>${money(i.price)}</td><td>${money(i.subtotal)}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="receipt-total-row"><span>TOTAL</span><span>${money(sale.total)}</span></div>
        <div class="receipt-total-row"><span>Payment</span><span>${esc(sale.payment_type)}</span></div>
        ${sale.payment_type === "CASH" ? `
          <div class="receipt-total-row"><span>Cash</span><span>${money(sale.cash_received)}</span></div>
          <div class="receipt-total-row"><span>Change</span><span>${money(sale.change)}</span></div>` : ""}
        <div class="receipt-footer">${esc(s.receipt_footer || "")}</div>
      </div>
      <div class="modal-actions no-print">
        <button class="btn btn-ghost" id="receipt-close">Close</button>
        <button class="btn btn-primary" id="receipt-print">Print</button>
      </div>`, { wide: false });
    document.getElementById("receipt-close").onclick = closeModal;
    document.getElementById("receipt-print").onclick = () => window.print();
  }

  // ============================================================
  // PRODUCTS
  // ============================================================
  async function renderProducts() {
    const content = document.getElementById("app-content");
    const list = await Products.searchProducts(state.productFilter);
    content.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">Products</h2>
        <div class="page-header-actions">
          <button class="btn btn-ghost" id="csv-import-btn">Import CSV</button>
          <button class="btn btn-ghost" id="csv-export-btn">Export CSV</button>
          <button class="btn btn-primary" id="add-product-btn">+ Add Product</button>
        </div>
      </div>
      <input id="product-search" type="text" placeholder="Search by Product Code, Name, Barcode, Category, or Supplier" value="${esc(state.productFilter)}" class="search-input">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Stock</th><th>Unit</th><th>Price</th><th>Barcode</th><th></th></tr></thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td>${esc(p.product_code)}</td>
                <td>${esc(p.product_name)} ${Products.stockStatus(p) !== "OK" ? `<span class="badge badge-${Products.stockStatus(p) === "OUT_OF_STOCK" ? "danger" : "warn"}">${Products.stockStatus(p) === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}</span>` : ""}</td>
                <td>${p.qty}</td>
                <td>${esc(p.unit)}</td>
                <td>${money(p.selling_price)}</td>
                <td>${esc(p.barcode || "—")}</td>
                <td class="row-actions">
                  <button class="link-btn edit-product" data-code="${esc(p.product_code)}">Edit</button>
                  <button class="link-danger del-product" data-code="${esc(p.product_code)}">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="7"><div class="empty-state small">No products found. Click "Add Product" to encode your first item.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <input type="file" id="csv-file-input" accept=".csv" style="display:none;">
    `;
    document.getElementById("product-search").addEventListener("input", (e) => {
      state.productFilter = e.target.value;
      renderProducts();
    });
    document.getElementById("add-product-btn").onclick = () => openProductForm();
    content.querySelectorAll(".edit-product").forEach(btn => {
      btn.onclick = async () => openProductForm(await Products.getProduct(btn.dataset.code));
    });
    content.querySelectorAll(".del-product").forEach(btn => {
      btn.onclick = async () => {
        const ok = await confirmDialog(`Delete product ${btn.dataset.code}? This cannot be undone.`);
        if (ok) { await Products.deleteProduct(btn.dataset.code); toast("Product deleted.", "success"); renderProducts(); }
      };
    });
    document.getElementById("csv-export-btn").onclick = async () => {
      const csv = await Products.exportProductsCSV();
      downloadText(csv, "products.csv");
    };
    document.getElementById("csv-import-btn").onclick = () => document.getElementById("csv-file-input").click();
    document.getElementById("csv-file-input").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const summary = await Products.importProductsCSV(text);
      toast(`Import done: ${summary.added} added, ${summary.updated} updated, ${summary.skipped} skipped.`, summary.errors.length ? "error" : "success");
      renderProducts();
    };
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function openProductForm(existing) {
    const categories = await DB.getAll("categories");
    const suppliers = await Suppliers.getAll();
    const isEdit = !!existing;
    const p = existing || { unit: "PCS", category: "Other", minimum_stock: state.settings.default_min_stock || 5 };
    openModal(`
      <div class="modal-header"><h3>${isEdit ? "Edit Product" : "Add Product"}</h3></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field">
            <label>Product Code</label>
            <div style="display:flex; gap:8px;">
              <input id="f-code" type="text" value="${esc(p.product_code || "")}" ${isEdit ? "readonly" : ""}>
              ${isEdit ? "" : `<button class="btn btn-ghost" id="f-gen-code" type="button">Auto</button>`}
            </div>
          </div>
          <div class="field"><label>Product Name</label><input id="f-name" type="text" value="${esc(p.product_name || "")}"></div>
          <div class="field"><label>Category</label>
            <select id="f-category">${categories.map(c => `<option value="${esc(c.name)}" ${p.category === c.name ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Quantity / Stock</label><input id="f-qty" type="number" min="0" value="${p.qty ?? 0}"></div>
          <div class="field"><label>Unit</label>
            <select id="f-unit">${UNITS.map(u => `<option value="${u}" ${p.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Cost Price</label><input id="f-cost" type="number" min="0" step="0.01" value="${p.cost_price ?? ""}"></div>
          <div class="field"><label>Selling Price</label><input id="f-price" type="number" min="0" step="0.01" value="${p.selling_price ?? ""}"></div>
          <div class="field"><label>Wholesale Price — Optional</label><input id="f-wprice" type="number" min="0" step="0.01" value="${p.wholesale_price ?? ""}"></div>
          <div class="field"><label>Barcode — Optional</label>
            <div style="display:flex; gap:8px;">
              <input id="f-barcode" type="text" value="${esc(p.barcode || "")}">
              <button class="btn btn-ghost" id="f-scan-barcode" type="button">Scan</button>
            </div>
          </div>
          <div class="field"><label>Minimum Stock</label><input id="f-minstock" type="number" min="0" value="${p.minimum_stock ?? 5}"></div>
          <div class="field"><label>Supplier</label>
            <select id="f-supplier"><option value="">None</option>${suppliers.map(s => `<option value="${esc(s.name)}" ${p.supplier === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field"><label>Notes</label><textarea id="f-notes">${esc(p.notes || "")}</textarea></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="f-cancel">CANCEL</button>
        <button class="btn btn-ghost" id="f-clear">CLEAR</button>
        <button class="btn btn-primary" id="f-save">SAVE PRODUCT</button>
      </div>`, { wide: true });

    document.getElementById("f-gen-code") && (document.getElementById("f-gen-code").onclick = async () => {
      document.getElementById("f-code").value = await Products.generateProductCode();
    });
    document.getElementById("f-scan-barcode").onclick = () => openScannerModal((val) => {
      // reopen product form and set barcode
      openProductForm({ ...p, ...readForm(), barcode: val });
    });
    function readForm() {
      return {
        product_code: document.getElementById("f-code").value,
        product_name: document.getElementById("f-name").value,
        category: document.getElementById("f-category").value,
        qty: document.getElementById("f-qty").value,
        unit: document.getElementById("f-unit").value,
        cost_price: document.getElementById("f-cost").value,
        selling_price: document.getElementById("f-price").value,
        wholesale_price: document.getElementById("f-wprice").value,
        barcode: document.getElementById("f-barcode").value,
        minimum_stock: document.getElementById("f-minstock").value,
        supplier: document.getElementById("f-supplier").value,
        notes: document.getElementById("f-notes").value
      };
    }
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-clear").onclick = () => openProductForm(isEdit ? existing : null);
    document.getElementById("f-save").onclick = async () => {
      const result = await Products.saveProduct(readForm(), isEdit);
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal();
      toast(result.message, "success");
      renderProducts();
    };
  }

  // ============================================================
  // INVENTORY (stock-in, adjustment, low stock)
  // ============================================================
  async function renderInventory(tab = "stockin") {
    const content = document.getElementById("app-content");
    content.innerHTML = `
      <h2 class="page-title">Inventory</h2>
      <div class="tabs">
        <button class="tab-btn ${tab === "stockin" ? "active" : ""}" data-tab="stockin">Stock-In</button>
        <button class="tab-btn ${tab === "adjust" ? "active" : ""}" data-tab="adjust">Stock Adjustment</button>
        <button class="tab-btn ${tab === "low" ? "active" : ""}" data-tab="low">Low / Out of Stock</button>
      </div>
      <div id="inv-tab-content"></div>`;
    content.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => renderInventory(b.dataset.tab));
    const box = document.getElementById("inv-tab-content");
    if (tab === "stockin") await renderStockInTab(box);
    else if (tab === "adjust") await renderAdjustTab(box);
    else await renderLowStockTab(box);
  }

  async function renderStockInTab(box) {
    const products = await Products.getAllProducts();
    const suppliers = await Suppliers.getAll();
    const history = await Inventory.stockInHistory();
    box.innerHTML = `
      <div class="card form-card">
        <h3>Receive Stock</h3>
        <div class="form-grid">
          <div class="field"><label>Product</label>
            <select id="si-product">${products.map(p => `<option value="${esc(p.product_code)}">${esc(p.product_code)} — ${esc(p.product_name)} (current: ${p.qty})</option>`).join("")}</select>
          </div>
          <div class="field"><label>Supplier</label>
            <select id="si-supplier"><option value="">None</option>${suppliers.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Quantity</label><input id="si-qty" type="number" min="1" value="1"></div>
          <div class="field"><label>Cost Price</label><input id="si-cost" type="number" min="0" step="0.01"></div>
          <div class="field"><label>Reference Number</label><input id="si-ref" type="text"></div>
        </div>
        <div class="field"><label>Notes</label><textarea id="si-notes"></textarea></div>
        <button class="btn btn-primary" id="si-save">Save Stock-In</button>
      </div>
      <h3 class="section-title">Stock-In History</h3>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Cost</th><th>Supplier</th><th>New Stock</th></tr></thead>
        <tbody>${history.map(h => `<tr><td>${fmtDate(h.date)}</td><td>${esc(h.product_name)}</td><td>+${h.qty}</td><td>${money(h.cost_price)}</td><td>${esc(h.supplier || "—")}</td><td>${h.new_qty}</td></tr>`).join("") || `<tr><td colspan="6"><div class="empty-state small">No stock-in records yet.</div></td></tr>`}</tbody>
      </table></div>`;
    document.getElementById("si-save").onclick = async () => {
      const result = await Inventory.stockIn({
        product_code: document.getElementById("si-product").value,
        supplier: document.getElementById("si-supplier").value,
        qty: document.getElementById("si-qty").value,
        cost_price: document.getElementById("si-cost").value,
        reference: document.getElementById("si-ref").value,
        notes: document.getElementById("si-notes").value
      });
      if (!result.ok) { toast(result.message, "error"); return; }
      toast(result.message, "success");
      renderInventory("stockin");
    };
  }

  async function renderAdjustTab(box) {
    const products = await Products.getAllProducts();
    const history = await Inventory.adjustmentHistory();
    box.innerHTML = `
      <div class="card form-card">
        <h3>Adjust Stock</h3>
        <div class="form-grid">
          <div class="field"><label>Product</label>
            <select id="adj-product">${products.map(p => `<option value="${esc(p.product_code)}">${esc(p.product_code)} — ${esc(p.product_name)} (current: ${p.qty})</option>`).join("")}</select>
          </div>
          <div class="field"><label>New Quantity</label><input id="adj-qty" type="number" min="0"></div>
          <div class="field"><label>Reason</label>
            <select id="adj-reason">${Inventory.ADJUSTMENT_REASONS.map(r => `<option value="${r}">${r}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field"><label>Notes</label><textarea id="adj-notes"></textarea></div>
        <button class="btn btn-primary" id="adj-save">Save Adjustment</button>
      </div>
      <h3 class="section-title">Adjustment History</h3>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Product</th><th>Previous</th><th>Adjustment</th><th>New</th><th>Reason</th></tr></thead>
        <tbody>${history.map(h => `<tr><td>${fmtDate(h.date)}</td><td>${esc(h.product_name)}</td><td>${h.previous_qty}</td><td>${h.adjustment > 0 ? "+" : ""}${h.adjustment}</td><td>${h.new_qty}</td><td>${esc(h.reason)}</td></tr>`).join("") || `<tr><td colspan="6"><div class="empty-state small">No adjustments yet.</div></td></tr>`}</tbody>
      </table></div>`;
    document.getElementById("adj-save").onclick = async () => {
      const result = await Inventory.adjustStock({
        product_code: document.getElementById("adj-product").value,
        new_qty: document.getElementById("adj-qty").value,
        reason: document.getElementById("adj-reason").value,
        notes: document.getElementById("adj-notes").value
      });
      if (!result.ok) { toast(result.message, "error"); return; }
      toast(result.message, "success");
      renderInventory("adjust");
    };
  }

  async function renderLowStockTab(box) {
    const low = await Products.lowStockProducts();
    const out = await Products.outOfStockProducts();
    box.innerHTML = `
      <h3 class="section-title">Out of Stock (${out.length})</h3>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Code</th><th>Name</th><th>Stock</th><th>Minimum</th></tr></thead>
        <tbody>${out.map(p => `<tr><td>${esc(p.product_code)}</td><td>${esc(p.product_name)}</td><td>${p.qty}</td><td>${p.minimum_stock}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state small">Nothing out of stock.</div></td></tr>`}</tbody>
      </table></div>
      <h3 class="section-title">Low Stock (${low.length})</h3>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Code</th><th>Name</th><th>Stock</th><th>Minimum</th></tr></thead>
        <tbody>${low.map(p => `<tr><td>${esc(p.product_code)}</td><td>${esc(p.product_name)}</td><td>${p.qty}</td><td>${p.minimum_stock}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state small">Nothing low on stock.</div></td></tr>`}</tbody>
      </table></div>`;
  }

  // ============================================================
  // SALES HISTORY + RETURNS
  // ============================================================
  async function renderSales() {
    const content = document.getElementById("app-content");
    const list = await Sales.history();
    content.innerHTML = `
      <h2 class="page-title">Sales History</h2>
      <div class="filter-row">
        <input id="sales-search" type="text" placeholder="Search Transaction Number">
        <select id="sales-payment-filter">
          <option value="">All Payment Types</option>
          <option value="CASH">Cash</option>
          <option value="UTANG">Utang / Credit</option>
        </select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Txn #</th><th>Date</th><th>Total</th><th>Payment</th><th></th></tr></thead>
        <tbody id="sales-tbody">${salesRows(list)}</tbody>
      </table></div>`;
    async function refresh() {
      const rows = await Sales.history({
        term: document.getElementById("sales-search").value,
        paymentType: document.getElementById("sales-payment-filter").value
      });
      document.getElementById("sales-tbody").innerHTML = salesRows(rows);
      wireSalesRows();
    }
    document.getElementById("sales-search").addEventListener("input", refresh);
    document.getElementById("sales-payment-filter").addEventListener("change", refresh);
    wireSalesRows();
  }
  function salesRows(list) {
    return list.map(s => `
      <tr><td>${esc(s.txn_number)}</td><td>${fmtDate(s.date)}</td><td>${money(s.total)}</td><td>${esc(s.payment_type)}</td>
      <td class="row-actions"><button class="link-btn view-sale" data-id="${s.id}">View</button></td></tr>`).join("")
      || `<tr><td colspan="5"><div class="empty-state small">No sales recorded yet.</div></td></tr>`;
  }
  function wireSalesRows() {
    document.querySelectorAll(".view-sale").forEach(btn => {
      btn.onclick = async () => {
        const sale = await Sales.getSale(Number(btn.dataset.id));
        const items = await Sales.getSaleItems(sale.id);
        showSaleDetail(sale, items);
      };
    });
  }
  async function showSaleDetail(sale, items) {
    openModal(`
      <div class="modal-header"><h3>Transaction ${esc(sale.txn_number)}</h3></div>
      <div class="modal-body">
        <p>${fmtDate(sale.date)} &middot; ${esc(sale.payment_type)}</p>
        <table class="data-table">
          <thead><tr><th><input type="checkbox" id="ret-all"></th><th>Item</th><th>Qty</th><th>Price</th><th>Amt</th></tr></thead>
          <tbody>${items.map(i => `<tr><td><input type="checkbox" class="ret-check" data-id="${i.id}" data-code="${esc(i.product_code)}" data-qty="${i.qty}" data-price="${i.price}" data-manual="${i.manual_entry ? "1" : "0"}"></td><td>${esc(i.product_name)}${i.manual_entry ? " <small>(Manual Entry)</small>" : ""}</td><td>${i.qty} ${esc(i.unit)}</td><td>${money(i.price)}</td><td>${money(i.subtotal)}</td></tr>`).join("")}</tbody>
        </table>
        <div class="receipt-total-row"><span>TOTAL</span><span>${money(sale.total)}</span></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="sale-close">Close</button>
        <button class="btn btn-danger" id="sale-return">Process Return</button>
        <button class="btn btn-primary" id="sale-reprint">Print Receipt</button>
      </div>`, { wide: true });
    document.getElementById("ret-all").onchange = (e) => {
      document.querySelectorAll(".ret-check").forEach(c => c.checked = e.target.checked);
    };
    document.getElementById("sale-close").onclick = closeModal;
    document.getElementById("sale-reprint").onclick = () => showReceipt(sale, items);
    document.getElementById("sale-return").onclick = async () => {
      const checked = Array.from(document.querySelectorAll(".ret-check:checked"));
      if (!checked.length) { toast("Select at least one item to return.", "error"); return; }
      const ok = await confirmDialog("Process return for the selected item(s)? Stock will be added back.");
      if (!ok) return;
      const items = checked.map(c => ({ product_code: c.dataset.code, qty: Number(c.dataset.qty), price: Number(c.dataset.price), manual_entry: c.dataset.manual === "1" }));
      const result = await Returns.processReturn(sale.id, items, "Customer return");
      if (!result.ok) { toast(result.message, "error"); return; }
      toast(result.message, "success");
      closeModal();
      renderSales();
    };
  }

  // ============================================================
  // CUSTOMERS / UTANG
  // ============================================================
  async function renderCustomers() {
    const content = document.getElementById("app-content");
    const list = await Customers.getAll();
    content.innerHTML = `
      <div class="page-header"><h2 class="page-title">Customers / Utang</h2>
        <button class="btn btn-primary" id="add-customer-btn">+ Add Customer</button></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Contact</th><th>Balance</th><th></th></tr></thead>
        <tbody>${list.map(c => `
          <tr><td>${esc(c.name)}</td><td>${esc(c.contact || "—")}</td><td>${money(c.balance || 0)}</td>
          <td class="row-actions">
            <button class="link-btn c-pay" data-id="${c.id}">Payment</button>
            <button class="link-btn c-edit" data-id="${c.id}">Edit</button>
            <button class="link-btn c-ledger" data-id="${c.id}">Ledger</button>
          </td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state small">No customers yet.</div></td></tr>`}</tbody>
      </table></div>`;
    document.getElementById("add-customer-btn").onclick = () => openCustomerForm();
    content.querySelectorAll(".c-edit").forEach(b => b.onclick = async () => openCustomerForm(await Customers.get(Number(b.dataset.id))));
    content.querySelectorAll(".c-pay").forEach(b => b.onclick = async () => openPaymentForm(await Customers.get(Number(b.dataset.id))));
    content.querySelectorAll(".c-ledger").forEach(b => b.onclick = async () => showLedger(await Customers.get(Number(b.dataset.id))));
  }
  function openCustomerForm(existing) {
    const c = existing || {};
    openModal(`
      <div class="modal-header"><h3>${existing ? "Edit Customer" : "Add Customer"}</h3></div>
      <div class="modal-body">
        <div class="field"><label>Customer Name</label><input id="cf-name" value="${esc(c.name || "")}"></div>
        <div class="field"><label>Contact Number</label><input id="cf-contact" value="${esc(c.contact || "")}"></div>
        <div class="field"><label>Address / Notes</label><textarea id="cf-notes">${esc(c.notes || "")}</textarea></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="cf-cancel">Cancel</button><button class="btn btn-primary" id="cf-save">Save</button></div>`);
    document.getElementById("cf-cancel").onclick = closeModal;
    document.getElementById("cf-save").onclick = async () => {
      const result = await Customers.save({ id: c.id, name: document.getElementById("cf-name").value, contact: document.getElementById("cf-contact").value, notes: document.getElementById("cf-notes").value, balance: c.balance });
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal(); toast(result.message, "success"); renderCustomers();
    };
  }
  function openPaymentForm(c) {
    openModal(`
      <div class="modal-header"><h3>Record Payment — ${esc(c.name)}</h3></div>
      <div class="modal-body">
        <p>Current Balance: <strong>${money(c.balance || 0)}</strong></p>
        <div class="field"><label>Payment Amount</label><input id="pf-amount" type="number" min="0" step="0.01"></div>
        <div class="field"><label>Notes</label><input id="pf-notes"></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="pf-cancel">Cancel</button><button class="btn btn-primary" id="pf-save">Save Payment</button></div>`);
    document.getElementById("pf-cancel").onclick = closeModal;
    document.getElementById("pf-save").onclick = async () => {
      const result = await Customers.recordPayment(c.id, Number(document.getElementById("pf-amount").value), document.getElementById("pf-notes").value);
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal(); toast(result.message, "success"); renderCustomers();
    };
  }
  async function showLedger(c) {
    const rows = await Customers.ledgerFor(c.id);
    openModal(`
      <div class="modal-header"><h3>Utang Ledger — ${esc(c.name)}</h3></div>
      <div class="modal-body">
        <table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance After</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${money(r.amount)}</td><td>${money(r.balance_after)}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state small">No transactions yet.</div></td></tr>`}</tbody></table>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="ledger-close">Close</button></div>`, { wide: true });
    document.getElementById("ledger-close").onclick = closeModal;
  }

  // ============================================================
  // SUPPLIERS
  // ============================================================
  async function renderSuppliers() {
    const content = document.getElementById("app-content");
    const list = await Suppliers.getAll();
    content.innerHTML = `
      <div class="page-header"><h2 class="page-title">Suppliers</h2><button class="btn btn-primary" id="add-supplier-btn">+ Add Supplier</button></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th></th></tr></thead>
        <tbody>${list.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.contact || "—")}</td><td>${esc(s.address || "—")}</td>
          <td class="row-actions"><button class="link-btn s-edit" data-id="${s.id}">Edit</button><button class="link-danger s-del" data-id="${s.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state small">No suppliers yet.</div></td></tr>`}</tbody>
      </table></div>`;
    document.getElementById("add-supplier-btn").onclick = () => openSupplierForm();
    content.querySelectorAll(".s-edit").forEach(b => b.onclick = async () => openSupplierForm(await Suppliers.get(Number(b.dataset.id))));
    content.querySelectorAll(".s-del").forEach(b => b.onclick = async () => {
      const ok = await confirmDialog("Delete this supplier?");
      if (ok) { await Suppliers.remove(Number(b.dataset.id)); renderSuppliers(); }
    });
  }
  function openSupplierForm(existing) {
    const s = existing || {};
    openModal(`
      <div class="modal-header"><h3>${existing ? "Edit Supplier" : "Add Supplier"}</h3></div>
      <div class="modal-body">
        <div class="field"><label>Supplier Name</label><input id="sf-name" value="${esc(s.name || "")}"></div>
        <div class="field"><label>Contact</label><input id="sf-contact" value="${esc(s.contact || "")}"></div>
        <div class="field"><label>Address</label><input id="sf-address" value="${esc(s.address || "")}"></div>
        <div class="field"><label>Notes</label><textarea id="sf-notes">${esc(s.notes || "")}</textarea></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="sf-cancel">Cancel</button><button class="btn btn-primary" id="sf-save">Save</button></div>`);
    document.getElementById("sf-cancel").onclick = closeModal;
    document.getElementById("sf-save").onclick = async () => {
      const result = await Suppliers.save({ id: s.id, name: document.getElementById("sf-name").value, contact: document.getElementById("sf-contact").value, address: document.getElementById("sf-address").value, notes: document.getElementById("sf-notes").value });
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal(); toast(result.message, "success"); renderSuppliers();
    };
  }

  // ============================================================
  // EXPENSES
  // ============================================================
  async function renderExpenses() {
    const content = document.getElementById("app-content");
    const list = await Expenses.getAll();
    content.innerHTML = `
      <div class="page-header"><h2 class="page-title">Expenses</h2><button class="btn btn-primary" id="add-expense-btn">+ Add Expense</button></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Name</th><th>Category</th><th>Amount</th><th></th></tr></thead>
        <tbody>${list.map(e => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.name)}</td><td>${esc(e.category)}</td><td>${money(e.amount)}</td>
          <td class="row-actions"><button class="link-danger e-del" data-id="${e.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty-state small">No expenses recorded.</div></td></tr>`}</tbody>
      </table></div>`;
    document.getElementById("add-expense-btn").onclick = () => openExpenseForm();
    content.querySelectorAll(".e-del").forEach(b => b.onclick = async () => {
      const ok = await confirmDialog("Delete this expense?");
      if (ok) { await Expenses.remove(Number(b.dataset.id)); renderExpenses(); }
    });
  }
  function openExpenseForm() {
    openModal(`
      <div class="modal-header"><h3>Add Expense</h3></div>
      <div class="modal-body">
        <div class="field"><label>Expense Name</label><input id="ef-name"></div>
        <div class="field"><label>Category</label><select id="ef-category">${Expenses.EXPENSE_CATEGORIES.map(c => `<option>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Amount</label><input id="ef-amount" type="number" min="0" step="0.01"></div>
        <div class="field"><label>Notes</label><textarea id="ef-notes"></textarea></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="ef-cancel">Cancel</button><button class="btn btn-primary" id="ef-save">Save</button></div>`);
    document.getElementById("ef-cancel").onclick = closeModal;
    document.getElementById("ef-save").onclick = async () => {
      const result = await Expenses.save({ name: document.getElementById("ef-name").value, category: document.getElementById("ef-category").value, amount: document.getElementById("ef-amount").value, notes: document.getElementById("ef-notes").value, date: new Date().toISOString() });
      if (!result.ok) { toast(result.message, "error"); return; }
      closeModal(); toast(result.message, "success"); renderExpenses();
    };
  }

  // ============================================================
  // REPORTS
  // ============================================================
  async function renderReports() {
    const content = document.getElementById("app-content");
    content.innerHTML = `
      <h2 class="page-title">Reports</h2>
      <div class="filter-row">
        <label>From <input id="rep-start" type="date"></label>
        <label>To <input id="rep-end" type="date"></label>
        <button class="btn btn-ghost" id="rep-run">Run Report</button>
      </div>
      <div id="rep-output"></div>`;
    document.getElementById("rep-run").onclick = runReports;
    runReports();

    async function runReports() {
      const startVal = document.getElementById("rep-start").value;
      const endVal = document.getElementById("rep-end").value;
      const start = startVal ? startVal + "T00:00:00.000Z" : null;
      const end = endVal ? endVal + "T23:59:59.999Z" : null;

      const sales = await Reports.salesReport(start, end);
      const profit = await Reports.profitReport(start, end);
      const inv = await Reports.inventoryReport();
      const utang = await Reports.utangReport();
      const best = await Reports.bestSellers(start, end, 10);
      const exp = await Reports.expenseReport(start, end);

      document.getElementById("rep-output").innerHTML = `
        <h3 class="section-title">Sales Report</h3>
        <div class="grid-cards">
          ${dashCard("Total Sales", money(sales.totalSales))}
          ${dashCard("Cash Sales", money(sales.cashSales))}
          ${dashCard("Utang Sales", money(sales.utangSales))}
          ${dashCard("Transactions", sales.count)}
        </div>
        <h3 class="section-title">Profit Report</h3>
        <div class="grid-cards">
          ${dashCard("Gross Sales", money(profit.grossSales))}
          ${dashCard("Cost of Goods", money(profit.cogs))}
          ${dashCard("Gross Profit", money(profit.grossProfit))}
          ${dashCard("Expenses", money(profit.totalExpenses))}
          ${dashCard("Net Profit", money(profit.netProfit))}
        </div>
        <h3 class="section-title">Inventory Report</h3>
        <div class="grid-cards">
          ${dashCard("Inventory Value (Cost)", money(inv.inventoryValue))}
          ${dashCard("Potential Retail Value", money(inv.retailValue))}
          ${dashCard("Potential Gross Profit", money(inv.grossProfitPotential))}
          ${dashCard("Low Stock", inv.lowStock.length)}
          ${dashCard("Out of Stock", inv.outOfStock.length)}
        </div>
        <h3 class="section-title">Utang Report</h3>
        <div class="grid-cards">${dashCard("Total Outstanding", money(utang.totalOutstanding))}${dashCard("Customers with Balance", utang.outstanding.length)}</div>
        <h3 class="section-title">Expense Report</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th>Total</th></tr></thead>
          <tbody>${Object.entries(exp.byCategory).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join("") || `<tr><td colspan="2"><div class="empty-state small">No expenses in range.</div></td></tr>`}</tbody></table></div>
        <h3 class="section-title">Best Sellers</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Qty Sold</th><th>Sales Amount</th><th>Est. Profit</th></tr></thead>
          <tbody>${best.bestSellers.map(b => `<tr><td>${esc(b.product_name)}</td><td>${b.qty}</td><td>${money(b.amount)}</td><td>${money(b.profit)}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state small">No sales in range.</div></td></tr>`}</tbody></table></div>
      `;
    }
  }

  // ============================================================
  // BACKUP / RESTORE
  // ============================================================
  async function renderBackupPage() {
    const content = document.getElementById("app-content");
    content.innerHTML = `
      <h2 class="page-title">Backup</h2>
      <div class="card form-card">
        <h3>Backup Data</h3>
        <p class="hint">Download a complete copy of your products, sales, inventory, customers, utang, suppliers, expenses, and settings.</p>
        <button class="btn btn-primary" id="backup-now">BACKUP DATA</button>
      </div>
      <div class="card form-card">
        <h3>Restore Data</h3>
        <p class="hint">Restore from a previously downloaded backup file. Your current data will be reviewed before anything is replaced.</p>
        <input type="file" id="restore-file" accept="application/json,.json">
        <button class="btn btn-danger" id="restore-now">IMPORT BACKUP</button>
      </div>
      <div class="card form-card">
        <h3>Export Data</h3>
        <button class="btn btn-ghost" id="export-products">EXPORT PRODUCTS</button>
        <button class="btn btn-ghost" id="export-sales">EXPORT SALES</button>
      </div>
      <div class="card form-card danger-card">
        <h3>Factory Reset</h3>
        <p class="hint">Permanently deletes all products, sales, inventory, customers, utang, suppliers, and expenses on this device. This cannot be undone.</p>
        <button class="btn btn-danger" id="factory-reset-btn">FACTORY RESET</button>
      </div>`;

    document.getElementById("backup-now").onclick = async () => {
      const dump = await Backup.exportBackup();
      Backup.downloadBackupFile(dump);
      toast("Backup downloaded.", "success");
    };
    document.getElementById("restore-now").onclick = async () => {
      const file = document.getElementById("restore-file").files[0];
      if (!file) { toast("Choose a backup file first.", "error"); return; }
      const ok = await confirmDialog("Restoring will replace your current data with the backup file's data. Continue?");
      if (!ok) return;
      const result = await Backup.restoreFromFile(file, "replace");
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) { state.settings = await Settings.getAll(); navigate("dashboard"); }
    };
    document.getElementById("export-products").onclick = async () => downloadText(await Products.exportProductsCSV(), "products.csv");
    document.getElementById("export-sales").onclick = async () => {
      const sales = await Sales.history();
      const csv = Products.toCSV(sales.map(s => ({ "Txn": s.txn_number, "Date": s.date, "Total": s.total, "Payment": s.payment_type })), ["Txn", "Date", "Total", "Payment"]);
      downloadText(csv, "sales.csv");
    };
    document.getElementById("factory-reset-btn").onclick = async () => {
      openModal(`
        <div class="modal-header"><h3>Factory Reset</h3></div>
        <div class="modal-body">
          <p>This will permanently delete all data on this device. Type <strong>DELETE ALL DATA</strong> to confirm.</p>
          <input id="fr-confirm" type="text" placeholder="DELETE ALL DATA">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="fr-cancel">Cancel</button>
          <button class="btn btn-danger" id="fr-go">Delete Everything</button>
        </div>`);
      document.getElementById("fr-cancel").onclick = closeModal;
      document.getElementById("fr-go").onclick = async () => {
        const result = await Backup.factoryReset(document.getElementById("fr-confirm").value);
        if (!result.ok) { toast(result.message, "error"); return; }
        closeModal();
        toast(result.message, "success");
        await Products.ensureDefaultCategories();
        navigate("dashboard");
      };
    };
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  async function renderSettingsPage() {
    const content = document.getElementById("app-content");
    const s = await Settings.getAll();
    const lic = await License.getActivation();
    content.innerHTML = `
      <h2 class="page-title">Settings</h2>
      <div class="card form-card">
        <h3>Store Profile</h3>
        <div class="form-grid">
          <div class="field"><label>Store Name</label><input id="set-name" value="${esc(s.store_name)}"></div>
          <div class="field"><label>Address</label><input id="set-address" value="${esc(s.address)}"></div>
          <div class="field"><label>Contact</label><input id="set-contact" value="${esc(s.contact)}"></div>
          <div class="field"><label>Currency Symbol</label><input id="set-currency" value="${esc(s.currency)}"></div>
          <div class="field"><label>Default Minimum Stock</label><input id="set-minstock" type="number" min="0" value="${s.default_min_stock}"></div>
        </div>
        <div class="field"><label>Receipt Footer Message</label><input id="set-footer" value="${esc(s.receipt_footer)}"></div>
        <button class="btn btn-primary" id="set-save">Save Settings</button>
      </div>
      <div class="card form-card">
        <h3>License Information</h3>
        <p>License: <strong>${esc(lic?.license_key || "—")}</strong></p>
        <p>Status: <span class="badge ${lic?.active ? "badge-ok" : "badge-danger"}">${lic?.active ? "ACTIVE" : "INACTIVE"}</span></p>
        <p class="hint">Activated ${lic?.activated_at ? fmtDate(lic.activated_at) : "—"}</p>
      </div>
      <div class="card form-card">
        <h3>Data Management</h3>
        <a class="btn btn-ghost" href="#backup">Go to Backup &amp; Restore</a>
      </div>`;
    document.getElementById("set-save").onclick = async () => {
      await Settings.setMany({
        store_name: document.getElementById("set-name").value || DEFAULT_SETTINGS.store_name,
        address: document.getElementById("set-address").value,
        contact: document.getElementById("set-contact").value,
        currency: document.getElementById("set-currency").value || DEFAULT_SETTINGS.currency,
        default_min_stock: Number(document.getElementById("set-minstock").value) || 5,
        receipt_footer: document.getElementById("set-footer").value
      });
      state.settings = await Settings.getAll();
      document.querySelector(".topbar-title").textContent = state.settings.store_name;
      toast("Settings saved.", "success");
    };
  }

  return { boot, navigate };
})();

document.addEventListener("DOMContentLoaded", () => { App.boot(); });
