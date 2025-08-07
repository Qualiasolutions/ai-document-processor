import React, { useState, useEffect } from 'react';
import { Edit, Save, Download } from 'lucide-react';
import { GeneratedForm, FormField } from '@/types';

interface FormGeneratorProps {
  form: GeneratedForm;
  onFormChange: (data: Record<string, string>) => void;
  onExport: () => void;
  className?: string;
}

export function FormGenerator({ form, onFormChange, onExport, className = '' }: FormGeneratorProps) {
  const [formData, setFormData] = useState<Record<string, string>>(form.data);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(form.data);
  }, [form.data]);

  const handleFieldChange = (fieldName: string, value: string) => {
    const newData = { ...formData, [fieldName]: value };
    setFormData(newData);
    setHasChanges(true);
    onFormChange(newData);
  };

  const handleSave = () => {
    setIsEditing(false);
    setHasChanges(false);
  };

  const renderField = (field: FormField) => {
    if (!field || !field.name) return null;
    
    const value = formData[field.name] || '';
    const isRequired = field.required || false;
    const isDisabled = !isEditing;

    const baseClasses = `
      w-full px-3 py-2 border border-gray-300 rounded-lg transition-colors
      ${isDisabled 
        ? 'bg-gray-50 text-gray-700 cursor-default' 
        : 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
      }
    `;

    const fieldElement = (() => {
      switch (field.type) {
        case 'textarea':
          return (
            <textarea
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isDisabled}
              required={isRequired}
              rows={3}
              className={baseClasses}
              placeholder={isEditing ? `Enter ${(field.label || field.name || 'value').toLowerCase()}` : ''}
            />
          );
        case 'date':
          return (
            <input
              type="date"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isDisabled}
              required={isRequired}
              className={baseClasses}
            />
          );
        case 'number':
          return (
            <input
              type="number"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isDisabled}
              required={isRequired}
              className={baseClasses}
              placeholder={isEditing ? `Enter ${(field.label || field.name || 'value').toLowerCase()}` : ''}
            />
          );
        case 'email':
          return (
            <input
              type="email"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isDisabled}
              required={isRequired}
              className={baseClasses}
              placeholder={isEditing ? `Enter ${(field.label || field.name || 'value').toLowerCase()}` : ''}
            />
          );
        default:
          return (
            <input
              type="text"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isDisabled}
              required={isRequired}
              className={baseClasses}
              placeholder={isEditing ? `Enter ${(field.label || field.name || 'value').toLowerCase()}` : ''}
            />
          );
      }
    })();

    return (
      <div key={field.name} className="space-y-2">
        <label 
          htmlFor={field.name} 
          className="block text-sm font-medium text-gray-700"
        >
          {field.label || field.name || 'Field'}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {fieldElement}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {form.template?.name || 'Form'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isEditing ? 'Edit the form fields below' : 'Review the extracted information'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
              95% Confidence
            </span>
            
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Form
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(form.template?.fields || []).map(renderField)}
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-center">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Download className="w-5 h-5" />
            Export Form
          </button>
        </div>
      </div>
    </div>
  );
}