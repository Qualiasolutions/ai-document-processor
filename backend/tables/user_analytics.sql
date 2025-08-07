CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    documents_processed INTEGER DEFAULT 0,
    forms_generated INTEGER DEFAULT 0,
    exports_created INTEGER DEFAULT 0,
    ai_api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);