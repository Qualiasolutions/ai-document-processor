import React from 'react';
import { FileCheck, Download, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface GeneratedForm {
  id: string;
  title?: string;
  form_type?: string;
  created_at: string;
  status?: string;
  form_data?: any;
  template?: any;
}

interface GeneratedFormsListProps {
  forms: GeneratedForm[];
  onFormSelect: (form: GeneratedForm) => void;
}

export function GeneratedFormsList({ forms, onFormSelect }: GeneratedFormsListProps) {
  if (forms.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">No forms generated yet</p>
        <p className="text-sm text-gray-500">Process documents to generate forms automatically</p>
      </div>
    );
  }

  const getFormTypeName = (formType: string) => {
    const typeNames: Record<string, string> = {
      visa_application: 'Visa Application',
      financial_declaration: 'Financial Declaration',
      personal_information: 'Personal Information',
      employment_application: 'Employment Application',
      medical_intake: 'Medical Intake',
      legal_document: 'Legal Document'
    };
    return typeNames[formType] || formType;
  };

  const getFormTypeColor = (formType: string) => {
    const colors: Record<string, string> = {
      visa_application: 'bg-blue-100 text-blue-700',
      financial_declaration: 'bg-green-100 text-green-700',
      personal_information: 'bg-purple-100 text-purple-700',
      employment_application: 'bg-orange-100 text-orange-700',
      medical_intake: 'bg-red-100 text-red-700',
      legal_document: 'bg-gray-100 text-gray-700'
    };
    return colors[formType] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-3">
      {forms.map((form) => {
        const fieldCount = form.form_data ? Object.keys(form.form_data).length : 0;
        const isCompleted = form.status === 'completed' || fieldCount > 0;
        
        return (
          <div 
            key={form.id} 
            className="card-modern p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => onFormSelect(form)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <FileText className={`w-5 h-5 ${isCompleted ? 'text-green-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {form.title || getFormTypeName(form.form_type || 'unknown')}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm text-gray-600">
                      {formatDate(form.created_at)}
                    </p>
                    {form.form_type && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getFormTypeColor(form.form_type)}`}>
                        {getFormTypeName(form.form_type)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {fieldCount > 0 && (
                  <span className="text-xs text-gray-600 mr-2">
                    {fieldCount} fields
                  </span>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  className="shadow-sm"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  View
                </Button>
                
                <Button
                  size="sm"
                  className="shadow-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Export
                </Button>
              </div>
            </div>
            
            {/* Form Preview */}
            {form.form_data && Object.keys(form.form_data).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(form.form_data).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-gray-600">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-gray-900 ml-1 font-medium">
                        {String(value).substring(0, 30)}
                        {String(value).length > 30 && '...'}
                      </span>
                    </div>
                  ))}
                </div>
                {Object.keys(form.form_data).length > 4 && (
                  <p className="text-xs text-gray-500 mt-2">
                    +{Object.keys(form.form_data).length - 4} more fields
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