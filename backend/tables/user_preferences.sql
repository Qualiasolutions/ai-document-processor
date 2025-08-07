CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    default_export_format TEXT DEFAULT 'pdf',
    auto_save_enabled BOOLEAN DEFAULT true,
    notification_preferences JSONB DEFAULT '{}',
    ai_processing_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);