export interface DocumentInfo {
  id: string;
  filename: string;
  file: File;
  content: string;
  type: 'passport' | 'financial' | 'personal' | 'contract' | 'other';
  processed: boolean;
  aiAnalysis?: AIAnalysis;
  error?: string;
}

export interface AIAnalysis {
  document_type: string;
  confidence: number;
  suggested_form: FormType;
  extracted_data: Record<string, any>;
  extractedFields?: Record<string, any>; // Support both field name formats
}

export type FormType = 'visa_application' | 'financial_declaration' | 'personal_information' | 'employment_application' | 'medical_intake' | 'legal_document';

export interface FormTemplate {
  name: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'date' | 'number' | 'textarea';
  required: boolean;
}

export interface GeneratedForm {
  id: string;
  template: FormTemplate;
  data: Record<string, string>;
  formType: FormType;
}

export type ProcessingStep = 'upload' | 'processing' | 'review' | 'form' | 'export';

export type ExportFormat = 'pdf' | 'docx' | 'excel';