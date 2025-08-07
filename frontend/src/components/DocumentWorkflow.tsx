import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Brain, 
  CheckCircle2, 
  ArrowRight, 
  Eye, 
  Edit,
  Download,
  Sparkles,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { FormTypeSelector } from '@/components/FormTypeSelector'
import { StepIndicator } from '@/components/StepIndicator'
import { FormType, ProcessingStep } from '@/types'
import { supabase } from '@/lib/supabase'

interface DocumentWorkflowProps {
  document: {
    id: string
    filename: string
    ai_analysis?: any
    document_type?: string 
    extracted_content?: string
  }
  onClose: () => void
  onFormGenerated: (formId: string) => void
}

type WorkflowStep = 'analysis' | 'template' | 'form' | 'export'

export function DocumentWorkflow({ document, onClose, onFormGenerated }: DocumentWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('analysis')

  // Map workflow steps to ProcessingStep for the indicator
  const getProcessingStep = (step: WorkflowStep): ProcessingStep => {
    switch (step) {
      case 'analysis': return 'review'
      case 'template': return 'processing'
      case 'form': return 'form'
      case 'export': return 'export'
      default: return 'processing'
    }
  }
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [generatedForm, setGeneratedForm] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const analysis = document.ai_analysis
  const extractedFields = analysis?.extractedFields || analysis?.extracted_data || {}

  const steps = [
    { id: 'analysis', title: 'Review Analysis', icon: Brain },
    { id: 'template', title: 'Choose Template', icon: FileText },
    { id: 'form', title: 'Generate Form', icon: Sparkles },
    { id: 'export', title: 'Review & Export', icon: Download }
  ]

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep)

  const goToNextStep = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as WorkflowStep)
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as WorkflowStep)
    }
  }

  const handleGenerateForm = async () => {
    if (!selectedTemplate) return
    
    setIsGenerating(true)
    try {
      // Call Supabase edge function for form generation
      const { data, error } = await supabase.functions.invoke('form-generation', {
        body: {
          documentId: document.id,
          formType: selectedTemplate,
          customTemplate: null
        }
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      if (data && data.data) {
        setGeneratedForm(data.data)
        onFormGenerated(data.data.formId)
        goToNextStep()
      }
    } catch (error) {
      console.error('Form generation failed:', error)
      alert('Form generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const renderAnalysisStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Brain className="w-12 h-12 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Analysis Complete!</h3>
        <p className="text-gray-600">Here's what we extracted from your document:</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {document.filename}
          </CardTitle>
          <CardDescription>
            Document Type: <span className="font-medium capitalize">
              {document.document_type?.replace('_', ' ') || 'Unknown'}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(extractedFields).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(extractedFields).map(([key, value]) => {
                if (!value || typeof value !== 'string') return null
                return (
                  <div key={key} className="border-l-4 border-blue-500 pl-4">
                    <dt className="text-sm font-medium text-gray-500 uppercase">
                      {key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-sm text-gray-900 mt-1">{value}</dd>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
              <p className="text-gray-600">Limited data extracted. You can still create a form manually.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={goToNextStep} className="flex items-center gap-2">
          Choose Form Template <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  const renderTemplateStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <FileText className="w-12 h-12 mx-auto text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Choose Form Template</h3>
        <p className="text-gray-600">Select the best template for your document type</p>
      </div>

      <FormTypeSelector
        selectedType={selectedTemplate as FormType}
        onTypeSelect={(type) => setSelectedTemplate(type)}
        suggestedTypes={[(document.document_type as FormType) || 'personal_information']}
        className="max-w-4xl mx-auto"
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={goToPreviousStep} className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Analysis
        </Button>
        <Button 
          onClick={goToNextStep} 
          disabled={!selectedTemplate}
          className="flex items-center gap-2"
        >
          Generate Form <Sparkles className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  const renderFormStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Sparkles className="w-12 h-12 mx-auto text-purple-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Generate Form</h3>
        <p className="text-gray-600">Create your auto-populated form</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <h4 className="font-medium">Selected Template</h4>
                <p className="text-sm text-gray-600 capitalize">
                  {selectedTemplate?.replace('_', ' ')}
                </p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Fields to be populated:</h4>
              <div className="text-sm text-gray-600">
                {Object.keys(extractedFields).length > 0 
                  ? `${Object.keys(extractedFields).length} fields will be auto-filled`
                  : 'Form will be created with empty fields for manual entry'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={goToPreviousStep} className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Templates
        </Button>
        <Button 
          onClick={handleGenerateForm} 
          disabled={isGenerating}
          className="flex items-center gap-2"
        >
          {isGenerating ? 'Generating...' : 'Create Form'} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  const renderExportStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Form Generated!</h3>
        <p className="text-gray-600">Your form is ready for review and export</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button className="w-full flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Open Form Editor
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
              <Button variant="outline" className="flex-1 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Close Workflow
        </Button>
        <Button onClick={onClose} className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Complete
        </Button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Document Processing Workflow</h2>
            <Button variant="ghost" onClick={onClose}>✕</Button>
          </div>
          
          <StepIndicator 
            currentStep={getProcessingStep(currentStep)} 
            className="mb-4"
          />
        </div>

        <div className="p-6">
          {currentStep === 'analysis' && renderAnalysisStep()}
          {currentStep === 'template' && renderTemplateStep()}
          {currentStep === 'form' && renderFormStep()}
          {currentStep === 'export' && renderExportStep()}
        </div>
      </div>
    </div>
  )
} 