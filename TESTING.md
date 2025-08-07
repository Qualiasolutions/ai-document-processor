# AI Service Testing Documentation

Comprehensive testing documentation for the AI Document Processor with enhanced AI service implementation.

## 🎯 Testing Overview

This project includes a complete testing suite that validates the AI service migration from OpenAI to a multi-provider system with Mistral OCR and Claude Analysis as primary providers, with OpenAI as fallback.

### Test Coverage Areas

1. **Backend Provider Tests** - Unit tests for individual AI providers
2. **Integration Tests** - AI service orchestration and fallback logic
3. **Edge Function Tests** - Document upload and processing endpoints
4. **Frontend Tests** - AI service client and enhanced components
5. **End-to-End Tests** - Complete document processing workflows
6. **Performance Tests** - Load testing and benchmarking
7. **Error Scenarios** - Comprehensive edge cases and failure modes
8. **Monitoring Tools** - Debug dashboard and monitoring utilities

## 🚀 Quick Start

### Run All Tests
```bash
# Execute comprehensive test suite
./run-all-tests.sh

# Run specific test categories
./run-all-tests.sh --category frontend
./run-all-tests.sh --category backend
./run-all-tests.sh --category performance
```

### Individual Test Commands
```bash
# Frontend tests
cd frontend
npm run test                    # Run unit tests
npm run test:coverage          # Generate coverage report
npm run test:ui                 # Interactive test UI

# Backend provider tests (Deno)
cd backend/functions/ai-service
deno test --allow-net --allow-env tests/providers/mistral.test.ts
deno test --allow-net --allow-env tests/providers/claude.test.ts
deno test --allow-net --allow-env tests/integration.test.ts

# Performance tests
cd performance-tests
deno run --allow-net --allow-read --allow-write load-test.ts light
deno run --allow-net --allow-read --allow-write benchmark-test.ts
```

## 📋 Test Categories

### 1. Backend Provider Tests

**Location**: `backend/functions/ai-service/tests/providers/`

Tests individual AI provider implementations:

- **Mistral OCR Provider** (`mistral.test.ts`)
  - OCR text extraction from images
  - Document analysis capabilities
  - Error handling (rate limits, API failures)
  - Response validation and normalization

- **Claude Analysis Provider** (`claude.test.ts`)
  - Document analysis and structured data extraction
  - JSON parsing and cleaning
  - Confidence scoring and validation
  - Error scenarios and fallback behavior

- **OpenAI Fallback Provider** (`openai.test.ts`)
  - Legacy compatibility testing
  - Fallback functionality validation
  - Error handling and recovery

**Key Test Scenarios**:
- ✅ Successful API calls with expected responses
- ✅ Authentication errors (401, invalid keys)
- ✅ Rate limiting errors (429)
- ✅ Network timeouts and failures
- ✅ Invalid response format handling
- ✅ Data validation and normalization

### 2. Integration Tests

**Location**: `backend/functions/ai-service/tests/integration.test.ts`

Tests AI service orchestration:

- **Provider Selection Strategy**
  - Automatic provider selection based on task type
  - Performance-based routing decisions
  - Provider availability detection

- **Fallback Logic**
  - Primary provider failure → Secondary provider
  - Multiple provider failures → Final fallback
  - Graceful degradation under service issues

- **Retry Mechanisms**
  - Exponential backoff for transient failures
  - Circuit breaker patterns
  - Permanent vs temporary error classification

**Key Test Scenarios**:
- ✅ Multi-provider orchestration
- ✅ Automatic fallback chains
- ✅ Retry logic validation
- ✅ Performance optimization
- ✅ Health monitoring integration

### 3. Edge Function Tests

**Location**: `backend/functions/ai-service/tests/edge-functions.test.ts`

Tests Supabase Edge Functions:

- **Document Upload Enhanced**
  - File upload validation
  - Multi-format processing (text, PDF, images)
  - Anonymous processing workflows
  - Error handling and user feedback

- **AI Service Endpoint**
  - Service status reporting
  - Document analysis requests
  - OCR text extraction
  - CORS and security validation

**Key Test Scenarios**:
- ✅ File upload and processing pipeline
- ✅ Multi-format document support
- ✅ Anonymous user workflows
- ✅ Security and validation checks
- ✅ Error responses and user feedback

### 4. Frontend Tests

**Location**: `frontend/src/test/`

Tests React components and services:

- **AI Service Client** (`aiService.test.ts`)
  - API communication with new service
  - File upload and processing
  - Error handling and user feedback
  - Response validation

- **Enhanced Document Processor** (`DocumentProcessorEnhanced.test.tsx`)
  - Document processing workflows
  - Progress tracking and user feedback
  - Service health monitoring
  - Configuration management

**Key Test Scenarios**:
- ✅ Service client functionality
- ✅ File processing workflows
- ✅ Progress tracking and feedback
- ✅ Error handling and recovery
- ✅ Configuration validation

### 5. End-to-End Tests

**Location**: `frontend/src/test/e2e-workflows.test.tsx`

Tests complete user workflows:

- **Passport Document Workflow**
  - Upload → OCR → Analysis → Form Generation
  - Real-time progress feedback
  - Data extraction validation

- **Bank Statement Processing**
  - PDF upload and OCR processing
  - Financial data extraction
  - Form population and validation

- **Image Document OCR**
  - Image upload and text extraction
  - Multi-stage processing feedback
  - OCR accuracy validation

**Key Test Scenarios**:
- ✅ Complete document processing pipelines
- ✅ Real-time user feedback
- ✅ Multi-format document support
- ✅ Form generation and population
- ✅ Error recovery workflows

### 6. Performance Tests

**Location**: `performance-tests/`

Load testing and benchmarking:

- **Load Testing** (`load-test.ts`)
  - Concurrent user simulation
  - Service throughput measurement
  - Error rate monitoring
  - Performance degradation detection

- **Provider Benchmarking** (`benchmark-test.ts`)
  - AI provider performance comparison
  - Accuracy and speed metrics
  - Reliability measurements
  - Cost-effectiveness analysis

**Test Configurations**:
- **Light**: 5 users, 1 minute (development testing)
- **Moderate**: 20 users, 5 minutes (staging validation)
- **Stress**: 50 users, 10 minutes (production readiness)

### 7. Error Scenarios

**Location**: `frontend/src/test/error-scenarios.test.tsx`

Comprehensive edge case testing:

- **Network Issues**
  - Complete network failure
  - Intermittent connectivity
  - Slow network conditions
  - Offline state handling

- **API Service Failures**
  - Rate limiting (429 errors)
  - Authentication errors (401)
  - Server errors (500)
  - Partial service degradation

- **File Processing Edge Cases**
  - Corrupted files
  - Extremely large files
  - Empty or unreadable content
  - Unsupported formats
  - Password-protected documents

- **Browser Compatibility**
  - FileReader API failures
  - Missing modern browser features
  - Memory pressure scenarios
  - CPU-intensive processing timeouts

### 8. Monitoring and Debugging

**Debug Dashboard** (`frontend/src/components/DebugDashboard.tsx`)
- Real-time service monitoring
- Provider health status
- Performance metrics tracking
- Log collection and analysis

**Backend Monitor** (`backend/functions/ai-service-monitor/index.ts`)
- Service health checks
- Performance metrics collection
- Database analytics
- Automated reporting

## 🔧 Testing Configuration

### Prerequisites

```bash
# Node.js (for frontend tests)
node --version  # >= 18.x

# Deno (for backend tests)
deno --version  # >= 1.40.x

# Dependencies
cd frontend && npm install
```

### Environment Setup

```bash
# Frontend environment variables
cp .env.local.example .env.local

# Required variables:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Backend environment variables (Supabase Dashboard)
MISTRAL_API_KEY=your_mistral_key
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key  # Fallback only
```

### Test Data

Sample test files located in `samples/`:
- `passport-data.txt` - Passport information
- `bank-statement.txt` - Financial data
- `employment-contract.txt` - Employment details
- `visa-application-info.txt` - Travel data

## 📊 Test Results and Reporting

### Automated Reports

Test results are automatically saved to `test-results/`:

```
test-results/
├── frontend-unit.json          # Frontend unit test results
├── frontend-coverage.json      # Code coverage report
├── e2e-results.json            # End-to-end test results
├── load-test-report-*.json     # Performance test results
├── benchmark-report-*.json     # AI provider benchmarks
└── test-summary.json           # Comprehensive summary
```

### Coverage Targets

- **Unit Tests**: ≥ 80% line coverage
- **Integration Tests**: All critical paths covered
- **E2E Tests**: Complete user workflows validated
- **Error Scenarios**: Comprehensive edge case coverage

### Performance Benchmarks

**Expected Performance**:
- API Response Time: < 3 seconds (95th percentile)
- OCR Processing: < 5 seconds for standard documents
- Document Analysis: < 2 seconds for text documents
- Success Rate: > 95% under normal load

**Provider Performance (Expected)**:
- **Mistral OCR**: 50x cheaper, ~2-3s response time
- **Claude Analysis**: Better accuracy, ~1-2s response time
- **OpenAI Fallback**: Reliable but expensive, ~2-4s response time

## 🐛 Debugging and Troubleshooting

### Common Issues

1. **Test Timeouts**
   ```bash
   # Increase timeout for slow tests
   npm run test -- --timeout 10000
   ```

2. **API Key Issues**
   ```bash
   # Verify environment variables
   deno run --allow-env -e "console.log(Deno.env.get('MISTRAL_API_KEY'))"
   ```

3. **Network Connectivity**
   ```bash
   # Test service endpoints
   curl -X POST https://your-supabase-url/functions/v1/ai-service \
     -H "Content-Type: application/json" \
     -d '{"action": "status"}'
   ```

### Debug Dashboard

Access the debug dashboard during development:
```typescript
import DebugDashboard from '@/components/DebugDashboard'

// Add to your development routes
<Route path="/debug" element={<DebugDashboard />} />
```

Features:
- Real-time provider status monitoring
- Performance metrics tracking
- Request/response logging
- Error analysis and reporting

### Log Analysis

View detailed logs:
```bash
# Frontend console logs
# Open browser DevTools → Console

# Backend function logs
supabase functions logs ai-service --project-ref your-project-ref

# Monitor endpoint logs
curl "https://your-supabase-url/functions/v1/ai-service-monitor?action=logs&limit=50"
```

## 🚀 Continuous Integration

### GitHub Actions Integration

```yaml
name: AI Service Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Run tests
        run: ./run-all-tests.sh
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Quality Gates

Before deployment, ensure:
- ✅ All unit tests pass
- ✅ Integration tests pass
- ✅ E2E workflows complete successfully
- ✅ Performance benchmarks meet targets
- ✅ Error scenarios handled gracefully
- ✅ Code coverage meets minimum thresholds

## 📈 Performance Monitoring

### Production Monitoring

Deploy monitoring components:
```bash
# Deploy monitor function
supabase functions deploy ai-service-monitor

# Access monitoring endpoint
curl "https://your-supabase-url/functions/v1/ai-service-monitor?action=report"
```

### Key Metrics to Track

- **Response Times**: P50, P95, P99 percentiles
- **Error Rates**: By provider and operation type
- **Throughput**: Requests per second
- **Success Rates**: By document type and provider
- **Cost Analysis**: Provider usage and costs

### Alerts and Notifications

Set up alerts for:
- Response time > 5 seconds (P95)
- Error rate > 5%
- Provider availability < 95%
- Processing failures > 10/hour

## 🔄 Test Maintenance

### Adding New Tests

1. **Provider Tests**: Add to `backend/functions/ai-service/tests/providers/`
2. **Frontend Tests**: Add to `frontend/src/test/`
3. **E2E Tests**: Add scenarios to `e2e-workflows.test.tsx`
4. **Performance Tests**: Update configurations in `performance-tests/`

### Test Data Management

- Use deterministic test data for consistency
- Mock external dependencies appropriately
- Clean up test artifacts after execution
- Rotate API keys regularly for security

### Documentation Updates

Keep documentation current:
- Update test scenarios when features change
- Document new test categories
- Maintain troubleshooting guides
- Update performance benchmarks

## 📚 Additional Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)
- [Deno Testing Guide](https://deno.land/manual/testing)
- [Supabase Edge Functions Testing](https://supabase.com/docs/guides/functions/testing)
- [Performance Testing Best Practices](https://k6.io/docs/)

## 🎯 Next Steps

After completing the test suite:

1. **Deploy AI Service**: Use the validated AI service migration
2. **Monitor Performance**: Track real-world usage patterns
3. **Optimize Based on Data**: Adjust provider prioritization
4. **Expand Test Coverage**: Add new scenarios as they emerge
5. **Automate Testing**: Integrate with CI/CD pipelines

---

**Status**: ✅ Comprehensive testing suite implemented and validated
**Last Updated**: Current implementation
**Coverage**: Backend providers, integration, frontend, E2E, performance, error scenarios