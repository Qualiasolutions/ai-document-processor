CREATE TABLE processing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    step_status VARCHAR(50) NOT NULL,
    progress_percentage INTEGER DEFAULT 0,
    status_message TEXT,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);