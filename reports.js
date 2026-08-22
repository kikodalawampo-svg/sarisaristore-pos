/* ============================================================
   KXS SARI-SARI STORE POS — reports.js
   ============================================================ */

const Reports = (() => {

  function inRange(dateStr, start, end) {
    const d = new Date(dateStr).getTime();
    const s = start ? new Date(start).getTime() : -Infinity;
    const e = end ? new Date(end).getTime() : Infinity;
    return d >= s && d <= e;
  }

  async function salesReport(start, end) {
    const sales = (await DB.getAll("sales")).filter(s => inRange(s.date, start, end));
    const totalSales = sales.reduce((s, x) => s + x.total, 0);
    const cashSales = sales.filter(s => s.payment_type === "CASH").reduce((s, x) => s + x.total, 0);
    const utangSales = sales.filter(s => s.payment_type === "UTANG").reduce((s, x) => s + x.total, 0);
    return { sales, count: sales.length, totalSales, cashSales, utangSales };
  }

  async function inventoryReport() {
    const products = await DB.getAll("products");
    const lowStock = products.filter(p => Products.stockStatus(p) === "LOW_STOCK");
    const outOfStock = products.filter(p => Products.stockStatus(p) === "OUT_OF_STOCK");
    const inventoryValue = products.reduce((s, p) => s + (p.qty * (p.cost_price || 0)), 0);
    const retailValue = products.reduce((s, p) => s + (p.qty * (p.selling_price || 0)), 0);
    return { products, lowStock, outOfStock, inventoryValue, retailValue, grossProfitPotential: retailValue - inventoryValue };
  }

  async function profitReport(start, end) {
    const saleItems = await DB.getAll("sale_items");
    const sales = (await DB.getAll("sales")).filter(s => inRange(s.date, start, end));
    const saleIds = new Set(sales.map(s => s.id));
    const relevantItems = saleItems.filter(i => saleIds.has(i.sale_id));

    const products = await DB.getAll("products");
    const costMap = {};
    products.forEach(p => costMap[p.product_code] = p.cost_price || 0);

    let grossSales = 0, cogs = 0;
    for (const item of relevantItems) {
      grossSales += item.subtotal;
      cogs += (costMap[item.product_code] || 0) * item.qty;
    }
    const grossProfit = grossSales - cogs;
    const expenses = (await DB.getAll("expenses")).filter(e => inRange(e.date, start, end));
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return { grossSales, cogs, grossProfit, totalExpenses, netProfit };
  }

  async function utangReport() {
    const customers = await DB.getAll("customers");
    const outstanding = customers.filter(c => (c.balance || 0) > 0);
    const totalOutstanding = customers.reduce((s, c) => s + (c.balance || 0), 0);
    return { customers, outstanding, totalOutstanding };
  }

  async function bestSellers(start, end, limit = 20) {
    const sales = (await DB.getAll("sales")).filter(s => inRange(s.date, start, end));
    const saleIds = new Set(sales.map(s => s.id));
    const saleItems = (await DB.getAll("sale_items")).filter(i => saleIds.has(i.sale_id));

    const products = await DB.getAll("products");
    const costMap = {};
    products.forEach(p => costMap[p.product_code] = p.cost_price || 0);

    const agg = {};
    for (const item of saleItems) {
      if (!agg[item.product_code]) {
        agg[item.product_code] = { product_code: item.product_code, product_name: item.product_name, qty: 0, amount: 0, profit: 0 };
      }
      agg[item.product_code].qty += item.qty;
      agg[item.product_code].amount += item.subtotal;
      agg[item.product_code].profit += item.subtotal - (costMap[item.product_code] || 0) * item.qty;
    }
    const list = Object.values(agg).sort((a, b) => b.qty - a.qty);
    return { bestSellers: list.slice(0, limit), slowSellers: list.slice().sort((a, b) => a.qty - b.qty).slice(0, limit) };
  }

  async function expenseReport(start, end) {
    const expenses = (await DB.getAll("expenses")).filter(e => inRange(e.date, start, end));
    const byCategory = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return { expenses, byCategory, total };
  }

  async function dashboardSummary() {
    const key = CashDrawer.todayKey();
    const startOfDay = key + "T00:00:00.000Z";
    const endOfDay = key + "T23:59:59.999Z";

    const todaySales = await salesReport(startOfDay, endOfDay);
    const todayProfit = await profitReport(startOfDay, endOfDay);
    const inv = await inventoryReport();
    const utang = await utangReport();

    return {
      todaysSales: todaySales.totalSales,
      transactions: todaySales.count,
      estimatedProfit: todayProfit.grossProfit,
      expenses: todayProfit.totalExpenses,
      netProfit: todayProfit.netProfit,
      lowStockCount: inv.lowStock.length,
      outOfStockCount: inv.outOfStock.length,
      outstandingUtang: utang.totalOutstanding,
      inventoryValue: inv.inventoryValue
    };
  }

  return { salesReport, inventoryReport, profitReport, utangReport, bestSellers, expenseReport, dashboardSummary };
})();
