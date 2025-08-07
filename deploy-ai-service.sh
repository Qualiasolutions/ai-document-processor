#!/bin/bash

# AI Service Deployment Script
# Deploys the new AI service functions to Supabase

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AI Service Deployment Script${NC}"
echo "======================================"

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first:${NC}"
    echo "npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Not in Supabase project directory. Please run from project root.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase project detected${NC}"

# Login check
echo -e "${BLUE}🔐 Checking Supabase authentication...${NC}"
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}⚠️ Not logged in to Supabase. Please login:${NC}"
    echo "supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated with Supabase${NC}"

# Deploy AI service functions
echo -e "${BLUE}📦 Deploying AI service functions...${NC}"

# Deploy main AI service
echo -e "${YELLOW}Deploying ai-service...${NC}"
if supabase functions deploy ai-service; then
    echo -e "${GREEN}✅ ai-service deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy ai-service${NC}"
    exit 1
fi

# Deploy enhanced document upload
echo -e "${YELLOW}Deploying document-upload-enhanced...${NC}"
if supabase functions deploy document-upload-enhanced; then
    echo -e "${GREEN}✅ document-upload-enhanced deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy document-upload-enhanced${NC}"
    exit 1
fi

# Check function status
echo -e "${BLUE}📊 Checking deployed functions...${NC}"
supabase functions list

echo ""
echo -e "${GREEN}🎉 AI Service deployment completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Set environment variables in Supabase Dashboard:"
echo "   - MISTRAL_API_KEY (for OCR processing)"
echo "   - ANTHROPIC_API_KEY (for document analysis)"
echo "   - OPENAI_API_KEY (for fallback, optional)"
echo ""
echo "2. Test the deployment:"
echo "   deno run --allow-net --allow-env test-ai-migration.ts"
echo ""
echo "3. Update your frontend to use the new AI service:"
echo "   import { aiService } from '@/lib/aiService'"
echo ""
echo -e "${BLUE}📚 See AI_MIGRATION_CONFIG.md for detailed instructions${NC}"

# Check if environment variables are set
echo -e "${YELLOW}⚠️ Checking environment variables...${NC}"
echo "Please verify these are set in Supabase Dashboard → Settings → Edge Functions → Environment Variables:"
echo "- MISTRAL_API_KEY"
echo "- ANTHROPIC_API_KEY" 
echo "- OPENAI_API_KEY (optional)"

echo ""
echo -e "${GREEN}✨ Deployment complete! Your AI service is ready to use.${NC}"