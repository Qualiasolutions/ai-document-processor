import React from 'react';
import { FileText, CheckCircle, AlertCircle, Brain } from 'lucide-react';
import { DocumentInfo } from '@/types';

interface DocumentAnalysisProps {
  documents: DocumentInfo[];
  className?: string;
}

export function DocumentAnalysis({ documents, className = '' }: DocumentAnalysisProps) {
  const processedDocuments = documents.filter(doc => doc.processed && doc.aiAnalysis);

  if (processedDocuments.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No documents analyzed yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600" />
          AI Analysis Results
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Extracted information from {processedDocuments.length} document{processedDocuments.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="p-6 space-y-6">
        {processedDocuments.map((document) => {
          const analysis = document.aiAnalysis;
          if (!analysis) return null;
          
          const confidence = analysis.confidence || 0;
          const confidenceColor = confidence >= 0.9 
            ? 'text-green-600 bg-green-100' 
            : confidence >= 0.7 
              ? 'text-yellow-600 bg-yellow-100'
              : 'text-red-600 bg-red-100';
          
          return (
            <div key={document.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">{document.filename || 'Unknown file'}</h4>
                    <p className="text-sm text-gray-500">Type: {analysis.document_type || 'unknown'}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${confidenceColor}`}>
                  {Math.round(confidence * 100)}% confidence
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(analysis.extracted_data || analysis.extractedFields) && Object.entries(analysis.extracted_data || analysis.extractedFields || {}).map(([key, value]) => {
                  if (!value || !key) return null;
                  
                  return (
                    <div key={key} className="">
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {(key || '').replace(/_/g, ' ')}
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </dd>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">
                  Suggested form: <span className="font-medium">
                    {(analysis.suggested_form || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}