-- Migration to allow anonymous document uploads
-- Make user_id nullable to support anonymous uploads

-- Update documents table to allow null user_id
ALTER TABLE documents ALTER COLUMN user_id DROP NOT NULL;

-- Add new fields for better anonymous tracking
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update generated_forms table to allow null user_id
ALTER TABLE generated_forms ALTER COLUMN user_id DROP NOT NULL;

-- Update audit_logs table to allow null user_id for anonymous actions
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Add indexes for better performance with anonymous uploads
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_forms_created_at ON generated_forms(created_at DESC);

-- Update RLS policies to allow anonymous access
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;

-- Create new policies that allow anonymous access
CREATE POLICY "Allow anonymous document access" ON documents FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view their own forms" ON generated_forms;
DROP POLICY IF EXISTS "Users can insert their own forms" ON generated_forms;
DROP POLICY IF EXISTS "Users can update their own forms" ON generated_forms;

-- Create new policies for forms
CREATE POLICY "Allow anonymous form access" ON generated_forms FOR ALL USING (true);

-- Update audit_logs policies
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
CREATE POLICY "Allow anonymous audit logging" ON audit_logs FOR ALL USING (true);

-- Update processing_status policies
DROP POLICY IF EXISTS "Users can view their processing status" ON processing_status;
CREATE POLICY "Allow anonymous processing status" ON processing_status FOR ALL USING (true);

-- Update document_extractions policies
DROP POLICY IF EXISTS "Users can view their document extractions" ON document_extractions;
CREATE POLICY "Allow anonymous document extractions" ON document_extractions FOR ALL USING (true);

COMMENT ON MIGRATION IS 'Allow anonymous document uploads and processing without authentication';