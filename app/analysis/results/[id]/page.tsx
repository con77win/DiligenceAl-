"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Download,
  Share2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  DollarSign,
  Target,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface AnalysisData {
  id: string
  company_name: string
  content_source: string
  status: string
  risk_level: string
  red_flags_count: number
  overall_score: number
  analysis_result: any
  created_at: string
}

export default function AnalysisResultsPage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState("overview")
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const supabase = createClient()

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const { data, error } = await supabase.from("analyses").select("*").eq("id", params.id).single()

        if (error) {
          throw error
        }

        setAnalysisData(data)
      } catch (err) {
        console.error("Error fetching analysis:", err)
        setError("Failed to load analysis results")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchAnalysis()
    }
  }, [params.id])

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/generate-pdf/${params.id}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${analysisData?.company_name}-analysis.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Error downloading PDF:", error)
    }
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/shared/${params.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      // You could add a toast notification here
      alert("Share link copied to clipboard!")
    } catch (error) {
      console.error("Error copying to clipboard:", error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "low":
        return "bg-blue-100 text-blue-700 border-blue-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "unverified":
      case "concerning":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "text-green-600"
      case "medium":
        return "text-yellow-600"
      case "high":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading analysis results...</p>
        </div>
      </div>
    )
  }

  if (error || !analysisData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Analysis Not Found</h2>
          <p className="text-gray-600 mb-4">{error || "The requested analysis could not be found."}</p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const analysis = analysisData.analysis_result

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share Report
            </Button>
            <Button onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Analysis Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{analysisData.company_name} Analysis</h1>
              <p className="text-gray-600">
                Due diligence report generated on {new Date(analysisData.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">Source: {analysisData.content_source}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-2">
                <Badge className={`${getRiskLevelColor(analysisData.risk_level)} bg-opacity-10`}>
                  {analysisData.risk_level.toUpperCase()} RISK
                </Badge>
                <Badge className="bg-red-100 text-red-700">{analysisData.red_flags_count} Red Flags</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Overall Score:</span>
                <span className={`text-lg font-bold ${getRiskLevelColor(analysisData.risk_level)}`}>
                  {analysisData.overall_score}/100
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar for Overall Score */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Investment Readiness Score</span>
              <span className="font-medium">{analysisData.overall_score}%</span>
            </div>
            <Progress value={analysisData.overall_score} className="h-3" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{analysisData.red_flags_count}</p>
                  <p className="text-sm text-gray-600">Red Flags</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {analysis?.verification?.filter((v: any) => v.status === "verified").length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Verified</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                {analysisData.overall_score >= 70 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p
                    className={`text-2xl font-bold ${analysisData.overall_score >= 70 ? "text-green-600" : "text-red-600"}`}
                  >
                    {analysisData.overall_score >= 70 ? "Strong" : "Weak"}
                  </p>
                  <p className="text-sm text-gray-600">Profile</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {analysis?.followUpQuestions?.reduce(
                      (total: number, category: any) => total + category.questions.length,
                      0,
                    ) || 0}
                  </p>
                  <p className="text-sm text-gray-600">Follow-ups</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="red-flags">Red Flags</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="questions">Follow-up</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Executive Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>Executive Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700 leading-relaxed">
                    {analysis?.executiveSummary || "Executive summary not available."}
                  </p>

                  {analysis?.strengths && analysis.strengths.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-900">Key Strengths:</h4>
                      <ul className="text-sm text-gray-600 space-y-1 ml-4">
                        {analysis.strengths.map((strength: string, index: number) => (
                          <li key={index}>• {strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis?.concerns && analysis.concerns.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-900">Key Concerns:</h4>
                      <ul className="text-sm text-gray-600 space-y-1 ml-4">
                        {analysis.concerns.map((concern: string, index: number) => (
                          <li key={index}>• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Investment Recommendation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <span>Investment Recommendation</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis?.investmentRecommendation && (
                    <>
                      <div className="text-center p-4 rounded-lg bg-gray-50">
                        <div
                          className={`text-2xl font-bold mb-2 ${
                            analysis.investmentRecommendation.recommendation === "proceed"
                              ? "text-green-600"
                              : analysis.investmentRecommendation.recommendation === "proceed_with_caution"
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {analysis.investmentRecommendation.recommendation.replace("_", " ").toUpperCase()}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Reasoning:</h4>
                          <p className="text-sm text-gray-600">{analysis.investmentRecommendation.reasoning}</p>
                        </div>
                        {analysis.investmentRecommendation.conditions && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Conditions:</h4>
                            <p className="text-sm text-gray-600">{analysis.investmentRecommendation.conditions}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="red-flags" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Red Flags Identified</span>
                </CardTitle>
                <CardDescription>
                  AI analysis identified {analysisData.red_flags_count} potential concerns that require attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {analysis?.redFlags?.map((flag: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Badge className={`${getSeverityColor(flag.severity)} border`}>
                            {flag.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-600">{flag.category}</span>
                        </div>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">{flag.title}</h4>
                      <p className="text-gray-700 mb-3">{flag.description}</p>

                      {flag.evidence && (
                        <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 mb-3">
                          <strong>Evidence:</strong> {flag.evidence}
                        </div>
                      )}

                      {flag.impact && (
                        <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 mb-3">
                          <strong>Impact:</strong> {flag.impact}
                        </div>
                      )}

                      {flag.recommendation && (
                        <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                          <strong>Recommendation:</strong> {flag.recommendation}
                        </div>
                      )}
                    </div>
                  )) || <div className="text-center py-8 text-gray-500">No red flags identified in the analysis.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Verification Summary</span>
                </CardTitle>
                <CardDescription>Cross-verification of claims and credentials across multiple sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis?.verification?.map((item: any, index: number) => (
                    <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <div className="mt-1">{getStatusIcon(item.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{item.category}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge
                              className={
                                item.status === "verified"
                                  ? "bg-green-100 text-green-700"
                                  : item.status === "partial"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }
                            >
                              {item.status}
                            </Badge>
                            {item.confidence && (
                              <span className="text-xs text-gray-500">{item.confidence}% confidence</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{item.details}</p>

                        {item.sources && (
                          <p className="text-xs text-gray-500 mb-2">
                            <strong>Sources:</strong> {item.sources}
                          </p>
                        )}

                        {item.recommendations && (
                          <p className="text-xs text-blue-600">
                            <strong>Next Steps:</strong> {item.recommendations}
                          </p>
                        )}
                      </div>
                    </div>
                  )) || <div className="text-center py-8 text-gray-500">No verification data available.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <span>Suggested Follow-up Questions</span>
                </CardTitle>
                <CardDescription>Tailored due diligence questions based on the analysis findings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {analysis?.followUpQuestions?.map((section: any, index: number) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span>{section.category}</span>
                        </h4>
                        {section.priority && (
                          <Badge
                            className={
                              section.priority === "high"
                                ? "bg-red-100 text-red-700"
                                : section.priority === "medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-blue-100 text-blue-700"
                            }
                          >
                            {section.priority} priority
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2 ml-6">
                        {section.questions.map((question: string, qIndex: number) => (
                          <div key={qIndex} className="flex items-start space-x-2">
                            <span className="text-blue-600 font-medium text-sm mt-1">{qIndex + 1}.</span>
                            <p className="text-gray-700 text-sm">{question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) || <div className="text-center py-8 text-gray-500">No follow-up questions generated.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Financial Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <span>Financial</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis?.keyMetrics?.financial &&
                      Object.entries(analysis.keyMetrics.financial).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-600 capitalize">{key}:</span>
                          <span className="font-medium">{value || "N/A"}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Market Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span>Market</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis?.keyMetrics?.market &&
                      Object.entries(analysis.keyMetrics.market).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-600 capitalize">{key}:</span>
                          <span className="font-medium">{value || "N/A"}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Team Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <span>Team</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis?.keyMetrics?.team &&
                      Object.entries(analysis.keyMetrics.team).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-600 capitalize">{key}:</span>
                          <span className="font-medium">{value || "N/A"}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
