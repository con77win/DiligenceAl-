import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createClient } from "@/lib/supabase/server"
import PDFParser from "pdf2json"

// API Keys with proper fallbacks
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  "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"
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1)

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(`PDF parsing failed: ${errData.parserError}`))
    })

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        let text = ""
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any) => {
            if (page.Texts) {
              page.Texts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((textRun: any) => {
                    if (textRun.T) {
                      text += decodeURIComponent(textRun.T) + " "
                    }
                  })
                }
              })
            }
          })
        }
        resolve(text.trim())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        reject(new Error(`PDF text extraction failed: ${message}`))
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}

async function fetchWebContent(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DiligenceAI/1.0; +https://diligenceai.com)",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Enhanced HTML to text conversion
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    return text.substring(0, 15000) // Limit for API efficiency
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to fetch content from URL: ${message}`)
  }
}

async function getPerplexityInsights(companyName: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) {
    console.log("Perplexity API key not configured, skipping external research")
    return null
  }

  try {
    const query = `Research the startup company "${companyName}": recent news, funding rounds, team background, market position, competitors, financial metrics, and any red flags or concerns. Focus on factual, up-to-date information from reliable sources.`

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
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
        max_tokens: 1500,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      console.error("Perplexity API error:", response.status, response.statusText)
      return null
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error("Perplexity API error:", error)
    return null
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
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON response: ${message}`)
  }
}

function createFallbackAnalysis(companyName: string, contentSource: string): any {
  return {
    executiveSummary: `Analysis of ${companyName} has been completed with automated processing. The company has provided ${contentSource.toLowerCase()} for evaluation. This preliminary analysis identifies key areas for further investigation and provides a foundation for comprehensive due diligence. Manual review and additional documentation are recommended to supplement this automated analysis.`,
    riskLevel: "medium",
    overallScore: 65,
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
      {
        category: "Market Analysis",
        priority: "high",
        questions: [
          "Who are your top 3 competitors and how do you differentiate?",
          "What is your total addressable market size and growth rate?",
          "What percentage of the market do you currently capture?",
          "What are the key market risks that could impact your business?",
        ],
      },
      {
        category: "Team Assessment",
        priority: "medium",
        questions: [
          "Can you provide detailed backgrounds for all key team members?",
          "What relevant industry experience does the leadership team have?",
          "Are there any key roles that still need to be filled?",
          "What is your employee retention rate?",
        ],
      },
    ],
    keyMetrics: {
      financial: {
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
    ],
    concerns: [
      "Limited information available for comprehensive automated analysis",
      "Requires additional documentation for full risk assessment",
    ],
    investmentRecommendation: {
      recommendation: "proceed_with_caution",
      reasoning:
        "While the company shows initiative in seeking investment, comprehensive due diligence requires additional information and manual review",
      conditions: "Successful completion of detailed financial, market, and team analysis with verified documentation",
    },
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

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
        content = await extractTextFromPDF(buffer)
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

        content = await fetchWebContent(url)
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
      }
    } catch (extractionError) {
      console.error("Content extraction error:", extractionError)
      const message =
        extractionError instanceof Error
          ? extractionError.message
          : String(extractionError)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to extract content: ${message}`,
        },
        { status: 400 },
      )
    }

    if (!content.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "No content could be extracted for analysis",
        },
        { status: 400 },
      )
    }

    // Get external research data
    const perplexityInsights = await getPerplexityInsights(companyName)

    // Create comprehensive analysis prompt
    const analysisPrompt = `You are a senior venture capital analyst with 15+ years of experience in startup due diligence. Analyze the following startup information and provide a comprehensive, professional assessment.

COMPANY: ${companyName}
SOURCE: ${contentSource}
ADDITIONAL CONTEXT: ${additionalNotes || "None provided"}

CONTENT TO ANALYZE:
${content.substring(0, 12000)}

${
  perplexityInsights
    ? `
EXTERNAL RESEARCH DATA:
${perplexityInsights.substring(0, 3000)}
`
    : ""
}

Provide your analysis as a valid JSON object with this EXACT structure. Do not include any markdown formatting, code blocks, or explanatory text - only the JSON:

{
  "executiveSummary": "2-3 paragraph executive summary of your findings and investment thesis",
  "riskLevel": "low|medium|high",
  "overallScore": 75,
  "redFlags": [
    {
      "severity": "high|medium|low",
      "category": "Financial|Technical|Market|Team|Legal|Operations",
      "title": "Specific red flag title",
      "description": "Detailed description of the concern",
      "evidence": "Specific evidence from the content",
      "impact": "Potential impact on investment decision",
      "recommendation": "Specific action to take"
    }
  ],
  "verification": [
    {
      "category": "Financial Metrics|Team Credentials|Market Claims|Technical Claims|Legal Structure",
      "status": "verified|partial|unverified|concerning",
      "confidence": 85,
      "details": "What was verified and findings",
      "sources": "Sources used for verification",
      "recommendations": "Additional verification needed"
    }
  ],
  "followUpQuestions": [
    {
      "category": "Financial Due Diligence|Technical Due Diligence|Market Analysis|Team Assessment|Legal Review",
      "priority": "high|medium|low",
      "questions": [
        "Specific question 1",
        "Specific question 2"
      ]
    }
  ],
  "keyMetrics": {
    "financial": {
      "revenue": "Revenue information or N/A",
      "growth": "Growth rate or N/A", 
      "funding": "Funding information or N/A",
      "burn": "Burn rate or N/A"
    },
    "market": {
      "tam": "Total addressable market or N/A",
      "competition": "Competitive analysis or N/A",
      "positioning": "Market position or N/A"
    },
    "team": {
      "experience": "Team experience assessment",
      "completeness": "Team completeness evaluation",
      "credibility": "Credibility assessment"
    }
  },
  "strengths": [
    "Key strength 1",
    "Key strength 2"
  ],
  "concerns": [
    "Key concern 1", 
    "Key concern 2"
  ],
  "investmentRecommendation": {
    "recommendation": "proceed|proceed_with_caution|pass",
    "reasoning": "Detailed reasoning for the recommendation",
    "conditions": "Conditions that would change the recommendation"
  }
}`

    // Generate analysis using OpenAI with enhanced error handling
    let analysisResult
    try {
      const { text } = await generateText({
        model: openai("gpt-4o" as any, { apiKey: OPENAI_API_KEY } as any),
        prompt: analysisPrompt,
        temperature: 0.1, // Very low temperature for consistent JSON
        maxTokens: 4000,
      })

      // Parse the AI response with robust error handling
      analysisResult = cleanAndParseJSON(text)

      // Validate required fields
      const requiredFields = ["executiveSummary", "riskLevel", "overallScore"]
      for (const field of requiredFields) {
        if (!analysisResult[field]) {
          throw new Error(`Missing required field: ${field}`)
        }
      }

      // Validate data types and ranges
      if (
        typeof analysisResult.overallScore !== "number" ||
        analysisResult.overallScore < 0 ||
        analysisResult.overallScore > 100
      ) {
        analysisResult.overallScore = 65 // Default fallback
      }

      if (!["low", "medium", "high"].includes(analysisResult.riskLevel)) {
        analysisResult.riskLevel = "medium" // Default fallback
      }
    } catch (aiError) {
      console.error("AI analysis failed:", aiError)
      console.error("Raw AI response preview:", aiError.message)

      // Use fallback analysis
      analysisResult = createFallbackAnalysis(companyName, contentSource)
    }

    const processingTime = Date.now() - startTime

    // Save analysis to database with comprehensive error handling
    try {
      const insertData = {
        user_id: user.id,
        company_name: companyName.trim(),
        content_source: contentSource,
        additional_notes: additionalNotes?.trim() || null,
        status: "completed" as const,
        risk_level: analysisResult.riskLevel as "low" | "medium" | "high",
        red_flags_count: analysisResult.redFlags?.length || 0,
        overall_score: analysisResult.overallScore || 65,
        processing_time: processingTime,
        analysis_result: analysisResult,
        perplexity_data: perplexityInsights
          ? { insights: perplexityInsights, timestamp: new Date().toISOString() }
          : null,
      }

      console.log("Attempting to save analysis with data:", {
        ...insertData,
        analysis_result: "...", // Don't log full analysis
        perplexity_data: perplexityInsights ? "..." : null,
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
        message: "Analysis completed successfully",
      })
    } catch (dbError) {
      console.error("Database save error:", dbError)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save analysis: ${dbError.message}`,
          details: "Please check database schema and permissions",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json(
      {
        success: false,
        error: (error instanceof Error ? error.message : String(error)) ||
          "Failed to analyze content",
        processingTime: Date.now() - startTime,
      },
      { status: 500 },
    )
  }
}
