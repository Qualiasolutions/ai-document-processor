import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qfldqwfpbabeonvryaof.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbGRxd2ZwYmFiZW9udnJ5YW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNDE4MDMsImV4cCI6MjA2OTcxNzgwM30.Aog8ipvpRpXDJBD_k6XcsiqZhf4YQ4tDXi8i7PkWB80'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Types for our database
export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  company?: string
  job_title?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  user_id: string
  filename: string
  file_url?: string
  file_size?: number
  mime_type?: string
  content?: string
  document_type?: string
  ai_analysis?: any
  processing_status: string
  created_at: string
  updated_at: string
}

export interface GeneratedForm {
  id: string
  user_id: string
  document_ids: string[]
  template_id?: string
  form_data: Record<string, any>
  form_type: string
  status: string
  title?: string
  created_at: string
  updated_at: string
}

export interface FormTemplate {
  id: string
  name: string
  description?: string
  fields: any
  is_public: boolean
  is_system: boolean
  created_by?: string
  category?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  default_export_format: string
  auto_save_enabled: boolean
  notification_preferences: Record<string, any>
  ai_processing_enabled: boolean
  created_at: string
  updated_at: string
}