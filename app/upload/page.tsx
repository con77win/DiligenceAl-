"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  FileText,
  LinkIcon,
  FolderOpen,
  Shield,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState("pdf")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dataRoomUrl, setDataRoomUrl] = useState("")
  const [publicUrl, setPublicUrl] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStep, setAnalysisStep] = useState("")
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  })

  const handleAnalysis = async () => {
    setIsAnalyzing(true)
    setAnalysisProgress(0)

    try {
      // Prepare form data
      const formData = new FormData()
      formData.append("companyName", companyName)
      formData.append("additionalNotes", additionalNotes)
      formData.append("analysisType", activeTab)

      if (activeTab === "pdf" && uploadedFile) {
        formData.append("file", uploadedFile)
      } else if (activeTab === "url" && publicUrl) {
        formData.append("url", publicUrl)
      } else if (activeTab === "dataroom" && dataRoomUrl) {
        formData.append("dataroomUrl", dataRoomUrl)
      }

      // Simulate progress steps
      const steps = [
        { step: "Preparing analysis...", progress: 10 },
        { step: "Processing content...", progress: 30 },
        { step: "Running AI analysis...", progress: 60 },
        { step: "Generating insights...", progress: 80 },
        { step: "Finalizing report...", progress: 95 },
      ]

      let currentStep = 0
      const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
          setAnalysisStep(steps[currentStep].step)
          setAnalysisProgress(steps[currentStep].progress)
          currentStep++
        }
      }, 1000)

      // Make API call
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      clearInterval(progressInterval)
      setAnalysisProgress(100)
      setAnalysisStep("Analysis complete!")

      if (result.success) {
        // Wait a moment to show completion
        await new Promise((resolve) => setTimeout(resolve, 1000))
        router.push(`/analysis/results/${result.analysisId}`)
      } else {
        throw new Error(result.error || "Analysis failed")
      }
    } catch (error) {
      console.error("Analysis error:", error)
      const errorMessage = error instanceof Error ? error.message : "Analysis failed"

      // Enhanced error handling for PDF issues
      if (errorMessage.includes("PDF processing failed") || errorMessage.includes("worker")) {
        setAnalysisStep("PDF processing failed. Consider using URL or Data Room analysis instead.")
      } else {
        setAnalysisStep("Analysis failed. Please try again.")
      }

      setIsAnalyzing(false)

      // Show error message to user
      alert(`Analysis failed: ${errorMessage}`)
    }
  }

  const canStartAnalysis = () => {
    return (
      ((activeTab === "pdf" && uploadedFile) ||
        (activeTab === "dataroom" && dataRoomUrl.trim()) ||
        (activeTab === "url" && publicUrl.trim())) &&
      companyName.trim()
    )
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="px-6 py-4 flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">DiligenceAI</span>
            </Link>
          </div>
        </header>

        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle>Analyzing {companyName}</CardTitle>
              <CardDescription>Our AI is processing your submission and generating insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{analysisStep}</span>
                  <span className="text-gray-900 font-medium">{analysisProgress}%</span>
                </div>
                <Progress value={analysisProgress} className="h-2" />
              </div>

              <div className="text-center text-sm text-gray-600">
                This usually takes 2-3 minutes. Please don't close this window.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
              <span className="text-gray-600">Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">DiligenceAI</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Due Diligence Analysis</h1>
          <p className="text-gray-600">
            Upload startup materials and let our AI generate comprehensive due diligence insights
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Upload Startup Materials</CardTitle>
                <CardDescription>Choose how you'd like to provide the startup information for analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pdf" className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Pitch Deck</span>
                    </TabsTrigger>
                    <TabsTrigger value="dataroom" className="flex items-center space-x-2">
                      <FolderOpen className="h-4 w-4" />
                      <span>Data Room</span>
                    </TabsTrigger>
                    <TabsTrigger value="url" className="flex items-center space-x-2">
                      <LinkIcon className="h-4 w-4" />
                      <span>Public URL</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pdf" className="space-y-4">
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? "border-blue-400 bg-blue-50"
                          : uploadedFile
                            ? "border-green-400 bg-green-50"
                            : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input {...getInputProps()} />
                      {uploadedFile ? (
                        <div className="space-y-2">
                          <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                          <p className="text-green-700 font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-green-600">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                          <p className="text-gray-600">
                            {isDragActive
                              ? "Drop your pitch deck here..."
                              : "Drag & drop your pitch deck PDF, or click to browse"}
                          </p>
                          <p className="text-sm text-gray-500">PDF files up to 10MB</p>
                          <p className="text-xs text-gray-400">
                            Note: If PDF processing fails, try using the URL or Data Room options instead
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="dataroom" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataroom-url">Data Room URL</Label>
                      <Input
                        id="dataroom-url"
                        placeholder="https://drive.google.com/... or https://dropbox.com/..."
                        value={dataRoomUrl}
                        onChange={(e) => setDataRoomUrl(e.target.value)}
                      />
                      <p className="text-sm text-gray-500">
                        Provide a shareable link to your Google Drive or Dropbox folder
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="url" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="public-url">Public URL</Label>
                      <Input
                        id="public-url"
                        placeholder="https://company.com or https://crunchbase.com/..."
                        value={publicUrl}
                        onChange={(e) => setPublicUrl(e.target.value)}
                      />
                      <p className="text-sm text-gray-500">
                        Company website, Crunchbase profile, or other public information
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Company Details */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>Provide additional context to improve analysis accuracy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    placeholder="Enter the startup's name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional-notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="additional-notes"
                    placeholder="Any specific areas of focus or concerns you'd like the AI to pay attention to..."
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span>Analysis Preview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Red Flag Detection</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Metrics Verification</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Team Credibility Check</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Follow-up Questions</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button className="w-full" onClick={handleAnalysis} disabled={!canStartAnalysis()}>
                    Start AI Analysis
                  </Button>
                  {!canStartAnalysis() && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Please provide company materials and name to continue
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What to Expect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Analysis typically takes 2-3 minutes</span>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Results include downloadable PDF report</span>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>All data is processed securely and confidentially</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
