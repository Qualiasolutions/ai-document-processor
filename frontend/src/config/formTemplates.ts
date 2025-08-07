import { FormTemplate, FormType } from '@/types';

export const FORM_TEMPLATES: Record<FormType, FormTemplate> = {
  visa_application: {
    name: 'Visa Application Form',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'passport_number', label: 'Passport Number', type: 'text', required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'nationality', label: 'Nationality', type: 'text', required: true },
      { name: 'address', label: 'Address', type: 'textarea', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: false },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'purpose_of_visit', label: 'Purpose of Visit', type: 'text', required: true },
      { name: 'duration_of_stay', label: 'Duration of Stay', type: 'text', required: false }
    ]
  },
  financial_declaration: {
    name: 'Financial Declaration Form',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'account_number', label: 'Account Number', type: 'text', required: true },
      { name: 'bank_name', label: 'Bank Name', type: 'text', required: true },
      { name: 'balance', label: 'Account Balance', type: 'number', required: true },
      { name: 'monthly_income', label: 'Monthly Income', type: 'number', required: false },
      { name: 'employment_status', label: 'Employment Status', type: 'text', required: false },
      { name: 'assets', label: 'Assets', type: 'textarea', required: false },
      { name: 'liabilities', label: 'Liabilities', type: 'textarea', required: false }
    ]
  },
  personal_information: {
    name: 'Personal Information Form',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'address', label: 'Address', type: 'textarea', required: true },
      { name: 'emergency_contact', label: 'Emergency Contact', type: 'text', required: false },
      { name: 'emergency_phone', label: 'Emergency Phone', type: 'text', required: false },
      { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false }
    ]
  },
  employment_application: {
    name: 'Employment Application Form',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'address', label: 'Address', type: 'textarea', required: true },
      { name: 'position_applied', label: 'Position Applied For', type: 'text', required: true },
      { name: 'available_start_date', label: 'Available Start Date', type: 'date', required: true },
      { name: 'salary_expectation', label: 'Salary Expectation', type: 'text', required: false },
      { name: 'education', label: 'Education Background', type: 'textarea', required: true },
      { name: 'work_experience', label: 'Work Experience', type: 'textarea', required: true },
      { name: 'skills', label: 'Skills and Qualifications', type: 'textarea', required: true },
      { name: 'references', label: 'References', type: 'textarea', required: false },
      { name: 'cover_letter', label: 'Cover Letter', type: 'textarea', required: false }
    ]
  },
  medical_intake: {
    name: 'Medical Intake Form',
    fields: [
      { name: 'full_name', label: 'Patient Full Name', type: 'text', required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'text', required: false },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'address', label: 'Address', type: 'textarea', required: true },
      { name: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text', required: true },
      { name: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text', required: true },
      { name: 'primary_complaint', label: 'Primary Complaint/Reason for Visit', type: 'textarea', required: true },
      { name: 'current_medications', label: 'Current Medications', type: 'textarea', required: false },
      { name: 'allergies', label: 'Allergies', type: 'textarea', required: false },
      { name: 'medical_history', label: 'Medical History', type: 'textarea', required: false },
      { name: 'insurance_provider', label: 'Insurance Provider', type: 'text', required: false },
      { name: 'insurance_policy_number', label: 'Insurance Policy Number', type: 'text', required: false }
    ]
  },
  legal_document: {
    name: 'Legal Document Form',
    fields: [
      { name: 'document_title', label: 'Document Title', type: 'text', required: true },
      { name: 'document_date', label: 'Document Date', type: 'date', required: true },
      { name: 'party_1_name', label: 'First Party Name', type: 'text', required: true },
      { name: 'party_1_address', label: 'First Party Address', type: 'textarea', required: true },
      { name: 'party_1_contact', label: 'First Party Contact', type: 'text', required: true },
      { name: 'party_2_name', label: 'Second Party Name', type: 'text', required: false },
      { name: 'party_2_address', label: 'Second Party Address', type: 'textarea', required: false },
      { name: 'party_2_contact', label: 'Second Party Contact', type: 'text', required: false },
      { name: 'subject_matter', label: 'Subject Matter', type: 'textarea', required: true },
      { name: 'terms_conditions', label: 'Terms and Conditions', type: 'textarea', required: true },
      { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: false },
      { name: 'witness_name', label: 'Witness Name', type: 'text', required: false },
      { name: 'additional_provisions', label: 'Additional Provisions', type: 'textarea', required: false }
    ]
  }
};

export const FORM_DESCRIPTIONS: Record<FormType, string> = {
  visa_application: 'Travel and immigration documents',
  financial_declaration: 'Financial and banking information',
  personal_information: 'General personal details and contact information',
  employment_application: 'Job applications and employment-related forms',
  medical_intake: 'Medical forms and patient intake information',
  legal_document: 'Legal contracts, agreements, and official documents'
};