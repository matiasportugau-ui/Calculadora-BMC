export function createMockCashflowState() {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

  const transactions = [
    { id: "tx_c1", description: "Cobro Cliente A", amount: 180000, currency: "UYU", date: addDays(3), type: "inflow", status: "pending" },
    { id: "tx_p1", description: "Proveedor XYZ", amount: 95000, currency: "UYU", date: addDays(5), type: "outflow", status: "pending" },
    { id: "tx_sueldos", description: "Sueldos", amount: 420000, currency: "UYU", date: addDays(10), type: "outflow", status: "pending" },
    { id: "tx_usd1", description: "Anticipo Proyecto B", amount: 2400, currency: "USD", date: addDays(17), type: "inflow", status: "pending" },
    { id: "tx_alq", description: "Alquiler", amount: 68000, currency: "UYU", date: addDays(18), type: "outflow", status: "pending" },
    { id: "tx_dgi", description: "DGI — IVA", amount: 125000, currency: "UYU", date: addDays(24), type: "outflow", status: "pending" },
    { id: "tx_c2", description: "Cobro Cliente C", amount: 310000, currency: "UYU", date: addDays(26), type: "inflow", status: "pending" },
    { id: "tx_cleared1", description: "Cobro histórico", amount: 520000, currency: "UYU", date: addDays(-45), type: "inflow", status: "cleared" },
    { id: "tx_cleared2", description: "Pago histórico", amount: 380000, currency: "UYU", date: addDays(-30), type: "outflow", status: "cleared" },
  ];

  const scenarios = [
    { id: "sc_contrato_venta", label: "Contrato venta", isActive: false, transactions: [
      { id: "sc_tx_venta", description: "Contrato venta", amount: 850000, currency: "UYU", date: addDays(45), type: "inflow", status: "pending", isScenario: true },
    ]},
    { id: "sc_nueva_contratacion", label: "Nueva contratación", isActive: false, transactions: Array.from({ length: 6 }, (_, i) => ({
      id: `sc_tx_hire_${i}`, description: "Contratación mensual", amount: 45000, currency: "UYU", date: addDays(30 + i * 30), type: "outflow", status: "pending", isScenario: true,
    }))},
    { id: "sc_retiro_socio", label: "Retiro socio", isActive: false, transactions: [
      { id: "sc_tx_retiro", description: "Retiro socio", amount: 40000, currency: "UYU", date: addDays(14), type: "outflow", status: "pending", isScenario: true },
    ]},
    { id: "sc_impuesto_dgi", label: "DGI / BPS", isActive: false, transactions: [
      { id: "sc_tx_dgi", description: "DGI/BPS", amount: 60000, currency: "UYU", date: addDays(75), type: "outflow", status: "pending", isScenario: true },
    ]},
  ];

  return {
    currentCashUyu: 2840000, currentCashUsd: 8500, monthlyBurn: 420000, monthlyBurnCurrency: "UYU",
    currencyMode: "uyu", fx: { rate: 40, rateDate: addDays(-1), source: "mock comprador" },
    transactions, scenarios,
  };
}

export const MOCK_CASHFLOW_STATE = createMockCashflowState();
