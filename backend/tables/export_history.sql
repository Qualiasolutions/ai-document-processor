CREATE TABLE export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    form_id UUID NOT NULL,
    export_format TEXT NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);