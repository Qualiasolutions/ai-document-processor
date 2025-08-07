# AI Service Migration Configuration

This document outlines the configuration needed for the new AI service implementation.

## Environment Variables

### Backend (Supabase Edge Functions)

Add these environment variables in your Supabase Dashboard → Settings → Edge Functions → Environment Variables:

```bash
# Required: Mistral API Key for OCR processing
MISTRAL_API_KEY=your_mistral_api_key_here

# Required: Anthropic API Key for document analysis
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: OpenAI API Key (for fallback)
OPENAI_API_KEY=your_openai_api_key_here

# Existing Supabase variables (should already be set)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_URL=your_supabase_url
```

### Frontend (.env.local)

The frontend no longer needs AI API keys! Only Supabase configuration:

```bash
# Required: Supabase configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# No longer needed (removed for security):
# VITE_OPENAI_API_KEY (removed - now handled server-side)
```

## API Keys Setup

### 1. Mistral API Key

1. Sign up at [https://console.mistral.ai/](https://console.mistral.ai/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key and add to Supabase environment variables as `MISTRAL_API_KEY`

**Pricing**: 1000 pages per $1 (50x cheaper than OpenAI!)

### 2. Anthropic Claude API Key

1. Sign up at [https://console.anthropic.com/](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key and add to Supabase environment variables as `ANTHROPIC_API_KEY`

**Pricing**: 40% cheaper input tokens than GPT-4, same output token price

### 3. OpenAI API Key (Optional Fallback)

Keep your existing OpenAI key as fallback:
1. Use existing key from OpenAI Dashboard
2. Add to Supabase environment variables as `OPENAI_API_KEY`

## Migration Steps

### Phase 1: Backend Deployment

1. Deploy new AI service functions:
```bash
cd compiled-project
supabase functions deploy ai-service
supabase functions deploy document-upload-enhanced
```

2. Set environment variables in Supabase Dashboard

3. Test the new endpoints:
```bash
# Test AI service status
curl -X POST \
  https://your-project.supabase.co/functions/v1/ai-service \
  -H 'Content-Type: application/json' \
  -d '{"action": "status"}'
```

### Phase 2: Frontend Integration

1. Update imports in components:
```typescript
// Old
import { analyzeDocument } from '@/lib/openai'

// New
import { analyzeDocument } from '@/lib/aiService'
```

2. Use enhanced document processor:
```typescript
// Old
import { documentProcessor } from '@/lib/documentProcessor'

// New  
import { enhancedDocumentProcessor as documentProcessor } from '@/lib/documentProcessorEnhanced'
```

### Phase 3: Testing

1. Test document upload and processing
2. Verify AI analysis results
3. Check form generation
4. Monitor error rates and performance

## Function Mapping

### Old vs New Functions

| Old Function | New Function | Purpose |
|--------------|--------------|---------|
| `document-upload` | `document-upload-enhanced` | Upload + AI processing |
| `ai-document-analysis` | `ai-service` | AI analysis abstraction |
| Frontend OpenAI calls | Backend AI service | Secure server-side processing |

### New AI Service Actions

| Action | Purpose | Parameters |
|--------|---------|------------|
| `extract_text` | OCR from images/PDFs | `imageData: string` |
| `analyze_document` | Structured data extraction | `text: string` |
| `status` | Provider health check | None |

## Benefits

### 🔧 **Technical Benefits**
- **Server-side Security**: No API keys in browser
- **Better Error Handling**: Simplified, more reliable processing
- **Provider Abstraction**: Easy to switch/fallback between AI providers
- **Retry Logic**: Built-in retry with exponential backoff

### 💰 **Cost Benefits**
- **50x cheaper OCR**: Mistral OCR vs OpenAI Vision API
- **40% cheaper analysis**: Claude vs GPT-4 for input tokens
- **Better rate limits**: Higher throughput, fewer 429 errors

### 🚀 **Performance Benefits**
- **Faster processing**: Mistral OCR processes 2000 pages/minute
- **Larger context**: Claude's 200k token limit vs OpenAI's 128k
- **More reliable**: Less parsing complexity, better structured output

## Monitoring

### Health Checks

Monitor AI service health:
```typescript
import { checkAIServiceHealth } from '@/lib/aiService'

const health = await checkAIServiceHealth()
console.log('AI Service Status:', health)
```

### Error Monitoring

Watch for these error patterns in logs:
- `Invalid API key` errors (check environment variables)
- `Rate limit exceeded` (less likely with new providers)
- `Provider unavailable` (automatic fallback should handle)

### Performance Metrics

Track these improvements:
- Reduced processing costs (target: 60-80% reduction)
- Faster OCR processing (target: 2-3x faster)
- Fewer parsing errors (target: 90% reduction)
- Better success rates (target: 95%+ vs current OpenAI issues)

## Rollback Plan

If issues occur, rollback by:

1. Switch traffic back to original functions
2. Update frontend imports back to `@/lib/openai`
3. Restore OpenAI environment variables in frontend
4. Monitor and fix issues before re-attempting migration

## Support

For issues with the new AI service:
1. Check Supabase function logs
2. Verify environment variables are set
3. Test individual provider availability
4. Use status endpoint for health checks