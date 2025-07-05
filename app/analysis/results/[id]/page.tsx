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
  Award,
  ExternalLink,
  Calculator,
  AlertCircle,
  BarChart3,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  perplexity_data?: {
    insights?: string
    citations?: string[]
    error?: string
  }
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

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case "RECOMMENDED TO INVEST":
        return "text-green-600 bg-green-50 border-green-200"
      case "PROCEED WITH CAUTION":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "DO NOT INVEST":
        return "text-red-600 bg-red-50 border-red-200"
      case "INSUFFICIENT DATA":
        return "text-gray-600 bg-gray-50 border-gray-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreComponentColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return "bg-green-500"
    if (percentage >= 60) return "bg-yellow-500"
    if (percentage >= 40) return "bg-orange-500"
    return "bg-red-500"
  }

  const renderFinancialData = (financialData: FinancialData) => {
    if (!financialData) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-green-600" />
            <span>Financial Data</span>
            {financialData.extraction_method && (
              <Badge variant="outline" className="ml-2">
                {financialData.extraction_method.replace("_", " ")}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Extracted and verified financial information
            {financialData.confidence_score && (
              <span className="ml-2">• Confidence: {financialData.confidence_score}%</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {financialData.summary && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Financial Summary</h4>
              <p className="text-blue-800 text-sm leading-relaxed">{financialData.summary}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Revenue Metrics</h4>
              {financialData.revenue && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Revenue:</span>
                  <span className="font-medium">{financialData.revenue}</span>
                </div>
              )}
              {financialData.arr_mrr && (
                <div className="flex justify-between">
                  <span className="text-gray-600">ARR/MRR:</span>
                  <span className="font-medium">{financialData.arr_mrr}</span>
                </div>
              )}
              {financialData.growth_rate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Growth Rate:</span>
                  <span className="font-medium">{financialData.growth_rate}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Funding & Valuation</h4>
              {financialData.valuation && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Valuation:</span>
                  <span className="font-medium">{financialData.valuation}</span>
                </div>
              )}
              {financialData.last_funding_amount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Latest Funding:</span>
                  <span className="font-medium">{financialData.last_funding_amount}</span>
                </div>
              )}
              {financialData.burn_rate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Burn Rate:</span>
                  <span className="font-medium">{financialData.burn_rate}</span>
                </div>
              )}
              {financialData.runway && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Runway:</span>
                  <span className="font-medium">{financialData.runway}</span>
                </div>
              )}
            </div>
          </div>

          {financialData.funding_rounds && financialData.funding_rounds.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-gray-900 mb-2">Funding History</h4>
              <div className="flex flex-wrap gap-2">
                {financialData.funding_rounds.map((round, index) => (
                  <Badge key={index} variant="outline" className="bg-green-50 text-green-700">
                    {round}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {financialData.investors && financialData.investors.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-gray-900 mb-2">Investors</h4>
              <div className="flex flex-wrap gap-2">
                {financialData.investors.map((investor, index) => (
                  <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700">
                    {investor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderScoreBreakdown = (scoreBreakdown: ScoreBreakdown, scoreJustification: any) => {
    const components = [
      { name: "Team Experience", score: scoreBreakdown.team_experience, max: 20 },
      { name: "Market Size", score: scoreBreakdown.market_size, max: 15 },
      { name: "Traction", score: scoreBreakdown.traction, max: 25 },
      { name: "Financial Performance", score: scoreBreakdown.financial_performance, max: 20 },
      { name: "Competitive Advantage", score: scoreBreakdown.competitive_advantage, max: 10 },
      { name: "Risk Factors", score: scoreBreakdown.risk_factors, max: 0 },
      { name: "Data Quality", score: scoreBreakdown.data_quality, max: 10 },
    ]

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span>Investment Score Breakdown</span>
          </CardTitle>
          <CardDescription>Detailed scoring analysis with justifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {components.map((component) => (
            <div key={component.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{component.name}</span>
                <div className="flex items-center space-x-2">
                  <span className={`font-bold ${component.score >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {component.score >= 0 ? "+" : ""}
                    {component.score}
                  </span>
                  <span className="text-xs text-gray-500">/ {component.max}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getScoreComponentColor(Math.abs(component.score), component.max)}`}
                  style={{
                    width: `${Math.min((Math.abs(component.score) / component.max) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              {scoreJustification && scoreJustification[component.name.toLowerCase().replace(" ", "_")] && (
                <p className="text-xs text-gray-600 mt-1">
                  {scoreJustification[component.name.toLowerCase().replace(" ", "_")]}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    )
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
  const financialData = analysis?.financialData
  const scoreBreakdown = analysis?.scoreBreakdown
  const scoreJustification = analysis?.scoreJustification

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
              {analysisData.perplexity_data?.insights && (
                <div className="flex items-center space-x-2 mt-2">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-600">Enhanced with external research</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-2">
                <Badge className={`${getRiskLevelColor(analysisData.risk_level)} bg-opacity-10`}>
                  {analysisData.risk_level.toUpperCase()} RISK
                </Badge>
                <Badge className="bg-red-100 text-red-700">{analysisData.red_flags_count} Red Flags</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-gray-500">Investment Score:</span>
                <span className={`text-2xl font-bold ${getScoreColor(analysisData.overall_score)}`}>
                  {analysisData.overall_score}/100
                </span>
              </div>
            </div>
          </div>

          {/* Investment Recommendation Banner */}
          {analysis?.recommendation && (
            <div className={`p-4 rounded-lg border-2 mb-6 ${getRecommendationColor(analysis.recommendation)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Investment Recommendation</h3>
                  <p className="text-2xl font-bold mt-1">{analysis.recommendation}</p>
                  {analysis.recommendationJustification && (
                    <div className="mt-2 text-sm">
                      <ul className="space-y-1">
                        {analysis.recommendationJustification.map((reason: string, index: number) => (
                          <li key={index}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {scoreBreakdown && (
                  <div className="text-right">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between space-x-4">
                        <span>Team:</span>
                        <span className={scoreBreakdown.team_experience >= 0 ? "text-green-600" : "text-red-600"}>
                          {scoreBreakdown.team_experience >= 0 ? "+" : ""}
                          {scoreBreakdown.team_experience}
                        </span>
                      </div>
                      <div className="flex justify-between space-x-4">
                        <span>Traction:</span>
                        <span className={scoreBreakdown.traction >= 0 ? "text-green-600" : "text-red-600"}>
                          {scoreBreakdown.traction >= 0 ? "+" : ""}
                          {scoreBreakdown.traction}
                        </span>
                      </div>
                      <div className="flex justify-between space-x-4">
                        <span>Financial:</span>
                        <span className={scoreBreakdown.financial_performance >= 0 ? "text-green-600" : "text-red-600"}>
                          {scoreBreakdown.financial_performance >= 0 ? "+" : ""}
                          {scoreBreakdown.financial_performance}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Financial Data Alert */}
          {financialData && (
            <Alert className="mb-6">
              <Calculator className="h-4 w-4" />
              <AlertDescription>
                <strong>Financial data extracted via {financialData.extraction_method?.replace("_", " ")}:</strong>
                This analysis includes financial metrics with {financialData.confidence_score}% confidence.
              </AlertDescription>
            </Alert>
          )}

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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
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

              {/* Investment Recommendation Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <span>Investment Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis?.investmentRecommendation && (
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
                  )}
                </CardContent>
              </Card>
            </div>

            {/* External Research Insights */}
            {analysisData.perplexity_data?.insights && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                    <span>External Research Insights</span>
                  </CardTitle>
                  <CardDescription>Real-time web research and market intelligence</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {analysisData.perplexity_data.insights}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="scoring" className="space-y-6">
            {scoreBreakdown ? (
              renderScoreBreakdown(scoreBreakdown, scoreJustification)
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-gray-400" />
                    <span>Score Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Score Breakdown Available</h3>
                    <p className="text-gray-600">Detailed scoring information is not available for this analysis.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            {financialData ? (
              renderFinancialData(financialData)
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calculator className="h-5 w-5 text-gray-400" />
                    <span>Financial Data</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Financial Data Available</h3>
                    <p className="text-gray-600 mb-4">
                      No financial information could be extracted from the provided content.
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg text-left">
                      <h4 className="font-semibold text-blue-900 mb-2">Recommendations:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Request audited financial statements</li>
                        <li>• Ask for detailed revenue and growth metrics</li>
                        <li>• Obtain funding history and investor information</li>
                        <li>• Review burn rate and runway calculations</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
