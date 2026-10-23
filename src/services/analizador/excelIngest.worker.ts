/**
 * Web Worker para Ingesta y Parsing de Planillas de Dotación en hilo secundario.
 * Evita bloqueos en el hilo principal de la UI (60 FPS / <16ms latencia).
 */
import * as XLSX from 'xlsx';
import { parseExcelWorkbook, ParsedSchoolResult } from './excelParser';
import { parseAsistentesFromWorkbook } from './asistentesParser';

export interface IngestWorkerRequest {
  fileBuffer: ArrayBuffer;
  fileName: string;
  fileIndex: number;
}

export interface IngestWorkerResponse {
  success: boolean;
  fileName: string;
  parsedSchool?: ParsedSchoolResult;
  asistentes?: any[];
  error?: string;
}

// Escuchar mensajes en el contexto del Worker
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (event: MessageEvent<IngestWorkerRequest>) => {
    try {
      const { fileBuffer, fileName, fileIndex } = event.data;

      // Lectura unificada de XLSX (un solo XLSX.read)
      const workbook = XLSX.read(fileBuffer, {
        type: 'array',
        cellDates: false,
        raw: false,
      });

      // Parsear docentes y cursos
      const parsedSchool = parseExcelWorkbook(workbook, fileName, fileIndex);

      // Parsear asistentes si existe hoja correspondiente
      let asistentes: any[] = [];
      try {
        const asistResult = parseAsistentesFromWorkbook(workbook, '', 2026);
        asistentes = asistResult.asistentes || [];
      } catch (_) {}

      self.postMessage({
        success: true,
        fileName,
        parsedSchool,
        asistentes,
      } as IngestWorkerResponse);
    } catch (err: any) {
      self.postMessage({
        success: false,
        fileName: event.data?.fileName || 'unknown',
        error: err?.message || String(err),
      } as IngestWorkerResponse);
    }
  };
}
