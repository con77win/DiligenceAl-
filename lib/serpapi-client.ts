import type { FinancialData } from "./financial-data-retriever"

export interface SerpApiResult {
  organic_results?: Array<{
    title: string
    snippet: string
    link: string
    position: number
  }>
  knowledge_graph?: {
    title?: string
    type?: string
    description?: string
    founded?: string
    employees?: string
    revenue?: string
    headquarters?: string
    website?: string
  }
  answer_box?: {
    answer?: string
    title?: string
    snippet?: string
  }
}

export class SerpApiClient {
  private apiKey: string
  private baseUrl = "https://serpapi.com/search"

  constructor() {
    this.apiKey = process.env.SERPAPI_KEY || ""
    if (!this.apiKey) {
      console.warn("SERPAPI_KEY not found in environment variables")
    }
  }

  async getFinancialData(
    companyName: string,
    domain?: string,
  ): Promise<{ financialData: FinancialData; source: string } | null> {
    if (!this.apiKey) {
      console.warn("SerpAPI key not configured")
      return null
    }

    const queries = [
      `${companyName} financial data funding revenue`,
      `${companyName} company profile employees founded`,
      `site:${domain} about company` + (domain ? "" : ""),
      `${companyName} crunchbase funding`,
      `${companyName} linkedin company size`,
    ].filter(Boolean)

    for (const query of queries) {
      try {
        const result = await this.searchAndExtract(query, companyName)
        if (result && Object.keys(result.financialData).length > 0) {
          return result
        }

        // Add delay between queries to respect rate limits
        await this.delay(1000)
      } catch (error) {
        console.warn(`SerpAPI query failed for "${query}":`, error)
      }
    }

    return null
  }

  private async searchAndExtract(
    query: string,
    companyName: string,
  ): Promise<{ financialData: FinancialData; source: string } | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const params = new URLSearchParams({
        q: query,
        engine: "google",
        api_key: this.apiKey,
        num: "10",
      })

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("SerpAPI rate limit exceeded")
        }
        if (response.status === 401) {
          throw new Error("SerpAPI key invalid")
        }
        throw new Error(`SerpAPI error: ${response.status}`)
      }

      const data: SerpApiResult = await response.json()
      const financialData: FinancialData = {}

      // Extract from knowledge graph first (most reliable)
      if (data.knowledge_graph) {
        const kg = data.knowledge_graph

        if (kg.founded) {
          const yearMatch = kg.founded.match(/\b(19|20)\d{2}\b/)
          if (yearMatch) {
            financialData.foundedYear = yearMatch[0]
          }
        }

        if (kg.employees) {
          const employeeMatch = kg.employees.match(/(\d{1,3}(?:,\d{3})*|\d+)/)
          if (employeeMatch) {
            financialData.employeeCount = employeeMatch[1]
          }
        }

        if (kg.revenue) {
          financialData.revenue = kg.revenue
        }

        if (kg.headquarters) {
          financialData.headquarters = kg.headquarters
        }

        if (kg.description) {
          financialData.description = kg.description.substring(0, 500)
        }
      }

      // Extract from answer box
      if (data.answer_box?.answer) {
        const answerText = data.answer_box.answer.toLowerCase()

        // Look for funding information
        const fundingMatch = answerText.match(/(?:raised|funding).*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i)
        if (fundingMatch) {
          const amount = fundingMatch[1]
          const unit = fundingMatch[2].toLowerCase()
          const suffix = unit.startsWith("b") ? "B" : "M"
          financialData.totalFunding = `$${amount}${suffix}`
        }

        // Look for valuation
        const valuationMatch = answerText.match(/(?:valued|valuation).*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i)
        if (valuationMatch) {
          const amount = valuationMatch[1]
          const unit = valuationMatch[2].toLowerCase()
          const suffix = unit.startsWith("b") ? "B" : "M"
          financialData.valuation = `$${amount}${suffix}`
        }
      }

      // Extract from organic results
      if (data.organic_results) {
        const allText = data.organic_results
          .slice(0, 5) // Top 5 results
          .map((result) => `${result.title} ${result.snippet}`)
          .join(" ")
          .toLowerCase()

        // Extract funding information
        if (!financialData.totalFunding) {
          const fundingMatches = [
            /(?:raised|funding|investment).*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/gi,
            /\$(\d+(?:\.\d+)?)\s*(million|billion|m|b).*?(?:funding|investment|raised)/gi,
          ]

          for (const regex of fundingMatches) {
            const match = regex.exec(allText)
            if (match) {
              const amount = match[1]
              const unit = match[2].toLowerCase()
              const suffix = unit.startsWith("b") ? "B" : "M"
              financialData.totalFunding = `$${amount}${suffix}`
              break
            }
          }
        }

        // Extract employee count
        if (!financialData.employeeCount) {
          const employeeMatches = [
            /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:\+)?\s*(?:employees|team members|staff|people)/gi,
            /(?:team|company).*?(\d{1,3}(?:,\d{3})*|\d+)\s*(?:employees|people)/gi,
          ]

          for (const regex of employeeMatches) {
            const match = regex.exec(allText)
            if (match) {
              financialData.employeeCount = match[1]
              break
            }
          }
        }

        // Extract founded year
        if (!financialData.foundedYear) {
          const foundedMatch = allText.match(/(?:founded|established|started).*?(\b(?:19|20)\d{2}\b)/i)
          if (foundedMatch) {
            financialData.foundedYear = foundedMatch[1]
          }
        }

        // Extract valuation
        if (!financialData.valuation) {
          const valuationMatch = allText.match(/(?:valued|valuation).*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i)
          if (valuationMatch) {
            const amount = valuationMatch[1]
            const unit = valuationMatch[2].toLowerCase()
            const suffix = unit.startsWith("b") ? "B" : "M"
            financialData.valuation = `$${amount}${suffix}`
          }
        }

        // Extract investors from Crunchbase results
        const crunchbaseResults = data.organic_results.filter((result) => result.link.includes("crunchbase.com"))

        if (crunchbaseResults.length > 0) {
          const investors: string[] = []
          const investorPattern =
            /(?:investors?|backed by|funding from).*?([A-Z][a-z]+ (?:Capital|Ventures|Partners|Fund|Investments?))/gi

          crunchbaseResults.forEach((result) => {
            const text = `${result.title} ${result.snippet}`
            let match
            while ((match = investorPattern.exec(text)) !== null) {
              const investor = match[1].trim()
              if (!investors.includes(investor)) {
                investors.push(investor)
              }
            }
          })

          if (investors.length > 0) {
            financialData.investors = investors.slice(0, 5) // Top 5 investors
          }
        }
      }

      if (Object.keys(financialData).length > 0) {
        return {
          financialData,
          source: "SerpAPI",
        }
      }

      return null
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("SerpAPI request timed out")
      } else {
        console.error("SerpAPI search error:", error)
      }
      throw error
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
