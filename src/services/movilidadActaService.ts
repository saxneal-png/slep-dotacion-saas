import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  Docente,
  EscenarioCalce,
  Establecimiento,
  PropuestaCalce,
  SolicitudMovilidad
} from '../types';

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inferirFuenteDocente(v: Docente): string {
  const pie = Number(v.horasPieTitular || 0) + Number(v.horasPieContrata || 0);
  const sep = Number(v.horasSepTitular || 0) + Number(v.horasSepContrata || 0);
  if (pie > 0) return 'PIE';
  if (sep > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

export function generarHtmlActaMesaMovilidad(params: {
  escenario: EscenarioCalce;
  propuestas: PropuestaCalce[];
  colegios: Establecimiento[];
  vacantesSinCubrir: Docente[];
  periodo: number;
  usuarioActor: string;
}): string {
  const { escenario, propuestas, colegios, vacantesSinCubrir, periodo, usuarioActor } = params;
  const colegiosByRbd = new Map(colegios.map(c => [c.rbd, c]));

  const nombreEscuela = (rbd: string) => {
    const est = colegiosByRbd.get(rbd);
    return est ? `${est.nombre} (RBD ${rbd})` : `RBD ${rbd}`;
  };

  const totalAsistentes = propuestas.filter(p => p.estamentoPersonal === 'ASISTENTE').length;
  const totalDocentes = propuestas.length - totalAsistentes;
  const totalHorasMovilizadas = propuestas.reduce((s, p) => s + Number(p.horasAsignadas || 0), 0);
  const rebotesGenerados = propuestas.filter(p => p.generaRebote);
  const rebotesConcurso = rebotesGenerados.filter(
    p => p.estadoResolucionRebote === 'DERIVADA_A_CONCURSO_GDP'
  );

  const fechaEmision = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const filasAcuerdos = propuestas
    .map((p, idx) => {
      const estamentoLabel = p.estamentoPersonal === 'ASISTENTE' ? 'AA.EE.' : 'Docente';
      const coberturaLabel = p.tipoCobertura === 'DEFINITIVA' ? 'Definitiva' : 'Transitoria';
      const estadoLabel = p.numeroResolucion ? `${p.estado} (${p.numeroResolucion})` : p.estado;
      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td><strong>${escapeHtml(p.nombreDocente)}</strong><br><span class="muted">${escapeHtml(estamentoLabel)}</span></td>
          <td class="mono">${escapeHtml(p.runDocente)}</td>
          <td>${escapeHtml(nombreEscuela(p.rbdOrigen))} &rarr; ${escapeHtml(nombreEscuela(p.rbdDestino))}</td>
          <td class="num">${p.horasAsignadas}h</td>
          <td>${escapeHtml(p.fuenteDestino)}</td>
          <td>${escapeHtml(coberturaLabel)}</td>
          <td class="num">${p.indiceCompatibilidad}%</td>
          <td>${escapeHtml(estadoLabel)}</td>
        </tr>`;
    })
    .join('');

  const filasRebotesConcurso = rebotesConcurso
    .map((p, idx) => {
      const reb = p.vacanteRebote;
      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${escapeHtml(nombreEscuela(p.rbdOrigen))}</td>
          <td>${escapeHtml(reb?.asignaturaPrincipal || p.nombreDocente)}</td>
          <td class="num">${reb?.horasContratoRebote ?? p.horasAsignadas}h</td>
          <td>${escapeHtml(reb?.fuenteFinanciamiento || p.fuenteDestino)}</td>
          <td>Generado por traslado de ${escapeHtml(p.nombreDocente)} hacia RBD ${escapeHtml(p.rbdDestino)}</td>
        </tr>`;
    })
    .join('');

  const filasVacantesSinCubrir = vacantesSinCubrir
    .map((v, idx) => {
      const est = colegiosByRbd.get(v.rbd);
      const esp = v.asignaturaPrincipal || `${v.nombres} ${v.apellidos}`.trim();
      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${escapeHtml(est ? `${est.nombre} (RBD ${v.rbd})` : `RBD ${v.rbd}`)}</td>
          <td>${escapeHtml(est?.comuna || '—')}</td>
          <td class="mono">${escapeHtml(v.run)}</td>
          <td>${escapeHtml(v.tipoVacante || 'NN_DETECTADO')}</td>
          <td>${escapeHtml(esp)}</td>
          <td class="num">${v.horasContrato}h</td>
          <td>${escapeHtml(inferirFuenteDocente(v))}</td>
          <td>${v.vacanteCondicional ? 'Condicional' : 'Firme'}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta Mesa de Movilidad Territorial ${periodo} - ${escapeHtml(escenario.nombre)}</title>
  <style>
    @page { size: letter; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.4;
      font-size: 10pt;
      margin: 0;
      padding: 20px;
      background-color: #ffffff;
    }
    .header-table {
      width: 100%;
      border-bottom: 3px solid #002B49;
      padding-bottom: 10px;
      margin-bottom: 16px;
      border-collapse: collapse;
    }
    .title-banner {
      background-color: #002B49;
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 14px;
    }
    .title-banner h1 { margin: 0; font-size: 14pt; }
    .title-banner p { margin: 2px 0 0; font-size: 9pt; opacity: 0.9; }
    .kpi-grid {
      width: 100%;
      border-collapse: separate;
      border-spacing: 8px 0;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background-color: #f8fafc;
      text-align: center;
      width: 20%;
    }
    .kpi-label { font-size: 7.5pt; text-transform: uppercase; color: #475569; font-weight: 700; }
    .kpi-val { font-size: 13pt; font-weight: 800; color: #002B49; margin-top: 2px; }
    h2 {
      font-size: 11pt;
      color: #002B49;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 18px 0 8px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 12px;
    }
    table.data-table th {
      background-color: #002B49;
      color: #ffffff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 700;
    }
    table.data-table td {
      border-bottom: 1px solid #e2e8f0;
      padding: 6px 8px;
      vertical-align: top;
    }
    table.data-table tr:nth-child(even) td { background-color: #f8fafc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .mono { font-family: monospace; white-space: nowrap; }
    .muted { font-size: 7.5pt; color: #64748b; }
    .empty-note { font-size: 9pt; color: #64748b; font-style: italic; padding: 6px 0; }
    .firmas-table {
      width: 100%;
      margin-top: 38px;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .firmas-table td {
      width: 33.3%;
      text-align: center;
      padding: 0 14px;
      vertical-align: bottom;
    }
    .firma-linea {
      border-top: 1px solid #334155;
      padding-top: 6px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .firma-cargo { font-size: 7.5pt; color: #475569; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td>
        <strong style="color:#002B49; font-size:11pt;">SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN</strong><br>
        <span class="muted">Unidad de Apoyo Técnico Pedagógico (UATP) &amp; Gestión de Dotación de Personal (GDP)</span>
      </td>
      <td style="text-align:right; font-size:8.5pt;">
        <strong>Fecha emisión:</strong> ${escapeHtml(fechaEmision)}<br>
        <strong>Responsable:</strong> ${escapeHtml(usuarioActor)}
      </td>
    </tr>
  </table>

  <div class="title-banner">
    <h1>Acta de Mesa Territorial de Movilidad y Dotación ${periodo}</h1>
    <p>Escenario: ${escapeHtml(escenario.nombre)} · Estado: ${escapeHtml(escenario.estado)} · Versión: v${escenario.version ?? 1}${escenario.numeroResolucion ? ` · Res. Ex. ${escapeHtml(escenario.numeroResolucion)}` : ''}</p>
  </div>

  <table class="kpi-grid">
    <tr>
      <td class="kpi-card"><div class="kpi-label">Total Movimientos</div><div class="kpi-val">${propuestas.length}</div></td>
      <td class="kpi-card"><div class="kpi-label">Docentes / AA.EE.</div><div class="kpi-val">${totalDocentes} / ${totalAsistentes}</div></td>
      <td class="kpi-card"><div class="kpi-label">Horas Movilizadas</div><div class="kpi-val">${totalHorasMovilizadas}h</div></td>
      <td class="kpi-card"><div class="kpi-label">Rebotes Generados</div><div class="kpi-val">${rebotesGenerados.length}</div></td>
      <td class="kpi-card"><div class="kpi-label">Vacantes Sin Cubrir</div><div class="kpi-val">${vacantesSinCubrir.length}</div></td>
    </tr>
  </table>

  <h2>1. Acuerdos de Movilidad y Calce Territorial</h2>
  ${
    propuestas.length === 0
      ? '<p class="empty-note">Sin propuestas de movilidad registradas en este escenario.</p>'
      : `<table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Funcionario</th>
              <th>RUN</th>
              <th>Origen &rarr; Destino</th>
              <th>Horas</th>
              <th>Fuente</th>
              <th>Cobertura</th>
              <th>Compat.</th>
              <th>Estado / Resolución</th>
            </tr>
          </thead>
          <tbody>${filasAcuerdos}</tbody>
        </table>`
  }

  <h2>2. Vacantes de Rebote Derivadas a Concurso GDP (${rebotesConcurso.length})</h2>
  ${
    rebotesConcurso.length === 0
      ? '<p class="empty-note">No existen vacantes de rebote derivadas a concurso público GDP en este escenario.</p>'
      : `<table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Establecimiento Origen</th>
              <th>Especialidad / Cargo</th>
              <th>Horas</th>
              <th>Fuente</th>
              <th>Motivo / Referencia</th>
            </tr>
          </thead>
          <tbody>${filasRebotesConcurso}</tbody>
        </table>`
  }

  <h2>3. Vacantes NN Remanentes Sin Cubrir (${vacantesSinCubrir.length})</h2>
  ${
    vacantesSinCubrir.length === 0
      ? '<p class="empty-note">Todas las vacantes NN activas del período cuentan con propuesta de cobertura.</p>'
      : `<table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Establecimiento</th>
              <th>Comuna</th>
              <th>Código / RUN</th>
              <th>Tipo Vacante</th>
              <th>Especialidad / Asignatura</th>
              <th>Horas</th>
              <th>Fuente</th>
              <th>Condición</th>
            </tr>
          </thead>
          <tbody>${filasVacantesSinCubrir}</tbody>
        </table>`
  }

  <table class="firmas-table">
    <tr>
      <td><div class="firma-linea">Subdirector/a UATP</div><div class="firma-cargo">SLEP Valle Diguillín</div></td>
      <td><div class="firma-linea">Encargado/a GDP</div><div class="firma-cargo">Gestión de Dotación de Personal</div></td>
      <td><div class="firma-linea">Asesor/a Territorial</div><div class="firma-cargo">Unidad Técnico Pedagógica</div></td>
    </tr>
  </table>
</body>
</html>`;
}

export function imprimirActaMesaMovilidad(html: string): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) {
    throw new Error('El navegador bloqueó la ventana emergente de impresión.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}

export function descargarActaWordMesaMovilidad(html: string, nombreArchivo: string): void {
  const filename = nombreArchivo.endsWith('.doc') ? nombreArchivo : `${nombreArchivo}.doc`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  saveAs(blob, filename);
}

export async function exportarVacantesRemanentesConcursoExcel(params: {
  vacantesSinCubrir: Docente[];
  colegios: Establecimiento[];
  periodo: number;
}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Vacantes Concurso GDP');
  const colegiosByRbd = new Map(params.colegios.map(c => [c.rbd, c]));

  ws.columns = [
    { header: 'RBD', key: 'rbd', width: 12 },
    { header: 'Establecimiento', key: 'establecimiento', width: 34 },
    { header: 'Comuna', key: 'comuna', width: 18 },
    { header: 'Código / RUN', key: 'run', width: 18 },
    { header: 'Tipo Vacante', key: 'tipoVacante', width: 20 },
    { header: 'Especialidad / Asignatura', key: 'especialidad', width: 30 },
    { header: 'Estamento', key: 'estamento', width: 20 },
    { header: 'Horas Contrato', key: 'horasContrato', width: 15 },
    { header: 'Fuente Financiamiento', key: 'fuente', width: 22 },
    { header: 'Condicional', key: 'condicional', width: 14 },
    { header: 'Justificación', key: 'justificacion', width: 42 }
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF002B49' }
  };

  for (const v of params.vacantesSinCubrir) {
    const est = colegiosByRbd.get(v.rbd);
    ws.addRow({
      rbd: v.rbd,
      establecimiento: est?.nombre || `RBD ${v.rbd}`,
      comuna: est?.comuna || '',
      run: v.run,
      tipoVacante: v.tipoVacante || 'NN_DETECTADO',
      especialidad: v.asignaturaPrincipal || `${v.nombres} ${v.apellidos}`.trim(),
      estamento: v.estamento || 'DOCENTE_AULA',
      horasContrato: Number(v.horasContrato || 0),
      fuente: inferirFuenteDocente(v),
      condicional: v.vacanteCondicional ? 'SI' : 'NO',
      justificacion: v.justificacionVacante || ''
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function generarHtmlNotificacionMovilidad(params: {
  solicitud: SolicitudMovilidad;
  propuesta?: PropuestaCalce;
  estOrigen?: Establecimiento;
  estDestino?: Establecimiento;
  periodo: number;
  usuarioActor: string;
}): string {
  const { solicitud, propuesta, estOrigen, estDestino, periodo, usuarioActor } = params;
  const origenTexto = estOrigen
    ? `${estOrigen.nombre} (RBD ${estOrigen.rbd})`
    : `RBD ${solicitud.rbdOrigen}`;
  const destinoRbd = propuesta?.rbdDestino || solicitud.rbdDestinoPreferente || 'Por definir';
  const destinoTexto = estDestino
    ? `${estDestino.nombre} (RBD ${estDestino.rbd})`
    : `RBD ${destinoRbd}`;
  const horas = propuesta?.horasAsignadas ?? solicitud.horasDisponiblesMover;
  const fuente = propuesta?.fuenteDestino || solicitud.fuenteActual;
  const cobertura = propuesta?.tipoCobertura === 'TRANSITORIA_CONDICIONAL' ? 'Transitoria Condicional' : 'Definitiva';

  const fechaEmision = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Notificación de Propuesta de Movilidad ${periodo} - ${escapeHtml(solicitud.nombreDocente)}</title>
  <style>
    @page { size: letter; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.45;
      font-size: 10.5pt;
      margin: 0;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      border-bottom: 3px solid #002B49;
      padding-bottom: 10px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .banner {
      background-color: #002B49;
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    .banner h1 { margin: 0; font-size: 13.5pt; }
    .banner p { margin: 2px 0 0; font-size: 9pt; opacity: 0.9; }
    table.info {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9.5pt;
    }
    table.info th, table.info td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }
    table.info th {
      width: 28%;
      background-color: #f1f5f9;
      color: #002B49;
      font-weight: 700;
    }
    .constancia {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 14px;
      background-color: #f8fafc;
      margin-top: 14px;
    }
    .firmas {
      width: 100%;
      margin-top: 44px;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .firmas td {
      width: 50%;
      text-align: center;
      padding: 0 22px;
      vertical-align: bottom;
    }
    .linea {
      border-top: 1px solid #334155;
      padding-top: 6px;
      font-weight: 700;
      font-size: 9pt;
    }
    .sub { font-size: 8pt; color: #475569; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <strong style="color:#002B49; font-size:11pt;">SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN</strong><br>
      <span style="font-size:8.5pt; color:#475569;">Unidad de Apoyo Técnico Pedagógico (UATP) · Mesa Territorial de Movilidad</span>
    </div>
    <div style="text-align:right; font-size:8.5pt;">
      <strong>Fecha:</strong> ${escapeHtml(fechaEmision)}<br>
      <strong>Emitido por:</strong> ${escapeHtml(usuarioActor)}
    </div>
  </div>

  <div class="banner">
    <h1>Notificación de Propuesta de Movilidad Territorial ${periodo}</h1>
    <p>Constancia formal para Dirección de Establecimiento de Origen y Funcionario/a (Nemawashi)</p>
  </div>

  <table class="info">
    <tr><th>Funcionario/a</th><td>${escapeHtml(solicitud.nombreDocente)}</td></tr>
    <tr><th>RUN</th><td>${escapeHtml(solicitud.runDocente)}</td></tr>
    <tr><th>Calidad Jurídica</th><td>${escapeHtml(solicitud.calidadJuridica)} · ${solicitud.horasContratoActual}h contrato actual</td></tr>
    <tr><th>Carril Normativo</th><td>${escapeHtml(solicitud.carril)}</td></tr>
    <tr><th>Establecimiento de Origen</th><td>${escapeHtml(origenTexto)}</td></tr>
    <tr><th>Establecimiento de Destino</th><td>${escapeHtml(destinoTexto)}</td></tr>
    <tr><th>Jornada / Fuente / Cobertura</th><td>${horas}h · ${escapeHtml(fuente)} · ${escapeHtml(cobertura)}</td></tr>
  </table>

  <div class="constancia">
    <strong>Constancia de Toma de Conocimiento y Aceptación:</strong>
    <p style="margin:6px 0 0; font-size:9pt;">
      Por medio del presente documento se notifica formalmente a la Dirección del establecimiento de origen y al/a la funcionario/a la propuesta de destinación o traslado territorial para el período ${periodo}, dejando registro de toma de conocimiento y conformidad previa a su consolidación administrativa.
    </p>
    <p style="margin:8px 0 0; font-size:9pt;"><strong>Observaciones:</strong> ________________________________________________________________________</p>
  </div>

  <table class="firmas">
    <tr>
      <td>
        <div class="linea">Dirección Establecimiento de Origen</div>
        <div class="sub">Nombre, Firma y Timbre · Fecha: ____/____/______</div>
      </td>
      <td>
        <div class="linea">Funcionario/a Notificado/a</div>
        <div class="sub">Firma y Aceptación · Fecha: ____/____/______</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
