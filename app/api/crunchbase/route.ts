import { NextRequest, NextResponse } from "next/server"

// Types for Crunchbase API responses
interface CrunchbaseSearchResult {
  entities: Array<{
    uuid: string
    properties: {
      identifier: {
        value: string
        permalink: string
      }
      short_description?: string
    }
  }>
}

interface CrunchbaseOrganization {
  properties: {
    identifier: {
      value: string
      permalink: string
    }
    short_description?: string
    founded_on?: {
      value: string
    }
    revenue_range?: {
      value: string
    }
    num_employees_enum?: {
      value: string
    }
    categories?: Array<{
      value: string
    }>
    website?: {
      value: string
    }
    location_identifiers?: Array<{
      value: string
    }>
  }
  cards: {
    funding_rounds?: {
      num_cards: number
      cards: Array<{
        properties: {
          investment_type?: {
            value: string
          }
          announced_on?: {
            value: string
          }
          money_raised?: {
            value: number
            currency: string
          }
          num_investors?: number
        }
      }>
    }
    investors?: {
      num_cards: number
      cards: Array<{
        properties: {
          identifier: {
            value: string
          }
        }
      }>
    }
  }
}

interface FinancialData {
  companyName: string
  website?: string
  foundedYear?: string
  revenueRange?: string
  employeeCount?: string
  categories?: string[]
  location?: string[]
  totalFunding?: {
    amount: number
    currency: string
  }
  fundingRounds?: Array<{
    type: string
    date: string
    amount?: {
      value: number
      currency: string
    }
    investorCount?: number
  }>
  investors?: string[]
  description?: string
}

interface ApiResponse {
  success: boolean
  data?: FinancialData
  error?: {
    message: string
    code: string
    details?: any
  }
}

// Helper function to make Crunchbase API requests
async function makeCrunchbaseRequest(endpoint: string, params?: Record<string, string>) {
  const apiKey = process.env.CRUNCHBASE_API_KEY

  if (!apiKey) {
    throw new Error("CRUNCHBASE_API_KEY environment variable is not set")
  }

  const baseUrl = "https://api.crunchbase.com/api/v4"
  const url = new URL(`${baseUrl}${endpoint}`)

  // Add API key and default parameters
  url.searchParams.append("user_key", apiKey)

  // Add additional parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "DiligenceAI/1.0",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Crunchbase API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// Search for company by name
async function searchCompany(companyName: string): Promise<string | null> {
  try {
    const searchData = await makeCrunchbaseRequest("/searches/organizations", {
      field_ids: "identifier,short_description",
      query: companyName,
      limit: "5",
    })

    const results = searchData as CrunchbaseSearchResult

    if (!results.entities || results.entities.length === 0) {
      return null
    }

    // Find the best match (exact name match preferred)
    const exactMatch = results.entities.find(
      (entity) => entity.properties.identifier.value.toLowerCase() === companyName.toLowerCase(),
    )

    if (exactMatch) {
      return exactMatch.uuid
    }

    // Return the first result if no exact match
    return results.entities[0].uuid
  } catch (error) {
    console.error("Error searching for company:", error)
    throw error
  }
}

// Get detailed company information
async function getCompanyDetails(uuid: string): Promise<CrunchbaseOrganization> {
  try {
    const detailsData = await makeCrunchbaseRequest(`/entities/organizations/${uuid}`, {
      field_ids:
        "identifier,short_description,founded_on,revenue_range,num_employees_enum,categories,website,location_identifiers",
      card_field_ids: "funding_rounds,investors",
    })

    return detailsData as CrunchbaseOrganization
  } catch (error) {
    console.error("Error fetching company details:", error)
    throw error
  }
}

// Process and format the financial data
function processFinancialData(orgData: CrunchbaseOrganization): FinancialData {
  const props = orgData.properties
  const cards = orgData.cards

  // Calculate total funding
  let totalFunding: { amount: number; currency: string } | undefined
  const fundingRounds: Array<{
    type: string
    date: string
    amount?: { value: number; currency: string }
    investorCount?: number
  }> = []

  if (cards.funding_rounds?.cards) {
    let totalAmount = 0
    let currency = "USD"

    cards.funding_rounds.cards.forEach((round) => {
      const roundData = {
        type: round.properties.investment_type?.value || "Unknown",
        date: round.properties.announced_on?.value || "",
        investorCount: round.properties.num_investors,
      }

      if (round.properties.money_raised) {
        const amount = {
          value: round.properties.money_raised.value,
          currency: round.properties.money_raised.currency,
        }
        roundData.amount = amount
        totalAmount += amount.value
        currency = amount.currency
      }

      fundingRounds.push(roundData)
    })

    if (totalAmount > 0) {
      totalFunding = { amount: totalAmount, currency }
    }
  }

  // Extract investors
  const investors = cards.investors?.cards?.map((investor) => investor.properties.identifier.value) || []

  // Format founded year
  const foundedYear = props.founded_on?.value ? new Date(props.founded_on.value).getFullYear().toString() : undefined

  return {
    companyName: props.identifier.value,
    website: props.website?.value,
    foundedYear,
    revenueRange: props.revenue_range?.value,
    employeeCount: props.num_employees_enum?.value,
    categories: props.categories?.map((cat) => cat.value),
    location: props.location_identifiers?.map((loc) => loc.value),
    totalFunding,
    fundingRounds: fundingRounds.length > 0 ? fundingRounds : undefined,
    investors: investors.length > 0 ? investors : undefined,
    description: props.short_description,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyName } = body

    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Company name is required and must be a string",
            code: "INVALID_INPUT",
          },
        } as ApiResponse,
        { status: 400 },
      )
    }

    // Step 1: Search for the company
    console.log(`Searching for company: ${companyName}`)
    const companyUuid = await searchCompany(companyName.trim())

    if (!companyUuid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Company "${companyName}" not found in Crunchbase`,
            code: "COMPANY_NOT_FOUND",
          },
        } as ApiResponse,
        { status: 404 },
      )
    }

    // Step 2: Get detailed company information
    console.log(`Fetching details for company UUID: ${companyUuid}`)
    const companyDetails = await getCompanyDetails(companyUuid)

    // Step 3: Process and format the data
    const financialData = processFinancialData(companyDetails)

    return NextResponse.json({
      success: true,
      data: financialData,
    } as ApiResponse)
  } catch (error: any) {
    console.error("Crunchbase API error:", error)

    // Handle specific error types
    if (error.message?.includes("CRUNCHBASE_API_KEY")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Crunchbase API key is not configured",
            code: "API_KEY_MISSING",
          },
        } as ApiResponse,
        { status: 500 },
      )
    }

    if (error.message?.includes("401")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid Crunchbase API key",
            code: "API_KEY_INVALID",
          },
        } as ApiResponse,
        { status: 401 },
      )
    }

    if (error.message?.includes("403")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Crunchbase API access forbidden - check your subscription",
            code: "API_ACCESS_FORBIDDEN",
          },
        } as ApiResponse,
        { status: 403 },
      )
    }

    if (error.message?.includes("429")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Crunchbase API rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
          },
        } as ApiResponse,
        { status: 429 },
      )
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Failed to fetch company financial data",
          code: "INTERNAL_ERROR",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
      } as ApiResponse,
      { status: 500 },
    )
  }
}

// GET method for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyName = searchParams.get("company")

  if (!companyName) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Company name parameter is required",
          code: "INVALID_INPUT",
        },
      } as ApiResponse,
      { status: 400 },
    )
  }

  // Reuse POST logic
  return POST(
    new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify({ companyName }),
    }),
  )
}
