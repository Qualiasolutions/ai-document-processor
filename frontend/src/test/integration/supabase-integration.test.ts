/**
 * Live Supabase Integration Tests
 * Tests the actual database and Edge Functions using MCP
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Test environment configuration
const SUPABASE_URL = 'https://qfldqwfpbabeonvryaof.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key'

// Create Supabase client for testing
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Test data factory
function createTestDocument() {
  const timestamp = Date.now()
  return {
    filename: `test-${timestamp}.txt`,
    file_size: 1024,
    file_type: 'text/plain',
    content: 'Test document content for integration testing',
    status: 'uploaded',
    processing_status: 'pending',
    metadata: {
      test: true,
      timestamp,
      session_id: `test_${timestamp}`
    }
  }
}

function createTestForm() {
  const timestamp = Date.now()
  return {
    form_type: 'test_form',
    title: `Test Form ${timestamp}`,
    form_data: {
      fields: [
        { name: 'test_field', value: 'test_value', type: 'text' }
      ],
      test: true,
      timestamp
    },
    status: 'draft'
  }
}

describe('Supabase Integration Tests', () => {
  let testDocumentIds: string[] = []
  let testFormIds: string[] = []

  beforeAll(async () => {
    // Verify database connection
    const { data, error } = await supabase.from('documents').select('count').single()
    if (error && !error.message.includes('JSON object')) {
      throw new Error(`Cannot connect to Supabase: ${error.message}`)
    }
    console.log('✅ Connected to Supabase database')
  })

  beforeEach(() => {
    // Reset test data arrays
    testDocumentIds = []
    testFormIds = []
  })

  afterAll(async () => {
    // Cleanup test data
    if (testDocumentIds.length > 0) {
      await supabase.from('documents').delete().in('id', testDocumentIds)
      console.log(`🧹 Cleaned up ${testDocumentIds.length} test documents`)
    }
    
    if (testFormIds.length > 0) {
      await supabase.from('generated_forms').delete().in('id', testFormIds)
      console.log(`🧹 Cleaned up ${testFormIds.length} test forms`)
    }
  })

  describe('Documents Table Operations', () => {
    it('should create a document with anonymous upload', async () => {
      const testDoc = createTestDocument()
      
      const { data, error } = await supabase
        .from('documents')
        .insert(testDoc)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.filename).toBe(testDoc.filename)
      expect(data.user_id).toBeNull() // Anonymous upload
      expect(data.status).toBe('uploaded')
      
      testDocumentIds.push(data.id)
    })

    it('should update document processing status', async () => {
      // Create test document
      const testDoc = createTestDocument()
      const { data: created } = await supabase
        .from('documents')
        .insert(testDoc)
        .select()
        .single()
      
      testDocumentIds.push(created.id)

      // Update processing status
      const { data, error } = await supabase
        .from('documents')
        .update({ 
          processing_status: 'processing',
          ai_analysis: { confidence: 0.95, extracted_fields: ['name', 'date'] }
        })
        .eq('id', created.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.processing_status).toBe('processing')
      expect(data.ai_analysis).toEqual({
        confidence: 0.95,
        extracted_fields: ['name', 'date']
      })
    })

    it('should query documents by status', async () => {
      // Create multiple test documents
      const docs = [
        { ...createTestDocument(), status: 'uploaded' },
        { ...createTestDocument(), status: 'processing' },
        { ...createTestDocument(), status: 'completed' }
      ]

      const { data: created } = await supabase
        .from('documents')
        .insert(docs)
        .select()

      testDocumentIds.push(...created.map(d => d.id))

      // Query by status
      const { data: uploaded, error } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'uploaded')
        .in('id', testDocumentIds)

      expect(error).toBeNull()
      expect(uploaded).toHaveLength(1)
      expect(uploaded[0].status).toBe('uploaded')
    })
  })

  describe('Generated Forms Operations', () => {
    it('should create a form linked to document', async () => {
      // Create test document first
      const testDoc = createTestDocument()
      const { data: doc } = await supabase
        .from('documents')
        .insert(testDoc)
        .select()
        .single()
      
      testDocumentIds.push(doc.id)

      // Create form linked to document
      const testForm = {
        ...createTestForm(),
        document_ids: [doc.id]
      }

      const { data, error } = await supabase
        .from('generated_forms')
        .insert(testForm)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.document_ids).toContain(doc.id)
      expect(data.form_type).toBe('test_form')
      expect(data.user_id).toBeNull() // Anonymous
      
      testFormIds.push(data.id)
    })

    it('should update form status', async () => {
      const testForm = createTestForm()
      const { data: created } = await supabase
        .from('generated_forms')
        .insert(testForm)
        .select()
        .single()
      
      testFormIds.push(created.id)

      const { data, error } = await supabase
        .from('generated_forms')
        .update({ status: 'completed' })
        .eq('id', created.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('completed')
    })
  })

  describe('Edge Functions Integration', () => {
    it('should call document-upload function', async () => {
      const testFileData = 'data:text/plain;base64,' + btoa('Test file content')
      
      const { data, error } = await supabase.functions.invoke('document-upload', {
        body: {
          fileData: testFileData,
          fileName: 'integration-test.txt',
          fileType: 'text/plain'
        }
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.data.document).toBeDefined()
      expect(data.data.document.filename).toBe('integration-test.txt')
      
      // Track for cleanup
      if (data.data.document.id) {
        testDocumentIds.push(data.data.document.id)
      }
    })

    it('should handle malformed upload data', async () => {
      const { data, error } = await supabase.functions.invoke('document-upload', {
        body: {
          fileName: 'test.txt'
          // Missing fileData
        }
      })

      expect(error).toBeDefined()
      expect(error.message).toContain('File data and filename are required')
    })
  })

  describe('Audit Logs', () => {
    it('should create audit log entry', async () => {
      const auditEntry = {
        action: 'test_action',
        resource_type: 'test_resource',
        details: { test: true, timestamp: Date.now() },
        ip_address: '127.0.0.1',
        user_agent: 'vitest'
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .insert(auditEntry)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.action).toBe('test_action')
      expect(data.resource_type).toBe('test_resource')
      expect(data.user_id).toBeNull() // Anonymous
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should receive document status updates', async () => {
      let receivedUpdate = false
      let updateData: any = null

      // Set up subscription
      const subscription = supabase
        .channel('document_updates')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents'
        }, (payload) => {
          receivedUpdate = true
          updateData = payload.new
        })
        .subscribe()

      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create and update a document
      const testDoc = createTestDocument()
      const { data: created } = await supabase
        .from('documents')
        .insert(testDoc)
        .select()
        .single()
      
      testDocumentIds.push(created.id)

      // Update the document
      await supabase
        .from('documents')
        .update({ processing_status: 'completed' })
        .eq('id', created.id)

      // Wait for real-time update
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Cleanup subscription
      await supabase.removeChannel(subscription)

      expect(receivedUpdate).toBe(true)
      expect(updateData?.processing_status).toBe('completed')
    }, 10000) // Extended timeout for real-time test
  })

  describe('Performance & Load Testing', () => {
    it('should handle concurrent document inserts', async () => {
      const concurrentDocs = Array.from({ length: 5 }, () => createTestDocument())
      
      const promises = concurrentDocs.map(doc =>
        supabase.from('documents').insert(doc).select().single()
      )

      const results = await Promise.all(promises)
      
      results.forEach(({ data, error }) => {
        expect(error).toBeNull()
        expect(data).toBeDefined()
        testDocumentIds.push(data.id)
      })

      expect(results).toHaveLength(5)
    })

    it('should handle large form data', async () => {
      const largeFormData = {
        fields: Array.from({ length: 100 }, (_, i) => ({
          name: `field_${i}`,
          value: `value_${i}`.repeat(50), // Large values
          type: 'text'
        }))
      }

      const testForm = {
        ...createTestForm(),
        form_data: largeFormData
      }

      const { data, error } = await supabase
        .from('generated_forms')
        .insert(testForm)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.form_data.fields).toHaveLength(100)
      
      testFormIds.push(data.id)
    })
  })
})