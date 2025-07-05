import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createClient } from "@/lib/supabase/server"
import * as pdfjsLib from "pdfjs-dist"

// Configure PDF.js worker source - Fix for 302 redirect issue
if (typeof window === "undefined") {
  // Server-side configuration with fallback
  const pdfVersion = pdfjsLib.version || "3.11.174"
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.js`
} else {
  // Client-side configuration (fallback)
  const pdfVersion = pdfjsLib.version || "3.11.174"
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.js`
}

// API Keys with proper validation
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

// Validate API keys on startup
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not configured - using fallback")
}

if (!PERPLEXITY_API_KEY) {
  console.warn("PERPLEXITY_API_KEY not configured - external research will be skipped")
}

interface FinancialData {
  revenue?: string
  profit_loss?: string
  ebitda?: string
  valuation?: string
  funding_rounds?: string[]
  last_funding_amount?: string
  last_funding_date?: string
  investors?: string[]
  burn_rate?: string
  runway?: string
  arr_mrr?: string
  growth_rate?: string
  summary?: string
  extraction_method?: string
  confidence_score?: number
}

interface ScoreBreakdown {
  team_experience: number
  market_size: number
  traction: number
  financial_performance: number
  competitive_advantage: number
  risk_factors: number
  data_quality: number
}

interface ExtractionLog {
  method: string
  success: boolean
  error?: string
  timestamp: string
  details?: any
}

interface InvestmentAnalysis {
  executiveSummary: string
  score: number
  scoreBreakdown: ScoreBreakdown
  scoreJustification: {
    team_experience: string
    market_size: string
    traction: string
    financial_performance: string
    competitive_advantage: string
    risk_factors: string
    data_quality: string
  }
  recommendation: "RECOMMENDED TO INVEST" | "PROCEED WITH CAUTION" | "DO NOT INVEST" | "INSUFFICIENT DATA"
  recommendationJustification: string[]
  riskLevel: "low" | "medium" | "high"
  redFlags: Array<{
    severity: "high" | "medium" | "low"
    category: string
    title: string
    description: string
    evidence: string
    impact: string
    recommendation: string
  }>
  verification: Array<{
    category: string
    status: "verified" | "partial" | "unverified" | "concerning"
    confidence: number
    details: string
    sources: string
    recommendations: string
  }>
  followUpQuestions: Array<{
    category: string
    priority: "high" | "medium" | "low"
    questions: string[]
  }>
  keyMetrics: {
    financial: Record<string, string>
    market: Record<string, string>
    team: Record<string, string>
  }
  strengths: string[]
  concerns: string[]
  investmentRecommendation: {
    recommendation: string
    reasoning: string
    conditions: string
  }
  financialData?: FinancialData
  extractionLogs?: ExtractionLog[]
  errorDetails?: {
    crunchbaseErrors?: string[]
    perplexityErrors?: string[]
    openaiErrors?: string[]
    generalErrors?: string[]
  }
}

async function logExtraction(method: string, success: boolean, error?: string, details?: any): Promise<ExtractionLog> {
  const log: ExtractionLog = {
    method,
    success,
    error,
    timestamp: new Date().toISOString(),
    details,
  }

  console.log(`[${log.timestamp}] ${method}: ${success ? "SUCCESS" : "FAILED"}`, {
    error,
    details: details ? JSON.stringify(details).substring(0, 200) : undefined,
  })

  return log
}

async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string
  financialData: FinancialData | null
  extractionLogs: ExtractionLog[]
  error?: string
}> {
  const extractionLogs: ExtractionLog[] = []

  try {
    console.log("Starting PDF extraction with PDF.js...")
    extractionLogs.push(await logExtraction("PDF_EXTRACTION_START", true, undefined, { bufferSize: buffer.length }))

    // Configure worker with multiple fallback options
    const pdfVersion = pdfjsLib.version || "3.11.174"
    const workerSources = [
      `https://unpkg.com/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.js`,
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.js`,
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.js`,
    ]

    let workerConfigured = false
    for (const workerSrc of workerSources) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
        console.log(`Attempting to configure PDF worker with: ${workerSrc}`)

        // Test the worker configuration with a small test
        const testDoc = await pdfjsLib.getDocument({
          data: buffer.slice(0, Math.min(1024, buffer.length)),
          useSystemFonts: true,
          disableFontFace: true,
          verbosity: 0,
        }).promise

        await testDoc.destroy()
        workerConfigured = true
        extractionLogs.push(await logExtraction("PDF_WORKER_CONFIGURED", true, undefined, { workerSrc }))
        break
      } catch (workerError) {
        console.warn(`Worker configuration failed with ${workerSrc}:`, workerError)
        continue
      }
    }

    if (!workerConfigured) {
      throw new Error("Failed to configure PDF worker with any available source")
    }

    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
      maxImageSize: 1024 * 1024, // 1MB max image size
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfVersion}/cmaps/`,
    })

    const pdf = await loadingTask.promise
    console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`)
    extractionLogs.push(await logExtraction("PDF_LOAD", true, undefined, { pageCount: pdf.numPages }))

    let fullText = ""
    let financialData: FinancialData | null = null

    // Extract text from all pages with improved error handling
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        })

        const pageText = textContent.items
          .map((item: any) => {
            if ("str" in item) {
              return item.str
            }
            return ""
          })
          .filter((text) => text.trim().length > 0)
          .join(" ")

        if (pageText.trim()) {
          fullText += pageText + "\n"
        }

        // Clean up page resources
        page.cleanup()
      } catch (pageError) {
        const errorMessage = pageError instanceof Error ? pageError.message : "Unknown page error"
        console.warn(`Error extracting page ${pageNum}:`, pageError)
        extractionLogs.push(await logExtraction(`PDF_PAGE_${pageNum}`, false, errorMessage))
        // Continue with other pages
      }
    }

    // Clean up PDF resources
    await pdf.destroy()

    if (!fullText.trim()) {
      const error = "No text content could be extracted from PDF"
      extractionLogs.push(await logExtraction("PDF_TEXT_EXTRACTION", false, error))
      throw new Error(error)
    }

    console.log(`PDF text extraction completed. Length: ${fullText.length} characters`)
    extractionLogs.push(await logExtraction("PDF_TEXT_EXTRACTION", true, undefined, { textLength: fullText.length }))

    // Attempt to extract financial data from the text
    try {
      financialData = extractFinancialDataFromText(fullText)
      if (financialData) {
        financialData.extraction_method = "PDF_DIRECT"
        financialData.confidence_score = 85
        extractionLogs.push(
          await logExtraction("PDF_FINANCIAL_EXTRACTION", true, undefined, {
            dataPoints: Object.keys(financialData).length,
          }),
        )
      } else {
        extractionLogs.push(await logExtraction("PDF_FINANCIAL_EXTRACTION", false, "No financial data patterns found"))
      }
    } catch (financialError) {
      const errorMessage = financialError instanceof Error ? financialError.message : "Financial extraction error"
      extractionLogs.push(await logExtraction("PDF_FINANCIAL_EXTRACTION", false, errorMessage))
    }

    return {
      text: fullText.trim(),
      financialData,
      extractionLogs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown PDF processing error"
    console.error("PDF extraction error:", error)
    extractionLogs.push(await logExtraction("PDF_EXTRACTION", false, errorMessage))

    // Enhanced error message for specific worker issues
    let userFriendlyError = "PDF processing failed. "
    if (errorMessage.includes("worker") || errorMessage.includes("302")) {
      userFriendlyError +=
        "There was an issue loading the PDF processing components. This can happen with some PDF files or network configurations. Please try again, or use a different analysis method."
    } else if (errorMessage.includes("Invalid PDF")) {
      userFriendlyError +=
        "The uploaded file doesn't appear to be a valid PDF. Please ensure you're uploading a proper PDF file."
    } else if (errorMessage.includes("password") || errorMessage.includes("encrypted")) {
      userFriendlyError +=
        "The PDF appears to be password-protected or encrypted. Please upload an unprotected PDF file."
    } else {
      userFriendlyError +=
        "Please ensure the file is a valid PDF and try again. If the issue persists, try using the URL or Data Room analysis options."
    }

    return {
      text: "",
      financialData: null,
      extractionLogs,
      error: userFriendlyError,
    }
  }
}

function extractFinancialDataFromText(text: string): FinancialData | null {
  try {
    const financialData: FinancialData = {}
    const lowerText = text.toLowerCase()

    // Enhanced revenue patterns
    const revenuePatterns = [
      /(?:annual\s+)?revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /arr[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /annual recurring revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /sales[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /gross revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ]

    // Enhanced MRR/ARR patterns
    const mrrPatterns = [
      /mrr[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /monthly recurring revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /monthly revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ]

    // Enhanced funding patterns
    const fundingPatterns = [
      /raised[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /funding[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /series\s+[a-z][:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /seed[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /pre-seed[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /round[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ]

    // Enhanced valuation patterns
    const valuationPatterns = [
      /valuation[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /valued at[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /pre-money[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /post-money[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ]

    // Enhanced growth patterns
    const growthPatterns = [
      /growth[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi,
      /growing[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi,
      /yoy[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi,
      /year over year[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi,
      /mom[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi,
      /month over month[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi,
    ]

    // Burn rate patterns
    const burnPatterns = [
      /burn rate[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /monthly burn[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /cash burn[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ]

    // Runway patterns
    const runwayPatterns = [
      /runway[:\s]*([\d,]+(?:\.\d+)?)\s*(months?|years?)/gi,
      /cash runway[:\s]*([\d,]+(?:\.\d+)?)\s*(months?|years?)/gi,
    ]

    // Extract revenue
    for (const pattern of revenuePatterns) {
      const match = pattern.exec(text)
      if (match) {
        const amount = match[1].replace(/,/g, "")
        const unit = match[2] || ""
        financialData.revenue = `$${amount}${unit.toUpperCase()}`
        break
      }
    }

    // Extract MRR/ARR
    for (const pattern of mrrPatterns) {
      const match = pattern.exec(text)
      if (match) {
        const amount = match[1].replace(/,/g, "")
        const unit = match[2] || ""
        financialData.arr_mrr = `$${amount}${unit.toUpperCase()} MRR`
        break
      }
    }

    // Extract funding
    const fundingRounds: string[] = []
    for (const pattern of fundingPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const amount = match[1].replace(/,/g, "")
        const unit = match[2] || ""
        fundingRounds.push(`$${amount}${unit.toUpperCase()}`)
      }
    }
    if (fundingRounds.length > 0) {
      financialData.funding_rounds = fundingRounds
      financialData.last_funding_amount = fundingRounds[fundingRounds.length - 1]
    }

    // Extract valuation
    for (const pattern of valuationPatterns) {
      const match = pattern.exec(text)
      if (match) {
        const amount = match[1].replace(/,/g, "")
        const unit = match[2] || ""
        financialData.valuation = `$${amount}${unit.toUpperCase()}`
        break
      }
    }

    // Extract growth rate
    for (const pattern of growthPatterns) {
      const match = pattern.exec(text)
      if (match) {
        financialData.growth_rate = `${match[1]}%`
        break
      }
    }

    // Extract burn rate
    for (const pattern of burnPatterns) {
      const match = pattern.exec(text)
      if (match) {
        const amount = match[1].replace(/,/g, "")
        const unit = match[2] || ""
        financialData.burn_rate = `$${amount}${unit.toUpperCase()}/month`
        break
      }
    }

    // Extract runway
    for (const pattern of runwayPatterns) {
      const match = pattern.exec(text)
      if (match) {
        financialData.runway = `${match[1]} ${match[2]}`
        break
      }
    }

    // Return data only if we found something
    const hasData = Object.keys(financialData).length > 0
    return hasData ? financialData : null
  } catch (error) {
    console.error("Error extracting financial data from text:", error)
    return null
  }
}

async function fetchWebContentWithFallback(url: string): Promise<{
  text: string
  financialData: FinancialData | null
  extractionLogs: ExtractionLog[]
  error?: string
}> {
  const extractionLogs: ExtractionLog[] = []
  const isCrunchbaseUrl = url.toLowerCase().includes("crunchbase.com")

  // Strategy 1: Direct web scraping with enhanced headers for Crunchbase
  try {
    console.log(`Attempting direct web scraping for: ${url}`)
    extractionLogs.push(
      await logExtraction("WEB_SCRAPING_START", true, undefined, { url, isCrunchbase: isCrunchbaseUrl }),
    )

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    }

    // Additional headers for Crunchbase
    if (isCrunchbaseUrl) {
      headers["Referer"] = "https://www.google.com/"
      headers["Sec-Fetch-Dest"] = "document"
      headers["Sec-Fetch-Mode"] = "navigate"
      headers["Sec-Fetch-Site"] = "cross-site"
      headers["Cache-Control"] = "no-cache"
      headers["Pragma"] = "no-cache"
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (response.ok) {
      const html = await response.text()
      const text = cleanHtmlToText(html)

      if (text.length > 100) {
        // Minimum viable content
        const financialData = extractFinancialDataFromText(text)
        if (financialData) {
          financialData.extraction_method = "WEB_DIRECT"
          financialData.confidence_score = 75
          extractionLogs.push(
            await logExtraction("WEB_FINANCIAL_EXTRACTION", true, undefined, {
              dataPoints: Object.keys(financialData).length,
            }),
          )
        } else {
          extractionLogs.push(
            await logExtraction("WEB_FINANCIAL_EXTRACTION", false, "No financial data patterns found"),
          )
        }

        console.log(`Direct web scraping successful. Content length: ${text.length}`)
        extractionLogs.push(
          await logExtraction("WEB_SCRAPING", true, undefined, {
            contentLength: text.length,
            hasFinancialData: !!financialData,
          }),
        )

        return {
          text: text.substring(0, 15000),
          financialData,
          extractionLogs,
        }
      }
    }

    const httpError = `HTTP ${response.status}: ${response.statusText}`
    extractionLogs.push(
      await logExtraction("WEB_SCRAPING", false, httpError, {
        status: response.status,
        statusText: response.statusText,
      }),
    )
    throw new Error(httpError)
  } catch (directError) {
    const errorMessage = directError instanceof Error ? directError.message : "Unknown web scraping error"
    console.warn(`Direct web scraping failed: ${errorMessage}`)
    extractionLogs.push(await logExtraction("WEB_SCRAPING", false, errorMessage))

    // Strategy 2: Perplexity API fallback for financial data
    if (PERPLEXITY_API_KEY) {
      try {
        console.log("Attempting Perplexity API fallback for financial data...")
        const perplexityResult = await getPerplexityFinancialData(url)
        extractionLogs.push(...perplexityResult.extractionLogs)

        if (perplexityResult.financialData) {
          console.log("Perplexity API financial extraction successful")
          return {
            text: perplexityResult.financialData.summary || `Financial data extracted from ${url}`,
            financialData: perplexityResult.financialData,
            extractionLogs,
          }
        }
      } catch (perplexityError) {
        const errorMessage = perplexityError instanceof Error ? perplexityError.message : "Perplexity API error"
        console.warn(`Perplexity API fallback failed: ${errorMessage}`)
        extractionLogs.push(await logExtraction("PERPLEXITY_FALLBACK", false, errorMessage))
      }
    }

    // Strategy 3: OpenAI GPT-4 fallback for financial data extraction
    if (OPENAI_API_KEY) {
      try {
        console.log("Attempting OpenAI GPT-4 fallback for financial data...")
        const openaiResult = await getOpenAIFinancialData(url)
        extractionLogs.push(...openaiResult.extractionLogs)

        if (openaiResult.financialData) {
          console.log("OpenAI GPT-4 financial extraction successful")
          return {
            text: openaiResult.financialData.summary || `Financial data extracted from ${url} via AI analysis`,
            financialData: openaiResult.financialData,
            extractionLogs,
          }
        }
      } catch (openaiError) {
        const errorMessage = openaiError instanceof Error ? openaiError.message : "OpenAI API error"
        console.warn(`OpenAI GPT-4 fallback failed: ${errorMessage}`)
        extractionLogs.push(await logExtraction("OPENAI_FALLBACK", false, errorMessage))
      }
    }

    // All strategies failed
    const finalError = `Failed to extract content from URL: ${errorMessage}. All fallback strategies exhausted.`
    extractionLogs.push(await logExtraction("ALL_STRATEGIES_FAILED", false, finalError))

    return {
      text: "",
      financialData: null,
      extractionLogs,
      error: finalError,
    }
  }
}

function cleanHtmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

interface PerplexityResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  citations?: string[]
}

async function getPerplexityFinancialData(url: string): Promise<{
  financialData: FinancialData | null
  extractionLogs: ExtractionLog[]
  error: string | null
}> {
  const extractionLogs: ExtractionLog[] = []

  if (!PERPLEXITY_API_KEY) {
    const error = "Perplexity API key not configured"
    extractionLogs.push(await logExtraction("PERPLEXITY_API_KEY_CHECK", false, error))
    return {
      financialData: null,
      extractionLogs,
      error,
    }
  }

  try {
    extractionLogs.push(await logExtraction("PERPLEXITY_API_START", true, undefined, { url }))

    // Enhanced query with better structure to avoid HTTP 400 errors
    const query = `Research financial information for the company at this URL: ${url}

Please extract and provide:
- Current revenue figures (ARR, MRR, annual revenue)
- Latest funding rounds and amounts
- Company valuation
- Key investors
- Growth metrics and trends
- Burn rate and runway if available
- Employee count and market position

Focus on specific numbers with sources. Provide factual, current information.`

    // Improved request payload to avoid HTTP 400 errors
    const requestPayload = {
      model: "sonar-pro", // Using smaller model to avoid quota issues
      messages: [
        {
          role: "system",
          content:
            "You are a financial research assistant. Extract specific financial data with exact numbers and sources. Be precise and comprehensive. Focus on revenue, funding, valuation, and growth metrics.",
        },
        {
          role: "user",
          content: query,
        },
      ],
      max_tokens: 800, // Reduced to avoid quota issues
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: false,
    }

    extractionLogs.push(
      await logExtraction("PERPLEXITY_REQUEST_PREPARED", true, undefined, {
        model: requestPayload.model,
        maxTokens: requestPayload.max_tokens,
        queryLength: query.length,
      }),
    )

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "DiligenceAI/1.0",
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    // Log response details for debugging
    const responseText = await response.text()

    if (!response.ok) {
      let errorDetails = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = JSON.parse(responseText)
        errorDetails += ` - ${JSON.stringify(errorData)}`
      } catch {
        errorDetails += ` - ${responseText.substring(0, 200)}`
      }

      extractionLogs.push(
        await logExtraction("PERPLEXITY_API_ERROR", false, errorDetails, {
          status: response.status,
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 200),
        }),
      )

      throw new Error(errorDetails)
    }

    const data: PerplexityResponse = JSON.parse(responseText)
    const insights = data.choices?.[0]?.message?.content

    extractionLogs.push(
      await logExtraction("PERPLEXITY_RESPONSE_PARSED", true, undefined, {
        hasContent: !!insights,
        contentLength: insights?.length || 0,
        usage: data.usage,
      }),
    )

    if (!insights) {
      const error = "No financial data found in Perplexity response"
      extractionLogs.push(await logExtraction("PERPLEXITY_NO_CONTENT", false, error))
      return {
        financialData: null,
        extractionLogs,
        error,
      }
    }

    // Parse financial data from the response
    const financialData = parseFinancialDataFromInsights(insights)
    financialData.summary = insights.trim()
    financialData.extraction_method = "PERPLEXITY_API"
    financialData.confidence_score = 70

    extractionLogs.push(
      await logExtraction("PERPLEXITY_FINANCIAL_PARSING", true, undefined, {
        dataPoints: Object.keys(financialData).length,
        hasRevenue: !!financialData.revenue,
        hasFunding: !!financialData.last_funding_amount,
        hasValuation: !!financialData.valuation,
      }),
    )

    return {
      financialData,
      extractionLogs,
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Perplexity API error"
    console.error("Perplexity financial query error:", error)
    extractionLogs.push(await logExtraction("PERPLEXITY_API_FAILED", false, errorMessage))

    return {
      financialData: null,
      extractionLogs,
      error: `Perplexity API error: ${errorMessage}`,
    }
  }
}

async function getOpenAIFinancialData(url: string): Promise<{
  financialData: FinancialData | null
  extractionLogs: ExtractionLog[]
  error: string | null
}> {
  const extractionLogs: ExtractionLog[] = []

  if (!OPENAI_API_KEY) {
    const error = "OpenAI API key not configured"
    extractionLogs.push(await logExtraction("OPENAI_API_KEY_CHECK", false, error))
    return {
      financialData: null,
      extractionLogs,
      error,
    }
  }

  try {
    extractionLogs.push(await logExtraction("OPENAI_API_START", true, undefined, { url }))

    const prompt = `As a financial analyst, research and extract financial information about the company from this URL: ${url}

Please provide a comprehensive financial analysis including:
1. Current revenue (annual, ARR, MRR)
2. Funding history and amounts
3. Latest valuation
4. Key investors
5. Growth metrics
6. Burn rate and runway (if available)
7. Profitability status
8. Employee count and key metrics

Format your response as a detailed financial summary with specific numbers where available. If this is a Crunchbase URL, focus on extracting all available financial metrics from the company profile.

Be specific about numbers and include confidence levels for each data point.`

    extractionLogs.push(
      await logExtraction("OPENAI_REQUEST_PREPARED", true, undefined, {
        promptLength: prompt.length,
      }),
    )

    const { text } = await generateText({
      model: openai("gpt-4o", { apiKey: OPENAI_API_KEY }),
      prompt,
      temperature: 0.1,
      maxTokens: 1000,
    })

    extractionLogs.push(
      await logExtraction("OPENAI_RESPONSE_RECEIVED", true, undefined, {
        responseLength: text?.length || 0,
        hasContent: !!text && text.length > 50,
      }),
    )

    if (!text || text.length < 50) {
      const error = "No meaningful financial data extracted from OpenAI"
      extractionLogs.push(await logExtraction("OPENAI_INSUFFICIENT_CONTENT", false, error))
      return {
        financialData: null,
        extractionLogs,
        error,
      }
    }

    // Parse financial data from the response
    const financialData = parseFinancialDataFromInsights(text)
    financialData.summary = text.trim()
    financialData.extraction_method = "OPENAI_GPT4"
    financialData.confidence_score = 60

    extractionLogs.push(
      await logExtraction("OPENAI_FINANCIAL_PARSING", true, undefined, {
        dataPoints: Object.keys(financialData).length,
        hasRevenue: !!financialData.revenue,
        hasFunding: !!financialData.last_funding_amount,
        hasValuation: !!financialData.valuation,
      }),
    )

    return {
      financialData,
      extractionLogs,
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown OpenAI API error"
    console.error("OpenAI financial query error:", error)
    extractionLogs.push(await logExtraction("OPENAI_API_FAILED", false, errorMessage))

    return {
      financialData: null,
      extractionLogs,
      error: `OpenAI API error: ${errorMessage}`,
    }
  }
}

function parseFinancialDataFromInsights(insights: string): FinancialData {
  const financialData: FinancialData = {}
  const lowerInsights = insights.toLowerCase()

  // Enhanced parsing patterns
  const patterns = {
    revenue: [
      /revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /arr[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /annual recurring revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ],
    mrr: [
      /mrr[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /monthly recurring revenue[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ],
    valuation: [
      /valuation[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /valued at[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ],
    funding: [
      /(?:raised|funding)[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
      /series [a-z][:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi,
    ],
    growth: [/growth[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi, /growing[:\s]*([\d,]+(?:\.\d+)?)\s*%/gi],
    burn: [/burn rate[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi, /monthly burn[:\s]*\$?([\d,]+(?:\.\d+)?)\s*([kmb])?/gi],
  }

  // Extract revenue
  for (const pattern of patterns.revenue) {
    const match = pattern.exec(insights)
    if (match) {
      financialData.revenue = `$${match[1]}${match[2] || ""}`
      break
    }
  }

  // Extract MRR
  for (const pattern of patterns.mrr) {
    const match = pattern.exec(insights)
    if (match) {
      financialData.arr_mrr = `$${match[1]}${match[2] || ""} MRR`
      break
    }
  }

  // Extract valuation
  for (const pattern of patterns.valuation) {
    const match = pattern.exec(insights)
    if (match) {
      financialData.valuation = `$${match[1]}${match[2] || ""}`
      break
    }
  }

  // Extract funding
  const fundingMatches: string[] = []
  for (const pattern of patterns.funding) {
    let match
    while ((match = pattern.exec(insights)) !== null) {
      fundingMatches.push(`$${match[1]}${match[2] || ""}`)
    }
  }
  if (fundingMatches.length > 0) {
    financialData.funding_rounds = fundingMatches
    financialData.last_funding_amount = fundingMatches[fundingMatches.length - 1]
  }

  // Extract growth
  for (const pattern of patterns.growth) {
    const match = pattern.exec(insights)
    if (match) {
      financialData.growth_rate = `${match[1]}%`
      break
    }
  }

  // Extract burn rate
  for (const pattern of patterns.burn) {
    const match = pattern.exec(insights)
    if (match) {
      financialData.burn_rate = `$${match[1]}${match[2] || ""}/month`
      break
    }
  }

  return financialData
}

function calculateInvestmentScore(
  content: string,
  financialData: FinancialData | null,
  perplexityInsights: string | null,
  companyName: string,
): {
  score: number
  breakdown: ScoreBreakdown
  justification: InvestmentAnalysis["scoreJustification"]
} {
  const breakdown: ScoreBreakdown = {
    team_experience: 0,
    market_size: 0,
    traction: 0,
    financial_performance: 0,
    competitive_advantage: 0,
    risk_factors: 0,
    data_quality: 0,
  }

  const justification: InvestmentAnalysis["scoreJustification"] = {
    team_experience: "",
    market_size: "",
    traction: "",
    financial_performance: "",
    competitive_advantage: "",
    risk_factors: "",
    data_quality: "",
  }

  const lowerContent = content.toLowerCase()
  const allContent = `${content} ${perplexityInsights || ""}`.toLowerCase()

  // 1. Team Experience (0-20 points)
  let teamScore = 0
  const teamIndicators = {
    experience: /(?:years? of experience|previous|former|ex-|founded|built|led|managed)/gi,
    education: /(?:stanford|harvard|mit|berkeley|phd|mba|degree)/gi,
    exits: /(?:exit|acquired|ipo|sold|founded)/gi,
    leadership: /(?:ceo|cto|cfo|founder|co-founder|vp|director)/gi,
  }

  Object.entries(teamIndicators).forEach(([key, pattern]) => {
    const matches = allContent.match(pattern) || []
    if (matches.length > 0) {
      teamScore += Math.min(matches.length * 2, 5)
    }
  })

  breakdown.team_experience = Math.min(teamScore, 20)
  justification.team_experience = `Team experience score: ${breakdown.team_experience}/20. ${
    teamScore > 15
      ? "Strong leadership team with proven track record"
      : teamScore > 10
        ? "Experienced team with relevant background"
        : teamScore > 5
          ? "Some team experience evident"
          : "Limited team information available"
  }`

  // 2. Market Size (0-15 points)
  let marketScore = 0
  const marketIndicators = {
    size: /(?:\$[\d,]+[kmb]?\s*(?:market|tam|addressable)|\d+\s*billion|\d+\s*million)/gi,
    growth: /(?:growing|growth|expanding|increasing).*(?:\d+%|percent)/gi,
    opportunity: /(?:opportunity|potential|market size|addressable market)/gi,
  }

  Object.entries(marketIndicators).forEach(([key, pattern]) => {
    const matches = allContent.match(pattern) || []
    if (matches.length > 0) {
      marketScore += Math.min(matches.length * 3, 5)
    }
  })

  breakdown.market_size = Math.min(marketScore, 15)
  justification.market_size = `Market size score: ${breakdown.market_size}/15. ${
    marketScore > 12
      ? "Large, well-defined market opportunity"
      : marketScore > 8
        ? "Significant market potential identified"
        : marketScore > 4
          ? "Some market opportunity evident"
          : "Limited market size information"
  }`

  // 3. Traction (0-25 points)
  let tractionScore = 0

  // Revenue indicators
  if (financialData?.revenue) {
    const revenueValue = Number.parseFloat(financialData.revenue.replace(/[^\d.]/g, ""))
    if (revenueValue > 10)
      tractionScore += 10 // Significant revenue
    else if (revenueValue > 1)
      tractionScore += 7 // Some revenue
    else if (revenueValue > 0) tractionScore += 4 // Early revenue
  }

  // Growth indicators
  if (financialData?.growth_rate) {
    const growthValue = Number.parseFloat(financialData.growth_rate.replace(/[^\d.]/g, ""))
    if (growthValue > 100)
      tractionScore += 8 // High growth
    else if (growthValue > 50)
      tractionScore += 6 // Good growth
    else if (growthValue > 20)
      tractionScore += 4 // Moderate growth
    else if (growthValue > 0) tractionScore += 2 // Some growth
  }

  // Customer/user indicators
  const tractionIndicators = /(?:customers?|users?|clients?|subscribers?).*(?:\d+[kmb]?|\d+,\d+)/gi
  const tractionMatches = allContent.match(tractionIndicators) || []
  tractionScore += Math.min(tractionMatches.length * 2, 7)

  breakdown.traction = Math.min(tractionScore, 25)
  justification.traction = `Traction score: ${breakdown.traction}/25. ${
    tractionScore > 20
      ? "Strong traction with significant revenue and growth"
      : tractionScore > 15
        ? "Good traction with measurable progress"
        : tractionScore > 10
          ? "Early traction indicators present"
          : tractionScore > 5
            ? "Some traction evidence"
            : "Limited traction information available"
  }`

  // 4. Financial Performance (0-20 points)
  let financialScore = 0

  if (financialData) {
    // Revenue quality
    if (financialData.revenue) financialScore += 5
    if (financialData.arr_mrr) financialScore += 4
    if (financialData.growth_rate) financialScore += 3

    // Funding and valuation
    if (financialData.last_funding_amount) financialScore += 3
    if (financialData.valuation) financialScore += 2

    // Burn and runway
    if (financialData.burn_rate) financialScore += 2
    if (financialData.runway) financialScore += 1
  }

  breakdown.financial_performance = Math.min(financialScore, 20)
  justification.financial_performance = `Financial performance score: ${breakdown.financial_performance}/20. ${
    financialScore > 15
      ? "Strong financial metrics with clear revenue model"
      : financialScore > 10
        ? "Good financial foundation with key metrics available"
        : financialScore > 5
          ? "Some financial data available"
          : "Limited financial information"
  }`

  // 5. Competitive Advantage (0-10 points)
  let competitiveScore = 0
  const competitiveIndicators = {
    ip: /(?:patent|intellectual property|proprietary|trademark)/gi,
    technology: /(?:ai|machine learning|blockchain|innovative|breakthrough)/gi,
    moat: /(?:moat|barrier|competitive advantage|differentiation)/gi,
    partnerships: /(?:partnership|strategic|alliance|integration)/gi,
  }

  Object.entries(competitiveIndicators).forEach(([key, pattern]) => {
    const matches = allContent.match(pattern) || []
    if (matches.length > 0) {
      competitiveScore += Math.min(matches.length, 3)
    }
  })

  breakdown.competitive_advantage = Math.min(competitiveScore, 10)
  justification.competitive_advantage = `Competitive advantage score: ${breakdown.competitive_advantage}/10. ${
    competitiveScore > 8
      ? "Strong competitive moats and differentiation"
      : competitiveScore > 5
        ? "Some competitive advantages identified"
        : competitiveScore > 2
          ? "Limited competitive differentiation"
          : "No clear competitive advantages"
  }`

  // 6. Risk Factors (0 to -15 points)
  let riskScore = 0
  const riskIndicators = {
    legal: /(?:lawsuit|litigation|legal issues|regulatory)/gi,
    financial: /(?:debt|loss|negative|deficit|bankruptcy)/gi,
    market: /(?:declining|shrinking|competitive|saturated)/gi,
    team: /(?:turnover|left|departed|resigned)/gi,
  }

  Object.entries(riskIndicators).forEach(([key, pattern]) => {
    const matches = allContent.match(pattern) || []
    if (matches.length > 0) {
      riskScore -= Math.min(matches.length * 2, 5)
    }
  })

  breakdown.risk_factors = Math.max(riskScore, -15)
  justification.risk_factors = `Risk factors score: ${breakdown.risk_factors}/0. ${
    riskScore < -10
      ? "Significant risk factors identified"
      : riskScore < -5
        ? "Some risk factors present"
        : riskScore < 0
          ? "Minor risk factors noted"
          : "No major risk factors identified"
  }`

  // 7. Data Quality (0-10 points)
  let dataScore = 0

  // Content quality
  if (content.length > 5000) dataScore += 3
  else if (content.length > 2000) dataScore += 2
  else if (content.length > 500) dataScore += 1

  // Financial data quality
  if (financialData) {
    dataScore += 2
    if (financialData.confidence_score && financialData.confidence_score > 70) dataScore += 2
  }

  // External validation
  if (perplexityInsights && perplexityInsights.length > 500) dataScore += 3

  breakdown.data_quality = Math.min(dataScore, 10)
  justification.data_quality = `Data quality score: ${breakdown.data_quality}/10. ${
    dataScore > 8
      ? "High-quality, comprehensive data available"
      : dataScore > 6
        ? "Good data quality with multiple sources"
        : dataScore > 4
          ? "Adequate data for analysis"
          : "Limited data quality"
  }`

  // Calculate total score
  const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0)
  const normalizedScore = Math.max(0, Math.min(100, totalScore))

  return {
    score: normalizedScore,
    breakdown,
    justification,
  }
}

function generateInvestmentRecommendation(
  score: number,
  breakdown: ScoreBreakdown,
  financialData: FinancialData | null,
  redFlagsCount: number,
): {
  recommendation: InvestmentAnalysis["recommendation"]
  justification: string[]
  riskLevel: "low" | "medium" | "high"
} {
  let recommendation: InvestmentAnalysis["recommendation"]
  const justification: string[] = []
  let riskLevel: "low" | "medium" | "high"

  // Determine recommendation based on score and key factors
  if (score >= 80 && breakdown.financial_performance >= 15 && breakdown.team_experience >= 15 && redFlagsCount <= 1) {
    recommendation = "RECOMMENDED TO INVEST"
    riskLevel = "low"
    justification.push("High overall score with strong financial performance and experienced team")
    justification.push("Minimal risk factors identified")
    justification.push("Strong market opportunity and competitive positioning")
  } else if (score >= 65 && breakdown.financial_performance >= 10 && redFlagsCount <= 3) {
    recommendation = "PROCEED WITH CAUTION"
    riskLevel = score >= 75 ? "medium" : "high"
    justification.push("Moderate overall score with acceptable financial metrics")
    if (breakdown.team_experience < 10) justification.push("Team experience requires further validation")
    if (breakdown.traction < 15) justification.push("Traction metrics need improvement")
    if (redFlagsCount > 1) justification.push(`${redFlagsCount} risk factors require attention`)
  } else if (score >= 40 && breakdown.data_quality >= 5) {
    recommendation = "DO NOT INVEST"
    riskLevel = "high"
    justification.push("Below-threshold overall score indicates high investment risk")
    if (breakdown.financial_performance < 10) justification.push("Insufficient financial performance")
    if (breakdown.team_experience < 8) justification.push("Weak team credentials")
    if (redFlagsCount > 3) justification.push("Too many risk factors identified")
  } else {
    recommendation = "INSUFFICIENT DATA"
    riskLevel = "medium"
    justification.push("Insufficient data quality for reliable investment assessment")
    justification.push("Additional due diligence and documentation required")
    if (breakdown.data_quality < 5) justification.push("Poor data quality limits analysis confidence")
  }

  return {
    recommendation,
    justification,
    riskLevel,
  }
}

function cleanAndParseJSON(text: string): any {
  try {
    // Remove any markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "")

    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim()

    // Find the first { and last } to extract just the JSON
    const firstBrace = cleaned.indexOf("{")
    const lastBrace = cleaned.lastIndexOf("}")

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1)
    }

    // Try to parse the cleaned JSON
    return JSON.parse(cleaned)
  } catch (error) {
    console.error("JSON parsing failed:", error)
    console.error("Attempted to parse:", text.substring(0, 500))
    throw new Error(`Invalid JSON response: ${error.message}`)
  }
}

function createFallbackAnalysis(
  companyName: string,
  contentSource: string,
  financialData: FinancialData | null,
  extractionLogs: ExtractionLog[],
  errorDetails: InvestmentAnalysis["errorDetails"],
): InvestmentAnalysis {
  const scoreResult = calculateInvestmentScore("", financialData, null, companyName)
  const recommendationResult = generateInvestmentRecommendation(
    scoreResult.score,
    scoreResult.breakdown,
    financialData,
    1,
  )

  const financialSummary = financialData
    ? `Financial data extracted via ${financialData.extraction_method}: ${Object.entries(financialData)
        .filter(([key, value]) => value && !["extraction_method", "confidence_score", "summary"].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")}.`
    : "No financial data available."

  const errorSummary = errorDetails
    ? `Extraction encountered ${Object.values(errorDetails).flat().length} errors across multiple methods. `
    : ""

  return {
    executiveSummary: `Analysis of ${companyName} has been completed with automated processing. The company has provided ${contentSource.toLowerCase()} for evaluation. ${financialSummary} ${errorSummary}This preliminary analysis identifies key areas for further investigation and provides a foundation for comprehensive due diligence. Manual review and additional documentation are recommended to supplement this automated analysis.`,
    score: scoreResult.score,
    scoreBreakdown: scoreResult.breakdown,
    scoreJustification: scoreResult.justification,
    recommendation: recommendationResult.recommendation,
    recommendationJustification: recommendationResult.justification,
    riskLevel: recommendationResult.riskLevel,
    redFlags: [
      {
        severity: "medium",
        category: "Documentation",
        title: "Limited Information Available",
        description: "The automated analysis was based on limited available information",
        evidence: "Processing constraints limited the depth of automated analysis",
        impact: "May require additional manual due diligence to fully assess investment risk",
        recommendation: "Request comprehensive financial statements, detailed business plan, and team credentials",
      },
      ...(errorDetails && Object.values(errorDetails).flat().length > 0
        ? [
            {
              severity: "low" as const,
              category: "Analysis",
              title: "Data Extraction Challenges",
              description: "Multiple data extraction methods encountered issues",
              evidence: `Errors: ${Object.values(errorDetails).flat().join("; ")}`,
              impact: "May lack comprehensive market context and financial details",
              recommendation: "Provide additional documentation and consider manual data verification",
            },
          ]
        : []),
    ],
    verification: [
      {
        category: "Content Processing",
        status: "partial",
        confidence: 60,
        details: "Basic content extraction and analysis completed successfully",
        sources: "Provided documentation and automated processing systems",
        recommendations: "Manual verification of all financial claims and team credentials recommended",
      },
    ],
    followUpQuestions: [
      {
        category: "Financial Due Diligence",
        priority: "high",
        questions: [
          "Can you provide audited financial statements for the past 2-3 years?",
          "What are your current monthly recurring revenue and growth metrics?",
          "What is your customer acquisition cost and lifetime value?",
          "What is your current burn rate and runway?",
        ],
      },
    ],
    keyMetrics: {
      financial: financialData
        ? {
            revenue: financialData.revenue || "Requires verification",
            growth: financialData.growth_rate || "Requires verification",
            funding: financialData.last_funding_amount || "Requires verification",
            burn: financialData.burn_rate || "Requires verification",
            valuation: financialData.valuation || "Requires verification",
            arr_mrr: financialData.arr_mrr || "Requires verification",
          }
        : {
            revenue: "Requires verification",
            growth: "Requires verification",
            funding: "Requires verification",
            burn: "Requires verification",
          },
      market: {
        tam: "Requires analysis",
        competition: "Requires analysis",
        positioning: "Requires analysis",
      },
      team: {
        experience: "Requires verification",
        completeness: "Requires assessment",
        credibility: "Requires verification",
      },
    },
    strengths: [
      "Company is actively seeking investment and has provided documentation",
      "Appears to have a structured approach to fundraising",
      ...(financialData ? ["Financial data successfully extracted and analyzed"] : []),
    ],
    concerns: [
      "Limited information available for comprehensive automated analysis",
      "Requires additional documentation for full risk assessment",
      ...(errorDetails && Object.values(errorDetails).flat().length > 0
        ? ["Data extraction encountered multiple challenges"]
        : []),
    ],
    investmentRecommendation: {
      recommendation: recommendationResult.recommendation.toLowerCase().replace(/ /g, "_"),
      reasoning: recommendationResult.justification.join(". "),
      conditions: "Successful completion of detailed financial, market, and team analysis with verified documentation",
    },
    financialData: financialData || undefined,
    extractionLogs,
    errorDetails,
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const allExtractionLogs: ExtractionLog[] = []
  const errorDetails: InvestmentAnalysis["errorDetails"] = {
    crunchbaseErrors: [],
    perplexityErrors: [],
    openaiErrors: [],
    generalErrors: [],
  }

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const companyName = formData.get("companyName") as string
    const additionalNotes = formData.get("additionalNotes") as string
    const analysisType = formData.get("analysisType") as string

    // Validate required fields
    if (!companyName?.trim()) {
      return NextResponse.json({ success: false, error: "Company name is required" }, { status: 400 })
    }

    if (!analysisType || !["pdf", "url", "dataroom"].includes(analysisType)) {
      return NextResponse.json({ success: false, error: "Valid analysis type is required" }, { status: 400 })
    }

    let content = ""
    let contentSource = ""
    let extractedFinancialData: FinancialData | null = null

    // Extract content based on analysis type
    try {
      if (analysisType === "pdf") {
        const file = formData.get("file") as File
        if (!file) {
          return NextResponse.json({ success: false, error: "No file provided for PDF analysis" }, { status: 400 })
        }

        if (file.type !== "application/pdf") {
          return NextResponse.json({ success: false, error: "Only PDF files are supported" }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const pdfResult = await extractTextFromPDF(buffer)

        allExtractionLogs.push(...pdfResult.extractionLogs)

        if (pdfResult.error) {
          errorDetails.generalErrors?.push(`PDF extraction: ${pdfResult.error}`)
          console.error("PDF extraction failed:", pdfResult.error)
        }

        content = pdfResult.text
        extractedFinancialData = pdfResult.financialData
        contentSource = `PDF: ${file.name}`
      } else if (analysisType === "url") {
        const url = formData.get("url") as string
        if (!url?.trim()) {
          return NextResponse.json({ success: false, error: "No URL provided for web analysis" }, { status: 400 })
        }

        // Validate URL format
        try {
          new URL(url)
        } catch {
          return NextResponse.json({ success: false, error: "Invalid URL format" }, { status: 400 })
        }

        const webResult = await fetchWebContentWithFallback(url)
        allExtractionLogs.push(...webResult.extractionLogs)

        if (webResult.error) {
          if (url.toLowerCase().includes("crunchbase.com")) {
            errorDetails.crunchbaseErrors?.push(`Web content extraction: ${webResult.error}`)
          } else {
            errorDetails.generalErrors?.push(`Web content extraction: ${webResult.error}`)
          }
          console.error("Web content extraction failed:", webResult.error)
        }

        content = webResult.text
        extractedFinancialData = webResult.financialData
        contentSource = `URL: ${url}`
      } else if (analysisType === "dataroom") {
        const dataroomUrl = formData.get("dataroomUrl") as string
        if (!dataroomUrl?.trim()) {
          return NextResponse.json({ success: false, error: "No data room URL provided" }, { status: 400 })
        }

        // For data room analysis, we analyze the link structure and any accessible metadata
        const platform = dataroomUrl.includes("drive.google.com")
          ? "Google Drive"
          : dataroomUrl.includes("dropbox.com")
            ? "Dropbox"
            : dataroomUrl.includes("box.com")
              ? "Box"
              : "File sharing platform"

        content = `Data room analysis for ${companyName}. Platform: ${platform}. URL: ${dataroomUrl}. This appears to be a structured data room containing company documents. Direct content access may be limited due to privacy settings, but the presence of an organized data room suggests the company has prepared comprehensive documentation for due diligence.`
        contentSource = `Data Room: ${platform}`

        allExtractionLogs.push(
          await logExtraction("DATAROOM_ANALYSIS", true, undefined, {
            platform,
            url: dataroomUrl,
          }),
        )
      }
    } catch (extractionError) {
      const errorMessage = extractionError instanceof Error ? extractionError.message : "Unknown extraction error"
      errorDetails.generalErrors?.push(`Content extraction: ${errorMessage}`)
      console.error("Content extraction error:", extractionError)
      allExtractionLogs.push(await logExtraction("CONTENT_EXTRACTION_FAILED", false, errorMessage))

      // Continue with empty content to attempt fallback
      content = ""
    }

    // Get external research data (Perplexity insights)
    let perplexityInsights: string | null = null
    let perplexityError: string | null = null

    if (PERPLEXITY_API_KEY) {
      try {
        console.log("Starting Perplexity web research for:", companyName)
        allExtractionLogs.push(await logExtraction("PERPLEXITY_RESEARCH_START", true, undefined, { companyName }))

        const perplexityResult = await getPerplexityWebInsights(companyName)
        allExtractionLogs.push(...perplexityResult.extractionLogs)

        perplexityInsights = perplexityResult.insights
        perplexityError = perplexityResult.error

        if (perplexityError) {
          errorDetails.perplexityErrors?.push(perplexityError)
        }

        console.log("Perplexity research completed:", {
          hasInsights: !!perplexityInsights,
          error: perplexityError,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown Perplexity error"
        perplexityError = `Perplexity API error: ${errorMessage}`
        errorDetails.perplexityErrors?.push(perplexityError)
        console.error("Perplexity research failed:", error)
        allExtractionLogs.push(await logExtraction("PERPLEXITY_RESEARCH_FAILED", false, errorMessage))
      }
    }

    // If no content was extracted and we have extraction errors, create minimal content
    if (!content.trim() && Object.values(errorDetails).flat().length > 0) {
      content = `Analysis request for ${companyName}. Content extraction encountered issues: ${Object.values(errorDetails).flat().join("; ")}. Analysis will proceed with available external research data.`
      allExtractionLogs.push(
        await logExtraction("FALLBACK_CONTENT_CREATED", true, undefined, {
          contentLength: content.length,
        }),
      )
    }

    // Calculate investment score using robust scoring system
    const scoreResult = calculateInvestmentScore(content, extractedFinancialData, perplexityInsights, companyName)
    allExtractionLogs.push(
      await logExtraction("INVESTMENT_SCORE_CALCULATED", true, undefined, {
        score: scoreResult.score,
        breakdown: scoreResult.breakdown,
      }),
    )

    // Generate investment recommendation
    const recommendationResult = generateInvestmentRecommendation(
      scoreResult.score,
      scoreResult.breakdown,
      extractedFinancialData,
      0, // Will be updated after red flags analysis
    )

    allExtractionLogs.push(
      await logExtraction("INVESTMENT_RECOMMENDATION_GENERATED", true, undefined, {
        recommendation: recommendationResult.recommendation,
        riskLevel: recommendationResult.riskLevel,
      }),
    )

    // Create comprehensive analysis prompt for OpenAI
    const analysisPrompt = `You are a senior venture capital analyst with 15+ years of experience. Analyze this startup for investment potential.

COMPANY: ${companyName}
SOURCE: ${contentSource}
ADDITIONAL CONTEXT: ${additionalNotes || "None provided"}

CONTENT DATA:
${content.substring(0, 8000)}

${
  extractedFinancialData
    ? `
EXTRACTED FINANCIAL DATA:
${JSON.stringify(extractedFinancialData, null, 2)}
`
    : ""
}

${
  perplexityInsights
    ? `
EXTERNAL RESEARCH:
${perplexityInsights.substring(0, 4000)}
`
    : ""
}

SCORING ANALYSIS:
- Overall Score: ${scoreResult.score}/100
- Team Experience: ${scoreResult.breakdown.team_experience}/20
- Market Size: ${scoreResult.breakdown.market_size}/15  
- Traction: ${scoreResult.breakdown.traction}/25
- Financial Performance: ${scoreResult.breakdown.financial_performance}/20
- Competitive Advantage: ${scoreResult.breakdown.competitive_advantage}/10
- Risk Factors: ${scoreResult.breakdown.risk_factors}/0
- Data Quality: ${scoreResult.breakdown.data_quality}/10

RECOMMENDATION: ${recommendationResult.recommendation}

ERROR CONTEXT:
${Object.values(errorDetails).flat().length > 0 ? `Extraction encountered ${Object.values(errorDetails).flat().length} errors: ${Object.values(errorDetails).flat().join("; ")}` : "No significant extraction errors"}

Provide your analysis as a valid JSON object with this EXACT structure:

{
  "executiveSummary": "2-3 paragraph executive summary incorporating the scoring analysis and financial data",
  "score": ${scoreResult.score},
  "scoreBreakdown": ${JSON.stringify(scoreResult.breakdown)},
  "scoreJustification": ${JSON.stringify(scoreResult.justification)},
  "recommendation": "${recommendationResult.recommendation}",
  "recommendationJustification": ${JSON.stringify(recommendationResult.justification)},
  "riskLevel": "${recommendationResult.riskLevel}",
  "redFlags": [
    {
      "severity": "high|medium|low",
      "category": "Financial|Technical|Market|Team|Legal|Operations",
      "title": "Specific red flag title",
      "description": "Detailed description",
      "evidence": "Evidence from content",
      "impact": "Investment impact",
      "recommendation": "Action to take"
    }
  ],
  "verification": [
    {
      "category": "Financial Metrics|Team Credentials|Market Claims|Technical Claims",
      "status": "verified|partial|unverified|concerning",
      "confidence": 85,
      "details": "Verification findings",
      "sources": "Sources used",
      "recommendations": "Next steps"
    }
  ],
  "followUpQuestions": [
    {
      "category": "Financial Due Diligence|Technical Due Diligence|Market Analysis|Team Assessment",
      "priority": "high|medium|low",
      "questions": ["Question 1", "Question 2"]
    }
  ],
  "keyMetrics": {
    "financial": {
      "revenue": "${extractedFinancialData?.revenue || "N/A"}",
      "growth": "${extractedFinancialData?.growth_rate || "N/A"}",
      "funding": "${extractedFinancialData?.last_funding_amount || "N/A"}",
      "burn": "${extractedFinancialData?.burn_rate || "N/A"}",
      "valuation": "${extractedFinancialData?.valuation || "N/A"}",
      "arr_mrr": "${extractedFinancialData?.arr_mrr || "N/A"}"
    },
    "market": {
      "tam": "Market size analysis",
      "competition": "Competitive analysis", 
      "positioning": "Market position"
    },
    "team": {
      "experience": "Team experience assessment",
      "completeness": "Team completeness",
      "credibility": "Credibility assessment"
    }
  },
  "strengths": ["Strength 1", "Strength 2"],
  "concerns": ["Concern 1", "Concern 2"],
  "investmentRecommendation": {
    "recommendation": "${recommendationResult.recommendation.toLowerCase().replace(/ /g, "_")}",
    "reasoning": "${recommendationResult.justification.join(". ")}",
    "conditions": "Conditions for investment"
  }
}`

    // Generate analysis using OpenAI
    let analysisResult: InvestmentAnalysis
    try {
      if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured")
      }

      allExtractionLogs.push(
        await logExtraction("OPENAI_ANALYSIS_START", true, undefined, {
          promptLength: analysisPrompt.length,
        }),
      )

      const { text } = await generateText({
        model: openai("gpt-4o", { apiKey: OPENAI_API_KEY }),
        prompt: analysisPrompt,
        temperature: 0.1,
        maxTokens: 4000,
      })

      allExtractionLogs.push(
        await logExtraction("OPENAI_ANALYSIS_COMPLETED", true, undefined, {
          responseLength: text?.length || 0,
        }),
      )

      // Parse the AI response
      const parsedResult = cleanAndParseJSON(text)

      // Ensure all required fields are present and properly formatted
      analysisResult = {
        executiveSummary:
          parsedResult.executiveSummary ||
          `Analysis of ${companyName} completed with score of ${scoreResult.score}/100.`,
        score: scoreResult.score,
        scoreBreakdown: scoreResult.breakdown,
        scoreJustification: scoreResult.justification,
        recommendation: recommendationResult.recommendation,
        recommendationJustification: recommendationResult.justification,
        riskLevel: recommendationResult.riskLevel,
        redFlags: parsedResult.redFlags || [],
        verification: parsedResult.verification || [],
        followUpQuestions: parsedResult.followUpQuestions || [],
        keyMetrics: parsedResult.keyMetrics || {
          financial: {},
          market: {},
          team: {},
        },
        strengths: parsedResult.strengths || [],
        concerns: parsedResult.concerns || [],
        investmentRecommendation: parsedResult.investmentRecommendation || {
          recommendation: recommendationResult.recommendation.toLowerCase().replace(/ /g, "_"),
          reasoning: recommendationResult.justification.join(". "),
          conditions: "Additional due diligence required",
        },
        financialData: extractedFinancialData || undefined,
        extractionLogs: allExtractionLogs,
        errorDetails,
      }

      allExtractionLogs.push(
        await logExtraction("ANALYSIS_PARSING_COMPLETED", true, undefined, {
          redFlagsCount: analysisResult.redFlags.length,
          hasFinancialData: !!analysisResult.financialData,
        }),
      )
    } catch (aiError) {
      const errorMessage = aiError instanceof Error ? aiError.message : "Unknown AI analysis error"
      console.error("AI analysis failed:", aiError)
      errorDetails.openaiErrors?.push(`AI analysis failed: ${errorMessage}`)
      allExtractionLogs.push(await logExtraction("OPENAI_ANALYSIS_FAILED", false, errorMessage))

      // Use fallback analysis with all available data
      analysisResult = createFallbackAnalysis(
        companyName,
        contentSource,
        extractedFinancialData,
        allExtractionLogs,
        errorDetails,
      )
    }

    const processingTime = Date.now() - startTime
    allExtractionLogs.push(
      await logExtraction("ANALYSIS_COMPLETED", true, undefined, {
        processingTime,
        totalLogs: allExtractionLogs.length,
        totalErrors: Object.values(errorDetails).flat().length,
      }),
    )

    // Save analysis to database
    try {
      const insertData = {
        user_id: user.id,
        company_name: companyName.trim(),
        content_source: contentSource,
        additional_notes: additionalNotes?.trim() || null,
        status: "completed" as const,
        risk_level: analysisResult.riskLevel as "low" | "medium" | "high",
        red_flags_count: analysisResult.redFlags?.length || 0,
        overall_score: analysisResult.score,
        processing_time: processingTime,
        analysis_result: analysisResult,
        perplexity_data: perplexityInsights
          ? {
              insights: perplexityInsights,
              timestamp: new Date().toISOString(),
            }
          : perplexityError
            ? {
                error: perplexityError,
                timestamp: new Date().toISOString(),
              }
            : null,
      }

      console.log("Attempting to save analysis with data:", {
        ...insertData,
        analysis_result: "...", // Don't log full analysis
        perplexity_data: perplexityInsights ? "..." : perplexityError || null,
      })

      const { data: analysisData, error: dbError } = await supabase
        .from("analyses")
        .insert(insertData)
        .select()
        .single()

      if (dbError) {
        console.error("Database error details:", dbError)
        throw new Error(`Database save failed: ${dbError.message}`)
      }

      console.log("Analysis saved successfully with ID:", analysisData.id)

      return NextResponse.json({
        success: true,
        analysisId: analysisData.id,
        analysis: analysisResult,
        processingTime,
        extractionLogs: allExtractionLogs,
        errorDetails,
        extractionSummary: {
          totalAttempts: allExtractionLogs.length,
          successfulAttempts: allExtractionLogs.filter((log) => log.success).length,
          failedAttempts: allExtractionLogs.filter((log) => !log.success).length,
          crunchbaseErrors: errorDetails.crunchbaseErrors?.length || 0,
          perplexityErrors: errorDetails.perplexityErrors?.length || 0,
          openaiErrors: errorDetails.openaiErrors?.length || 0,
          generalErrors: errorDetails.generalErrors?.length || 0,
        },
        financialDataExtracted: !!extractedFinancialData,
        financialExtractionMethod: extractedFinancialData?.extraction_method || null,
        perplexityStatus: {
          success: !!perplexityInsights,
          error: perplexityError,
        },
        message: "Analysis completed successfully with comprehensive error handling and logging",
      })
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : "Unknown database error"
      console.error("Database save error:", dbError)
      allExtractionLogs.push(await logExtraction("DATABASE_SAVE_FAILED", false, errorMessage))

      return NextResponse.json(
        {
          success: false,
          error: `Failed to save analysis: ${errorMessage}`,
          details: "Please check database schema and permissions",
          extractionLogs: allExtractionLogs,
          errorDetails,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown analysis error"
    console.error("Analysis error:", error)
    allExtractionLogs.push(await logExtraction("ANALYSIS_FAILED", false, errorMessage))

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || "Failed to analyze content",
        processingTime: Date.now() - startTime,
        extractionLogs: allExtractionLogs,
        errorDetails,
      },
      { status: 500 },
    )
  }
}

async function getPerplexityWebInsights(companyName: string): Promise<{
  insights: string | null
  extractionLogs: ExtractionLog[]
  error: string | null
}> {
  const extractionLogs: ExtractionLog[] = []

  if (!PERPLEXITY_API_KEY) {
    const error = "Perplexity API key not configured"
    extractionLogs.push(await logExtraction("PERPLEXITY_WEB_API_KEY_CHECK", false, error))
    return {
      insights: null,
      extractionLogs,
      error,
    }
  }

  try {
    extractionLogs.push(await logExtraction("PERPLEXITY_WEB_RESEARCH_START", true, undefined, { companyName }))

    const query = `Research the startup company "${companyName}": recent news, funding rounds, team background, market position, competitors, financial metrics, and any red flags or concerns. Focus on factual, up-to-date information from reliable sources.`

    // Improved request payload to avoid HTTP 400 errors
    const requestPayload = {
      model: "sonar-pro", // Using smaller model to avoid quota issues
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant helping with startup due diligence. Provide factual, current information with sources when possible. Focus on financial metrics, team credibility, market position, and potential risks.",
        },
        {
          role: "user",
          content: query,
        },
      ],
      max_tokens: 1000, // Reduced to avoid quota issues
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: false,
    }

    extractionLogs.push(
      await logExtraction("PERPLEXITY_WEB_REQUEST_PREPARED", true, undefined, {
        model: requestPayload.model,
        maxTokens: requestPayload.max_tokens,
        queryLength: query.length,
      }),
    )

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "DiligenceAI/1.0",
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    // Log response details for debugging
    const responseText = await response.text()

    if (!response.ok) {
      let errorDetails = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = JSON.parse(responseText)
        errorDetails += ` - ${JSON.stringify(errorData)}`
      } catch {
        errorDetails += ` - ${responseText.substring(0, 200)}`
      }

      extractionLogs.push(
        await logExtraction("PERPLEXITY_WEB_API_ERROR", false, errorDetails, {
          status: response.status,
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 200),
        }),
      )

      throw new Error(errorDetails)
    }

    const data = JSON.parse(responseText)
    const insights = data.choices?.[0]?.message?.content

    extractionLogs.push(
      await logExtraction("PERPLEXITY_WEB_RESPONSE_PARSED", true, undefined, {
        hasContent: !!insights,
        contentLength: insights?.length || 0,
        usage: data.usage,
      }),
    )

    return {
      insights: insights || null,
      extractionLogs,
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Perplexity web research error"
    console.error("Perplexity web research error:", error)
    extractionLogs.push(await logExtraction("PERPLEXITY_WEB_RESEARCH_FAILED", false, errorMessage))

    return {
      insights: null,
      extractionLogs,
      error: `Perplexity web research error: ${errorMessage}`,
    }
  }
}
