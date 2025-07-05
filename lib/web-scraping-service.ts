import * as cheerio from "cheerio"
import type { FinancialData } from "./financial-data-retriever"

export interface ScrapingResult {
  financialData: FinancialData
  source: string
}

export class WebScrapingService {
  private userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

  async scrapeFinancialData(companyName: string, domain: string): Promise<ScrapingResult | null> {
    const sources = [
      () => this.scrapeCrunchbase(companyName),
      () => this.scrapeCompanyWebsite(domain),
      () => this.scrapeLinkedIn(companyName),
      () => this.scrapePitchBook(companyName),
    ]

    for (const scrapeSource of sources) {
      try {
        const result = await scrapeSource()
        if (result) {
          return result
        }
      } catch (error) {
        console.warn("Scraping source failed:", error)
      }
    }

    return null
  }

  private async scrapeCrunchbase(companyName: string): Promise<ScrapingResult | null> {
    try {
      const searchUrl = `https://www.crunchbase.com/discover/organization.companies/field/organizations/num_funding_rounds/funding-rounds`
      const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")
      const companyUrl = `https://www.crunchbase.com/organization/${companySlug}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(companyUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.log(`Crunchbase page not found for ${companyName}`)
        return null
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      const financialData: FinancialData = {}

      // Extract funding information
      const fundingSelectors = [
        '[data-testid="funding-rounds-total"]',
        ".funding-total",
        '[class*="funding"]',
        'span:contains("Total Funding")',
        'div:contains("Funding Rounds")',
      ]

      for (const selector of fundingSelectors) {
        const fundingElement = $(selector)
        if (fundingElement.length > 0) {
          const fundingText = fundingElement.text().trim()
          const fundingMatch = fundingText.match(/\$[\d.,]+[KMB]?/)
          if (fundingMatch) {
            financialData.totalFunding = fundingMatch[0]
            break
          }
        }
      }

      // Extract employee count
      const employeeSelectors = [
        '[data-testid="employee-count"]',
        ".employee-count",
        'span:contains("Employees")',
        'div:contains("Company Size")',
      ]

      for (const selector of employeeSelectors) {
        const employeeElement = $(selector)
        if (employeeElement.length > 0) {
          const employeeText = employeeElement.text().trim()
          const employeeMatch = employeeText.match(/(\d{1,3}(?:,\d{3})*|\d+)/)
          if (employeeMatch) {
            financialData.employeeCount = employeeMatch[1]
            break
          }
        }
      }

      // Extract founded year
      const foundedSelectors = [
        '[data-testid="founded-date"]',
        ".founded-date",
        'span:contains("Founded")',
        'div:contains("Founded")',
      ]

      for (const selector of foundedSelectors) {
        const foundedElement = $(selector)
        if (foundedElement.length > 0) {
          const foundedText = foundedElement.text().trim()
          const yearMatch = foundedText.match(/\b(19|20)\d{2}\b/)
          if (yearMatch) {
            financialData.foundedYear = yearMatch[0]
            break
          }
        }
      }

      // Extract investors
      const investorElements = $(
        '[data-testid="investor-name"], .investor-name, a[href*="/organization/"]:contains("Capital"), a[href*="/organization/"]:contains("Ventures")',
      )
      const investors: string[] = []
      investorElements.each((_, element) => {
        const investorName = $(element).text().trim()
        if (investorName && !investors.includes(investorName)) {
          investors.push(investorName)
        }
      })
      if (investors.length > 0) {
        financialData.investors = investors.slice(0, 10) // Limit to top 10
      }

      // Extract description
      const descriptionSelectors = [
        '[data-testid="company-description"]',
        ".company-description",
        'meta[name="description"]',
      ]

      for (const selector of descriptionSelectors) {
        const descElement = $(selector)
        if (descElement.length > 0) {
          const description = selector.includes("meta") ? descElement.attr("content") : descElement.text().trim()
          if (description && description.length > 20) {
            financialData.description = description.substring(0, 500)
            break
          }
        }
      }

      if (Object.keys(financialData).length > 0) {
        return {
          financialData,
          source: "Crunchbase",
        }
      }

      return null
    } catch (error) {
      console.warn("Crunchbase scraping failed:", error)
      return null
    }
  }

  private async scrapeCompanyWebsite(domain: string): Promise<ScrapingResult | null> {
    if (!domain) return null

    try {
      const url = `https://${domain}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return null
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      const financialData: FinancialData = {}
      const pageText = $("body").text().toLowerCase()

      // Extract founded year
      const foundedMatches = pageText.match(/(?:founded|established|started).*?(\b(?:19|20)\d{2}\b)/i)
      if (foundedMatches) {
        financialData.foundedYear = foundedMatches[1]
      }

      // Extract employee count
      const employeeMatches = pageText.match(
        /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:\+)?\s*(?:employees|team members|staff|people)/i,
      )
      if (employeeMatches) {
        financialData.employeeCount = employeeMatches[1]
      }

      // Extract funding information
      const fundingMatches = pageText.match(
        /(?:raised|funding|investment).*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i,
      )
      if (fundingMatches) {
        const amount = fundingMatches[1]
        const unit = fundingMatches[2].toLowerCase()
        const suffix = unit.startsWith("b") ? "B" : "M"
        financialData.totalFunding = `$${amount}${suffix}`
      }

      // Extract revenue information
      const revenueMatches = pageText.match(/(?:revenue|sales).*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i)
      if (revenueMatches) {
        const amount = revenueMatches[1]
        const unit = revenueMatches[2].toLowerCase()
        const suffix = unit.startsWith("b") ? "B" : "M"
        financialData.revenue = `$${amount}${suffix}`
      }

      // Extract description from meta tags
      const description =
        $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content")
      if (description && description.length > 20) {
        financialData.description = description.substring(0, 500)
      }

      if (Object.keys(financialData).length > 0) {
        return {
          financialData,
          source: "Company Website",
        }
      }

      return null
    } catch (error) {
      console.warn("Company website scraping failed:", error)
      return null
    }
  }

  private async scrapeLinkedIn(companyName: string): Promise<ScrapingResult | null> {
    try {
      // LinkedIn search for company
      const searchQuery = encodeURIComponent(`${companyName} company`)
      const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${searchQuery}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return null
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      const financialData: FinancialData = {}

      // Extract employee count from LinkedIn search results
      const employeeText = $('.company-employees-count, .t-black--light, [data-test-id="company-employees-count"]')
        .first()
        .text()
      const employeeMatch = employeeText.match(/(\d{1,3}(?:,\d{3})*|\d+)/)
      if (employeeMatch) {
        financialData.employeeCount = employeeMatch[1]
      }

      // Extract industry information
      const industryText = $('.company-industries, .industry, [data-test-id="company-industry"]').first().text().trim()
      if (industryText) {
        financialData.industry = industryText
      }

      if (Object.keys(financialData).length > 0) {
        return {
          financialData,
          source: "LinkedIn",
        }
      }

      return null
    } catch (error) {
      console.warn("LinkedIn scraping failed:", error)
      return null
    }
  }

  private async scrapePitchBook(companyName: string): Promise<ScrapingResult | null> {
    try {
      // Note: PitchBook requires authentication, so this is a basic attempt
      const searchUrl = `https://pitchbook.com/profiles/company/${companyName.toLowerCase().replace(/\s+/g, "-")}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return null
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      const financialData: FinancialData = {}

      // Extract basic information if available (most content requires login)
      const pageText = $("body").text().toLowerCase()

      // Look for funding information in meta tags or visible text
      const fundingMatch = pageText.match(/total funding.*?\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i)
      if (fundingMatch) {
        const amount = fundingMatch[1]
        const unit = fundingMatch[2].toLowerCase()
        const suffix = unit.startsWith("b") ? "B" : "M"
        financialData.totalFunding = `$${amount}${suffix}`
      }

      if (Object.keys(financialData).length > 0) {
        return {
          financialData,
          source: "PitchBook",
        }
      }

      return null
    } catch (error) {
      console.warn("PitchBook scraping failed:", error)
      return null
    }
  }
}
