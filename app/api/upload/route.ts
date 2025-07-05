import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get("file") as File
    const companyName = formData.get("companyName") as string
    const additionalNotes = formData.get("additionalNotes") as string

    if (!file || !companyName) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage.from("pitch-decks").upload(fileName, file)

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json({ success: false, error: "Failed to upload file" }, { status: 500 })
    }

    // Create analysis record in database
    const { data: analysisData, error: dbError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        company_name: companyName,
        file_path: uploadData.path,
        additional_notes: additionalNotes,
        status: "processing",
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ success: false, error: "Failed to create analysis record" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      analysisId: analysisData.id,
      message: "File uploaded successfully",
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
