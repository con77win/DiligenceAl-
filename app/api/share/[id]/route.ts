import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Verify the analysis belongs to the user
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 })
    }

    // Generate a unique share token
    const shareToken = crypto.randomUUID()

    // Create shared report entry
    const { data: sharedReport, error: shareError } = await supabase
      .from("shared_reports")
      .insert({
        analysis_id: params.id,
        share_token: shareToken,
        expires_at: null, // No expiration for now
      })
      .select()
      .single()

    if (shareError) {
      console.error("Share creation error:", shareError)
      return NextResponse.json({ success: false, error: "Failed to create share link" }, { status: 500 })
    }

    const shareUrl = `${request.nextUrl.origin}/shared/${shareToken}`

    return NextResponse.json({
      success: true,
      shareUrl,
      shareToken,
    })
  } catch (error) {
    console.error("Share error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create share link",
      },
      { status: 500 },
    )
  }
}
