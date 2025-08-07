#!/bin/bash

# Deploy Supabase Edge Functions
# This script properly sets up and deploys the backend functions

echo "🚀 Deploying Supabase Edge Functions..."

# Set the token
export SUPABASE_ACCESS_TOKEN="sbp_bf7b09cbcadf8a826b9d1c7846fe04a4c8d86801"

# Create temporary deployment directory
TEMP_DIR="/tmp/supabase-deploy-$$"
mkdir -p "$TEMP_DIR/supabase/functions"

# Copy functions to temporary directory
echo "📋 Copying functions..."
cp -r backend/functions/document-upload "$TEMP_DIR/supabase/functions/"
cp -r backend/functions/document-upload-process "$TEMP_DIR/supabase/functions/"
cp -r backend/functions/form-generation "$TEMP_DIR/supabase/functions/"
cp -r backend/functions/ai-document-analysis "$TEMP_DIR/supabase/functions/"

# Copy config
cp supabase/config.toml "$TEMP_DIR/supabase/"

# Navigate to temp directory
cd "$TEMP_DIR"

# Deploy each function
echo "🔧 Deploying document-upload..."
npx supabase functions deploy document-upload --project-ref qfldqwfpbabeonvryaof

echo "🔧 Deploying document-upload-process..."
npx supabase functions deploy document-upload-process --project-ref qfldqwfpbabeonvryaof

echo "🔧 Deploying form-generation..."
npx supabase functions deploy form-generation --project-ref qfldqwfpbabeonvryaof

echo "🔧 Deploying ai-document-analysis..."
npx supabase functions deploy ai-document-analysis --project-ref qfldqwfpbabeonvryaof

# Clean up
cd -
rm -rf "$TEMP_DIR"

echo "✅ Deployment complete!"
echo ""
echo "⚠️  IMPORTANT: Don't forget to set the OPENAI_API_KEY in Supabase:"
echo "Go to: https://supabase.com/dashboard/project/qfldqwfpbabeonvryaof/settings/functions"
echo "Add: OPENAI_API_KEY = your_api_key"