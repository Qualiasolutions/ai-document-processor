CREATE TABLE generated_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_ids UUID[],
    template_id UUID,
    form_data JSONB NOT NULL,
    form_type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);