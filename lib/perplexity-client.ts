import type { FinancialData } from "./financial-data-retriever"

export class PerplexityClient {
  private apiKey: string
  private baseUrl = "https://api.perplexity.ai"

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || ""
    if (!this.apiKey) {
      console.warn("PERPLEXITY_API_KEY not found in environment variables")
    }
  }

  async getFinancialData(companyName: string, domain: string): Promise<{ financialData: FinancialData } | null> {
    if (!this.apiKey) {
      console.log("Perplexity API key not available")
      return null
    }

    try {
      const queries = this.buildSearchQueries(companyName, domain)

      for (const query of queries) {
        try {
          const result = await this.searchAndExtract(query, companyName)
          if (result && Object.keys(result).length > 0) {
            return { financialData: result }
          }
        } catch (error) {
          console.error(`Perplexity query failed: ${query}`, error)
          continue
        }
      }

      return null
    } catch (error) {
      console.error("Perplexity API error:", error)
      throw error
    }
  }

  private buildSearchQueries(companyName: string, domain: string): string[] {
    const queries = [
      `${companyName} financial data revenue funding investors`,
      `${companyName} company funding rounds valuation`,
      `${companyName} startup investment series A B C`,
    ]

    if (domain) {
      queries.push(
        `site:${domain} financial information`,
        `site:crunchbase.com ${companyName} funding`,
        `site:pitchbook.com ${companyName} investment`,
      )
    }

    return queries
  }

  private async searchAndExtract(query: string, companyName: string): Promise<FinancialData | null> {
    const prompt = `Search for financial information about ${companyName} and extract the following data in JSON format:
    - revenue (annual revenue if available)
    - funding (total funding raised)
    - lastFundingRound (most recent funding round details)
    - investors (list of investors)
    - employeeCount (number of employees)
    - foundedYear (year founded)
    - valuation (current valuation if available)

    Query: ${query}

    Please provide only the JSON object with the available data, using null for unavailable fields.`

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 800,
          temperature: 0.1,
        }),
        timeout: 30000,
      })

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        return null
      }

      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const financialData = JSON.parse(jsonMatch[0])

          // Filter out null values and clean up the data
          const cleanedData: FinancialData = {}
          Object.entries(financialData).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              cleanedData[key as keyof FinancialData] = value as any
            }
          })

          return Object.keys(cleanedData).length > 0 ? cleanedData : null
        } catch (parseError) {
          console.error("Failed to parse Perplexity JSON response:", parseError)
          return null
        }
      }

      return null
    } catch (error) {
      console.error("Perplexity search error:", error)
      throw error
    }
  }
}
