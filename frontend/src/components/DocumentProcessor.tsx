import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { documentProcessor, ProcessingProgress, ProcessedDocument } from '@/lib/documentProcessor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileText, 
  Upload, 
  Brain, 
  Download, 
  Plus, 
  BarChart3,
  Clock,
  FileCheck,
  Sparkles,
  Eye,
  Zap,
  X,
  FormInput,
  CheckCircle,
  Info
} from 'lucide-react'
import { formatDate, formatFileSize } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ProgressBar } from '@/components/ProgressBar'
import { DocumentWorkflow } from '@/components/DocumentWorkflow'
import { DocumentList } from '@/components/DocumentList'
import { GeneratedFormsList } from '@/components/GeneratedFormsList'
import { FormGenerator } from '@/components/FormGenerator'
import { ExportOptions } from '@/components/ExportOptions'
import { TestProcessing } from '@/components/TestProcessing'

interface Document {
  id: string
  filename: string
  file_size?: number
  file_type: string
  status: string
  processing_status?: string
  extracted_content?: string
  ai_analysis?: any
  document_type?: string
  created_at: string
  updated_at: string
}

interface GeneratedForm {
  id: string
  title: string
  form_type: string
  status: string
  created_at: string
  document_id: string
}

export function DocumentProcessor() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [forms, setForms] = useState<GeneratedForm[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<Map<string, ProcessingProgress>>(new Map())
  const [batchMode, setBatchMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [realTimeUpdates, setRealTimeUpdates] = useState<Map<string, () => void>>(new Map())
  const [workflowDocument, setWorkflowDocument] = useState<Document | null>(null)
  const [processing, setProcessing] = useState(false)
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [generatedForm, setGeneratedForm] = useState<any>(null)
  const [generatedForms, setGeneratedForms] = useState<any[]>([])

  useEffect(() => {
    loadData()

    // Cleanup real-time subscriptions on unmount
    return () => {
      realTimeUpdates.forEach(unsubscribe => unsubscribe())
      setRealTimeUpdates(new Map())
    }
  }, [])

  useEffect(() => {
    // Setup real-time subscription for all documents
    const subscription = supabase
      .channel('documents_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDocuments(prev => [payload.new as Document, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => 
            prev.map(doc => doc.id === payload.new.id ? { ...doc, ...payload.new } : doc)
          )
        }
      })
      .subscribe()

    const formsSubscription = supabase
      .channel('forms_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'generated_forms'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setForms(prev => [payload.new as GeneratedForm, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setForms(prev => 
            prev.map(form => form.id === payload.new.id ? { ...form, ...payload.new } : form)
          )
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
      supabase.removeChannel(formsSubscription)
    }
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      
      // Load documents (no user_id filter)
      const { data: documentsData, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) // Limit to recent documents

      if (docsError) {
        console.error('Error loading documents:', docsError)
      } else {
        setDocuments(documentsData || [])
      }

      // Load forms (no user_id filter)
      const { data: formsData, error: formsError } = await supabase
        .from('generated_forms')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) // Limit to recent forms

      if (formsError) {
        console.error('Error loading forms:', formsError)
      } else {
        setGeneratedForms(formsData || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(files: FileList) {
    if (!files.length) return

    setUploading(true)
    const fileArray = Array.from(files)
    
    try {
      if (batchMode && fileArray.length > 1) {
        // Batch processing
        await documentProcessor.processBatch(fileArray, (completed, total, results) => {
          toast.success(`Processed ${completed}/${total} documents`, { id: 'batch-progress' })
        })
        toast.success('Batch processing completed!', { id: 'batch-progress' })
      } else {
        // Process files individually with real-time progress
        for (const file of fileArray) {
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          
          // Set up progress tracking
          const progressHandler = (progress: ProcessingProgress) => {
            setProcessingProgress(prev => new Map(prev.set(tempId, progress)))
            
            // Show toast updates for major stages
            if (progress.stage === 'completed') {
              toast.success(`${file.name} processed successfully!`)
              setProcessingProgress(prev => {
                const newMap = new Map(prev)
                newMap.delete(tempId)
                return newMap
              })
              
              // Auto-open workflow for processed documents
              if (progress.data && progress.data.document) {
                setTimeout(() => {
                  setWorkflowDocument(progress.data.document)
                }, 1000) // Small delay to let UI update
              }
            } else if (progress.stage === 'error') {
              toast.error(`${file.name}: ${progress.error}`)
              setProcessingProgress(prev => {
                const newMap = new Map(prev)
                newMap.delete(tempId)
                return newMap
              })
            }
          }

          try {
            const processedDoc = await documentProcessor.processDocument(file, progressHandler)
            
            // Set up real-time updates for this document
            const unsubscribe = documentProcessor.subscribeToDocumentUpdates(
              processedDoc.id,
              (updatedDoc) => {
                setDocuments(prev => 
                  prev.map(doc => doc.id === processedDoc.id ? { ...doc, ...updatedDoc } : doc)
                )
              }
            )
            
            setRealTimeUpdates(prev => new Map(prev.set(processedDoc.id, unsubscribe)))
            
          } catch (error) {
            console.error(`Failed to process ${file.name}:`, error)
            
            // Enhanced error handling with user-friendly messages
            let errorMessage = `Failed to process ${file.name}`
            
            if (error.message.includes('DOCX')) {
              if (error.message.includes('too large')) {
                errorMessage = `${file.name} is too large. Please use a file smaller than 50MB.`
              } else if (error.message.includes('corrupted') || error.message.includes('invalid')) {
                errorMessage = `${file.name} appears to be corrupted. Try opening it in Microsoft Word and saving it again.`
              } else if (error.message.includes('empty') || error.message.includes('no readable text')) {
                errorMessage = `${file.name} contains no readable text. Make sure the document has content and isn't password-protected.`
              } else if (error.message.includes('not supported')) {
                errorMessage = `${file.name} format not supported. Please save as a newer Word format (.docx).`
              } else {
                errorMessage = `DOCX processing failed for ${file.name}. ${error.message}`
              }
            } else if (error.message.includes('PDF')) {
              errorMessage = `PDF processing failed for ${file.name}. The file might be image-based or corrupted.`
            } else if (error.message.includes('Unsupported file type')) {
              errorMessage = `${file.name} is not a supported file type. Please use TXT, PDF, or DOCX files.`
            } else if (error.message.includes('File is too large')) {
              errorMessage = `${file.name} is too large. Maximum file size is 50MB.`
            } else if (error.message.includes('appears to be empty')) {
              errorMessage = `${file.name} appears to be empty. Please select a file with content.`
            }
            
            toast.error(errorMessage, {
              duration: 6000,
              id: `error-${file.name}`,
              style: {
                maxWidth: '500px',
              }
            })
          }
        }
      }

      // Reload all data
      await loadData()
    } catch (error) {
      console.error('Upload error:', error)
      
      // Enhanced error handling for general upload failures
      let errorMessage = 'Failed to process file(s)'
      
      if (error.message.includes('File is too large')) {
        errorMessage = 'One or more files are too large. Maximum file size is 50MB.'
      } else if (error.message.includes('Unsupported file type')) {
        errorMessage = 'Unsupported file type detected. Please use TXT, PDF, or DOCX files.'
      } else if (error.message.includes('DOCX')) {
        errorMessage = 'DOCX processing error. Please ensure your Word documents are not corrupted or password-protected.'
      } else if (error.message.includes('PDF')) {
        errorMessage = 'PDF processing error. The file might be image-based or corrupted.'
      } else {
        errorMessage = `Upload failed: ${error.message}`
      }
      
      toast.error(errorMessage, {
        duration: 6000,
        style: {
          maxWidth: '500px',
        }
      })
    } finally {
      setUploading(false)
    }
  }

  // Enhanced file selection with drag and drop
  function handleFileSelection(files: FileList | File[]) {
    const fileArray = Array.isArray(files) ? files : Array.from(files)
    setSelectedFiles(fileArray)
  }

  async function analyzeDocument(document: Document) {
    try {
      toast.loading('Analyzing document with AI...', { id: 'ai-analysis' })
      
      // Use document-upload-process for reprocessing existing documents
      const { data, error } = await supabase.functions.invoke('document-upload-process', {
        body: {
          fileData: 'data:text/plain;base64,' + btoa((document as any).content || document.extracted_content || `Document: ${document.filename}`),
          fileName: document.filename,
          fileType: document.file_type || 'text/plain',
          processImmediately: true
        }
      })

      if (error) {
        console.error('Processing error details:', error)
        throw error
      }

      if (data && data.data) {
        // After successful analysis, automatically open workflow
        setTimeout(() => {
          setWorkflowDocument({
            ...document,
            ai_analysis: data.data.aiAnalysis,
            document_type: data.data.aiAnalysis?.document_type
          } as Document)
        }, 500)
      }

      toast.success('Document analyzed successfully!', { id: 'ai-analysis' })
      await loadData()
    } catch (error: any) {
      console.error('Analysis error:', error)
      
      // Enhanced error message for document analysis
      let errorMessage = 'Failed to analyze document'
      
      if (error?.message?.includes('DOCX')) {
        if (error.message.includes('too large')) {
          errorMessage = 'Document is too large. Please use a file smaller than 50MB.'
        } else if (error.message.includes('corrupted') || error.message.includes('invalid')) {
          errorMessage = 'Document appears to be corrupted. Try opening it in Microsoft Word and saving it again.'
        } else if (error.message.includes('empty') || error.message.includes('no readable text')) {
          errorMessage = 'Document contains no readable text. Make sure it has content and isn\'t password-protected.'
        } else if (error.message.includes('not supported')) {
          errorMessage = 'Document format not supported. Please save as a newer Word format (.docx).'
        } else {
          errorMessage = `DOCX processing failed: ${error.message}`
        }
      } else if (error?.message?.includes('PDF')) {
        errorMessage = 'PDF processing failed. The file might be image-based or corrupted.'
      } else {
        errorMessage = error?.message || 'Failed to analyze document'
      }
      
      toast.error(`Analysis failed: ${errorMessage}`, { 
        id: 'ai-analysis',
        duration: 6000,
        style: {
          maxWidth: '500px',
        }
      })
      
      // Show detailed error in console for debugging
      if (error?.details) {
        console.error('Detailed error:', error.details)
      }
    }
  }

  const stats = {
    totalDocuments: documents.length,
    processedDocuments: documents.filter(d => d.processing_status === 'completed' || d.status === 'processed').length,
    totalForms: forms.length,
    recentActivity: Math.max(documents.length, forms.length)
  }

  if (loading) {
    return <LoadingSpinner message="Loading document processor..." />
  }

  const getFileTypeInfo = (file: File) => {
    if (file.type.includes('pdf')) return 'PDF';
    if (file.type.includes('word')) return 'Word Document';
    if (file.type.includes('image')) return 'Image';
    return 'Unknown';
  };

  const processDocuments = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to process.');
      return;
    }

    setProcessing(true);
    setActiveJobs([]); // Clear previous jobs
    setGeneratedForm(null); // Clear generated form

    for (const file of selectedFiles) {
      const jobId = `job_${Date.now()}`;
      setActiveJobs(prev => [...prev, {
        id: jobId,
        documentId: '', // Will be updated by documentProcessor
        filename: file.name,
        stage: 'pending',
        progress: 0,
        message: 'Preparing to process...'
      }]);

      const progressHandler = (progress: ProcessingProgress) => {
        setActiveJobs(prev => prev.map(j => 
          j.id === jobId ? { ...j, progress: progress.progress, message: progress.message, stage: progress.stage } : j
        ));
      };

      try {
        const processedDoc = await documentProcessor.processDocument(file, progressHandler);
        setActiveJobs(prev => prev.map(j => 
          j.id === jobId ? { ...j, documentId: processedDoc.id, stage: 'completed', progress: 100, message: 'Processing complete!' } : j
        ));
      } catch (error) {
        console.error(`Processing failed for ${file.name}:`, error);
        
        // Enhanced error message for activeJobs display
        let jobErrorMessage = 'Processing failed'
        
        if (error?.message?.includes('DOCX')) {
          if (error.message.includes('too large')) {
            jobErrorMessage = 'File too large (max 50MB)'
          } else if (error.message.includes('corrupted') || error.message.includes('invalid')) {
            jobErrorMessage = 'File corrupted or invalid format'
          } else if (error.message.includes('empty') || error.message.includes('no readable text')) {
            jobErrorMessage = 'No readable text found'
          } else if (error.message.includes('not supported')) {
            jobErrorMessage = 'DOCX format not supported'
          } else {
            jobErrorMessage = 'DOCX processing failed'
          }
        } else if (error?.message?.includes('PDF')) {
          jobErrorMessage = 'PDF processing failed (may be image-based)'
        } else if (error?.message?.includes('Unsupported file type')) {
          jobErrorMessage = 'File type not supported'
        } else if (error?.message?.includes('File is too large')) {
          jobErrorMessage = 'File too large (max 50MB)'
        } else if (error?.message?.includes('appears to be empty')) {
          jobErrorMessage = 'File appears to be empty'
        } else {
          jobErrorMessage = error?.message || 'Processing failed'
        }
        
        setActiveJobs(prev => prev.map(j => 
          j.id === jobId ? { ...j, stage: 'error', progress: 0, message: jobErrorMessage } : j
        ));
      }
    }
    setProcessing(false);
    toast.success(`Processing ${selectedFiles.length} documents...`);
  };

  const handleExport = () => {
    if (generatedForm) {
      toast.loading('Exporting form...', { id: 'export-form' });
      // In a real app, you'd send the generatedForm to a backend endpoint for PDF generation
      // For now, we'll just simulate a download
      setTimeout(() => {
        toast.dismiss('export-form');
        toast.success('Form exported successfully! (Simulated)');
        // In a real app, you'd trigger a download here
      }, 1000);
    } else {
      toast.error('No form to export.');
    }
  };

  const handleExportComplete = () => {
    toast.success('Form export complete!');
    // Optionally, refresh the forms list or update the UI
    loadData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">
                  AI Document Processor
                </h1>
                <p className="text-sm text-gray-600 hidden sm:block">Intelligent Form Generation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 hidden sm:block">No signup required</span>
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-900">Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card-modern p-6 hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Documents</p>
                <p className="text-3xl font-bold gradient-text">{stats.totalDocuments}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="card-modern p-6 hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processed</p>
                <p className="text-3xl font-bold text-green-600">{stats.processedDocuments}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <FileCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="card-modern p-6 hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Generated Forms</p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalForms}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="card-modern p-6 hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-3xl font-bold text-orange-600">{stats.recentActivity}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tabs */}
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 bg-gray-100/50 p-1 rounded-xl">
            <TabsTrigger value="upload" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all">
              <Upload className="w-4 h-4 mr-2" />
              Upload & Process
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all">
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="forms" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all">
              <FormInput className="w-4 h-4 mr-2" />
              Forms
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            {/* Upload Section with Glass Effect */}
            <Card className="card-modern glass border-0">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl gradient-text">
                      AI Document Processing
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      Upload documents and let AI extract data to generate professional forms instantly
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                      <input
                        type="checkbox"
                        checked={batchMode}
                        onChange={(e) => setBatchMode(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium">Batch Mode</span>
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors bg-gray-50/50">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center mb-4">
                      <Zap className="w-8 h-8 text-blue-600 mr-2" />
                      <Brain className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Advanced AI Document Processing
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      PDF OCR • Vision API • Text Analysis • Form Generation
                    </p>
                    <p className="text-xs text-blue-600 mb-4">
                      ✨ Real OpenAI GPT-4o processing with real-time updates
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 max-w-md mx-auto">
                      <div>📄 PDF, DOC, DOCX</div>
                      <div>🖼️ PNG, JPG, JPEG</div>
                      <div>📝 TXT, CSV</div>
                      <div>🧠 AI Vision + Text</div>
                    </div>
                  </label>
                  
                  {uploading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10">
                      <div className="text-center space-y-4 max-w-md">
                        <div className="flex items-center justify-center mb-4">
                          <Brain className="w-8 h-8 text-blue-600 animate-pulse mr-2" />
                          <Zap className="w-8 h-8 text-green-600 animate-bounce" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            AI Processing
                          </h3>
                          <p className="text-gray-600 mb-4">
                            {batchMode ? "Processing batch..." : "Processing documents..."}
                          </p>
                          <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                        </div>
                        
                        {/* Show individual file progress */}
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {Array.from(processingProgress.entries()).map(([id, progress]) => (
                            <div key={id} className="bg-gray-50 rounded-lg p-3 text-left">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">{progress.message}</span>
                                <span className="text-xs text-gray-500 capitalize">{progress.stage}</span>
                              </div>
                              <ProgressBar progress={progress.progress} />
                              {progress.data && (
                                <div className="mt-1 text-xs text-green-600">
                                  ✓ Processing complete
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Selected Files</h4>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            file.type.includes('pdf') ? 'bg-red-100' :
                            file.type.includes('word') ? 'bg-blue-100' :
                            file.type.includes('image') ? 'bg-green-100' :
                            'bg-gray-100'
                          }`}>
                            <FileText className={`w-4 h-4 ${
                              file.type.includes('pdf') ? 'text-red-600' :
                              file.type.includes('word') ? 'text-blue-600' :
                              file.type.includes('image') ? 'text-green-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)} • {getFileTypeInfo(file)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedFiles.length > 0 && (
                  <div className="flex gap-3">
                    <button
                      onClick={processDocuments}
                      disabled={processing || uploading}
                      className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing || uploading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Zap className="w-5 h-5 mr-2" />
                          <span>Process {selectedFiles.length} {selectedFiles.length === 1 ? 'Document' : 'Documents'}</span>
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="btn-ghost"
                    >
                      Clear All
                    </button>
                  </div>
                )}
                
                {/* Troubleshooting Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Troubleshooting Tips
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-800">
                    <div>
                      <strong>DOCX Issues:</strong>
                      <ul className="ml-2 mt-1 space-y-1">
                        <li>• Ensure file is not password-protected</li>
                        <li>• Try saving as newer .docx format</li>
                        <li>• Maximum file size: 50MB</li>
                      </ul>
                    </div>
                    <div>
                      <strong>PDF Issues:</strong>
                      <ul className="ml-2 mt-1 space-y-1">
                        <li>• Image-based PDFs require OCR processing</li>
                        <li>• Scanned documents may take longer</li>
                        <li>• Text-based PDFs work best</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700">
                    <strong>Quick Fix:</strong> If you encounter errors, try converting your document to plain text (.txt) format first, or ensure DOCX files are saved in the latest Microsoft Word format.
                  </div>
                </div>
                
                {/* Test Processing Section */}
                <TestProcessing />
              </CardContent>
            </Card>
            
            {/* Processing Progress */}
            {activeJobs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Processing Queue</h3>
                {activeJobs.map((job) => (
                  <Card key={job.id} className="card-modern">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-500" />
                          <span className="font-medium">{job.filename}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          job.stage === 'completed' ? 'bg-green-100 text-green-700' :
                          job.stage === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {job.stage}
                        </span>
                      </div>
                      <ProgressBar progress={job.progress} className="mb-2" />
                      <p className="text-sm text-gray-600">{job.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {/* Form Generation */}
            {generatedForm && (
              <div className="space-y-6 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Generated Form</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Ready to Export
                  </span>
                </div>
                
                <Card className="card-modern">
                  <CardContent className="p-6">
                    <FormGenerator
                      form={generatedForm}
                      onFormChange={setGeneratedForm}
                      onExport={handleExport}
                    />
                  </CardContent>
                </Card>
                
                <ExportOptions
                  form={generatedForm}
                  onExportComplete={handleExportComplete}
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="documents" className="space-y-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle>Document History</CardTitle>
                <CardDescription>
                  View and manage all processed documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentList 
                  documents={documents}
                  onDocumentSelect={(doc: any) => {
                    // Handle document selection
                    console.log('Selected document:', doc);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="forms" className="space-y-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle>Generated Forms</CardTitle>
                <CardDescription>
                  Access and export your generated forms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GeneratedFormsList 
                  forms={generatedForms}
                  onFormSelect={(form: any) => {
                    setGeneratedForm(form);
                    // Switch to upload tab to show the form
                    const tabsList = document.querySelector('[role="tablist"]');
                    const uploadTab = tabsList?.querySelector('[value="upload"]');
                    if (uploadTab) {
                      (uploadTab as HTMLButtonElement).click();
                    }
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Document Workflow Modal */}
      {workflowDocument && (
        <DocumentWorkflow
          document={workflowDocument}
          onClose={() => setWorkflowDocument(null)}
          onFormGenerated={(formId) => {
            console.log('Form generated:', formId)
            loadData() // Refresh data to show new forms
          }}
        />
      )}
    </div>
  )
}