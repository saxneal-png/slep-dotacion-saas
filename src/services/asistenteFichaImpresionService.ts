import { AsistenteConsolidadoTerritorial, Establecimiento, EstamentoAsistente } from '../types';

const ESTAMENTO_ETIQUETAS: Record<EstamentoAsistente, string> = {
  PROFESIONAL: 'Profesional',
  TECNICO: 'Técnico',
  ADMINISTRATIVO: 'Administrativo',
  AUXILIAR: 'Auxiliar de Servicios',
  PARADOCENTE_INSPECTORIA: 'Administrativo (Paradocente / Inspectoría)'
};

function escapeHtml(text?: string | number | null): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generarHtmlFichaAsistente(
  asistente: AsistenteConsolidadoTerritorial,
  colegioPrincipal?: Establecimiento
): string {
  const primerContrato = asistente.contratos[0];
  const rbdPrincipal = primerContrato?.colegio?.rbd || colegioPrincipal?.rbd || '—';
  const nombreColegioPrincipal = primerContrato?.colegio?.nombre || colegioPrincipal?.nombre || 'Establecimiento SLEP';
  const periodo = primerContrato?.asistente?.periodo || 2027;

  const fechaImpresion = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const clasificaciones: string[] = [];
  if (asistente.esDuplaPsicosocial) clasificaciones.push('Dupla Psicosocial');
  if (asistente.esEquipoPie) clasificaciones.push('Equipo PIE');
  if (asistente.esTecnicoParvulo) clasificaciones.push('Técnico en Párvulos');
  if (asistente.esAuxiliarServicio) clasificaciones.push('Auxiliar de Servicios');
  if (asistente.esInspectorPatio) clasificaciones.push('Inspectoría / Patio');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha de Asistente de la Educación - ${escapeHtml(asistente.nombres)} ${escapeHtml(asistente.apellidos)} - SLEP Valle Diguillín</title>
  <style>
    @page {
      size: letter;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.4;
      font-size: 11pt;
      margin: 0;
      padding: 20px;
      background-color: #ffffff;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #002B49;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title-banner {
      background-color: #002B49;
      color: #ffffff;
      padding: 8px 12px;
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-radius: 4px;
      margin-bottom: 16px;
      text-align: center;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #002B49;
      border-left: 4px solid #d97706;
      padding-left: 8px;
      margin-top: 16px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9.5pt;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    table.data-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background-color: #f8fafc;
    }
    .kpi-title {
      font-size: 8pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .kpi-value {
      font-size: 12pt;
      font-weight: bold;
      color: #002B49;
      margin-top: 2px;
    }
    .kpi-sub {
      font-size: 7.5pt;
      color: #64748b;
    }
    .signatures-block {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
    }
    .sig-table td {
      width: 50%;
      text-align: center;
      vertical-align: bottom;
      padding: 20px 30px 0 30px;
    }
    .sig-line {
      border-top: 1px solid #475569;
      padding-top: 6px;
      font-size: 9pt;
      font-weight: 600;
      color: #1e293b;
    }
    .footer-note {
      font-size: 7.5pt;
      color: #64748b;
      text-align: center;
      margin-top: 25px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; background: #fef3c7; padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #fcd34d;">
    <span style="font-size: 9.5pt; color: #92400e; font-weight: 500;">
      📄 Vista previa de impresión oficial de Ficha de Asistente de la Educación SLEP. Puedes imprimir o guardar como PDF.
    </span>
    <button onclick="window.print()" style="background: #002B49; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10pt;">
      🖨️ Imprimir / Guardar en PDF
    </button>
  </div>

  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div style="font-size: 11pt; font-weight: bold; color: #002B49;">SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN</div>
        <div style="font-size: 9pt; color: #475569;">Unidad de Acompañamiento Técnico Pedagógico (UATP) — Dotación Asistentes de la Educación</div>
      </td>
      <td style="text-align: right; vertical-align: middle; font-size: 8.5pt; color: #64748b;">
        <div>Periodo Escolar: <strong>${escapeHtml(periodo)}</strong></div>
        <div>Emisión: ${escapeHtml(fechaImpresion)}</div>
      </td>
    </tr>
  </table>

  <div class="title-banner">
    FICHA OFICIAL DE DOTACIÓN, FUNCIONES Y CONTRATO — ASISTENTE DE LA EDUCACIÓN
  </div>

  <div class="section-title">1. Identificación del Funcionario</div>
  <table class="data-table">
    <tr>
      <th style="width: 24%;">Nombre Completo</th>
      <td style="width: 41%;"><strong>${escapeHtml(asistente.nombres)} ${escapeHtml(asistente.apellidos)}</strong></td>
      <th style="width: 15%;">RUN</th>
      <td style="width: 20%; font-family: monospace; font-weight: bold;">${escapeHtml(asistente.run)}</td>
    </tr>
    <tr>
      <th>Estamento (Ley 21.109)</th>
      <td>${escapeHtml(ESTAMENTO_ETIQUETAS[asistente.estamentoPrincipal] || asistente.estamentoPrincipal)}</td>
      <th>Contratos SLEP</th>
      <td>${asistente.contratos.length} establecimiento(s)</td>
    </tr>
    <tr>
      <th>Establecimiento Base</th>
      <td>${escapeHtml(nombreColegioPrincipal)} (RBD: ${escapeHtml(rbdPrincipal)})</td>
      <th>Estado Legal (&le;44h)</th>
      <td>${asistente.excedeLimiteSlep ? `<strong style="color:#be123c;">EXCESO (+${asistente.excesoHorasSlep}h)</strong>` : '<strong style="color:#047857;">Conforme a Ley</strong>'}</td>
    </tr>
    <tr>
      <th>Cargo / Función Principal</th>
      <td colspan="3">${escapeHtml(asistente.cargosPrincipales.join(' • ') || 'Sin cargo especificado')}</td>
    </tr>
    <tr>
      <th>Clasificación Operativa</th>
      <td colspan="3">${clasificaciones.length > 0 ? escapeHtml(clasificaciones.join(' • ')) : 'Estándar'}</td>
    </tr>
  </table>

  <div class="section-title">2. Consolidado Horario y Calidad Contractual</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Horas SLEP</div>
      <div class="kpi-value">${asistente.horasTotalesSlep} hrs</div>
      <div class="kpi-sub">Tope legal semanal: 44 hrs</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Planta / Indefinido</div>
      <div class="kpi-value">${asistente.resumenFinanciamiento.indefinido} hrs</div>
      <div class="kpi-sub">Subv. Gen + SEP + PIE</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Plazo Fijo</div>
      <div class="kpi-value">${asistente.resumenFinanciamiento.plazoFijo} hrs</div>
      <div class="kpi-sub">Subv. Gen + SEP + PIE</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Honorarios / Pro-Ret.</div>
      <div class="kpi-value">${asistente.resumenFinanciamiento.honorarios + asistente.resumenFinanciamiento.proRetencion} hrs</div>
      <div class="kpi-sub">Hon: ${asistente.resumenFinanciamiento.honorarios}h • Pro-Ret: ${asistente.resumenFinanciamiento.proRetencion}h</div>
    </div>
  </div>

  <div class="section-title">3. Detalle de Contratos, Cargos y Funciones por Establecimiento</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 24%;">Establecimiento / RBD</th>
        <th style="width: 22%;">Cargo / Función</th>
        <th style="width: 32%;">Descripción Funcional / GDP / PME</th>
        <th style="width: 11%; text-align: center;">Hrs Contrato</th>
        <th style="width: 11%; text-align: center;">Estado GDP</th>
      </tr>
    </thead>
    <tbody>
      ${asistente.contratos.map(c => {
        const a = c.asistente;
        const detalleFunc = [
          a.descripcionFuncionGdp,
          a.accionPmeSep || a.accionPme ? `PME: ${a.accionPmeSep || a.accionPme}` : '',
          a.propuestaGdp ? `Propuesta GDP: ${a.propuestaGdp}` : '',
          a.observaciones ? `Obs: ${a.observaciones}` : ''
        ].filter(Boolean).join(' | ');
        return `<tr>
          <td><strong>${escapeHtml(c.colegio.nombre)}</strong><br><small style="color:#64748b;">RBD ${escapeHtml(c.colegio.rbd)} • ${escapeHtml(c.colegio.comuna)}</small></td>
          <td>${escapeHtml(a.cargoFuncion || '—')}</td>
          <td>${detalleFunc ? escapeHtml(detalleFunc) : '<span style="color:#64748b;">Sin descripción adicional</span>'}</td>
          <td style="text-align: center; font-weight: bold;">${c.horasContrato} hrs</td>
          <td style="text-align: center;">${escapeHtml(a.estadoSancionGdp || '—')}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="section-title">4. Respaldo de Fuentes de Financiamiento (Indefinido / Plazo Fijo)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Establecimiento</th>
        <th style="text-align: center;">Subv. Gral (Ind/PF)</th>
        <th style="text-align: center;">SEP (Ind/PF)</th>
        <th style="text-align: center;">PIE (Ind/PF)</th>
        <th style="text-align: center;">Honorarios</th>
        <th style="text-align: center;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${asistente.contratos.map(c => `<tr>
        <td><strong>${escapeHtml(c.colegio.nombre)}</strong></td>
        <td style="text-align: center;">${c.fuentesFinanciamiento.subvencionGeneralIndefinido}h / ${c.fuentesFinanciamiento.subvencionGeneralPlazoFijo}h</td>
        <td style="text-align: center;">${c.fuentesFinanciamiento.sepIndefinido}h / ${c.fuentesFinanciamiento.sepPlazoFijo}h</td>
        <td style="text-align: center;">${c.fuentesFinanciamiento.pieIndefinido}h / ${c.fuentesFinanciamiento.piePlazoFijo}h</td>
        <td style="text-align: center;">${c.fuentesFinanciamiento.honorarios}h</td>
        <td style="text-align: center; font-weight: bold;">${c.horasContrato} hrs</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="signatures-block">
    <table class="sig-table">
      <tr>
        <td>
          <div style="height: 50px;"></div>
          <div class="sig-line">
            ${escapeHtml(asistente.nombres)} ${escapeHtml(asistente.apellidos)}<br>
            <span style="font-weight: normal; font-size: 8pt; color: #64748b;">Asistente de la Educación / RUN: ${escapeHtml(asistente.run)}</span>
          </div>
        </td>
        <td>
          <div style="height: 50px;"></div>
          <div class="sig-line">
            Director/a del Establecimiento<br>
            <span style="font-weight: normal; font-size: 8pt; color: #64748b;">Firma y Timbre Oficial</span>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="footer-note">
    Documento emitido conforme al Estatuto de los Asistentes de la Educación Pública (Ley N° 21.109), Ley N° 19.464 y Decreto 170 PIE.<br>
    Sistema Consolidador de Dotación — Servicio Local de Educación Pública Valle Diguillín.
  </div>
</body>
</html>`;
}

export function imprimirFichaAsistente(
  asistente: AsistenteConsolidadoTerritorial,
  colegioPrincipal?: Establecimiento
): void {
  const html = generarHtmlFichaAsistente(asistente, colegioPrincipal);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
