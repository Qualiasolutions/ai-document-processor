#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * AI Migration Test Script
 * Tests the new AI service implementation
 * Run: deno run --allow-net --allow-env test-ai-migration.ts
 */

// Test configuration
const SUPABASE_URL = 'https://qfldqwfpbabeonvryaof.supabase.co'
const TEST_TEXT = `
John Michael Smith
Passport Number: P123456789
Date of Birth: May 15, 1990
Nationality: United States of America
Address: 123 Main Street, Apartment 4B, New York, NY 10001
Phone: +1 (555) 123-4567
Email: john.smith@email.com
`

const TEST_IMAGE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // 1x1 transparent PNG

interface TestResult {
  name: string
  success: boolean
  duration: number
  error?: string
  data?: any
}

class AIServiceTester {
  private baseUrl: string
  private results: TestResult[] = []

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting AI Migration Tests...\n')

    // Test 1: Service Status
    await this.testServiceStatus()

    // Test 2: Document Analysis
    await this.testDocumentAnalysis()

    // Test 3: OCR (with dummy image)
    await this.testOCRExtraction()

    // Test 4: Enhanced Document Upload
    await this.testEnhancedUpload()

    // Show results
    this.showResults()
  }

  async testServiceStatus(): Promise<void> {
    const testName = 'AI Service Status Check'
    const startTime = Date.now()

    try {
      console.log('📊 Testing AI service status...')
      
      const response = await fetch(`${this.baseUrl}/ai-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      
      this.results.push({
        name: testName,
        success: true,
        duration,
        data: data
      })

      console.log('✅ Status check passed')
      console.log('📈 Provider status:', JSON.stringify(data, null, 2))

    } catch (error) {
      const duration = Date.now() - startTime
      this.results.push({
        name: testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      console.log('❌ Status check failed:', error)
    }
  }

  async testDocumentAnalysis(): Promise<void> {
    const testName = 'Document Analysis'
    const startTime = Date.now()

    try {
      console.log('\n🔍 Testing document analysis...')
      
      const response = await fetch(`${this.baseUrl}/ai-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_document',
          text: TEST_TEXT
        })
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      
      // Validate response structure
      if (!data.document_type || !data.confidence || !data.extracted_data) {
        throw new Error('Invalid response structure')
      }

      this.results.push({
        name: testName,
        success: true,
        duration,
        data: {
          document_type: data.document_type,
          confidence: data.confidence,
          field_count: Object.keys(data.extracted_data).length
        }
      })

      console.log('✅ Document analysis passed')
      console.log('📋 Document type:', data.document_type)
      console.log('🎯 Confidence:', (data.confidence * 100).toFixed(1) + '%')
      console.log('📝 Fields extracted:', Object.keys(data.extracted_data).length)

    } catch (error) {
      const duration = Date.now() - startTime
      this.results.push({
        name: testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      console.log('❌ Document analysis failed:', error)
    }
  }

  async testOCRExtraction(): Promise<void> {
    const testName = 'OCR Text Extraction'
    const startTime = Date.now()

    try {
      console.log('\n👁️ Testing OCR extraction...')
      
      const response = await fetch(`${this.baseUrl}/ai-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract_text',
          imageData: TEST_IMAGE_BASE64
        })
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        // OCR might fail with dummy image, that's OK
        const errorText = await response.text()
        console.log('⚠️ OCR test failed (expected with dummy image):', errorText)
        
        this.results.push({
          name: testName,
          success: false,
          duration,
          error: 'Expected failure with dummy image'
        })
        return
      }

      const data = await response.json()
      
      this.results.push({
        name: testName,
        success: true,
        duration,
        data: {
          text_length: data.text?.length || 0,
          confidence: data.confidence,
          processing_time: data.processing_time_ms
        }
      })

      console.log('✅ OCR extraction passed')
      console.log('📄 Text extracted:', data.text?.length || 0, 'characters')

    } catch (error) {
      const duration = Date.now() - startTime
      this.results.push({
        name: testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      console.log('❌ OCR extraction failed:', error)
    }
  }

  async testEnhancedUpload(): Promise<void> {
    const testName = 'Enhanced Document Upload'
    const startTime = Date.now()

    try {
      console.log('\n📤 Testing enhanced document upload...')
      
      // Create a simple text file as base64
      const textContent = 'Test document content: ' + TEST_TEXT
      const base64Content = 'data:text/plain;base64,' + btoa(textContent)
      
      const response = await fetch(`${this.baseUrl}/document-upload-enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Content,
          fileName: 'test-document.txt',
          fileType: 'text/plain'
        })
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      
      // Validate response structure
      if (!data.data || !data.data.document || !data.data.processing) {
        throw new Error('Invalid response structure')
      }

      this.results.push({
        name: testName,
        success: true,
        duration,
        data: {
          document_id: data.data.document.id,
          processing_status: data.data.processing.status,
          content_length: data.data.processing.content_length,
          analysis: data.data.analysis ? 'included' : 'not included'
        }
      })

      console.log('✅ Enhanced upload passed')
      console.log('📄 Document ID:', data.data.document.id)
      console.log('⚙️ Processing status:', data.data.processing.status)
      if (data.data.analysis) {
        console.log('🧠 AI analysis included')
      }

    } catch (error) {
      const duration = Date.now() - startTime
      this.results.push({
        name: testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      console.log('❌ Enhanced upload failed:', error)
    }
  }

  showResults(): void {
    console.log('\n' + '='.repeat(60))
    console.log('🏁 AI Migration Test Results')
    console.log('='.repeat(60))

    const passed = this.results.filter(r => r.success).length
    const total = this.results.length
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0)

    console.log(`📊 Overall: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`)
    console.log(`⏱️ Total time: ${totalTime}ms`)
    console.log()

    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌'
      console.log(`${index + 1}. ${status} ${result.name} (${result.duration}ms)`)
      
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
      
      if (result.data && result.success) {
        console.log(`   Data: ${JSON.stringify(result.data)}`)
      }
      console.log()
    })

    // Recommendations
    console.log('📋 Recommendations:')
    if (passed === total) {
      console.log('🎉 All tests passed! Your AI service migration is ready.')
      console.log('✅ Next steps:')
      console.log('   1. Set environment variables (MISTRAL_API_KEY, ANTHROPIC_API_KEY)')
      console.log('   2. Deploy functions: supabase functions deploy ai-service')
      console.log('   3. Update frontend to use new aiService')
    } else {
      console.log('⚠️ Some tests failed. Check:')
      console.log('   1. Supabase functions are deployed')
      console.log('   2. Environment variables are set')
      console.log('   3. API keys are valid')
      console.log('   4. Network connectivity')
    }
  }
}

// Run tests
if (import.meta.main) {
  const tester = new AIServiceTester()
  await tester.runAllTests()
}