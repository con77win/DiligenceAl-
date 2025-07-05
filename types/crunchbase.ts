// Type definitions for Crunchbase API responses

export interface CrunchbaseIdentifier {
  value: string
  permalink: string
}

export interface CrunchbaseValue<T = string> {
  value: T
}

export interface CrunchbaseMoneyValue {
  value: number
  currency: string
}

export interface CrunchbaseSearchEntity {
  uuid: string
  properties: {
    identifier: CrunchbaseIdentifier
    short_description?: string
  }
}

export interface CrunchbaseSearchResult {
  entities: CrunchbaseSearchEntity[]
  count: number
}

export interface CrunchbaseFundingRound {
  properties: {
    investment_type?: CrunchbaseValue
    announced_on?: CrunchbaseValue
    money_raised?: CrunchbaseMoneyValue
    num_investors?: number
  }
}

export interface CrunchbaseInvestor {
  properties: {
    identifier: CrunchbaseIdentifier
  }
}

export interface CrunchbaseOrganization {
  properties: {
    identifier: CrunchbaseIdentifier
    short_description?: string
    founded_on?: CrunchbaseValue
    revenue_range?: CrunchbaseValue
    num_employees_enum?: CrunchbaseValue
    categories?: CrunchbaseValue[]
    website?: CrunchbaseValue
    location_identifiers?: CrunchbaseValue[]
  }
  cards: {
    funding_rounds?: {
      num_cards: number
      cards: CrunchbaseFundingRound[]
    }
    investors?: {
      num_cards: number
      cards: CrunchbaseInvestor[]
    }
  }
}

export interface ProcessedFinancialData {
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

export interface CrunchbaseApiResponse {
  success: boolean
  data?: ProcessedFinancialData
  error?: {
    message: string
    code: string
    details?: any
  }
}
