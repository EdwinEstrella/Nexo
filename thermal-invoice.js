/**
 * Factura / comprobante térmico 58 mm (Nexo Lending Ledger).
 * Inspirado en el enfoque de CyberBistro: HTML + CSS @page + impresión Electron.
 */
;(function (global) {
  const STORAGE_KEY = 'nexo_thermal_invoice_v1'
  /** Ancho de rollo fijo para esta implementación. */
  const PAPER_WIDTH_MM = 58

  function escapeHtml (s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function defaultSettings () {
    return {
      paperWidthMm: PAPER_WIDTH_MM,
      printerName: '',
      document_title: 'COMPROBANTE DE COBRO',
      logo_url: '',
      institution_tax_id: '',
      footer_line1: 'Gracias por su pago.',
      footer_line2: 'Nexo · Lending Ledger',
      show_breakdown: true
    }
  }

  function getThermalInvoiceSettings () {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY)
      if (!raw) return { ...defaultSettings() }
      const p = JSON.parse(raw)
      return { ...defaultSettings(), ...p, paperWidthMm: PAPER_WIDTH_MM }
    } catch (_) {
      return { ...defaultSettings() }
    }
  }

  function saveThermalInvoiceSettings (partial) {
    const next = { ...getThermalInvoiceSettings(), ...partial, paperWidthMm: PAPER_WIDTH_MM }
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  }

  function thermalStyles58mm () {
    return `
    @page { size: 58mm auto; margin: 1.5mm; }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: Consolas, "Courier New", Courier, monospace;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.35;
      width: 52mm;
      max-width: 52mm;
      margin: 0 auto;
      padding: 2mm 1mm;
      color: #000;
      background: #fff;
    }
    h1 {
      text-align: center;
      font-size: 13px;
      margin: 0 0 4px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .center { text-align: center; }
    .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .double-divider { border: none; border-top: 2px double #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    .row td { padding: 2px 0; font-size: 10px; vertical-align: top; }
    .row td:last-child { text-align: right; font-weight: 700; }
    .total td { font-size: 12px; font-weight: 800; padding-top: 4px; }
    .footer { text-align: center; font-size: 9px; margin-top: 6px; font-weight: 600; line-height: 1.3; }
    .logo-wrap { text-align: center; margin-bottom: 4px; }
    .logo-wrap img { max-width: 100%; max-height: 40px; object-fit: contain; }
    .muted { font-weight: 600; font-size: 9px; color: #222; }
    `
  }

  function formatDoDateTime (iso) {
    const d = new Date(iso || Date.now())
    const date = new Intl.DateTimeFormat('es-DO', {
      timeZone: 'America/Santo_Domingo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d)
    const time = new Intl.DateTimeFormat('es-DO', {
      timeZone: 'America/Santo_Domingo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d)
    return { date, time }
  }

  function fmtMoney (n) {
    const v = Number(n) || 0
    return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  /**
   * @param {object} org — razón social, comercial, dirección, etc.
   * @param {object} thermal — getThermalInvoiceSettings()
   * @param {object} receipt — línea de cobro cartera
   */
  function buildThermalInvoiceHtml (org, thermal, receipt) {
    const t = { ...defaultSettings(), ...thermal, paperWidthMm: PAPER_WIDTH_MM }
    const title = (t.document_title || 'COMPROBANTE DE COBRO').trim() || 'COMPROBANTE DE COBRO'
    const legal = (org.org_legal_name || '').trim() || 'Institución'
    const trade = (org.org_trade_name || '').trim()
    const addr = (org.org_address || '').trim()
    const tax = (t.institution_tax_id || '').trim()
    const logo = (t.logo_url || '').trim()
    const when = formatDoDateTime(receipt.created_at)
    const br = receipt.breakdown || {}
    const showBr = t.show_breakdown !== false

    const logoBlock = logo
      ? `<div class="logo-wrap"><img src="${escapeHtml(logo)}" alt="" crossorigin="anonymous" /></div>`
      : ''

    const tradeLine = trade && trade !== legal
      ? `<p class="center muted" style="margin:2px 0">${escapeHtml(trade)}</p>`
      : ''

    const taxRow = tax
      ? `<tr class="row"><td>RNC / Tax ID</td><td>${escapeHtml(tax)}</td></tr>`
      : ''

    const breakdown = showBr
      ? `
    <div class="divider"></div>
    <table>
      <tr class="row"><td>Capital</td><td>${escapeHtml(fmtMoney(br.principal))}</td></tr>
      <tr class="row"><td>Interés</td><td>${escapeHtml(fmtMoney(br.interest))}</td></tr>
      <tr class="row"><td>Mora</td><td>${escapeHtml(fmtMoney(br.late_fee))}</td></tr>
    </table>`
      : ''

    const footer1 = (t.footer_line1 || '').trim()
    const footer2 = (t.footer_line2 || '').trim()

    const body = `
  ${logoBlock}
  <h1>${escapeHtml(title)}</h1>
  <p class="center muted" style="margin:0;font-weight:700">${escapeHtml(legal)}</p>
  ${tradeLine}
  ${addr ? `<p class="center muted" style="margin:4px 0 0">${escapeHtml(addr)}</p>` : ''}
  <div class="divider"></div>
  <table>
    ${taxRow}
    <tr class="row"><td>Fecha</td><td>${escapeHtml(when.date)}</td></tr>
    <tr class="row"><td>Hora</td><td>${escapeHtml(when.time)}</td></tr>
    <tr class="row"><td>Cliente</td><td>${escapeHtml(receipt.client_name || '—')}</td></tr>
    <tr class="row"><td>Préstamo</td><td>${escapeHtml(receipt.loan_reference || '—')}</td></tr>
    <tr class="row"><td>Cuota</td><td>${escapeHtml(String(receipt.installment_n != null ? receipt.installment_n : '—'))}</td></tr>
    <tr class="row"><td>Método</td><td>${escapeHtml((receipt.payment_method || '—').toUpperCase())}</td></tr>
  </table>
  <div class="divider"></div>
  <table>
    <tr class="total"><td>TOTAL PAGADO</td><td>${escapeHtml(fmtMoney(receipt.amount))}</td></tr>
  </table>
  ${breakdown}
  <div class="double-divider"></div>
  <div class="footer">
    ${footer1 ? `<p style="margin:0 0 3px">${escapeHtml(footer1)}</p>` : ''}
    ${footer2 ? `<p style="margin:0">${escapeHtml(footer2)}</p>` : ''}
    <p class="muted" style="margin:6px 0 0">Documento informativo · no sustituye comprobante fiscal si aplica.</p>
  </div>
  `

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${thermalStyles58mm()}</style></head><body>${body}</body></html>`
  }

  /** Datos de ejemplo para la vista previa en ajustes. */
  function sampleReceipt () {
    return {
      client_name: 'María Pérez de los Santos',
      loan_reference: 'HIP-2026-0001',
      installment_n: 3,
      amount: 12500.5,
      breakdown: { principal: 10000, interest: 2400.5, late_fee: 100 },
      payment_method: 'Transferencia',
      created_at: new Date().toISOString()
    }
  }

  global.NexoThermalInvoice = {
    STORAGE_KEY,
    PAPER_WIDTH_MM,
    escapeHtml,
    getThermalInvoiceSettings,
    saveThermalInvoiceSettings,
    buildThermalInvoiceHtml,
    sampleReceipt,
    fmtMoney
  }
})(typeof window !== 'undefined' ? window : globalThis)
