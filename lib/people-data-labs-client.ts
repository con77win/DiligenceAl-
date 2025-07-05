import type { FinancialData } from "./financial-data-retriever"

export interface PeopleDataLabsCompanyData {
  name?: string
  website?: string
  size?: string
  founded?: number
  industry?: string
  location?: {
    name?: string
    country?: string
  }
  linkedin_url?: string
  employee_count?: number
  estimated_num_employees?: number
}

export class PeopleDataLabsClient {
  private apiKey: string
  private baseUrl = "https://api.peopledatalabs.com/v5"

  constructor() {
    this.apiKey = process.env.PEOPLE_DATA_LABS_API_KEY || ""
    if (!this.apiKey) {
      console.warn("PEOPLE_DATA_LABS_API_KEY not found in environment variables")
    }
  }

  async getCompanyData(
    companyName: string,
    domain?: string,
  ): Promise<{ financialData: FinancialData; source: string } | null> {
    if (!this.apiKey) {
      console.warn("People Data Labs API key not configured")
      return null
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      // Build query parameters
      const params = new URLSearchParams()
      if (domain) {
        params.append("website", domain)
      } else {
        params.append("name", companyName)
      }
      params.append("pretty", "true")

      const response = await fetch(`${this.baseUrl}/company/enrich?${params.toString()}`, {
        headers: {
          "X-Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Company not found in People Data Labs: ${companyName}`)
          return null
        }
        if (response.status === 429) {
          throw new Error("People Data Labs rate limit exceeded")
        }
        if (response.status === 401) {
          throw new Error("People Data Labs API key invalid")
        }
        throw new Error(`People Data Labs API error: ${response.status}`)
      }

      const data: PeopleDataLabsCompanyData = await response.json()

      const financialData: FinancialData = {}

      // Extract employee count
      if (data.employee_count) {
        financialData.employeeCount = data.employee_count.toString()
      } else if (data.estimated_num_employees) {
        financialData.employeeCount = data.estimated_num_employees.toString()
      } else if (data.size) {
        // Parse size ranges like "51-200", "201-500", etc.
        const sizeMatch = data.size.match(/(\d+)-(\d+)/)
        if (sizeMatch) {
          const min = Number.parseInt(sizeMatch[1])
          const max = Number.parseInt(sizeMatch[2])
          const avg = Math.round((min + max) / 2)
          financialData.employeeCount = `${avg} (${data.size})`
        } else {
          financialData.employeeCount = data.size
        }
      }

      // Extract founded year
      if (data.founded) {
        financialData.foundedYear = data.founded.toString()
      }

      // Extract industry
      if (data.industry) {
        financialData.industry = data.industry
      }

      // Extract headquarters
      if (data.location?.name) {
        financialData.headquarters = data.location.name
      } else if (data.location?.country) {
        financialData.headquarters = data.location.country
      }

      if (Object.keys(financialData).length > 0) {
        return {
          financialData,
          source: "People Data Labs",
        }
      }

      return null
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("People Data Labs request timed out")
      } else {
        console.error("People Data Labs API error:", error)
      }
      return null
    }
  }

  async searchCompanies(query: string, limit = 10): Promise<PeopleDataLabsCompanyData[]> {
    if (!this.apiKey) {
      console.warn("People Data Labs API key not configured")
      return []
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const params = new URLSearchParams({
        query: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: query,
                    fields: ["name^2", "website", "industry"],
                  },
                },
              ],
            },
          },
          size: limit.toString(),
        }),
      })

      const response = await fetch(`${this.baseUrl}/company/search?${params.toString()}`, {
        headers: {
          "X-Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`People Data Labs search error: ${response.status}`)
      }

      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error("People Data Labs search error:", error)
      return []
    }
  }
}
