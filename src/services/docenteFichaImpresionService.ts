import { DocenteConsolidadoTerritorial, Establecimiento, CursoSae } from '../types';

export function generarHtmlFichaDocente(
  doc: DocenteConsolidadoTerritorial,
  colegioPrincipal?: Establecimiento,
  cursos: CursoSae[] = []
): string {
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} min`;
  };

  const totalMinutosRecreo = doc.contratos.reduce((s, c) => s + c.minutosRecreoMineduc, 0);
  const totalMinutosNoLectivos = doc.contratos.reduce((s, c) => s + c.minutosNoLectivosMineduc, 0);
  const totalMinutosLectivos = doc.contratos.reduce((s, c) => s + c.horasPedagogicasAsignadas * 45, 0);
  const totalMinutosPlanif = doc.contratos.reduce((s, c) => s + (c.minutosHnlPlanificacion40 ?? Math.floor(c.minutosNoLectivosMineduc * 0.40)), 0);

  const primerContrato = doc.contratos[0];
  const rbdPrincipal = primerContrato?.colegio?.rbd || colegioPrincipal?.rbd || '—';
  const nombreColegioPrincipal = primerContrato?.colegio?.nombre || colegioPrincipal?.nombre || 'Establecimiento SLEP';
  const periodoDocente = primerContrato?.docente?.periodo || 2026;

  const fechaImpresion = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha de Carga Horaria - ${doc.nombres} ${doc.apellidos} - SLEP Valle Diguillín</title>
  <style>
    @page {
      size: letter;
      margin: 15mm 15mm 15mm 15mm;
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
      border-left: 4px solid #0080FF;
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
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; background: #e0f2fe; padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #7dd3fc;">
    <span style="font-size: 9.5pt; color: #0369a1; font-weight: 500;">
      📄 Vista previa de impresión oficial de la Ficha Docente SLEP. Puedes imprimir o guardar como PDF.
    </span>
    <button onclick="window.print()" style="background: #002B49; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10pt;">
      🖨️ Imprimir / Guardar en PDF
    </button>
  </div>

  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div style="font-size: 11pt; font-weight: bold; color: #002B49;">SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN</div>
        <div style="font-size: 9pt; color: #475569;">Unidad de Acompañamiento Técnico Pedagógico (UATP) — Dotación Docente</div>
      </td>
      <td style="text-align: right; vertical-align: middle; font-size: 8.5pt; color: #64748b;">
        <div>Periodo Escolar: <strong>${periodoDocente}</strong></div>
        <div>Emisión: ${fechaImpresion}</div>
      </td>
    </tr>
  </table>

  <div class="title-banner">
    FICHA OFICIAL DE CARGA HORARIA Y DISTRIBUCIÓN LECTIVA / NO LECTIVA
  </div>

  <div class="section-title">1. Identificación del Docente</div>
  <table class="data-table">
    <tr>
      <th style="width: 25%;">Docente / Funcionario</th>
      <td style="width: 40%;"><strong>${doc.nombres} ${doc.apellidos}</strong></td>
      <th style="width: 15%;">RUN</th>
      <td style="width: 20%; font-family: monospace; font-weight: bold;">${doc.run}</td>
    </tr>
    <tr>
      <th>Título Profesional</th>
      <td>${doc.titulo || 'Docente'}</td>
      <th>Estamento</th>
      <td>${doc.estamentoPrincipal.replace('_', ' ')}</td>
    </tr>
    <tr>
      <th>Establecimiento Base</th>
      <td>${nombreColegioPrincipal} (RBD: ${rbdPrincipal})</td>
      <th>Artículo 69</th>
      <td>${doc.contratos.some(c => c.aplicaArticulo69) ? 'SÍ (Rebaja de aula por antigüedad)' : 'NO'}</td>
    </tr>
  </table>

  <div class="section-title">2. Distribución Normativa de la Jornada (Ley N° 20.903)</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Horas Contrato Semanal</div>
      <div class="kpi-value">${doc.horasTotalesSlep} hrs</div>
      <div class="kpi-sub">${doc.horasTotalesSlep * 60} minutos cronológicos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Docencia de Aula</div>
      <div class="kpi-value">${formatMins(totalMinutosLectivos)}</div>
      <div class="kpi-sub">${doc.contratos.reduce((s, c) => s + c.horasPedagogicasAsignadas, 0)} hrs pedagógicas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Recreo Normativo</div>
      <div class="kpi-value">${formatMins(totalMinutosRecreo)}</div>
      <div class="kpi-sub">Según tabla MINEDUC</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">No Lectivas (HNL)</div>
      <div class="kpi-value">${formatMins(totalMinutosNoLectivos)}</div>
      <div class="kpi-sub">Planif. indiv: ${formatMins(totalMinutosPlanif)}</div>
    </div>
  </div>

  <div class="section-title">3. Detalle de Asignaciones y Cursos Impartidos</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Establecimiento / RBD</th>
        <th style="width: 20%;">Curso</th>
        <th style="width: 35%;">Asignatura / Función</th>
        <th style="width: 10%; text-align: center;">Hrs Pedag.</th>
        <th style="width: 10%; text-align: center;">Hrs PIE/Colab.</th>
      </tr>
    </thead>
    <tbody>
      ${doc.contratos.flatMap(c => c.asignaciones.map(a => {
        const cursoObj = cursos.find(cu => cu.id === a.cursoId);
        const cursoNombre = cursoObj ? `${cursoObj.nivel} ${cursoObj.letra}` : 'Curso General';
        const colNombre = c.colegio?.nombre || 'Establecimiento';
        const colRbd = c.colegio?.rbd || '—';
        return `<tr>
          <td>${colNombre} (RBD: ${colRbd})</td>
          <td><strong>${cursoNombre}</strong></td>
          <td>${a.asignatura} ${a.esTallerJec ? '<small style="color:#0284c7;">(JEC)</small>' : ''} ${a.esTallerSep ? '<small style="color:#16a34a;">(SEP)</small>' : ''}</td>
          <td style="text-align: center; font-weight: bold;">${a.horasPedagogicasAula} hrs</td>
          <td style="text-align: center;">${a.horasCronologicasPie || a.horasColaborativas || '—'}</td>
        </tr>`;
      })).join('') || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No registra asignaciones de aula en este periodo.</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">4. Respaldo de Fuentes de Financiamiento</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Establecimiento</th>
        <th style="text-align: center;">Subv. General (Tit/Cont)</th>
        <th style="text-align: center;">SEP (Tit/Cont)</th>
        <th style="text-align: center;">PIE (Tit/Cont)</th>
        <th style="text-align: center;">Total Contrato</th>
      </tr>
    </thead>
    <tbody>
      ${doc.contratos.map(c => `<tr>
        <td><strong>${c.colegio?.nombre || 'Colegio'}</strong></td>
        <td style="text-align: center;">${c.fuentesFinanciamiento?.subvencionGeneralTitular || 0} / ${c.fuentesFinanciamiento?.subvencionGeneralContrata || 0} hrs</td>
        <td style="text-align: center;">${c.fuentesFinanciamiento?.sepTitular || 0} / ${c.fuentesFinanciamiento?.sepContrata || 0} hrs</td>
        <td style="text-align: center;">${c.fuentesFinanciamiento?.pieTitular || 0} / ${c.fuentesFinanciamiento?.pieContrata || 0} hrs</td>
        <td style="text-align: center; font-weight: bold;">${c.docente?.horasContrato || c.fuentesFinanciamiento?.total || 0} hrs</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="signatures-block">
    <table class="sig-table">
      <tr>
        <td>
          <div style="height: 50px;"></div>
          <div class="sig-line">
            ${doc.nombres} ${doc.apellidos}<br>
            <span style="font-weight: normal; font-size: 8pt; color: #64748b;">Docente / RUN: ${doc.run}</span>
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
    Documento emitido conforme al Estatuto Docente (DFL 1/1996), Ley N° 20.903 de Desarrollo Profesional Docente y Decreto 170 PIE.<br>
    Sistema Consolidador de Dotación — Servicio Local de Educación Pública Valle Diguillín.
  </div>
</body>
</html>`;
}

export function imprimirFichaDocente(
  doc: DocenteConsolidadoTerritorial,
  colegioPrincipal?: Establecimiento,
  cursos: CursoSae[] = []
): void {
  const html = generarHtmlFichaDocente(doc, colegioPrincipal, cursos);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
