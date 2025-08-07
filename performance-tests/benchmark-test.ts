#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/**
 * AI Provider Benchmark Test Suite
 * Compares performance and accuracy of different AI providers
 * Run: deno run --allow-net --allow-read --allow-write performance-tests/benchmark-test.ts
 */

interface BenchmarkConfig {
  baseUrl: string
  iterations: number
  warmupRuns: number
  testDatasets: TestDataset[]
}

interface TestDataset {
  name: string
  type: 'text' | 'image'
  data: string
  expectedResult: {
    document_type?: string
    confidence_threshold?: number
    key_fields?: string[]
  }
}

interface ProviderResult {
  provider: string
  success: boolean
  response_time: number
  result?: any
  error?: string
}

interface BenchmarkResult {
  dataset: string
  providers: ProviderResult[]
  fastest_provider: string
  most_accurate_provider: string
  average_response_time: number
  success_rate: number
}

interface BenchmarkReport {
  config: BenchmarkConfig
  start_time: string
  end_time: string
  total_tests: number
  results: BenchmarkResult[]
  provider_rankings: {
    by_speed: Array<{ provider: string; avg_response_time: number }>
    by_accuracy: Array<{ provider: string; accuracy_score: number }>
    by_reliability: Array<{ provider: string; success_rate: number }>
  }
  recommendations: string[]
}

class AIProviderBenchmark {
  private config: BenchmarkConfig
  private allResults: Map<string, ProviderResult[]> = new Map()

  constructor(config: BenchmarkConfig) {
    this.config = config
  }

  async runBenchmark(): Promise<BenchmarkReport> {
    console.log('🏁 Starting AI Provider Benchmark...')
    console.log(`Configuration:`)
    console.log(`  - Iterations per test: ${this.config.iterations}`)
    console.log(`  - Warmup runs: ${this.config.warmupRuns}`)
    console.log(`  - Test datasets: ${this.config.testDatasets.length}`)
    console.log()

    const startTime = Date.now()

    // Run warmup
    await this.runWarmup()

    // Run benchmark tests
    const results: BenchmarkResult[] = []
    
    for (const dataset of this.config.testDatasets) {
      console.log(`\n📊 Testing dataset: ${dataset.name}`)
      const result = await this.benchmarkDataset(dataset)
      results.push(result)
      this.printDatasetResult(result)
    }

    const endTime = Date.now()
    const report = this.generateReport(results, startTime, endTime)
    
    console.log('\n✅ Benchmark completed!')
    this.printSummaryReport(report)
    
    return report
  }

  private async runWarmup() {
    console.log('🔥 Running warmup...')
    
    const warmupDataset = this.config.testDatasets[0]
    
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await this.testAllProviders(warmupDataset, false) // Don't record results
      process.stdout.write(`\r  Warmup ${i + 1}/${this.config.warmupRuns}`)
    }
    
    console.log('\n✅ Warmup completed')
  }

  private async benchmarkDataset(dataset: TestDataset): Promise<BenchmarkResult> {
    const datasetResults: ProviderResult[] = []
    
    for (let iteration = 1; iteration <= this.config.iterations; iteration++) {
      process.stdout.write(`\r  Iteration ${iteration}/${this.config.iterations}`)
      
      const iterationResults = await this.testAllProviders(dataset, true)
      datasetResults.push(...iterationResults)
      
      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log() // New line after progress
    
    return this.analyzeDatasetResults(dataset.name, datasetResults)
  }

  private async testAllProviders(dataset: TestDataset, recordResults: boolean): Promise<ProviderResult[]> {
    const providers = ['mistral-ocr', 'claude-analysis', 'openai-fallback']
    const results: ProviderResult[] = []

    // Test each provider
    for (const provider of providers) {
      const result = await this.testProvider(provider, dataset)
      results.push(result)
      
      if (recordResults) {
        const datasetResults = this.allResults.get(dataset.name) || []
        datasetResults.push(result)
        this.allResults.set(dataset.name, datasetResults)
      }
      
      // Brief pause between provider tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return results
  }

  private async testProvider(provider: string, dataset: TestDataset): Promise<ProviderResult> {
    const startTime = performance.now()
    
    try {
      let endpoint: string
      let payload: any

      if (dataset.type === 'text') {
        endpoint = '/ai-service'
        payload = {
          action: 'analyze_document',
          text: dataset.data,
          preferred_provider: provider
        }
      } else if (dataset.type === 'image') {
        endpoint = '/ai-service'
        payload = {
          action: 'extract_text',
          imageData: dataset.data,
          preferred_provider: provider
        }
      } else {
        throw new Error(`Unsupported dataset type: ${dataset.type}`)
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const responseTime = performance.now() - startTime

      if (!response.ok) {
        return {
          provider,
          success: false,
          response_time: responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const result = await response.json()

      return {
        provider,
        success: true,
        response_time: responseTime,
        result
      }

    } catch (error) {
      const responseTime = performance.now() - startTime
      
      return {
        provider,
        success: false,
        response_time: responseTime,
        error: error.message
      }
    }
  }

  private analyzeDatasetResults(datasetName: string, results: ProviderResult[]): BenchmarkResult {
    // Group results by provider
    const providerGroups = new Map<string, ProviderResult[]>()
    
    for (const result of results) {
      const group = providerGroups.get(result.provider) || []
      group.push(result)
      providerGroups.set(result.provider, group)
    }

    // Calculate aggregated results for each provider
    const providerSummaries: ProviderResult[] = []
    
    for (const [provider, providerResults] of providerGroups.entries()) {
      const successfulResults = providerResults.filter(r => r.success)
      const avgResponseTime = providerResults.reduce((sum, r) => sum + r.response_time, 0) / providerResults.length
      const successRate = (successfulResults.length / providerResults.length) * 100

      providerSummaries.push({
        provider,
        success: successfulResults.length > 0,
        response_time: avgResponseTime,
        result: {
          success_rate: successRate,
          avg_response_time: avgResponseTime,
          total_tests: providerResults.length,
          successful_tests: successfulResults.length
        }
      })
    }

    // Find fastest and most accurate providers
    const successfulProviders = providerSummaries.filter(p => p.success)
    const fastestProvider = successfulProviders.reduce((fastest, current) => 
      current.response_time < fastest.response_time ? current : fastest
    ).provider

    // For accuracy, we'll use success rate as a proxy (could be enhanced with actual accuracy scoring)
    const mostAccurateProvider = successfulProviders.reduce((accurate, current) => 
      current.result.success_rate > accurate.result.success_rate ? current : accurate
    ).provider

    const avgResponseTime = providerSummaries.reduce((sum, p) => sum + p.response_time, 0) / providerSummaries.length
    const overallSuccessRate = providerSummaries.reduce((sum, p) => sum + p.result.success_rate, 0) / providerSummaries.length

    return {
      dataset: datasetName,
      providers: providerSummaries,
      fastest_provider: fastestProvider,
      most_accurate_provider: mostAccurateProvider,
      average_response_time: avgResponseTime,
      success_rate: overallSuccessRate
    }
  }

  private generateReport(results: BenchmarkResult[], startTime: number, endTime: number): BenchmarkReport {
    // Calculate provider rankings
    const providerStats = new Map<string, { 
      total_response_time: number, 
      total_tests: number, 
      successful_tests: number,
      accuracy_scores: number[] 
    }>()

    // Aggregate stats across all datasets
    for (const result of results) {
      for (const provider of result.providers) {
        const stats = providerStats.get(provider.provider) || {
          total_response_time: 0,
          total_tests: 0,
          successful_tests: 0,
          accuracy_scores: []
        }

        stats.total_response_time += provider.response_time
        stats.total_tests += provider.result.total_tests
        stats.successful_tests += provider.result.successful_tests
        stats.accuracy_scores.push(provider.result.success_rate)

        providerStats.set(provider.provider, stats)
      }
    }

    // Calculate rankings
    const bySpeed = Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      avg_response_time: stats.total_response_time / results.length
    })).sort((a, b) => a.avg_response_time - b.avg_response_time)

    const byAccuracy = Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      accuracy_score: stats.accuracy_scores.reduce((sum, score) => sum + score, 0) / stats.accuracy_scores.length
    })).sort((a, b) => b.accuracy_score - a.accuracy_score)

    const byReliability = Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      success_rate: (stats.successful_tests / stats.total_tests) * 100
    })).sort((a, b) => b.success_rate - a.success_rate)

    return {
      config: this.config,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      total_tests: results.reduce((sum, r) => sum + r.providers.reduce((pSum, p) => pSum + p.result.total_tests, 0), 0),
      results,
      provider_rankings: {
        by_speed: bySpeed,
        by_accuracy: byAccuracy,
        by_reliability: byReliability
      },
      recommendations: this.generateRecommendations(bySpeed, byAccuracy, byReliability)
    }
  }

  private generateRecommendations(
    bySpeed: Array<{ provider: string; avg_response_time: number }>,
    byAccuracy: Array<{ provider: string; accuracy_score: number }>,
    byReliability: Array<{ provider: string; success_rate: number }>
  ): string[] {
    const recommendations: string[] = []

    // Speed recommendations
    const fastestProvider = bySpeed[0]
    const slowestProvider = bySpeed[bySpeed.length - 1]
    
    if (slowestProvider.avg_response_time > fastestProvider.avg_response_time * 2) {
      recommendations.push(`Consider optimizing ${slowestProvider.provider} - it's ${(slowestProvider.avg_response_time / fastestProvider.avg_response_time).toFixed(1)}x slower than ${fastestProvider.provider}`)
    }

    // Accuracy recommendations
    const mostAccurate = byAccuracy[0]
    const leastAccurate = byAccuracy[byAccuracy.length - 1]
    
    if (leastAccurate.accuracy_score < 90) {
      recommendations.push(`${leastAccurate.provider} has low accuracy (${leastAccurate.accuracy_score.toFixed(1)}%) - investigate or consider removing from rotation`)
    }

    // Reliability recommendations
    const mostReliable = byReliability[0]
    const leastReliable = byReliability[byReliability.length - 1]
    
    if (leastReliable.success_rate < 95) {
      recommendations.push(`${leastReliable.provider} has reliability issues (${leastReliable.success_rate.toFixed(1)}% success rate) - check API keys and service status`)
    }

    // Overall recommendations
    if (fastestProvider.provider === mostAccurate.provider && fastestProvider.provider === mostReliable.provider) {
      recommendations.push(`${fastestProvider.provider} excels in all categories - consider prioritizing it in the fallback chain`)
    } else {
      recommendations.push(`Consider balancing provider selection: ${fastestProvider.provider} (fastest), ${mostAccurate.provider} (most accurate), ${mostReliable.provider} (most reliable)`)
    }

    return recommendations
  }

  private printDatasetResult(result: BenchmarkResult) {
    console.log(`\n  Results for ${result.dataset}:`)
    console.log(`    Fastest: ${result.fastest_provider}`)
    console.log(`    Most Accurate: ${result.most_accurate_provider}`)
    console.log(`    Average Response Time: ${result.average_response_time.toFixed(2)}ms`)
    console.log(`    Overall Success Rate: ${result.success_rate.toFixed(2)}%`)
    
    console.log(`\n    Provider Details:`)
    for (const provider of result.providers) {
      if (provider.success) {
        console.log(`      ${provider.provider}: ${provider.response_time.toFixed(2)}ms avg, ${provider.result.success_rate.toFixed(1)}% success`)
      } else {
        console.log(`      ${provider.provider}: FAILED - ${provider.error}`)
      }
    }
  }

  private printSummaryReport(report: BenchmarkReport) {
    console.log('\n' + '='.repeat(80))
    console.log('📊 BENCHMARK SUMMARY REPORT')
    console.log('='.repeat(80))
    
    console.log(`Duration: ${((new Date(report.end_time).getTime() - new Date(report.start_time).getTime()) / 1000).toFixed(2)}s`)
    console.log(`Total Tests: ${report.total_tests}`)
    console.log()
    
    console.log('🏆 PROVIDER RANKINGS:')
    console.log('-'.repeat(80))
    
    console.log('\n⚡ By Speed (avg response time):')
    report.provider_rankings.by_speed.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${provider.provider}: ${provider.avg_response_time.toFixed(2)}ms`)
    })
    
    console.log('\n🎯 By Accuracy:')
    report.provider_rankings.by_accuracy.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${provider.provider}: ${provider.accuracy_score.toFixed(1)}%`)
    })
    
    console.log('\n🛡️ By Reliability:')
    report.provider_rankings.by_reliability.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${provider.provider}: ${provider.success_rate.toFixed(1)}%`)
    })
    
    console.log('\n💡 RECOMMENDATIONS:')
    console.log('-'.repeat(80))
    report.recommendations.forEach(rec => console.log(`• ${rec}`))
  }

  async saveReport(report: BenchmarkReport, filename?: string) {
    const reportFilename = filename || `benchmark-report-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`
    
    try {
      await Deno.writeTextFile(reportFilename, JSON.stringify(report, null, 2))
      console.log(`\n💾 Report saved to: ${reportFilename}`)
    } catch (error) {
      console.error('Failed to save report:', error)
    }
  }
}

// Test datasets
const TEST_DATASETS: TestDataset[] = [
  {
    name: 'passport_document',
    type: 'text',
    data: `
PASSPORT
United States of America
John Michael Smith
Passport No: P123456789
Date of Birth: 15 MAY 1990
Place of Birth: New York, USA
Nationality: USA
Sex: M
Date of Issue: 15 JAN 2020
Date of Expiry: 15 JAN 2030
Authority: U.S. Department of State
    `,
    expectedResult: {
      document_type: 'passport',
      confidence_threshold: 0.9,
      key_fields: ['full_name', 'passport_number', 'date_of_birth', 'nationality']
    }
  },
  {
    name: 'bank_statement',
    type: 'text',
    data: `
FIRST NATIONAL BANK
Account Statement
Account Holder: John Michael Smith
Account Number: ****1234
Statement Period: January 1, 2024 - January 31, 2024

ACCOUNT SUMMARY
Opening Balance: $10,500.00
Total Deposits: $3,200.00
Total Withdrawals: $2,150.00
Closing Balance: $11,550.00

TRANSACTION HISTORY
01/03/2024  Direct Deposit - Salary        +$2,800.00
01/05/2024  Online Transfer                 -$500.00
01/10/2024  ATM Withdrawal                  -$100.00
01/15/2024  Check #1234                     -$1,200.00
01/20/2024  Mobile Deposit                  +$400.00
01/25/2024  Grocery Store                   -$350.00
    `,
    expectedResult: {
      document_type: 'bank_statement',
      confidence_threshold: 0.85,
      key_fields: ['account_holder', 'account_number', 'closing_balance']
    }
  },
  {
    name: 'drivers_license',
    type: 'text',
    data: `
STATE OF CALIFORNIA
DRIVER LICENSE
DL 12345678
SMITH, JOHN MICHAEL
123 MAIN STREET
ANYTOWN, CA 90210
DOB: 05/15/1990
ISS: 01/15/2020
EXP: 05/15/2028
Class: C
Restrictions: None
    `,
    expectedResult: {
      document_type: 'identification',
      confidence_threshold: 0.9,
      key_fields: ['full_name', 'license_number', 'date_of_birth']
    }
  },
  {
    name: 'small_image_test',
    type: 'image',
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    expectedResult: {
      confidence_threshold: 0.1, // Very low threshold for dummy image
      key_fields: []
    }
  }
]

// Benchmark configuration
const BENCHMARK_CONFIG: BenchmarkConfig = {
  baseUrl: 'https://qfldqwfpbabeonvryaof.supabase.co/functions/v1',
  iterations: 3,
  warmupRuns: 2,
  testDatasets: TEST_DATASETS
}

// Main execution
if (import.meta.main) {
  const benchmark = new AIProviderBenchmark(BENCHMARK_CONFIG)
  
  try {
    const report = await benchmark.runBenchmark()
    await benchmark.saveReport(report)
  } catch (error) {
    console.error('Benchmark failed:', error)
    Deno.exit(1)
  }
}