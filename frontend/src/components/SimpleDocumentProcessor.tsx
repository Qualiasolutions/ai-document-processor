import React, { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, User, CreditCard, FileCheck, Download, ArrowRight, CheckCircle, Sparkles, Brain, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ExtractedData {
  [key: string]: string
}

interface Document {
  id: string
  filename: string
  ai_analysis?: {
    document_type: string
    extracted_data: ExtractedData
    confidence: number
  }
}

interface FormTemplate {
  id: string
  name: string
  category: string
  description: string
}

const FORM_TEMPLATES: FormTemplate[] = [
  { id: 'personal', name: 'Personal Information Form', category: 'personal', description: 'Basic personal details and identity information' },
  { id: 'employment', name: 'Employment Application', category: 'employment', description: 'Job application and employment history' },
  { id: 'visa', name: 'Visa Application Form', category: 'immigration', description: 'Travel and immigration documentation' },
  { id: 'financial', name: 'Financial Statement', category: 'finance', description: 'Bank statements and financial records' },
  { id: 'medical', name: 'Medical Information Form', category: 'healthcare', description: 'Healthcare and medical history' }
]

export function SimpleDocumentProcessor() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'extracted' | 'form-select' | 'form-filled' | 'export'>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [document, setDocument] = useState<Document | null>(null)
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null)
  const [filledForm, setFilledForm] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setUploadedFile(file)
      setCurrentStep('processing')
      setIsProcessing(true)
      
      toast.success('Document uploaded successfully!')

      // Convert file to base64
      const reader = new FileReader()
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Use the document-upload-process Edge Function for complete workflow
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-upload-process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          fileData: fileData,
          fileName: file.name,
          fileType: file.type,
          processImmediately: true
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Upload failed: ${errorData}`)
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error.message || 'Processing failed')
      }

      // Set up the document with extracted data
      const processedDoc = result.data
      const aiAnalysis = processedDoc.aiAnalysis || processedDoc.ai_analysis
      
      console.log('Full backend response:', result) // Debug log
      console.log('Processed doc:', processedDoc) // Debug log
      console.log('AI Analysis:', aiAnalysis) // Debug log
      console.log('Processing status from backend:', processedDoc.processingStatus) // Debug log
      console.log('AI Analysis fields check:', {
        hasExtractedData: !!aiAnalysis?.extracted_data,
        hasExtractedFields: !!aiAnalysis?.extracted_fields,
        hasExtractedFieldsAlt: !!aiAnalysis?.extractedFields,
        allKeys: aiAnalysis ? Object.keys(aiAnalysis) : 'no aiAnalysis'
      })

      // Extract meaningful personal information from AI analysis
      let extractedData = {}
      
      if (aiAnalysis && (aiAnalysis.extracted_data || aiAnalysis.extracted_fields || aiAnalysis.extractedFields)) {
        // Use the AI extracted personal information (support multiple field name formats)
        extractedData = aiAnalysis.extracted_data || aiAnalysis.extracted_fields || aiAnalysis.extractedFields
        console.log('✅ Using AI extracted personal data:', extractedData)
        console.log('ExtractedData type and keys:', typeof extractedData, Object.keys(extractedData || {}))
        
        // Ensure extractedData is an object with actual content
        if (!extractedData || typeof extractedData !== 'object' || Object.keys(extractedData).length === 0) {
          console.warn('⚠️ Extracted data is empty or invalid:', extractedData)
          extractedData = {
            document_status: 'AI analysis returned empty data',
            ai_confidence: aiAnalysis.confidence_score || aiAnalysis.confidence || 'unknown',
            raw_ai_response: JSON.stringify(aiAnalysis)
          }
        }
      } else if (aiAnalysis && aiAnalysis.raw_analysis) {
        // If we have raw analysis but parsing failed, try to show some info
        extractedData = {
          document_status: 'AI analysis parsing failed - check raw response',
          raw_content_preview: aiAnalysis.raw_analysis.substring(0, 200) + '...',
          full_raw_analysis: aiAnalysis.raw_analysis
        }
      } else if (!aiAnalysis) {
        // No AI analysis received - need to debug why
        extractedData = {
          document_status: '⚠️ NO AI ANALYSIS RECEIVED',
          backend_processing_status: processedDoc.processingStatus || 'unknown',
          extracted_text_length: (processedDoc.extractedText || '').length,
          has_extracted_text: !!(processedDoc.extractedText),
          debug_keys: Object.keys(processedDoc || {}),
          possible_issue: 'Check backend logs - OpenAI API call might be failing'
        }
      } else {
        // True fallback - try to extract from document content if available
        const documentContent = processedDoc.extractedText || processedDoc.document?.content || ''
        if (documentContent && documentContent.length > 50) {
          // Basic text parsing for common patterns
          const lines = documentContent.split('\n')
          const basicFields: { [key: string]: string } = {}
          
          lines.forEach(line => {
            const cleanLine = line.trim()
            if (cleanLine.includes('Name:') || cleanLine.includes('Full Name:')) {
              const name = cleanLine.split(':')[1]?.trim()
              if (name) basicFields.full_name = name
            }
            if (cleanLine.includes('Date of Birth:') || cleanLine.includes('DOB:')) {
              const dob = cleanLine.split(':')[1]?.trim()
              if (dob) basicFields.date_of_birth = dob
            }
            if (cleanLine.includes('Email:') || cleanLine.includes('Email Address:')) {
              const email = cleanLine.split(':')[1]?.trim()
              if (email) basicFields.email = email
            }
            if (cleanLine.includes('Phone:') || cleanLine.includes('Phone Number:')) {
              const phone = cleanLine.split(':')[1]?.trim()
              if (phone) basicFields.phone = phone
            }
            if (cleanLine.includes('Passport Number:') || cleanLine.includes('Passport No:')) {
              const passport = cleanLine.split(':')[1]?.trim()
              if (passport) basicFields.passport_number = passport
            }
            if (cleanLine.includes('Nationality:')) {
              const nationality = cleanLine.split(':')[1]?.trim()
              if (nationality) basicFields.nationality = nationality
            }
            if (cleanLine.includes('Address:') || cleanLine.includes('Current Address:')) {
              const address = cleanLine.split(':')[1]?.trim()
              if (address) basicFields.address = address
            }
          })
          
          extractedData = Object.keys(basicFields).length > 0 ? basicFields : {
            document_status: 'Basic text extraction completed',
            content_preview: documentContent.substring(0, 300) + '...',
            processing_note: 'OpenAI API key needed for intelligent extraction'
          }
        } else {
          extractedData = {
            document_status: 'No content extracted',
            document_name: file.name,
            processing_note: 'OpenAI API key needed for AI analysis - please configure in Supabase',
            debug_info: 'No AI analysis received from backend',
            backend_processing_status: processedDoc.processingStatus || 'unknown'
          }
        }
      }

      const documentData = {
        id: processedDoc.document?.id || `temp-${Date.now()}`,
        filename: file.name,
        ai_analysis: {
          document_type: aiAnalysis?.document_type || aiAnalysis?.documentType || 'document',
          confidence: aiAnalysis?.confidence_score || aiAnalysis?.confidence || 0.7,
          extracted_data: extractedData
        }
      }
      
      console.log('Setting document:', documentData) // Debug log
      setDocument(documentData)
      setCurrentStep('extracted')
      
      // Show appropriate success message based on what was extracted
      const extractedFields = aiAnalysis?.extracted_data || aiAnalysis?.extracted_fields || aiAnalysis?.extractedFields || {}
      const personalDataFields = Object.keys(extractedFields).filter(key => 
        !['document_status', 'document_name', 'processing_note', 'raw_content_preview'].includes(key)
      )
      
      if (personalDataFields.length > 0) {
        toast.success(`Document processed! Extracted ${personalDataFields.length} pieces of personal information.`)
      } else if (aiAnalysis) {
        toast.success('Document processed, but no personal information could be extracted.')
      } else {
        toast.success('Document uploaded successfully!')
      }
      
    } catch (error) {
      console.error('Error processing document:', error)
      toast.error('Failed to process document: ' + (error as Error).message)
      setCurrentStep('upload')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFormSelection = async (template: FormTemplate) => {
    try {
      setSelectedForm(template)
      setIsProcessing(true)

      // Always extract the data regardless of the structure
      const extractedData = document?.ai_analysis?.extracted_data || 
                           document?.ai_analysis?.extracted_fields || 
                           document?.ai_analysis?.extractedFields || {}
      
      if (!extractedData || Object.keys(extractedData).length === 0) {
        // If no AI data, create simple form with basic info
        const simpleForm = {
          formData: {
            document_name: document?.filename || 'Unknown',
            template_used: template.name,
            status: 'No personal data extracted - check if OpenAI API key is configured'
          }
        }
        setFilledForm(simpleForm)
        setCurrentStep('form-filled')
        toast.success('Form generated successfully!')
        return
      }

      // Generate form with AI using the form-generation Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/form-generation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document?.id,
          formType: template.category,
          templateId: template.id
        })
      })

      if (!response.ok) {
        // Fallback to simple form if AI generation fails
        const simpleForm = {
          formData: {
            document_name: document?.filename || 'Unknown',
            template_used: template.name,
            ...extractedData
          }
        }
        setFilledForm(simpleForm)
        setCurrentStep('form-filled')
        toast.success('Form generated with extracted data!')
        return
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error.message)
      }

      // Set the form data from the AI response
      const formData = result.data?.populatedData || result.data?.formData || extractedData
      setFilledForm({ formData })
      setCurrentStep('form-filled')
      toast.success('Form generated successfully!')
      
    } catch (error) {
      console.error('Error generating form:', error)
      // Fallback to simple form on any error
      const simpleForm = {
        formData: {
          document_name: document?.filename || 'Unknown',
          template_used: template.name,
          ...extractedData
        }
      }
      setFilledForm(simpleForm)
      setCurrentStep('form-filled')
      toast.success('Form created with available data!')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    try {
      // Create simple HTML/text export since Edge Function export is complex
      const formData = filledForm?.formData || {}
      const templateName = selectedForm?.name || 'Generated Form'
      
      let exportContent = ''
      let mimeType = ''
      let fileExtension = ''
      
      if (format === 'pdf' || format === 'docx') {
        // For now, export as HTML which can be saved as PDF by user
        exportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${templateName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .field { margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
        .label { font-weight: bold; color: #333; }
        .value { background: #f5f5f5; padding: 8px 12px; border-radius: 4px; min-width: 200px; text-align: right; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${templateName}</h1>
        <p>Generated by Qualia Solutions Document Processor</p>
        <p>Date: ${new Date().toLocaleDateString()}</p>
    </div>
    
    ${Object.entries(formData).map(([key, value]) => `
        <div class="field">
            <div class="label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</div>
            <div class="value">${typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value || 'N/A')}</div>
        </div>
    `).join('')}
    
    <div class="footer">
        <p>Processed from: ${document?.filename}</p>
        <p>Template: ${templateName}</p>
    </div>
</body>
</html>`
        mimeType = 'text/html'
        fileExtension = 'html'
      }

      // Create and download file
      const blob = new Blob([exportContent], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `${templateName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`
      window.document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      window.document.body.removeChild(a)
      
      toast.success(`Form exported as HTML! You can save it as PDF from your browser.`)
      
    } catch (error) {
      console.error('Error exporting form:', error)
      toast.error('Failed to export form: ' + (error as Error).message)
    }
  }

  const resetWorkflow = () => {
    setCurrentStep('upload')
    setUploadedFile(null)
    setDocument(null)
    setSelectedForm(null)
    setFilledForm(null)
    setIsProcessing(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Qualia Solutions Document Processor
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Intelligent document processing and form generation</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-500">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Made by Qualia</span>
              <span className="sm:hidden">Qualia</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Progress Steps */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-4 sm:mb-6 overflow-x-auto pb-2">
            {[
              { key: 'upload', icon: Upload, label: 'Upload' },
              { key: 'processing', icon: Brain, label: 'Document Analysis' },
              { key: 'extracted', icon: FileText, label: 'Review Data' },
              { key: 'form-select', icon: FileCheck, label: 'Select Form' },
              { key: 'form-filled', icon: CheckCircle, label: 'Generate' },
              { key: 'export', icon: Download, label: 'Export' }
            ].map((step, index) => {
              const isActive = currentStep === step.key
              const isCompleted = ['upload', 'processing', 'extracted', 'form-select', 'form-filled'].indexOf(currentStep) > 
                                ['upload', 'processing', 'extracted', 'form-select', 'form-filled'].indexOf(step.key)
              
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex flex-col items-center space-y-1 sm:space-y-2 min-w-0 ${isActive ? 'opacity-100' : isCompleted ? 'opacity-80' : 'opacity-40'}`}>
                    <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-transparent text-white shadow-lg' 
                        : isCompleted
                        ? 'bg-green-500 border-transparent text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      <step.icon className="w-3 h-3 sm:w-5 sm:h-5" />
                    </div>
                    <span className={`text-xs font-medium text-center ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < 5 && (
                    <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ml-2 sm:ml-4 ${isCompleted ? 'text-green-400' : 'text-gray-300'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upload Step */}
        {currentStep === 'upload' && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Upload Your Document</h2>
                <p className="text-sm sm:text-base text-gray-600">Drag and drop or click to select your document for processing</p>
              </div>
              
              <div 
                className="border-2 border-dashed border-indigo-300 rounded-2xl p-8 sm:p-12 text-center hover:border-indigo-400 transition-all duration-300 cursor-pointer bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100"
                onClick={() => window.document.getElementById('file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const files = Array.from(e.dataTransfer.files)
                  if (files[0]) handleFileUpload(files[0])
                }}
              >
                <Upload className="w-12 h-12 sm:w-16 sm:h-16 text-indigo-400 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Drop your document here</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">Supports PDF, Word, images, and text files</p>
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Choose File
                </Button>
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Step */}
        {currentStep === 'processing' && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="animate-spin w-12 h-12 sm:w-16 sm:h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4 sm:mb-6"></div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Processing Your Document</h2>
              <p className="text-sm sm:text-base text-gray-600 mb-4">Our system is analyzing and extracting data from your document...</p>
              <div className="bg-indigo-50 rounded-lg p-3 sm:p-4 max-w-md mx-auto">
                <p className="text-xs sm:text-sm text-indigo-800 break-all">
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Processing: {uploadedFile?.name}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extracted Data Step */}
        {currentStep === 'extracted' && document && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Extracted Information</h2>
                <p className="text-sm sm:text-base text-gray-600">Review the data extracted from your document</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    <span className="font-semibold text-green-800 text-sm sm:text-base">Document Type: {document.ai_analysis?.document_type || 'Document'}</span>
                  </div>
                  <span className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium self-start sm:self-auto">
                    {Math.round((document.ai_analysis?.confidence || 0.7) * 100)}% confidence
                  </span>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  {Object.entries(document.ai_analysis?.extracted_data || {}).map(([key, value]) => (
                    <div key={key} className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                        <span className="font-medium text-gray-700 capitalize text-sm sm:text-base">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-gray-900 font-semibold text-sm sm:text-base break-all">
                          {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value || 'N/A')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <Button 
                  onClick={() => setCurrentStep('form-select')}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base w-full sm:w-auto"
                >
                  Continue to Form Selection
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Selection Step */}
        {currentStep === 'form-select' && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Choose Your Form Template</h2>
                <p className="text-sm sm:text-base text-gray-600">Select the form template that best matches your needs</p>
              </div>

              <div className="grid gap-3 sm:gap-4 max-w-2xl mx-auto">
                {FORM_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleFormSelection(template)}
                    className="p-4 sm:p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{template.name}</h3>
                        <p className="text-gray-600 text-xs sm:text-sm mt-1">{template.description}</p>
                        <span className="inline-block mt-2 px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium">
                          {template.category}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </div>
                ))}
              </div>

              {isProcessing && (
                <div className="text-center mt-4 sm:mt-6">
                  <div className="animate-spin w-6 h-6 sm:w-8 sm:h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-2"></div>
                  <p className="text-sm sm:text-base text-gray-600">Generating form...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form Filled Step */}
        {currentStep === 'form-filled' && filledForm && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Generated Form</h2>
                <p className="text-sm sm:text-base text-gray-600">Review your generated form and export when ready</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-3 sm:mb-4">{selectedForm?.name}</h3>
                <div className="grid gap-3 sm:gap-4">
                  {Object.entries(filledForm.formData || {}).map(([key, value]) => (
                    <div key={key} className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                        <span className="font-medium text-gray-700 capitalize text-sm sm:text-base">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-gray-900 font-semibold text-sm sm:text-base break-all">
                          {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value || 'N/A')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={() => handleExport('pdf')}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Export PDF
                </Button>
                <Button 
                  onClick={() => handleExport('docx')}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Export Word
                </Button>
                <Button 
                  onClick={resetWorkflow}
                  variant="outline"
                  className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base w-full sm:w-auto"
                >
                  Process Another Document
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 