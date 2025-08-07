import React, { useState } from 'react';
import { Download, FileText, File, Table, Settings } from 'lucide-react';
import { GeneratedForm, ExportFormat } from '@/types';
import { exportToPDF, exportToExcel, exportToWord } from '@/lib/export';
import { PDFConfig, DEFAULT_PDF_CONFIG } from '@/lib/pdfStyles';

interface ExportOptionsProps {
  form: GeneratedForm;
  onExportComplete: (format: ExportFormat) => void;
  className?: string;
}

const exportOptions = [
  {
    format: 'pdf' as ExportFormat,
    name: 'Export as PDF',
    description: 'Professional document format',
    icon: FileText,
    color: 'border-red-200 hover:border-red-400 hover:bg-red-50'
  },
  {
    format: 'docx' as ExportFormat,
    name: 'Export as Word',
    description: 'Editable document format',
    icon: File,
    color: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
  },
  {
    format: 'excel' as ExportFormat,
    name: 'Export as Excel',
    description: 'Spreadsheet format',
    icon: Table,
    color: 'border-green-200 hover:border-green-400 hover:bg-green-50'
  }
];

export function ExportOptions({ form, onExportComplete, className = '' }: ExportOptionsProps) {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportStatus, setExportStatus] = useState<{ format: ExportFormat; status: 'success' | 'error' } | null>(null);
  const [showPDFSettings, setShowPDFSettings] = useState(false);
  const [pdfConfig, setPdfConfig] = useState<PDFConfig>(DEFAULT_PDF_CONFIG);

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    setExportStatus(null);

    try {
      switch (format) {
        case 'pdf':
          // Use the enhanced PDF export with configuration
          await exportToPDF(form, pdfConfig);
          break;
        case 'docx':
          await exportToWord(form);
          break;
        case 'excel':
          await exportToExcel(form);
          break;
      }
      setExportStatus({ format, status: 'success' });
      onExportComplete(format);
    } catch (error) {
      console.error(`Export failed for ${format}:`, error);
      setExportStatus({ format, status: 'error' });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Export Options
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose your preferred format to download the generated form
            </p>
          </div>
          <button
            onClick={() => setShowPDFSettings(!showPDFSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="PDF Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        {/* PDF Settings Panel */}
        {showPDFSettings && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">PDF Export Settings</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pdfConfig.includeMetadata}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, includeMetadata: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Include metadata section</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pdfConfig.includePageNumbers}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, includePageNumbers: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Include page numbers</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pdfConfig.showWatermark}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, showWatermark: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Add watermark</span>
              </label>
              {pdfConfig.showWatermark && (
                <input
                  type="text"
                  value={pdfConfig.watermarkText || ''}
                  onChange={(e) => setPdfConfig({ ...pdfConfig, watermarkText: e.target.value })}
                  placeholder="Watermark text (e.g., DRAFT)"
                  className="ml-6 px-3 py-1 text-sm border border-gray-300 rounded-md"
                />
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            const isExporting = exportingFormat === option.format;
            const hasStatus = exportStatus?.format === option.format;
            const isSuccess = hasStatus && exportStatus?.status === 'success';
            const isError = hasStatus && exportStatus?.status === 'error';
            
            return (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                disabled={isExporting}
                className={`
                  p-6 border-2 rounded-lg transition-all duration-200 text-center
                  ${isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${isSuccess ? 'border-green-400 bg-green-50' : 
                    isError ? 'border-red-400 bg-red-50' : 
                    option.color
                  }
                  hover:transform hover:scale-105 hover:shadow-lg
                `}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-3 rounded-full ${
                    isSuccess ? 'bg-green-100' :
                    isError ? 'bg-red-100' :
                    'bg-gray-100'
                  }`}>
                    <Icon className={`w-8 h-8 ${
                      isSuccess ? 'text-green-600' :
                      isError ? 'text-red-600' :
                      'text-gray-600'
                    }`} />
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">
                      {isExporting ? 'Exporting...' : option.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {isSuccess ? 'Downloaded successfully!' :
                       isError ? 'Export failed. Try again.' :
                       option.description
                      }
                    </p>
                  </div>
                  
                  {isExporting && (
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {exportStatus && (
          <div className={`mt-6 p-4 rounded-lg text-center ${
            exportStatus.status === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {exportStatus.status === 'success' 
              ? `Form successfully exported as ${exportStatus.format.toUpperCase()}!`
              : `Failed to export as ${exportStatus.format.toUpperCase()}. Please try again.`
            }
          </div>
        )}
      </div>
    </div>
  );
}