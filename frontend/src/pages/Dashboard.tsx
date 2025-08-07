import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, Document, GeneratedForm } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileText, 
  Upload, 
  Brain, 
  Download, 
  Plus, 
  Settings, 
  LogOut,
  BarChart3,
  Clock,
  Users,
  FileCheck
} from 'lucide-react'
import { formatDate, formatFileSize } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [forms, setForms] = useState<GeneratedForm[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (user) {
      loadUserData()
    }
  }, [user])

  async function loadUserData() {
    try {
      setLoading(true)
      
      // Load documents
      const { data: documentsData, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (docsError) {
        console.error('Error loading documents:', docsError)
      } else {
        setDocuments(documentsData || [])
      }

      // Load forms
      const { data: formsData, error: formsError } = await supabase
        .from('generated_forms')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (formsError) {
        console.error('Error loading forms:', formsError)
      } else {
        setForms(formsData || [])
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(files: FileList) {
    if (!files.length) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Convert file to base64
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const base64Data = await base64Promise

        // Upload via edge function
        const { data, error } = await supabase.functions.invoke('document-upload', {
          body: {
            fileData: base64Data,
            fileName: file.name,
            fileType: file.type
          }
        })

        if (error) {
          throw error
        }

        toast.success(`${file.name} uploaded successfully!`)
      }

      // Reload documents
      await loadUserData()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload file(s)')
    } finally {
      setUploading(false)
    }
  }

  async function analyzeDocument(document: Document) {
    try {
      toast.loading('Analyzing document with AI...', { id: 'ai-analysis' })
      
      const { data, error } = await supabase.functions.invoke('ai-document-analysis', {
        body: {
          documentId: document.id,
          content: document.content || `Document: ${document.filename}`
        }
      })

      if (error) {
        throw error
      }

      toast.success('Document analyzed successfully!', { id: 'ai-analysis' })
      await loadUserData()
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error('Failed to analyze document', { id: 'ai-analysis' })
    }
  }

  const stats = {
    totalDocuments: documents.length,
    processedDocuments: documents.filter(d => d.processing_status === 'completed').length,
    totalForms: forms.length,
    recentActivity: Math.max(documents.length, forms.length)
  }

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Qualia AI Form-Filler Pro
                </h1>
                <p className="text-sm text-gray-600">Enterprise Document Processing</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.user_metadata?.full_name || user?.email}
              </span>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Documents</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Processed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.processedDocuments}</p>
                </div>
                <FileCheck className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Generated Forms</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalForms}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.recentActivity}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="forms">Generated Forms</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="documents" className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload documents for AI analysis and form generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.txt,.csv"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Click to upload files
                    </p>
                    <p className="text-sm text-gray-600">
                      Supports PDF, DOC, DOCX, TXT, CSV files up to 50MB
                    </p>
                  </label>
                  {uploading && (
                    <div className="mt-4">
                      <LoadingSpinner message="Uploading files..." />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Documents</CardTitle>
                <CardDescription>
                  Manage and analyze your uploaded documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No documents uploaded yet</p>
                    <p className="text-sm text-gray-500">Upload your first document to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900">{doc.filename}</p>
                            <p className="text-sm text-gray-600">
                              {formatDate(doc.created_at)} • {formatFileSize(doc.file_size || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            doc.processing_status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : doc.processing_status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {doc.processing_status}
                          </span>
                          {doc.processing_status !== 'completed' && (
                            <Button
                              size="sm"
                              onClick={() => analyzeDocument(doc)}
                              disabled={doc.processing_status === 'processing'}
                            >
                              <Brain className="w-4 h-4 mr-2" />
                              Analyze
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="forms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generated Forms</CardTitle>
                <CardDescription>
                  View and manage your AI-generated forms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {forms.length === 0 ? (
                  <div className="text-center py-8">
                    <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No forms generated yet</p>
                    <p className="text-sm text-gray-500">Process some documents to generate forms</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {forms.map((form) => (
                      <div key={form.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileCheck className="w-8 h-8 text-green-600" />
                          <div>
                            <p className="font-medium text-gray-900">{form.title}</p>
                            <p className="text-sm text-gray-600">
                              {formatDate(form.created_at)} • {form.form_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            form.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {form.status}
                          </span>
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Form Templates</CardTitle>
                <CardDescription>
                  Manage your custom form templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Plus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Template management coming soon</p>
                  <p className="text-sm text-gray-500">Create and customize your own form templates</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}