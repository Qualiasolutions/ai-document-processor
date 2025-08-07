import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle, Clock, RefreshCw, Download, Trash2 } from 'lucide-react'
import { aiService } from '@/lib/aiService'

interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: any
  duration?: number
}

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  status: 'good' | 'warning' | 'error'
  trend?: 'up' | 'down' | 'stable'
}

interface ProviderStatus {
  name: string
  available: boolean
  response_time?: number
  error?: string
  last_used?: Date
  success_rate?: number
}

export const DebugDashboard: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Initialize monitoring
  useEffect(() => {
    initializeMonitoring()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && isMonitoring) {
      intervalRef.current = setInterval(() => {
        refreshStatus()
      }, refreshInterval)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, isMonitoring, refreshInterval])

  const initializeMonitoring = async () => {
    try {
      setIsMonitoring(true)
      await refreshStatus()
      addLog('info', 'Debug dashboard initialized')
    } catch (error) {
      addLog('error', 'Failed to initialize monitoring', { error: error.message })
    }
  }

  const refreshStatus = async () => {
    const startTime = performance.now()
    
    try {
      // Get service status
      const status = await aiService.getServiceStatus()
      const duration = performance.now() - startTime

      // Update provider status
      const providers = Object.entries(status.providers).map(([name, info]: [string, any]) => ({
        name,
        available: info.available,
        response_time: info.response_time,
        error: info.error,
        last_used: info.last_used ? new Date(info.last_used) : undefined,
        success_rate: info.success_rate || 0
      }))
      
      setProviderStatus(providers)

      // Update performance metrics
      const metrics: PerformanceMetric[] = [
        {
          name: 'API Response Time',
          value: Math.round(duration),
          unit: 'ms',
          status: duration < 1000 ? 'good' : duration < 3000 ? 'warning' : 'error'
        },
        {
          name: 'Available Providers',
          value: providers.filter(p => p.available).length,
          unit: 'count',
          status: providers.filter(p => p.available).length > 1 ? 'good' : 'warning'
        },
        {
          name: 'Average Success Rate',
          value: Math.round(providers.reduce((sum, p) => sum + (p.success_rate || 0), 0) / providers.length),
          unit: '%',
          status: providers.reduce((sum, p) => sum + (p.success_rate || 0), 0) / providers.length > 90 ? 'good' : 'warning'
        }
      ]
      
      setPerformanceMetrics(metrics)
      addLog('debug', 'Status refreshed', { duration: Math.round(duration), providers: providers.length })

    } catch (error) {
      addLog('error', 'Failed to refresh status', { error: error.message })
      setPerformanceMetrics(prev => prev.map(m => ({ ...m, status: 'error' as const })))
    }
  }

  const addLog = (level: LogEntry['level'], message: string, data?: any, duration?: number) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      message,
      data,
      duration
    }
    
    setLogs(prev => [newLog, ...prev].slice(0, 1000)) // Keep last 1000 logs
  }

  const testProvider = async (providerName: string) => {
    const startTime = performance.now()
    addLog('info', `Testing provider: ${providerName}`)
    
    try {
      if (providerName.includes('ocr')) {
        // Test OCR capability
        await aiService.extractTextFromImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
      } else {
        // Test analysis capability
        await aiService.analyzeDocument('Test document for provider testing')
      }
      
      const duration = performance.now() - startTime
      addLog('info', `Provider ${providerName} test successful`, { duration: Math.round(duration) }, duration)
      
    } catch (error) {
      const duration = performance.now() - startTime
      addLog('error', `Provider ${providerName} test failed`, { error: error.message, duration: Math.round(duration) }, duration)
    }
  }

  const clearLogs = () => {
    setLogs([])
    addLog('info', 'Logs cleared')
  }

  const exportLogs = () => {
    const logData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      data: log.data,
      duration: log.duration
    }))
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-logs-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    addLog('info', 'Logs exported')
  }

  const getStatusIcon = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'warn': return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'debug': return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Debug Dashboard</h1>
          <p className="text-muted-foreground">AI Service Monitoring & Debugging Tools</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={!isMonitoring}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {performanceMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              {getStatusIcon(metric.status)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.value} {metric.unit}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Status</CardTitle>
              <CardDescription>
                Current status and health of all AI service providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {providerStatus.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {provider.available ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        <h3 className="font-medium">{provider.name}</h3>
                      </div>
                      
                      <Badge variant={provider.available ? "default" : "destructive"}>
                        {provider.available ? "Available" : "Unavailable"}
                      </Badge>
                      
                      {provider.response_time && (
                        <Badge variant="outline">
                          {provider.response_time}ms
                        </Badge>
                      )}
                      
                      {provider.success_rate !== undefined && (
                        <Badge variant="outline">
                          {provider.success_rate}% success
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testProvider(provider.name)}
                      >
                        Test
                      </Button>
                      
                      {provider.error && (
                        <Badge variant="destructive" className="max-w-xs truncate">
                          {provider.error}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Debug Logs</CardTitle>
                  <CardDescription>
                    Real-time logs from AI service operations ({logs.length} entries)
                  </CardDescription>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportLogs}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearLogs}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    {getLogIcon(log.level)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{log.message}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.level}
                        </Badge>
                        {log.duration && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(log.duration)}ms
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {log.timestamp.toLocaleTimeString()}
                      </div>
                      {log.data && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-muted-foreground">
                            Show details
                          </summary>
                          <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                
                {logs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No logs available. Start using the AI service to see logs here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Monitoring</CardTitle>
              <CardDescription>
                Real-time performance metrics and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {performanceMetrics.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">{metric.name}</h3>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(metric.status)}
                        <span className="text-sm">
                          {metric.value} {metric.unit}
                        </span>
                      </div>
                    </div>
                    
                    <Progress 
                      value={metric.status === 'good' ? 100 : metric.status === 'warning' ? 60 : 30}
                      className="h-2"
                    />
                  </div>
                ))}
                
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-2">System Information</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>User Agent: {navigator.userAgent}</div>
                    <div>Online: {navigator.onLine ? 'Yes' : 'No'}</div>
                    <div>Connection: {(navigator as any).connection?.effectiveType || 'Unknown'}</div>
                    <div>Memory: {(performance as any).memory ? 
                      `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB used` : 
                      'Not available'
                    }</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DebugDashboard