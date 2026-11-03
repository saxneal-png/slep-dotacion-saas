/**
 * templateLoaderService.ts
 * Cargador de plantillas oficiales Excel (PAL 2027, GDP, Matrices)
 * Diseñado para operar con resiliencia en:
 * - Navegador Web (Desarrollo y Producción Vite con base './')
 * - Electron Desktop (empaquetado o en desarrollo)
 * - Entornos de Test automatizado (Node.js / Vitest)
 */

export async function cargarPlantillaOficialBuffer(nombreArchivo: string): Promise<ArrayBuffer> {
  const errores: string[] = [];

  // 1. Estrategia Navegador / Renderer (Fetch con múltiples variantes de ruta)
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const rutasCandidatas = [
      `./templates/${nombreArchivo}`,
      `/templates/${nombreArchivo}`,
      `templates/${nombreArchivo}`,
      `../templates/${nombreArchivo}`,
    ];

    if (window.location && window.location.origin && window.location.origin !== 'null') {
      rutasCandidatas.push(`${window.location.origin}/templates/${nombreArchivo}`);
      const pathname = window.location.pathname.replace(/\/[^/]*$/, '');
      if (pathname && pathname !== '/') {
        rutasCandidatas.push(`${window.location.origin}${pathname}/templates/${nombreArchivo}`);
      }
    }

    for (const ruta of rutasCandidatas) {
      try {
        const res = await window.fetch(ruta);
        // En protocolos HTTP/HTTPS: res.ok (200-299)
        // En protocolo file:// de Electron/Chromium: res.status suele ser 0 pero la respuesta es válida
        if (res.ok || (res.status === 0 && res.type !== 'error')) {
          const buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 500) {
            return buf;
          }
        }
      } catch (err: any) {
        errores.push(`fetch(${ruta}): ${err?.message || err}`);
      }
    }
  }

  // 2. Estrategia Node.js / Test Runner / Electron Main & Renderer con acceso a fs
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const posiblesRutasNode = [
        path.resolve(process.cwd(), 'public/templates', nombreArchivo),
        path.resolve(process.cwd(), 'dist/templates', nombreArchivo),
        path.resolve(process.cwd(), 'templates', nombreArchivo)
      ];

      // En Electron empaquetado
      if ((process as any).resourcesPath) {
        posiblesRutasNode.push(
          path.resolve((process as any).resourcesPath, 'public/templates', nombreArchivo),
          path.resolve((process as any).resourcesPath, 'app.asar.unpacked/public/templates', nombreArchivo),
          path.resolve((process as any).resourcesPath, 'templates', nombreArchivo)
        );
      }

      for (const rutaNode of posiblesRutasNode) {
        try {
          const buf = await fs.readFile(rutaNode);
          if (buf && buf.byteLength > 500) {
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          }
        } catch (err: any) {
          errores.push(`fs.readFile(${rutaNode}): ${err?.message || err}`);
        }
      }
    } catch (importErr: any) {
      errores.push(`import fs/promises: ${importErr?.message || importErr}`);
    }
  }

  throw new Error(
    `No se pudo cargar la plantilla oficial "${nombreArchivo}". Verifique que el archivo exista en public/templates/. Detalle: ${errores.slice(0, 3).join(' | ')}`
  );
}
