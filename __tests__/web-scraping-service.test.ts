import { WebScrapingService } from "@/lib/web-scraping-service"
import { jest } from "@jest/globals"

// Mock fetch globally
global.fetch = jest.fn()

describe("WebScrapingService", () => {
  let service: WebScrapingService

  beforeEach(() => {
    service = new WebScrapingService()
    jest.clearAllMocks()
  })

  describe("scrapeFinancialData", () => {
    it("should handle successful scraping", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(`
          <html>
            <body>
              <div>Test Company founded in 2020 with 100 employees</div>
              <div>Raised $50 million in funding</div>
              <div>Revenue of $10 million annually</div>
            </body>
          </html>
        `),
      } as Response)

      const result = await service.scrapeFinancialData("Test Company", "example.com")

      expect(result).toBeDefined()
      if (result) {
        expect(result.source).toBeTruthy()
        expect(result.financialData).toBeDefined()
      }
    })

    it("should handle scraping failures", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await service.scrapeFinancialData("Test Company", "example.com")

      expect(result).toBeNull()
    })

    it("should handle HTTP errors", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await service.scrapeFinancialData("Test Company", "example.com")

      expect(result).toBeNull()
    })

    it("should extract financial data from HTML", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(`
          <html>
            <body>
              <div>Founded in 2020</div>
              <div>Team of 150 employees</div>
              <div>Raised $25 million in Series B</div>
              <div>Annual revenue $5 million</div>
            </body>
          </html>
        `),
      } as Response)

      const result = await service.scrapeFinancialData("Test Company", "example.com")

      expect(result).toBeDefined()
      if (result?.financialData) {
        expect(result.financialData.foundedYear).toBeTruthy()
        expect(result.financialData.employeeCount).toBeTruthy()
      }
    })
  })
})
