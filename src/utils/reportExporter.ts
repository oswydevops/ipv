import { saveFileWithPicker } from './fileSaver';

export type ReportFormat = 'excel' | 'pdf';

interface ExportReportInput {
  title: string;
  fileName: string;
  csvContent: string;
  delimiter?: ',' | ';';
  format: ReportFormat;
}

export async function exportReportFile({
  title,
  fileName,
  csvContent,
  delimiter = ';',
  format,
}: ExportReportInput): Promise<{ canceled: boolean; path?: string; error?: string }> {
  if (window.api?._isElectron && window.api.reports?.exportarTabla) {
    return window.api.reports.exportarTabla({
      title,
      fileName,
      csvContent,
      delimiter,
      format,
    });
  }

  if (format === 'pdf') {
    return {
      canceled: false,
      error: 'La exportación a PDF requiere la aplicación de escritorio.',
    };
  }

  const csvName = `${fileName.replace(/\.[^.]+$/, '')}.csv`;
  const result = await saveFileWithPicker(csvContent, {
    suggestedName: csvName,
    mimeType: 'text/csv;charset=utf-8;',
    extension: 'csv',
    description: `${title} (CSV compatible con Excel)`,
  });
  return {
    canceled: result.canceled,
    path: result.fullPath,
    error: result.error,
  };
}
