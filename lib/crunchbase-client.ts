// Crunchbase API client utility functions

export interface CrunchbaseConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

export class CrunchbaseClient {
  private config: CrunchbaseConfig

  constructor(config: CrunchbaseConfig) {
    this.config = {
      baseUrl: "https://api.crunchbase.com/api/v4",
      timeout: 30000,
      ...config,
    }
  }

  async makeRequest(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.config.baseUrl}${endpoint}`)

    // Add API key
    url.searchParams.append("user_key", this.config.apiKey)

    // Add additional parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "DiligenceAI/1.0",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Crunchbase API error: ${response.status} - ${errorText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  async searchOrganizations(query: string, limit = 5) {
    return this.makeRequest("/searches/organizations", {
      field_ids: "identifier,short_description",
      query: query,
      limit: limit.toString(),
    })
  }

  async getOrganization(uuid: string) {
    return this.makeRequest(`/entities/organizations/${uuid}`, {
      field_ids:
        "identifier,short_description,founded_on,revenue_range,num_employees_enum,categories,website,location_identifiers",
      card_field_ids: "funding_rounds,investors",
    })
  }
}

// Helper function to create a client instance
export function createCrunchbaseClient(): CrunchbaseClient {
  const apiKey = process.env.CRUNCHBASE_API_KEY

  if (!apiKey) {
    throw new Error("CRUNCHBASE_API_KEY environment variable is not set")
  }

  return new CrunchbaseClient({ apiKey })
}
