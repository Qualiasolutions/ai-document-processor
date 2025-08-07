/**
 * AI Service Monitor Edge Function
 * Provides monitoring, health checks, and debugging information for AI services
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import AI providers for health checks
import { MistralOCRProvider } from '../ai-service/providers/mistral-ocr.ts'
import { ClaudeAnalysisProvider } from '../ai-service/providers/claude-analysis.ts'
import { OpenAIFallbackProvider } from '../ai-service/providers/openai-fallback.ts'

interface HealthCheckResult {
  provider: string
  available: boolean
  response_time?: number
  error?: string
  last_check: string
}

interface SystemMetrics {
  uptime: number
  memory_usage?: number
  total_requests: number
  successful_requests: number
  failed_requests: number
  average_response_time: number
  provider_usage: Record<string, number>
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  provider?: string
  message: string
  duration?: number
  error?: string
  metadata?: Record<string, any>
}

class AIServiceMonitor {
  private providers: Array<any> = []
  private startTime: number = Date.now()
  private metrics: SystemMetrics = {
    uptime: 0,
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    average_response_time: 0,
    provider_usage: {}
  }
  private logs: LogEntry[] = []
  private maxLogs = 1000

  constructor() {
    // Initialize providers
    this.providers = [
      new MistralOCRProvider(),
      new ClaudeAnalysisProvider(),
      new OpenAIFallbackProvider()
    ]
    
    this.log('info', 'AI Service Monitor initialized')
  }

  private log(level: LogEntry['level'], message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata
    }
    
    this.logs.unshift(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }
    
    console.log(`[${level.toUpperCase()}] ${message}`, metadata || '')
  }

  async performHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = []
    
    for (const provider of this.providers) {
      const startTime = performance.now()
      
      try {
        const available = await provider.isAvailable()
        const responseTime = performance.now() - startTime
        
        results.push({
          provider: provider.name,
          available,
          response_time: Math.round(responseTime),
          last_check: new Date().toISOString()
        })
        
        this.log('debug', `Health check completed for ${provider.name}`, {
          available,
          response_time: Math.round(responseTime)
        })
        
      } catch (error) {
        const responseTime = performance.now() - startTime
        
        results.push({
          provider: provider.name,
          available: false,
          response_time: Math.round(responseTime),
          error: error.message,
          last_check: new Date().toISOString()
        })
        
        this.log('error', `Health check failed for ${provider.name}`, {
          error: error.message,
          response_time: Math.round(responseTime)
        })
      }
    }
    
    return results
  }

  async performEndToEndTest(): Promise<Record<string, any>> {
    const testResults: Record<string, any> = {}
    
    // Test OCR capability
    try {
      const ocrStartTime = performance.now()
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      
      for (const provider of this.providers.filter(p => p.name.includes('ocr') || p.name.includes('openai'))) {
        try {
          const result = await provider.extractTextFromImage(testImage)
          const duration = performance.now() - ocrStartTime
          
          testResults[`${provider.name}_ocr`] = {
            success: true,
            duration: Math.round(duration),
            result_length: result.text?.length || 0
          }
        } catch (error) {
          testResults[`${provider.name}_ocr`] = {
            success: false,
            error: error.message
          }
        }
      }
    } catch (error) {
      this.log('error', 'OCR end-to-end test failed', { error: error.message })
    }
    
    // Test analysis capability
    try {
      const analysisStartTime = performance.now()
      const testText = 'John Smith, Passport Number: P123456789, Date of Birth: 1990-05-15'
      
      for (const provider of this.providers) {
        try {
          const result = await provider.analyzeDocument(testText)
          const duration = performance.now() - analysisStartTime
          
          testResults[`${provider.name}_analysis`] = {
            success: true,
            duration: Math.round(duration),
            document_type: result.document_type,
            confidence: result.confidence
          }
        } catch (error) {
          testResults[`${provider.name}_analysis`] = {
            success: false,
            error: error.message
          }
        }
      }
    } catch (error) {
      this.log('error', 'Analysis end-to-end test failed', { error: error.message })
    }
    
    return testResults
  }

  getSystemMetrics(): SystemMetrics {
    this.metrics.uptime = Date.now() - this.startTime
    return { ...this.metrics }
  }

  updateMetrics(success: boolean, responseTime: number, provider?: string) {
    this.metrics.total_requests++
    
    if (success) {
      this.metrics.successful_requests++
    } else {
      this.metrics.failed_requests++
    }
    
    // Update average response time
    const totalTime = this.metrics.average_response_time * (this.metrics.total_requests - 1) + responseTime
    this.metrics.average_response_time = Math.round(totalTime / this.metrics.total_requests)
    
    // Update provider usage
    if (provider) {
      this.metrics.provider_usage[provider] = (this.metrics.provider_usage[provider] || 0) + 1
    }
  }

  getLogs(level?: string, limit = 100): LogEntry[] {
    let filteredLogs = this.logs
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level)
    }
    
    return filteredLogs.slice(0, limit)
  }

  async getDatabaseMetrics(): Promise<Record<string, any>> {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Get document processing stats
      const { data: docStats, error: docError } = await supabase
        .from('documents')
        .select('status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

      if (docError) throw docError

      // Get processing job stats
      const { data: jobStats, error: jobError } = await supabase
        .from('processing_jobs')
        .select('status, processing_time_ms, provider_used, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (jobError) throw jobError

      return {
        documents_24h: docStats?.length || 0,
        completed_jobs_24h: jobStats?.filter(j => j.status === 'completed').length || 0,
        failed_jobs_24h: jobStats?.filter(j => j.status === 'failed').length || 0,
        average_processing_time: jobStats?.reduce((sum, j) => sum + (j.processing_time_ms || 0), 0) / (jobStats?.length || 1),
        provider_distribution: jobStats?.reduce((acc, j) => {
          if (j.provider_used) {
            acc[j.provider_used] = (acc[j.provider_used] || 0) + 1
          }
          return acc
        }, {} as Record<string, number>)
      }
    } catch (error) {
      this.log('error', 'Failed to get database metrics', { error: error.message })
      return {
        error: 'Database metrics unavailable',
        reason: error.message
      }
    }
  }

  async generateReport(): Promise<Record<string, any>> {
    const healthCheck = await this.performHealthCheck()
    const systemMetrics = this.getSystemMetrics()
    const databaseMetrics = await this.getDatabaseMetrics()
    
    return {
      timestamp: new Date().toISOString(),
      health_check: healthCheck,
      system_metrics: systemMetrics,
      database_metrics: databaseMetrics,
      environment: {
        deno_version: Deno.version.deno,
        typescript_version: Deno.version.typescript,
        v8_version: Deno.version.v8
      },
      recommendations: this.generateRecommendations(healthCheck, systemMetrics)
    }
  }

  private generateRecommendations(healthCheck: HealthCheckResult[], metrics: SystemMetrics): string[] {
    const recommendations: string[] = []
    
    // Check provider availability
    const unavailableProviders = healthCheck.filter(p => !p.available)
    if (unavailableProviders.length > 0) {
      recommendations.push(`${unavailableProviders.length} provider(s) unavailable: ${unavailableProviders.map(p => p.provider).join(', ')}`)
    }
    
    // Check response times
    const slowProviders = healthCheck.filter(p => p.response_time && p.response_time > 3000)
    if (slowProviders.length > 0) {
      recommendations.push(`Slow response times detected: ${slowProviders.map(p => p.provider).join(', ')}`)
    }
    
    // Check error rate
    const errorRate = metrics.total_requests > 0 ? (metrics.failed_requests / metrics.total_requests) * 100 : 0
    if (errorRate > 10) {
      recommendations.push(`High error rate: ${errorRate.toFixed(1)}% - investigate recent failures`)
    }
    
    // Check average response time
    if (metrics.average_response_time > 5000) {
      recommendations.push(`Average response time is high: ${metrics.average_response_time}ms - consider optimization`)
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All systems operating normally')
    }
    
    return recommendations
  }
}

// Global monitor instance
const monitor = new AIServiceMonitor()

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'status'

    let result: any

    switch (action) {
      case 'health':
        result = await monitor.performHealthCheck()
        break
        
      case 'test':
        result = await monitor.performEndToEndTest()
        break
        
      case 'metrics':
        result = monitor.getSystemMetrics()
        break
        
      case 'logs':
        const level = url.searchParams.get('level')
        const limit = parseInt(url.searchParams.get('limit') || '100')
        result = monitor.getLogs(level || undefined, limit)
        break
        
      case 'database':
        result = await monitor.getDatabaseMetrics()
        break
        
      case 'report':
        result = await monitor.generateReport()
        break
        
      case 'status':
      default:
        result = {
          status: 'operational',
          timestamp: new Date().toISOString(),
          uptime: Date.now() - monitor['startTime'],
          providers: await monitor.performHealthCheck(),
          quick_metrics: monitor.getSystemMetrics()
        }
        break
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    console.error('Monitor error:', error)
    
    return new Response(JSON.stringify({
      error: 'Monitor request failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
})