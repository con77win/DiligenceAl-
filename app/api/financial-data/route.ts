import { type NextRequest, NextResponse } from "next/server"
import { FinancialDataRetriever } from "@/lib/financial-data-retriever"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company = searchParams.get("company")
    const forceRefresh = searchParams.get("forceRefresh") === "true"

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Company name or URL is required",
            source: "API",
            details: "Missing company parameter in request",
          },
        },
        { status: 400 },
      )
    }

    const retriever = new FinancialDataRetriever()
    const result = await retriever.getFinancialData(company, { forceRefresh })

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Financial data API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Internal server error",
          source: "API",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company, forceRefresh = false } = body

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Company name or URL is required",
            source: "API",
            details: "Missing company field in request body",
          },
        },
        { status: 400 },
      )
    }

    const retriever = new FinancialDataRetriever()
    const result = await retriever.getFinancialData(company, { forceRefresh })

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Financial data API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Internal server error",
          source: "API",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    )
  }
}
