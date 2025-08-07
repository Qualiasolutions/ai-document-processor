CREATE TABLE document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    extraction_status VARCHAR(50) DEFAULT 'pending',
    extracted_text TEXT,
    structured_data JSONB,
    ai_analysis JSONB,
    processing_log TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);