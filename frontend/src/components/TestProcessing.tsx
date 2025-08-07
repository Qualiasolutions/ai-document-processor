import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TestProcessing() {
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function runTest() {
    setLoading(true)
    try {
      // Test the environment
      const { data, error } = await supabase.functions.invoke('test-processing')
      
      if (error) {
        setTestResult({ error: error.message })
      } else {
        setTestResult(data)
      }
    } catch (err: any) {
      setTestResult({ error: err.message })
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Environment</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={runTest} disabled={loading}>
          {loading ? 'Testing...' : 'Run Environment Test'}
        </Button>
        
        {testResult && (
          <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto text-xs">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}