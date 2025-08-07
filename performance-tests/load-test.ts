#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/**
 * Performance and Load Testing Suite
 * Tests AI service performance under various load conditions
 * Run: deno run --allow-net --allow-read --allow-write performance-tests/load-test.ts
 */

interface TestConfig {
  baseUrl: string
  concurrentUsers: number
  testDuration: number // seconds
  rampUpTime: number // seconds
  scenarios: TestScenario[]
}

interface TestScenario {
  name: string
  weight: number // percentage of traffic
  endpoint: string
  method: 'GET' | 'POST'
  payload?: any
  expectedResponseTime: number // ms
  expectedSuccessRate: number // percentage
}

interface TestResult {
  scenario: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  successRate: number
  errorsPerSecond: number
  requestsPerSecond: number
  errors: Array<{ message: string; count: number }>
}

interface LoadTestReport {
  testConfig: TestConfig
  startTime: string
  endTime: string
  duration: number
  totalRequests: number
  overallSuccessRate: number
  averageResponseTime: number
  peakRPS: number
  results: TestResult[]
  recommendations: string[]
}

class LoadTester {
  private config: TestConfig
  private results: Map<string, TestResult> = new Map()
  private responseTimes: Map<string, number[]> = new Map()
  private errors: Map<string, Map<string, number>> = new Map()
  private requestCounts: Map<string, number> = new Map()
  private startTime: number = 0
  private isRunning: boolean = false

  constructor(config: TestConfig) {
    this.config = config
    this.initializeResults()
  }

  private initializeResults() {
    for (const scenario of this.config.scenarios) {
      this.results.set(scenario.name, {
        scenario: scenario.name,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        successRate: 0,
        errorsPerSecond: 0,
        requestsPerSecond: 0,
        errors: []
      })
      
      this.responseTimes.set(scenario.name, [])
      this.errors.set(scenario.name, new Map())
      this.requestCounts.set(scenario.name, 0)
    }
  }

  async runLoadTest(): Promise<LoadTestReport> {
    console.log('🚀 Starting load test...')
    console.log(`Configuration:`)
    console.log(`  - Concurrent Users: ${this.config.concurrentUsers}`)
    console.log(`  - Test Duration: ${this.config.testDuration}s`)
    console.log(`  - Ramp-up Time: ${this.config.rampUpTime}s`)
    console.log(`  - Scenarios: ${this.config.scenarios.length}`)
    console.log()

    this.startTime = Date.now()
    this.isRunning = true

    // Start user simulation
    const userPromises: Promise<void>[] = []
    
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const delay = (i / this.config.concurrentUsers) * this.config.rampUpTime * 1000
      userPromises.push(this.simulateUser(delay))
    }

    // Start progress reporting
    const progressInterval = setInterval(() => {
      this.reportProgress()
    }, 5000)

    // Stop test after duration
    setTimeout(() => {
      this.isRunning = false
      clearInterval(progressInterval)
      console.log('\n⏰ Test duration reached, stopping...')
    }, this.config.testDuration * 1000)

    // Wait for all users to complete
    await Promise.all(userPromises)

    const endTime = Date.now()
    const report = this.generateReport(endTime)
    
    console.log('\n✅ Load test completed!')
    this.printReport(report)
    
    return report
  }

  private async simulateUser(initialDelay: number) {
    // Initial delay for ramp-up
    if (initialDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, initialDelay))
    }

    while (this.isRunning) {
      try {
        // Select scenario based on weight
        const scenario = this.selectScenario()
        await this.executeScenario(scenario)
        
        // Random think time between requests (1-3 seconds)
        const thinkTime = 1000 + Math.random() * 2000
        await new Promise(resolve => setTimeout(resolve, thinkTime))
        
      } catch (error) {
        console.error('User simulation error:', error)
      }
    }
  }

  private selectScenario(): TestScenario {
    const random = Math.random() * 100
    let cumulativeWeight = 0
    
    for (const scenario of this.config.scenarios) {
      cumulativeWeight += scenario.weight
      if (random <= cumulativeWeight) {
        return scenario
      }
    }
    
    // Fallback to first scenario
    return this.config.scenarios[0]
  }

  private async executeScenario(scenario: TestScenario) {
    const startTime = performance.now()
    
    try {
      const response = await fetch(`${this.config.baseUrl}${scenario.endpoint}`, {
        method: scenario.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: scenario.payload ? JSON.stringify(scenario.payload) : undefined,
      })

      const endTime = performance.now()
      const responseTime = endTime - startTime

      // Update metrics
      this.updateMetrics(scenario.name, response.ok, responseTime, response.status)

      if (!response.ok) {
        this.recordError(scenario.name, `HTTP ${response.status}: ${response.statusText}`)
      }

    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime
      
      this.updateMetrics(scenario.name, false, responseTime)
      this.recordError(scenario.name, error.message)
    }
  }

  private updateMetrics(scenarioName: string, success: boolean, responseTime: number, statusCode?: number) {
    const result = this.results.get(scenarioName)!
    const responseTimes = this.responseTimes.get(scenarioName)!
    
    result.totalRequests++
    
    if (success) {
      result.successfulRequests++
    } else {
      result.failedRequests++
    }
    
    responseTimes.push(responseTime)
    
    result.minResponseTime = Math.min(result.minResponseTime, responseTime)
    result.maxResponseTime = Math.max(result.maxResponseTime, responseTime)
    
    // Update request count for RPS calculation
    this.requestCounts.set(scenarioName, (this.requestCounts.get(scenarioName) || 0) + 1)
  }

  private recordError(scenarioName: string, errorMessage: string) {
    const errorMap = this.errors.get(scenarioName)!
    errorMap.set(errorMessage, (errorMap.get(errorMessage) || 0) + 1)
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  private reportProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000
    const totalRequests = Array.from(this.results.values()).reduce((sum, r) => sum + r.totalRequests, 0)
    const totalSuccessful = Array.from(this.results.values()).reduce((sum, r) => sum + r.successfulRequests, 0)
    const currentRPS = totalRequests / elapsed
    const successRate = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0
    
    console.log(`⏱️  Progress: ${elapsed.toFixed(0)}s | RPS: ${currentRPS.toFixed(1)} | Success: ${successRate.toFixed(1)}% | Total: ${totalRequests}`)
  }

  private generateReport(endTime: number): LoadTestReport {
    const duration = (endTime - this.startTime) / 1000
    
    // Calculate final metrics for each scenario
    for (const [scenarioName, result] of this.results.entries()) {
      const responseTimes = this.responseTimes.get(scenarioName)!
      const errorMap = this.errors.get(scenarioName)!
      
      if (result.totalRequests > 0) {
        result.averageResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
        result.p95ResponseTime = this.calculatePercentile(responseTimes, 95)
        result.successRate = (result.successfulRequests / result.totalRequests) * 100
        result.requestsPerSecond = result.totalRequests / duration
        result.errorsPerSecond = result.failedRequests / duration
        result.errors = Array.from(errorMap.entries()).map(([message, count]) => ({ message, count }))
      }
    }
    
    const totalRequests = Array.from(this.results.values()).reduce((sum, r) => sum + r.totalRequests, 0)
    const totalSuccessful = Array.from(this.results.values()).reduce((sum, r) => sum + r.successfulRequests, 0)
    const allResponseTimes = Array.from(this.responseTimes.values()).flat()
    
    return {
      testConfig: this.config,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      totalRequests,
      overallSuccessRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
      averageResponseTime: allResponseTimes.length > 0 ? allResponseTimes.reduce((sum, rt) => sum + rt, 0) / allResponseTimes.length : 0,
      peakRPS: totalRequests / duration,
      results: Array.from(this.results.values()),
      recommendations: this.generateRecommendations()
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    for (const result of this.results.values()) {
      const scenario = this.config.scenarios.find(s => s.name === result.scenario)!
      
      // Check success rate
      if (result.successRate < scenario.expectedSuccessRate) {
        recommendations.push(`${result.scenario}: Success rate ${result.successRate.toFixed(1)}% below expected ${scenario.expectedSuccessRate}%`)
      }
      
      // Check response time
      if (result.averageResponseTime > scenario.expectedResponseTime) {
        recommendations.push(`${result.scenario}: Response time ${result.averageResponseTime.toFixed(0)}ms exceeds expected ${scenario.expectedResponseTime}ms`)
      }
      
      // Check for high error rate
      if (result.successRate < 95) {
        recommendations.push(`${result.scenario}: High error rate detected - investigate service stability`)
      }
      
      // Check for slow responses
      if (result.p95ResponseTime > scenario.expectedResponseTime * 2) {
        recommendations.push(`${result.scenario}: P95 response time ${result.p95ResponseTime.toFixed(0)}ms indicates performance bottlenecks`)
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All performance metrics within expected ranges')
    }
    
    return recommendations
  }

  private printReport(report: LoadTestReport) {
    console.log('\n' + '='.repeat(80))
    console.log('📊 LOAD TEST REPORT')
    console.log('='.repeat(80))
    
    console.log(`Duration: ${report.duration.toFixed(2)}s`)
    console.log(`Total Requests: ${report.totalRequests}`)
    console.log(`Overall Success Rate: ${report.overallSuccessRate.toFixed(2)}%`)
    console.log(`Average Response Time: ${report.averageResponseTime.toFixed(2)}ms`)
    console.log(`Peak RPS: ${report.peakRPS.toFixed(2)}`)
    console.log()
    
    console.log('📈 SCENARIO RESULTS:')
    console.log('-'.repeat(80))
    
    for (const result of report.results) {
      console.log(`\n${result.scenario}:`)
      console.log(`  Requests: ${result.totalRequests} (${result.successfulRequests} success, ${result.failedRequests} failed)`)
      console.log(`  Success Rate: ${result.successRate.toFixed(2)}%`)
      console.log(`  Response Time: avg=${result.averageResponseTime.toFixed(2)}ms, min=${result.minResponseTime.toFixed(2)}ms, max=${result.maxResponseTime.toFixed(2)}ms, p95=${result.p95ResponseTime.toFixed(2)}ms`)
      console.log(`  Throughput: ${result.requestsPerSecond.toFixed(2)} RPS`)
      
      if (result.errors.length > 0) {
        console.log(`  Top Errors:`)
        result.errors.slice(0, 3).forEach(error => {
          console.log(`    - ${error.message} (${error.count} times)`)
        })
      }
    }
    
    console.log('\n🎯 RECOMMENDATIONS:')
    console.log('-'.repeat(80))
    report.recommendations.forEach(rec => console.log(`• ${rec}`))
    
    console.log('\n' + '='.repeat(80))
  }

  async saveReport(report: LoadTestReport, filename?: string) {
    const reportFilename = filename || `load-test-report-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`
    
    try {
      await Deno.writeTextFile(reportFilename, JSON.stringify(report, null, 2))
      console.log(`\n💾 Report saved to: ${reportFilename}`)
    } catch (error) {
      console.error('Failed to save report:', error)
    }
  }
}

// Test configurations
const TEST_CONFIGS = {
  light: {
    baseUrl: 'https://qfldqwfpbabeonvryaof.supabase.co/functions/v1',
    concurrentUsers: 5,
    testDuration: 60, // 1 minute
    rampUpTime: 10,   // 10 seconds
    scenarios: [
      {
        name: 'service_status',
        weight: 30,
        endpoint: '/ai-service',
        method: 'POST' as const,
        payload: { action: 'status' },
        expectedResponseTime: 1000,
        expectedSuccessRate: 99
      },
      {
        name: 'document_analysis',
        weight: 50,
        endpoint: '/ai-service',
        method: 'POST' as const,
        payload: {
          action: 'analyze_document',
          text: 'John Smith, Passport Number: P123456789, Date of Birth: 1990-05-15, Nationality: USA'
        },
        expectedResponseTime: 3000,
        expectedSuccessRate: 95
      },
      {
        name: 'ocr_extraction',
        weight: 20,
        endpoint: '/ai-service',
        method: 'POST' as const,
        payload: {
          action: 'extract_text',
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        },
        expectedResponseTime: 5000,
        expectedSuccessRate: 90
      }
    ]
  },
  
  moderate: {
    baseUrl: 'https://qfldqwfpbabeonvryaof.supabase.co/functions/v1',
    concurrentUsers: 20,
    testDuration: 300, // 5 minutes
    rampUpTime: 30,    // 30 seconds
    scenarios: [
      {
        name: 'service_status',
        weight: 20,
        endpoint: '/ai-service',
        method: 'POST' as const,
        payload: { action: 'status' },
        expectedResponseTime: 1000,
        expectedSuccessRate: 99
      },
      {
        name: 'document_analysis',
        weight: 60,
        endpoint: '/ai-service',
        method: 'POST' as const,
        payload: {
          action: 'analyze_document',
          text: 'John Smith, Passport Number: P123456789, Date of Birth: 1990-05-15, Nationality: USA, Address: 123 Main St, New York, NY 10001'
        },
        expectedResponseTime: 4000,
        expectedSuccessRate: 95
      },
      {
        name: 'document_upload',
        weight: 20,
        endpoint: '/document-upload-enhanced',
        method: 'POST' as const,
        payload: {
          fileData: 'data:text/plain;base64,' + btoa('Test document content for load testing'),
          fileName: 'load-test.txt',
          fileType: 'text/plain'
        },
        expectedResponseTime: 6000,
        expectedSuccessRate: 90
      }
    ]
  },
  
  stress: {
    baseUrl: 'https://qfldqwfpbabeonvryaof.supabase.co/functions/v1',
    concurrentUsers: 50,
    testDuration: 600, // 10 minutes
    rampUpTime: 60,    // 1 minute
    scenarios: [
      {
        name: 'high_volume_analysis',
        weight: 80,
        endpoint: '/ai-service',
        method: 'POST' as const,
        payload: {
          action: 'analyze_document',
          text: 'Large document content for stress testing. '.repeat(100) // Large payload
        },
        expectedResponseTime: 8000,
        expectedSuccessRate: 85
      },
      {
        name: 'concurrent_uploads',
        weight: 20,
        endpoint: '/document-upload-enhanced',
        method: 'POST' as const,
        payload: {
          fileData: 'data:text/plain;base64,' + btoa('Stress test document content. '.repeat(500)),
          fileName: 'stress-test.txt',
          fileType: 'text/plain'
        },
        expectedResponseTime: 12000,
        expectedSuccessRate: 80
      }
    ]
  }
}

// Main execution
if (import.meta.main) {
  const testType = Deno.args[0] || 'light'
  
  if (!TEST_CONFIGS[testType as keyof typeof TEST_CONFIGS]) {
    console.error(`Invalid test type: ${testType}`)
    console.log('Available test types: light, moderate, stress')
    Deno.exit(1)
  }
  
  const config = TEST_CONFIGS[testType as keyof typeof TEST_CONFIGS]
  const tester = new LoadTester(config)
  
  try {
    const report = await tester.runLoadTest()
    await tester.saveReport(report)
  } catch (error) {
    console.error('Load test failed:', error)
    Deno.exit(1)
  }
}