import React from 'react';
import { FileText, DollarSign, User, Briefcase, Heart, Scale } from 'lucide-react';
import { FormType } from '@/types';
import { FORM_TEMPLATES } from '@/config/formTemplates';

interface FormTypeSelectorProps {
  selectedType: FormType | null;
  onTypeSelect: (type: FormType) => void;
  suggestedTypes?: FormType[];
  className?: string;
}

const typeIcons: Record<FormType, React.ComponentType<any>> = {
  visa_application: FileText,
  financial_declaration: DollarSign,
  personal_information: User,
  employment_application: Briefcase,
  medical_intake: Heart,
  legal_document: Scale
};

const typeColors: Record<FormType, string> = {
  visa_application: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
  financial_declaration: 'border-green-200 hover:border-green-400 hover:bg-green-50',
  personal_information: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',
  employment_application: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50',
  medical_intake: 'border-red-200 hover:border-red-400 hover:bg-red-50',
  legal_document: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
};

const selectedColors: Record<FormType, string> = {
  visa_application: 'border-blue-500 bg-blue-500 text-white',
  financial_declaration: 'border-green-500 bg-green-500 text-white',
  personal_information: 'border-purple-500 bg-purple-500 text-white',
  employment_application: 'border-orange-500 bg-orange-500 text-white',
  medical_intake: 'border-red-500 bg-red-500 text-white',
  legal_document: 'border-gray-700 bg-gray-700 text-white'
};

const FORM_DESCRIPTIONS: Record<FormType, string> = {
  visa_application: 'For travel documents, passports, and visa applications',
  financial_declaration: 'For bank statements, financial records, and income verification',
  personal_information: 'For general personal documents and identification',
  employment_application: 'For job applications, resumes, and employment verification',
  medical_intake: 'For medical records, health information, and patient intake',
  legal_document: 'For contracts, agreements, and legal documentation'
};

export function FormTypeSelector({ selectedType, onTypeSelect, suggestedTypes, className = '' }: FormTypeSelectorProps) {
  const typesToShow = suggestedTypes && suggestedTypes.length > 0 
    ? suggestedTypes 
    : Object.keys(FORM_TEMPLATES) as FormType[];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Select Form Type
        </h3>
        {suggestedTypes && suggestedTypes.length > 0 && (
          <p className="text-sm text-gray-600">
            Based on AI analysis, we recommend these form types:
          </p>
        )}
      </div>
      
      <div className="space-y-3">
        {typesToShow.map((type) => {
          const template = FORM_TEMPLATES[type];
          const Icon = typeIcons[type];
          const isSelected = selectedType === type;
          const isSuggested = suggestedTypes?.includes(type);
          
          if (!template) return null;
          
          return (
            <button
              key={type}
              onClick={() => onTypeSelect(type)}
              className={`
                w-full p-4 rounded-lg border-2 transition-all duration-200 text-left
                ${isSelected 
                  ? selectedColors[type] 
                  : `${typeColors[type]} bg-white`
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  isSelected 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gray-100'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    isSelected 
                      ? 'text-white' 
                      : 'text-gray-600'
                  }`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium ${
                      isSelected ? 'text-white' : 'text-gray-900'
                    }`}>
                      {template.name || 'Unknown Form'}
                    </h4>
                    {isSuggested && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        isSelected 
                          ? 'bg-white bg-opacity-20 text-white' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${
                    isSelected ? 'text-white text-opacity-90' : 'text-gray-600'
                  }`}>
                    {FORM_DESCRIPTIONS[type]}
                  </p>
                  <p className={`text-xs mt-1 ${
                    isSelected ? 'text-white text-opacity-75' : 'text-gray-500'
                  }`}>
                    {template.fields?.length || 0} fields
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}