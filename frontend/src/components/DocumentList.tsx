import React from 'react';
import { FileText, Eye, Brain, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, formatFileSize } from '@/lib/utils';

interface Document {
  id: string;
  filename: string;
  file_size?: number;
  file_type?: string;
  status?: string;
  processing_status?: string;
  created_at: string;
  ai_analysis?: any;
  extracted_content?: string;
}

interface DocumentListProps {
  documents: Document[];
  onDocumentSelect: (document: Document) => void;
}

export function DocumentList({ documents, onDocumentSelect }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">No documents uploaded yet</p>
        <p className="text-sm text-gray-500">Upload your first document to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const isProcessed = doc.status === 'processed' || doc.processing_status === 'completed';
        const isProcessing = doc.processing_status === 'processing' || doc.status === 'processing';
        
        return (
          <div 
            key={doc.id} 
            className="card-modern p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => onDocumentSelect(doc)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${
                  isProcessed ? 'bg-green-100' :
                  isProcessing ? 'bg-yellow-100' :
                  'bg-gray-100'
                }`}>
                  <FileText className={`w-5 h-5 ${
                    isProcessed ? 'text-green-600' :
                    isProcessing ? 'text-yellow-600' :
                    'text-gray-600'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{doc.filename}</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(doc.created_at)} • {formatFileSize(doc.file_size || 0)}
                  </p>
                  {doc.extracted_content && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {doc.extracted_content.substring(0, 50)}...
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  isProcessed ? 'bg-green-100 text-green-700' :
                  isProcessing ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {doc.processing_status || doc.status || 'pending'}
                </span>
                
                {isProcessed && doc.ai_analysis && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                
                {!isProcessed && !isProcessing && (
                  <Button
                    size="sm"
                    className="shadow-sm"
                  >
                    <Brain className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* AI Analysis Preview */}
            {doc.ai_analysis && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Document Type:</span>
                    <span className="text-xs font-medium text-gray-900">
                      {doc.ai_analysis.documentType || doc.ai_analysis.document_type || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    {Math.round((doc.ai_analysis.confidence || 0.8) * 100)}% confidence
                  </span>
                </div>
                {doc.ai_analysis.extractedFields && Object.keys(doc.ai_analysis.extractedFields).length > 0 && (
                  <p className="text-xs text-gray-600">
                    {Object.keys(doc.ai_analysis.extractedFields).length} fields extracted
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 