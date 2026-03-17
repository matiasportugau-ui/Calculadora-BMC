(function () {
  const API_BASE = '';
  let proximasEntregas = [];
  let auditData = [];

  function showToast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  function setLastRefresh() {
    const el = document.getElementById('lastRefresh');
    if (el) el.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-UY');
  }

  async function fetchProximasEntregas() {
    const res = await fetch(API_BASE + '/api/proximas-entregas');
    if (!res.ok) throw new Error('Error al cargar próximas entregas');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error en API');
    return json.data || [];
  }

  async function fetchCoordinacionLogistica(ids) {
    const url = ids && ids.length
      ? API_BASE + '/api/coordinacion-logistica?ids=' + encodeURIComponent(ids.join(','))
      : API_BASE + '/api/coordinacion-logistica';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al generar mensaje');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error en API');
    return json.text || '';
  }

  async function fetchKpiFinanciero() {
    const res = await fetch(API_BASE + '/api/kpi-financiero');
    if (!res.ok) throw new Error('Error al cargar KPI financiero');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error en API');
    return json;
  }

  async function fetchAudit() {
    const res = await fetch(API_BASE + '/api/audit');
    if (!res.ok) throw new Error('Error al cargar audit log');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error en API');
    return json.data || [];
  }

  function renderTable(rows) {
    const tbody = document.getElementById('tbodyEntregas');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay entregas para la semana actual.</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr data-id="${escapeHtml(r.COTIZACION_ID || '')}">
        <td><code>${escapeHtml(r.COTIZACION_ID || '—')}</code></td>
        <td>${escapeHtml(r.CLIENTE_NOMBRE || '—')}</td>
        <td>${formatPhone(r.TELEFONO)}</td>
        <td>${escapeHtml(r.LINK_UBICACION ? 'Link' : (r.DIRECCION || r.ZONA || '—'))}</td>
        <td>${formatDate(r.FECHA_ENTREGA)}</td>
        <td class="col-actions">
          <button type="button" class="btn btn-sm btn-success btn-copy-whatsapp" data-id="${escapeHtml(r.COTIZACION_ID || '')}">WhatsApp</button>
          <button type="button" class="btn btn-sm btn-secondary btn-marcar-entregado" data-id="${escapeHtml(r.COTIZACION_ID || '')}">Marcar entregado</button>
        </td>
      </tr>
    `
      )
      .join('');

    tbody.querySelectorAll('.btn-copy-whatsapp').forEach((btn) => {
      btn.addEventListener('click', () => copyWhatsAppForId(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-marcar-entregado').forEach((btn) => {
      btn.addEventListener('click', () => marcarEntregado(btn.dataset.id));
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatPhone(val) {
    if (!val) return '—';
    const t = String(val).trim();
    return t ? t : '—';
  }

  function formatDate(val) {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) {
      return val;
    }
  }

  function formatMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return '$ ' + Number(n).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatDateTime(val) {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return val;
    }
  }

  function renderAudit(rows) {
    const tbody = document.getElementById('tbodyAudit');
    if (!tbody) return;
    const filter = (document.getElementById('auditFilter') || {}).value || '';
    const q = filter.toLowerCase().trim();
    const filtered = q ? rows.filter(function (r) {
      const line = [r.TIMESTAMP, r.ACTION, r.ROW, r.OLD_VALUE, r.NEW_VALUE, r.REASON, r.USER, r.SHEET].join(' ').toLowerCase();
      return line.indexOf(q) !== -1;
    }) : rows;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">' + (rows.length === 0 ? 'No hay registros.' : 'Ningún registro coincide con el filtro.') + '</td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map(function (r) {
        return '<tr><td>' + formatDateTime(r.TIMESTAMP) + '</td><td>' + escapeHtml(r.ACTION || '') + '</td><td>' + escapeHtml(String(r.ROW || '')) + '</td><td>' + escapeHtml(String(r.OLD_VALUE || '')) + '</td><td>' + escapeHtml(String(r.NEW_VALUE || '')) + '</td><td>' + escapeHtml(String(r.REASON || '')) + '</td><td>' + escapeHtml(String(r.USER || '')) + '</td><td>' + escapeHtml(String(r.SHEET || '')) + '</td></tr>';
      })
      .join('');
  }

  function exportAuditCSV() {
    const headers = ['TIMESTAMP', 'ACTION', 'ROW', 'OLD_VALUE', 'NEW_VALUE', 'REASON', 'USER', 'SHEET'];
    const rows = auditData.map(function (r) {
      return headers.map(function (h) {
        const v = String(r[h] != null ? r[h] : '');
        return v.indexOf(',') !== -1 || v.indexOf('"') !== -1 ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    });
    const csv = [headers.join(','), rows.join('\n')].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bmc-audit-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV descargado');
  }

  function renderKpiFinanciero(kpi) {
    const byPeriod = kpi.byPeriod || {};
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatMoney(val);
    };
    set('kpiTotal', byPeriod.total);
    set('kpiEstaSemana', byPeriod.estaSemana);
    set('kpiProximaSemana', byPeriod.proximaSemana);
    set('kpiEsteMes', byPeriod.esteMes);

    const calBody = document.getElementById('tbodyVencimientos');
    if (calBody) {
      const calendar = kpi.calendar || [];
      if (calendar.length === 0) {
        calBody.innerHTML = '<tr><td colspan="2" class="empty">No hay vencimientos cargados.</td></tr>';
      } else {
        calBody.innerHTML = calendar
          .map((c) => '<tr><td>' + formatDate(c.date) + '</td><td>' + formatMoney(c.total) + '</td></tr>')
          .join('');
      }
    }

    const pagosBody = document.getElementById('tbodyPagos');
    if (pagosBody) {
      const pending = kpi.pendingPayments || [];
      if (pending.length === 0) {
        pagosBody.innerHTML = '<tr><td colspan="4" class="empty">No hay pagos pendientes.</td></tr>';
      } else {
        pagosBody.innerHTML = pending
          .map(
            (p) =>
              '<tr><td>' +
              escapeHtml(p.CLIENTE_NOMBRE || '—') +
              '</td><td><code>' +
              escapeHtml(p.COTIZACION_ID || '—') +
              '</code></td><td>' +
              (p.MONEDA || '$') +
              ' ' +
              escapeHtml(String(p.MONTO || '—')) +
              '</td><td>' +
              formatDate(p.FECHA_VENCIMIENTO) +
              '</td></tr>'
          )
          .join('');
      }
    }

    const metasBody = document.getElementById('tbodyMetas');
    if (metasBody) {
      const metas = kpi.metas || [];
      if (metas.length === 0) {
        metasBody.innerHTML = '<tr><td colspan="4" class="empty">No hay metas de ventas cargadas.</td></tr>';
      } else {
        metasBody.innerHTML = metas
          .map(
            (m) =>
              '<tr><td>' +
              escapeHtml(m.PERIODO || '—') +
              '</td><td>' +
              escapeHtml(m.TIPO || '—') +
              '</td><td>' +
              (m.MONEDA || '$') +
              ' ' +
              escapeHtml(String(m.META_MONTO || '—')) +
              '</td><td>' +
              escapeHtml(m.NOTAS || '') +
              '</td></tr>'
          )
          .join('');
      }
    }
  }

  async function copyWhatsAppForId(id) {
    try {
      const text = await fetchCoordinacionLogistica([id]);
      await navigator.clipboard.writeText(text);
      showToast('Mensaje copiado al portapapeles');
    } catch (e) {
      showToast('Error: ' + (e.message || 'no se pudo copiar'));
    }
  }

  async function marcarEntregado(id) {
    const comentarios = window.prompt('Comentarios (opcional):') || '';
    try {
      const res = await fetch(API_BASE + '/api/marcar-entregado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: id, comentarios }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error al marcar');
      showToast('Marcado como entregado y movido a Ventas realizadas y entregadas');
      load();
    } catch (e) {
      showToast('Error: ' + (e.message || 'no se pudo marcar'));
    }
  }

  async function load() {
    const btnRefresh = document.getElementById('btnRefresh');
    const btnCopyAll = document.getElementById('btnCopyAllWhatsApp');
    const btnCopyPreview = document.getElementById('btnCopyPreview');
    if (btnRefresh) btnRefresh.disabled = true;

    try {
      proximasEntregas = await fetchProximasEntregas();
      renderTable(proximasEntregas);
      setLastRefresh();

      const hasRows = proximasEntregas.length > 0;
      if (btnCopyAll) {
        btnCopyAll.disabled = !hasRows;
      }
      if (btnCopyPreview) {
        btnCopyPreview.disabled = !hasRows;
      }

      const preview = document.getElementById('previewWhatsApp');
      if (preview) {
        if (hasRows) {
          const text = await fetchCoordinacionLogistica(proximasEntregas.map((r) => r.COTIZACION_ID));
          preview.textContent = text;
        } else {
          preview.textContent = 'No hay entregas esta semana para generar mensaje.';
        }
      }

      const kpi = await fetchKpiFinanciero();
      renderKpiFinanciero(kpi);

      auditData = await fetchAudit();
      renderAudit(auditData);
    } catch (e) {
      if (document.getElementById('tbodyEntregas')) {
        document.getElementById('tbodyEntregas').innerHTML =
          '<tr><td colspan="6" class="empty">Error: ' + escapeHtml(e.message) + '</td></tr>';
      }
      if (document.getElementById('previewWhatsApp')) {
        document.getElementById('previewWhatsApp').textContent = 'No se pudo cargar.';
      }
      if (document.getElementById('tbodyVencimientos')) {
        document.getElementById('tbodyVencimientos').innerHTML =
          '<tr><td colspan="2" class="empty">Error: ' + escapeHtml(e.message) + '</td></tr>';
      }
      if (document.getElementById('tbodyPagos')) {
        document.getElementById('tbodyPagos').innerHTML =
          '<tr><td colspan="4" class="empty">Error al cargar.</td></tr>';
      }
      if (document.getElementById('tbodyMetas')) {
        document.getElementById('tbodyMetas').innerHTML =
          '<tr><td colspan="4" class="empty">Error al cargar.</td></tr>';
      }
      if (document.getElementById('tbodyAudit')) {
        document.getElementById('tbodyAudit').innerHTML =
          '<tr><td colspan="8" class="empty">Error al cargar.</td></tr>';
      }
    } finally {
      if (btnRefresh) btnRefresh.disabled = false;
    }
  }

  document.getElementById('btnRefresh')?.addEventListener('click', load);

  document.getElementById('btnCopyAllWhatsApp')?.addEventListener('click', async function () {
    try {
      const text = await fetchCoordinacionLogistica(proximasEntregas.map((r) => r.COTIZACION_ID));
      await navigator.clipboard.writeText(text);
      showToast('Mensaje completo copiado al portapapeles');
    } catch (e) {
      showToast('Error: ' + (e.message || 'no se pudo copiar'));
    }
  });

  document.getElementById('btnCopyPreview')?.addEventListener('click', async function () {
    const pre = document.getElementById('previewWhatsApp');
    if (!pre || !pre.textContent) return;
    try {
      await navigator.clipboard.writeText(pre.textContent);
      showToast('Texto copiado al portapapeles');
    } catch (e) {
      showToast('Error: ' + (e.message || 'no se pudo copiar'));
    }
  });

  document.getElementById('auditFilter')?.addEventListener('input', function () {
    renderAudit(auditData);
  });

  document.getElementById('btnExportAuditCSV')?.addEventListener('click', exportAuditCSV);

  load();
})();
