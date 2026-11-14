import { saveFileWithPicker } from './fileSaver';
import { getSelectedBusinessProfile } from '../data/productCategories';

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
  const businessProfile = getSelectedBusinessProfile();
  const reportTitle = `${title} - ${businessProfile.label}`;
  const bom = csvContent.startsWith('\uFEFF') ? '\uFEFF' : '';
  const csvBody = bom ? csvContent.slice(1) : csvContent;
  const profileRow = `"Tipo de negocio"${delimiter}"${businessProfile.label.replace(/"/g, '""')}"`;

  if (window.api?._isElectron && window.api.reports?.exportarTabla) {
    return window.api.reports.exportarTabla({
      title: reportTitle,
      fileName,
      csvContent,
      delimiter,
      format,
      businessProfileName: businessProfile.label,
    });
  }

  if (format === 'pdf') {
    return {
      canceled: false,
      error: 'La exportación a PDF requiere la aplicación de escritorio.',
    };
  }

  const csvName = `${fileName.replace(/\.[^.]+$/, '')}.csv`;
  const reportCsvContent = `${bom}${profileRow}\r\n${csvBody}`;
  const result = await saveFileWithPicker(reportCsvContent, {
    suggestedName: csvName,
    mimeType: 'text/csv;charset=utf-8;',
    extension: 'csv',
    description: `${reportTitle} (CSV compatible con Excel)`,
  });
  return {
    canceled: result.canceled,
    path: result.fullPath,
    error: result.error,
  };
}
