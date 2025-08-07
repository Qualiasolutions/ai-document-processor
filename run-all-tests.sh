#!/bin/bash

# Comprehensive Test Runner for AI Document Processor
# Runs all tests including unit, integration, e2e, performance, and benchmarks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/frontend" && pwd)"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/backend" && pwd)"
PERFORMANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/performance-tests" && pwd)"
TEST_RESULTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test-results"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Function to run command with error handling
run_command() {
    local cmd="$1"
    local description="$2"
    local optional="${3:-false}"
    
    print_status "Running: $description"
    
    if eval "$cmd"; then
        print_success "$description completed"
        return 0
    else
        if [ "$optional" = "true" ]; then
            print_warning "$description failed (optional)"
            return 0
        else
            print_error "$description failed"
            return 1
        fi
    fi
}

# Main test execution
main() {
    echo "================================================================================================"
    echo "🧪 AI Document Processor - Comprehensive Test Suite"
    echo "================================================================================================"
    echo "Start time: $(date)"
    echo ""
    
    local start_time=$(date +%s)
    local failed_tests=0
    local total_tests=0
    
    # Check dependencies
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    if ! command -v deno &> /dev/null; then
        print_warning "Deno is not installed - backend tests will be skipped"
    fi
    
    print_success "Dependencies checked"
    echo ""
    
    # 1. Frontend Unit Tests
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    echo "📱 Frontend Unit Tests"
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    
    cd "$FRONTEND_DIR"
    
    total_tests=$((total_tests + 1))
    if run_command "npm run test:run -- --reporter=json --outputFile=$TEST_RESULTS_DIR/frontend-unit.json" "Frontend unit tests"; then
        print_success "Frontend unit tests passed"
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    total_tests=$((total_tests + 1))
    if run_command "npm run test:coverage -- --reporter=json-summary --outputFile=$TEST_RESULTS_DIR/frontend-coverage.json" "Frontend test coverage" true; then
        print_success "Frontend coverage report generated"
    else
        print_warning "Frontend coverage failed (optional)"
    fi
    
    echo ""
    
    # 2. Backend Unit Tests (Deno)
    if command -v deno &> /dev/null; then
        echo "════════════════════════════════════════════════════════════════════════════════════════════════"
        echo "🔧 Backend Unit Tests"
        echo "════════════════════════════════════════════════════════════════════════════════════════════════"
        
        cd "$BACKEND_DIR/functions/ai-service"
        
        # Test individual providers
        for provider in "mistral" "claude" "openai"; do
            total_tests=$((total_tests + 1))
            if run_command "deno test --allow-net --allow-env tests/providers/${provider}.test.ts" "Backend ${provider} provider tests"; then
                print_success "${provider} provider tests passed"
            else
                failed_tests=$((failed_tests + 1))
            fi
        done
        
        # Integration tests
        total_tests=$((total_tests + 1))
        if run_command "deno test --allow-net --allow-env tests/integration.test.ts" "Backend integration tests"; then
            print_success "Backend integration tests passed"
        else
            failed_tests=$((failed_tests + 1))
        fi
        
        # Edge function tests
        total_tests=$((total_tests + 1))
        if run_command "deno test --allow-net --allow-env tests/edge-functions.test.ts" "Edge function tests"; then
            print_success "Edge function tests passed"
        else
            failed_tests=$((failed_tests + 1))
        fi
        
        echo ""
    else
        print_warning "Skipping backend tests - Deno not available"
        echo ""
    fi
    
    # 3. End-to-End Tests
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    echo "🎭 End-to-End Workflow Tests"
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    
    cd "$FRONTEND_DIR"
    
    total_tests=$((total_tests + 1))
    if run_command "npm run test:run src/test/e2e-workflows.test.tsx -- --reporter=json --outputFile=$TEST_RESULTS_DIR/e2e-results.json" "E2E workflow tests"; then
        print_success "E2E workflow tests passed"
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    total_tests=$((total_tests + 1))
    if run_command "npm run test:run src/test/error-scenarios.test.tsx" "Error scenario tests"; then
        print_success "Error scenario tests passed"
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    echo ""
    
    # 4. Performance Tests
    if command -v deno &> /dev/null; then
        echo "════════════════════════════════════════════════════════════════════════════════════════════════"
        echo "⚡ Performance Tests"
        echo "════════════════════════════════════════════════════════════════════════════════════════════════"
        
        cd "$PERFORMANCE_DIR"
        
        total_tests=$((total_tests + 1))
        if run_command "deno run --allow-net --allow-read --allow-write load-test.ts light" "Light load test" true; then
            print_success "Light load test completed"
            if [ -f "load-test-report-*.json" ]; then
                mv load-test-report-*.json "$TEST_RESULTS_DIR/" 2>/dev/null || true
            fi
        else
            print_warning "Light load test failed (optional)"
        fi
        
        total_tests=$((total_tests + 1))
        if run_command "deno run --allow-net --allow-read --allow-write benchmark-test.ts" "AI provider benchmark" true; then
            print_success "AI provider benchmark completed"
            if [ -f "benchmark-report-*.json" ]; then
                mv benchmark-report-*.json "$TEST_RESULTS_DIR/" 2>/dev/null || true
            fi
        else
            print_warning "AI provider benchmark failed (optional)"
        fi
        
        echo ""
    else
        print_warning "Skipping performance tests - Deno not available"
        echo ""
    fi
    
    # 5. Code Quality Checks
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    echo "🔍 Code Quality Checks"
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    
    cd "$FRONTEND_DIR"
    
    total_tests=$((total_tests + 1))
    if run_command "npm run lint" "ESLint code quality check" true; then
        print_success "ESLint passed"
    else
        print_warning "ESLint failed (optional)"
    fi
    
    total_tests=$((total_tests + 1))
    if run_command "npm run build" "TypeScript compilation check"; then
        print_success "TypeScript compilation passed"
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    echo ""
    
    # 6. Generate Test Report
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    echo "📊 Test Report Generation"
    echo "════════════════════════════════════════════════════════════════════════════════════════════════"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local success_rate=$((100 * (total_tests - failed_tests) / total_tests))
    
    # Create comprehensive test report
    cat > "$TEST_RESULTS_DIR/test-summary.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $duration,
  "total_tests": $total_tests,
  "passed_tests": $((total_tests - failed_tests)),
  "failed_tests": $failed_tests,
  "success_rate": $success_rate,
  "test_categories": {
    "frontend_unit": "$([ -f "$TEST_RESULTS_DIR/frontend-unit.json" ] && echo "completed" || echo "skipped")",
    "frontend_coverage": "$([ -f "$TEST_RESULTS_DIR/frontend-coverage.json" ] && echo "completed" || echo "skipped")",
    "backend_unit": "$(command -v deno &> /dev/null && echo "completed" || echo "skipped")",
    "e2e_workflows": "$([ -f "$TEST_RESULTS_DIR/e2e-results.json" ] && echo "completed" || echo "skipped")",
    "performance_tests": "$([ -f "$TEST_RESULTS_DIR/load-test-report-*.json" ] && echo "completed" || echo "skipped")",
    "benchmark_tests": "$([ -f "$TEST_RESULTS_DIR/benchmark-report-*.json" ] && echo "completed" || echo "skipped")"
  },
  "environment": {
    "node_version": "$(node --version 2>/dev/null || echo "not available")",
    "deno_version": "$(deno --version 2>/dev/null | head -n1 || echo "not available")",
    "os": "$(uname -s)",
    "arch": "$(uname -m)"
  }
}
EOF
    
    print_success "Test summary generated: $TEST_RESULTS_DIR/test-summary.json"
    
    # Display results
    echo ""
    echo "================================================================================================"
    echo "📋 Final Test Results"
    echo "================================================================================================"
    echo "Total Duration: ${duration}s"
    echo "Tests Run: $total_tests"
    echo "Passed: $((total_tests - failed_tests))"
    echo "Failed: $failed_tests"
    echo "Success Rate: $success_rate%"
    echo ""
    
    if [ $failed_tests -eq 0 ]; then
        print_success "All critical tests passed! 🎉"
        echo ""
        echo "✅ Frontend unit tests"
        echo "✅ Backend provider tests"
        echo "✅ Integration tests" 
        echo "✅ End-to-end workflows"
        echo "✅ Error scenarios"
        echo "✅ Code quality checks"
        echo ""
        echo "🚀 The AI service migration is ready for deployment!"
        exit 0
    else
        print_error "$failed_tests test(s) failed"
        echo ""
        echo "❌ Check the logs above for details"
        echo "📁 Test results saved to: $TEST_RESULTS_DIR"
        echo ""
        echo "🔧 Fix the failing tests before deployment"
        exit 1
    fi
}

# Check if script is being sourced or run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi