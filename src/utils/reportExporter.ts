import { saveFileWithPicker } from './fileSaver';
import { getSelectedBusinessProfile } from '../data/productCategories';
import platformLogoDataUrl from '../../assets/icono.png?inline';

export { platformLogoDataUrl };

export type ReportFormat = 'excel' | 'pdf';

interface ExportReportInput {
  title: string;
  fileName: string;
  csvContent: string;
  delimiter?: ',' | ';';
  format: ReportFormat;
  businessName?: string;
  ownerName?: string;
  logoDataUrl?: string;
}

export async function exportReportFile({
  title,
  fileName,
  csvContent,
  delimiter = ';',
  format,
  businessName = '',
  ownerName = '',
  logoDataUrl = platformLogoDataUrl,
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
      businessName,
      ownerName,
      logoDataUrl,
    });
  }

  if (format === 'pdf') {
    return {
      canceled: false,
      error: 'La exportación a PDF requiere la aplicación de escritorio.',
    };
  }

  const csvName = `${fileName.replace(/\.[^.]+$/, '')}.csv`;
  const brandingRows = [
    `"Plataforma"${delimiter}"FerreStock"`,
    `"Nombre del negocio"${delimiter}"${businessName.replace(/"/g, '""')}"`,
    `"Propietario"${delimiter}"${ownerName.replace(/"/g, '""')}"`,
    profileRow,
  ];
  const reportCsvContent = `${bom}${brandingRows.join('\r\n')}\r\n${csvBody}`;
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
