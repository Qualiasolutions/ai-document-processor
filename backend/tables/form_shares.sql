CREATE TABLE form_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    shared_by UUID NOT NULL,
    shared_with UUID,
    share_token TEXT UNIQUE,
    permissions JSONB DEFAULT '{"view": true,
    "edit": false}',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);