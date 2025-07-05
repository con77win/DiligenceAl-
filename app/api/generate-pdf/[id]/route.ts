import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Fetch analysis data
    const { data: analysisData, error: dbError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single()

    if (dbError || !analysisData) {
      return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 })
    }

    const analysis = analysisData.analysis_result

    // Generate HTML content for PDF
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${analysisData.company_name} - Due Diligence Report</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #e5e7eb; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .company-name { 
          font-size: 2.5em; 
          font-weight: bold; 
          color: #1f2937; 
          margin-bottom: 10px; 
        }
        .report-date { 
          color: #6b7280; 
          font-size: 1.1em; 
        }
        .section { 
          margin-bottom: 30px; 
          page-break-inside: avoid; 
        }
        .section-title { 
          font-size: 1.5em; 
          font-weight: bold; 
          color: #1f2937; 
          border-bottom: 1px solid #e5e7eb; 
          padding-bottom: 10px; 
          margin-bottom: 15px; 
        }
        .risk-badge { 
          display: inline-block; 
          padding: 4px 12px; 
          border-radius: 20px; 
          font-weight: bold; 
          font-size: 0.9em; 
        }
        .risk-high { background-color: #fee2e2; color: #dc2626; }
        .risk-medium { background-color: #fef3c7; color: #d97706; }
        .risk-low { background-color: #dcfce7; color: #16a34a; }
        .red-flag { 
          border: 1px solid #fca5a5; 
          border-radius: 8px; 
          padding: 15px; 
          margin-bottom: 15px; 
          background-color: #fef2f2; 
        }
        .red-flag-title { 
          font-weight: bold; 
          color: #dc2626; 
          margin-bottom: 8px; 
        }
        .verification-item { 
          border: 1px solid #e5e7eb; 
          border-radius: 8px; 
          padding: 15px; 
          margin-bottom: 15px; 
        }
        .status-verified { color: #16a34a; font-weight: bold; }
        .status-partial { color: #d97706; font-weight: bold; }
        .status-unverified { color: #dc2626; font-weight: bold; }
        .question-category { 
          font-weight: bold; 
          color: #1f2937; 
          margin-top: 20px; 
          margin-bottom: 10px; 
        }
        .question { 
          margin-bottom: 8px; 
          padding-left: 20px; 
        }
        .footer { 
          margin-top: 50px; 
          padding-top: 20px; 
          border-top: 1px solid #e5e7eb; 
          text-align: center; 
          color: #6b7280; 
          font-size: 0.9em; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${analysisData.company_name}</div>
        <div class="report-date">Due Diligence Report - ${new Date(analysisData.created_at).toLocaleDateString()}</div>
        <div style="margin-top: 15px;">
          <span class="risk-badge risk-${analysisData.risk_level}">${analysisData.risk_level.toUpperCase()} RISK</span>
          <span style="margin-left: 10px;">Overall Score: ${analysisData.overall_score}/100</span>
        </div>
        <div style="margin-top: 10px; font-size: 0.9em; color: #6b7280;">
          Source: ${analysisData.content_source}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Executive Summary</div>
        <p>${analysis?.executiveSummary || "Executive summary not available."}</p>
        
        ${
          analysis?.investmentRecommendation
            ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
          <strong>Investment Recommendation:</strong> 
          <span style="text-transform: uppercase; font-weight: bold; color: ${
            analysis.investmentRecommendation.recommendation === "proceed"
              ? "#16a34a"
              : analysis.investmentRecommendation.recommendation === "proceed_with_caution"
                ? "#d97706"
                : "#dc2626"
          };">
            ${analysis.investmentRecommendation.recommendation.replace("_", " ")}
          </span>
          <p style="margin-top: 10px;">${analysis.investmentRecommendation.reasoning}</p>
        </div>
        `
            : ""
        }
      </div>

      ${
        analysis?.redFlags && analysis.redFlags.length > 0
          ? `
      <div class="section">
        <div class="section-title">Red Flags (${analysis.redFlags.length})</div>
        ${analysis.redFlags
          .map(
            (flag: any) => `
          <div class="red-flag">
            <div class="red-flag-title">${flag.title}</div>
            <div><strong>Category:</strong> ${flag.category} | <strong>Severity:</strong> ${flag.severity.toUpperCase()}</div>
            <p>${flag.description}</p>
            ${flag.evidence ? `<div><strong>Evidence:</strong> ${flag.evidence}</div>` : ""}
            ${flag.recommendation ? `<div><strong>Recommendation:</strong> ${flag.recommendation}</div>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        analysis?.verification && analysis.verification.length > 0
          ? `
      <div class="section">
        <div class="section-title">Verification Summary</div>
        ${analysis.verification
          .map(
            (item: any) => `
          <div class="verification-item">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <strong>${item.category}</strong>
              <span class="status-${item.status}">${item.status.toUpperCase()}</span>
            </div>
            <p>${item.details}</p>
            ${item.confidence ? `<div style="font-size: 0.9em; color: #6b7280;">Confidence: ${item.confidence}%</div>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        analysis?.followUpQuestions && analysis.followUpQuestions.length > 0
          ? `
      <div class="section">
        <div class="section-title">Follow-up Questions</div>
        ${analysis.followUpQuestions
          .map(
            (section: any) => `
          <div class="question-category">${section.category}</div>
          ${section.questions
            .map(
              (question: string, index: number) => `
            <div class="question">${index + 1}. ${question}</div>
          `,
            )
            .join("")}
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      <div class="footer">
        <p>Generated by DiligenceAI - AI-Powered Due Diligence Platform</p>
        <p>This report is confidential and intended solely for the recipient's use in investment decision-making.</p>
        <p style="margin-top: 10px; font-size: 0.8em;">
          Analysis completed in ${analysisData.processing_time ? Math.round(analysisData.processing_time / 1000) : "N/A"}s
        </p>
      </div>
    </body>
    </html>
    `

    // For now, return the HTML content as a simple PDF-like response
    // In production, you would use Puppeteer or similar to generate actual PDF
    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `inline; filename="${analysisData.company_name}-analysis.html"`,
      },
    })
  } catch (error) {
    console.error("PDF generation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate PDF",
      },
      { status: 500 },
    )
  }
}
