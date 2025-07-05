import { FinancialDataRetriever } from "@/lib/financial-data-retriever"
import jest from "jest"

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  }),
}))

// Mock environment variables
process.env.CLEARBIT_API_KEY = "test-clearbit-key"
process.env.PEOPLE_DATA_LABS_API_KEY = "test-pdl-key"
process.env.SERPAPI_KEY = "test-serpapi-key"

// Mock fetch globally
global.fetch = jest.fn()

describe("FinancialDataRetriever", () => {
  let retriever: FinancialDataRetriever

  beforeEach(() => {
    retriever = new FinancialDataRetriever()
    jest.clearAllMocks()
  })

  describe("getFinancialData", () => {
    it("should handle company name input", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await retriever.getFinancialData("Test Company")

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(typeof result.success).toBe("boolean")
    })

    it("should handle URL input", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await retriever.getFinancialData("https://example.com")

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it("should handle force refresh option", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await retriever.getFinancialData("Test Company", { forceRefresh: true })

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it("should handle errors gracefully", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await retriever.getFinancialData("Test Company")

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBeTruthy()
    })

    it("should return successful result with financial data", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

      // Mock successful web scraping response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(`
          <html>
            <body>
              <div>Test Company founded in 2020 with 100 employees</div>
              <div>Raised $50 million in Series A funding</div>
            </body>
          </html>
        `),
      } as Response)

      const result = await retriever.getFinancialData("Test Company")

      expect(result.success).toBe(true)
      expect(result.companyName).toBe("Test Company")
    })
  })

  describe("domain extraction", () => {
    it("should extract domain from HTTP URL", () => {
      const retriever = new FinancialDataRetriever()
      // Access private method for testing
      const extractDomain = (retriever as any).extractDomain.bind(retriever)

      expect(extractDomain("https://www.example.com")).toBe("example.com")
      expect(extractDomain("http://example.com/path")).toBe("example.com")
      expect(extractDomain("www.example.com")).toBe("example.com")
      expect(extractDomain("example.com")).toBe("example.com")
    })

    it("should handle malformed URLs", () => {
      const retriever = new FinancialDataRetriever()
      const extractDomain = (retriever as any).extractDomain.bind(retriever)

      expect(extractDomain("not-a-url")).toBe("not-a-url")
      expect(extractDomain("")).toBe("")
    })
  })
})
