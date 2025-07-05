import { createClient } from "@/lib/supabase/server"
import { ClearbitClient } from "./clearbit-client"
import { WebScrapingService } from "./web-scraping-service"
import { PeopleDataLabsClient } from "./people-data-labs-client"
import { SerpApiClient } from "./serpapi-client"

export interface FinancialData {
  totalFunding?: string
  revenue?: string
  valuation?: string
  employeeCount?: string
  foundedYear?: string
  lastFundingRound?: string
  investors?: string[]
  headquarters?: string
  industry?: string
  description?: string
}

export interface FinancialDataResult {
  success: boolean
  companyName?: string
  domain?: string
  financialData?: FinancialData
  source?: string
  retrievalTimestamp?: string
  cached?: boolean
  error?: {
    message: string
    source: string
    details: string
  }
}

export interface RetrievalOptions {
  forceRefresh?: boolean
  timeout?: number
}

export class FinancialDataRetriever {
  private clearbitClient: ClearbitClient
  private webScrapingService: WebScrapingService
  private peopleDataLabsClient: PeopleDataLabsClient
  private serpApiClient: SerpApiClient
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.clearbitClient = new ClearbitClient()
    this.webScrapingService = new WebScrapingService()
    this.peopleDataLabsClient = new PeopleDataLabsClient()
    this.serpApiClient = new SerpApiClient()
    this.supabase = createClient()
  }

  async getFinancialData(companyInput: string, options: RetrievalOptions = {}): Promise<FinancialDataResult> {
    const { forceRefresh = false, timeout = 30000 } = options
    const startTime = Date.now()

    try {
      // Determine if input is a URL or company name
      const isUrl = this.isValidUrl(companyInput)
      const companyName = isUrl ? this.extractCompanyNameFromUrl(companyInput) : companyInput
      const domain = isUrl ? this.extractDomain(companyInput) : ""

      console.log(`Starting financial data retrieval for: ${companyName}`)

      // Check cache first (unless force refresh is requested)
      if (!forceRefresh) {
        const cachedResult = await this.getCachedData(companyName, domain)
        if (cachedResult) {
          console.log(`Cache hit for ${companyName}`)
          return {
            ...cachedResult,
            cached: true,
            retrievalTimestamp: new Date().toISOString(),
          }
        }
      }

      // Step 1: Try to resolve domain using Clearbit if we don't have it
      let resolvedDomain = domain
      if (!resolvedDomain) {
        try {
          const clearbitResult = await this.withTimeout(this.clearbitClient.enrichCompany(companyName), timeout / 4)
          if (clearbitResult?.domain) {
            resolvedDomain = clearbitResult.domain
            console.log(`Clearbit resolved domain: ${resolvedDomain}`)
          }
        } catch (error) {
          console.warn("Clearbit domain resolution failed:", error)
        }
      }

      // Step 2: Try multiple data sources with fallback
      const dataSources = [
        () => this.webScrapingService.scrapeFinancialData(companyName, resolvedDomain),
        () => this.peopleDataLabsClient.getCompanyData(companyName, resolvedDomain),
        () => this.serpApiClient.getFinancialData(companyName, resolvedDomain),
      ]

      let result: FinancialDataResult | null = null
      let lastError: Error | null = null

      for (const [index, dataSource] of dataSources.entries()) {
        try {
          console.log(`Trying data source ${index + 1}...`)
          const sourceResult = await this.withTimeout(dataSource(), timeout / 3)

          if (sourceResult && sourceResult.financialData) {
            result = {
              success: true,
              companyName,
              domain: resolvedDomain,
              ...sourceResult,
              retrievalTimestamp: new Date().toISOString(),
            }
            break
          }
        } catch (error) {
          console.warn(`Data source ${index + 1} failed:`, error)
          lastError = error instanceof Error ? error : new Error(String(error))

          // Add delay between retries with exponential backoff
          if (index < dataSources.length - 1) {
            await this.delay(Math.pow(2, index) * 1000)
          }
        }
      }

      if (!result) {
        const errorMessage = lastError?.message || "All data sources failed"
        console.error(`Failed to retrieve data for ${companyName}: ${errorMessage}`)

        return {
          success: false,
          companyName,
          domain: resolvedDomain,
          error: {
            message: "Failed to retrieve financial data from all sources",
            source: "All Sources",
            details: errorMessage,
          },
          retrievalTimestamp: new Date().toISOString(),
        }
      }

      // Cache the successful result
      await this.cacheResult(result)

      const duration = Date.now() - startTime
      console.log(`Successfully retrieved data for ${companyName} in ${duration}ms`)

      return result
    } catch (error) {
      console.error("Financial data retrieval error:", error)
      return {
        success: false,
        companyName: companyInput,
        error: {
          message: "Unexpected error during data retrieval",
          source: "System",
          details: error instanceof Error ? error.message : String(error),
        },
        retrievalTimestamp: new Date().toISOString(),
      }
    }
  }

  private async getCachedData(companyName: string, domain: string): Promise<FinancialDataResult | null> {
    try {
      const { data, error } = await this.supabase
        .from("financial_cache")
        .select("*")
        .or(`company_name.ilike.%${companyName}%,domain.eq.${domain}`)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24 hours TTL
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      return {
        success: true,
        companyName: data.company_name,
        domain: data.domain,
        financialData: data.financial_data,
        source: data.source,
        retrievalTimestamp: data.created_at,
        cached: true,
      }
    } catch (error) {
      console.warn("Cache retrieval error:", error)
      return null
    }
  }

  private async cacheResult(result: FinancialDataResult): Promise<void> {
    if (!result.success || !result.financialData) return

    try {
      const { error } = await this.supabase.from("financial_cache").upsert({
        company_name: result.companyName,
        domain: result.domain,
        financial_data: result.financialData,
        source: result.source,
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.warn("Cache storage error:", error)
      }
    } catch (error) {
      console.warn("Cache storage error:", error)
    }
  }

  private isValidUrl(input: string): boolean {
    try {
      new URL(input.startsWith("http") ? input : `https://${input}`)
      return true
    } catch {
      return false
    }
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
      return urlObj.hostname.replace(/^www\./, "")
    } catch {
      return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0]
    }
  }

  private extractCompanyNameFromUrl(url: string): string {
    const domain = this.extractDomain(url)
    return domain.split(".")[0].replace(/[-_]/g, " ")
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const result = await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`))
          })
        }),
      ])
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
