export interface ClearbitCompanyData {
  name?: string
  domain?: string
  description?: string
  foundedYear?: number
  employees?: number
  estimatedAnnualRevenue?: string
  industry?: string
  location?: string
  funding?: {
    total?: number
    rounds?: Array<{
      type?: string
      amount?: number
      date?: string
    }>
  }
}

export class ClearbitClient {
  private apiKey: string
  private baseUrl = "https://company.clearbit.com/v2/companies"

  constructor() {
    this.apiKey = process.env.CLEARBIT_API_KEY || ""
    if (!this.apiKey) {
      console.warn("CLEARBIT_API_KEY not found in environment variables")
    }
  }

  async enrichCompany(companyName: string): Promise<ClearbitCompanyData | null> {
    if (!this.apiKey) {
      console.warn("Clearbit API key not configured")
      return null
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(`${this.baseUrl}/find?name=${encodeURIComponent(companyName)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Company not found in Clearbit: ${companyName}`)
          return null
        }
        if (response.status === 429) {
          throw new Error("Clearbit rate limit exceeded")
        }
        throw new Error(`Clearbit API error: ${response.status}`)
      }

      const data = await response.json()

      return {
        name: data.name,
        domain: data.domain,
        description: data.description,
        foundedYear: data.foundedYear,
        employees: data.metrics?.employees,
        estimatedAnnualRevenue: data.metrics?.estimatedAnnualRevenue,
        industry: data.category?.industry,
        location: data.geo?.city && data.geo?.state ? `${data.geo.city}, ${data.geo.state}` : data.geo?.country,
        funding: data.funding
          ? {
              total: data.funding.total,
              rounds: data.funding.rounds?.map((round: any) => ({
                type: round.type,
                amount: round.amount,
                date: round.announcedOn,
              })),
            }
          : undefined,
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("Clearbit request timed out")
      } else {
        console.error("Clearbit API error:", error)
      }
      return null
    }
  }

  async enrichByDomain(domain: string): Promise<ClearbitCompanyData | null> {
    if (!this.apiKey) {
      console.warn("Clearbit API key not configured")
      return null
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${this.baseUrl}/find?domain=${encodeURIComponent(domain)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Domain not found in Clearbit: ${domain}`)
          return null
        }
        if (response.status === 429) {
          throw new Error("Clearbit rate limit exceeded")
        }
        throw new Error(`Clearbit API error: ${response.status}`)
      }

      const data = await response.json()

      return {
        name: data.name,
        domain: data.domain,
        description: data.description,
        foundedYear: data.foundedYear,
        employees: data.metrics?.employees,
        estimatedAnnualRevenue: data.metrics?.estimatedAnnualRevenue,
        industry: data.category?.industry,
        location: data.geo?.city && data.geo?.state ? `${data.geo.city}, ${data.geo.state}` : data.geo?.country,
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("Clearbit domain lookup timed out")
      } else {
        console.error("Clearbit domain lookup error:", error)
      }
      return null
    }
  }
}
