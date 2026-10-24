/**
 * Utilidad para guardar o exportar archivos preguntando la ruta de guardado al usuario.
 * Utiliza el File System Access API (window.showSaveFilePicker) cuando está disponible,
 * abriendo el selector de carpetas y archivos nativo del sistema operativo.
 * Si no está disponible o falla, utiliza la descarga del navegador como fallback.
 */

export interface SaveFileOptions {
  suggestedName: string;
  mimeType?: string;
  extension?: string;
  description?: string;
}

export interface SaveFileResult {
  ok: boolean;
  canceled: boolean;
  fileName?: string;
  fullPath?: string;
  error?: string;
}

export async function saveFileWithPicker(
  content: Blob | string,
  options: SaveFileOptions
): Promise<SaveFileResult> {
  const {
    suggestedName,
    mimeType = 'text/csv;charset=utf-8;',
    extension = 'csv',
    description = 'Planilla Excel / CSV',
  } = options;

  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

  // 1. Intentar File System Access API nativo de navegadores modernos (Chrome, Edge, etc.)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const mimeClean = mimeType.split(';')[0].trim();
      const extWithDot = extension.startsWith('.') ? extension : `.${extension}`;

      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description,
            accept: {
              [mimeClean]: [extWithDot],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        ok: true,
        canceled: false,
        fileName: handle.name || suggestedName,
        fullPath: handle.name ? `Carpeta seleccionada / ${handle.name}` : undefined,
      };
    } catch (err: any) {
      // Si el usuario canceló deliberadamente en la ventana nativa de "Guardar como..."
      if (err.name === 'AbortError') {
        return {
          ok: false,
          canceled: true,
        };
      }
      console.warn('showSaveFilePicker no completado o restringido en este contexto:', err);
      // Fallback a descarga regular
    }
  }

  // 2. Descarga estándar mediante enlace <a>
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    return {
      ok: true,
      canceled: false,
      fileName: suggestedName,
      fullPath: `Descargas / ${suggestedName}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      canceled: false,
      error: err?.message || 'Error al descargar archivo.',
    };
  }
}
