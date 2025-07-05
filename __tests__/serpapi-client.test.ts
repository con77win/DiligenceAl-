import { SerpApiClient } from "@/lib/serpapi-client"
import jest from "jest"

// Mock environment variables
process.env.SERPAPI_KEY = "test-serpapi-key"

// Mock fetch globally
global.fetch = jest.fn()

describe("SerpApiClient", () => {
  let client: SerpApiClient

  beforeEach(() => {
    client = new SerpApiClient()
    jest.clearAllMocks()
  })

  describe("getFinancialData", () => {
    it("should handle successful API response", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            organic_results: [
              {
                title: "Test Company raises $50 million in Series A",
                snippet: "Test Company, founded in 2020 with 100 employees, has raised $50 million",
                link: "https://example.com/news",
                position: 1,
              },
            ],
            knowledge_graph: {
              title: "Test Company",
              founded: "2020",
              employees: "100",
            },
          }),
      } as Response)

      const result = await client.getFinancialData("Test Company", "example.com")

      expect(result).toBeDefined()
      expect(result?.financialData).toBeDefined()
      if (result?.financialData) {
        expect(result.financialData.foundedYear).toBe("2020")
        expect(result.financialData.employeeCount).toBe("100")
      }
    })

    it("should handle API errors", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response)

      await expect(client.getFinancialData("Test Company", "example.com")).rejects.toThrow(
        "SerpAPI rate limit exceeded",
      )
    })

    it("should handle missing API key", async () => {
      process.env.SERPAPI_KEY = ""
      const clientWithoutKey = new SerpApiClient()

      const result = await clientWithoutKey.getFinancialData("Test Company", "example.com")

      expect(result).toBeNull()
    })

    it("should extract financial data from search results", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            organic_results: [
              {
                title: "Test Company valued at $1 billion",
                snippet: "The startup raised $100 million and is now valued at $1 billion with 500 employees",
                link: "https://example.com",
                position: 1,
              },
            ],
          }),
      } as Response)

      const result = await client.getFinancialData("Test Company", "example.com")

      expect(result).toBeDefined()
      if (result?.financialData) {
        expect(result.financialData.valuation).toBeTruthy()
        expect(result.financialData.employeeCount).toBeTruthy()
      }
    })
  })
})
