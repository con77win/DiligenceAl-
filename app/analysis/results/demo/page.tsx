"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Download,
  Share2,
  Shield,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  DollarSign,
  Target,
  Lightbulb,
} from "lucide-react"
import Link from "next/link"

export default function AnalysisResultsPage() {
  const [activeTab, setActiveTab] = useState("overview")

  const redFlags = [
    {
      severity: "high",
      category: "Financial",
      title: "Inconsistent Revenue Projections",
      description:
        "Revenue growth projections show 500% YoY growth without clear justification or comparable market examples.",
      details:
        "Slide 8 shows $2M ARR growing to $10M in 12 months, but customer acquisition metrics suggest maximum 200% growth.",
    },
    {
      severity: "medium",
      category: "Team",
      title: "Limited Technical Leadership",
      description: "CTO background shows primarily frontend development experience for a deep-tech AI company.",
      details:
        "LinkedIn profile indicates 3 years experience, mostly in web development rather than machine learning or AI systems.",
    },
    {
      severity: "low",
      category: "Market",
      title: "Vague Competitive Analysis",
      description: "Competitive landscape section lacks specific competitor analysis and differentiation strategy.",
      details:
        'Generic statements about "no direct competitors" without acknowledging adjacent solutions or potential threats.',
    },
  ]

  const verificationSummary = [
    {
      category: "Domain Verification",
      status: "verified",
      details: "Company domain registered 2 years ago, SSL certificate valid, professional email setup confirmed.",
    },
    {
      category: "Team LinkedIn Profiles",
      status: "partial",
      details: "3 out of 5 team members have verified LinkedIn profiles with consistent employment history.",
    },
    {
      category: "Financial Metrics",
      status: "unverified",
      details: "Revenue figures cannot be independently verified. No public financial disclosures found.",
    },
    {
      category: "Customer References",
      status: "verified",
      details: "2 customer logos verified through public case studies and press releases.",
    },
  ]

  const followUpQuestions = [
    {
      category: "Financial Due Diligence",
      questions: [
        "Can you provide audited financial statements for the past 2 years?",
        "What are the unit economics and customer acquisition costs?",
        "How do you justify the 500% revenue growth projection?",
        "What is your current burn rate and runway?",
      ],
    },
    {
      category: "Technical Due Diligence",
      questions: [
        "Can you provide a technical architecture overview?",
        "What is your IP protection strategy?",
        "How scalable is your current technical infrastructure?",
        "What are the key technical risks and mitigation strategies?",
      ],
    },
    {
      category: "Market & Competition",
      questions: [
        "Who are your top 5 competitors and how do you differentiate?",
        "What is your go-to-market strategy and customer acquisition plan?",
        "How large is your addressable market and what's your market share goal?",
        "What are the key market risks that could impact growth?",
      ],
    },
  ]

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
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

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
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share Report
            </Button>
            <Button>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">TechStart Inc. Analysis</h1>
              <p className="text-gray-600">Due diligence report generated on {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-2">
                <Badge className="bg-yellow-100 text-yellow-700">Medium Risk</Badge>
                <Badge className="bg-red-100 text-red-700">3 Red Flags</Badge>
              </div>
              <p className="text-sm text-gray-500">Analysis completed in 2m 34s</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">3</p>
                  <p className="text-sm text-gray-600">Red Flags</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">67%</p>
                  <p className="text-sm text-gray-600">Verified</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">5</p>
                  <p className="text-sm text-gray-600">Team Members</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold text-purple-600">$2M</p>
                  <p className="text-sm text-gray-600">ARR Claimed</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="red-flags">Red Flags</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="questions">Follow-up</TabsTrigger>
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
                  <p className="text-gray-700">
                    TechStart Inc. presents as an AI-powered SaaS platform targeting enterprise customers. The company
                    shows promising early traction with claimed $2M ARR and notable customer logos.
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900">Key Strengths:</h4>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                      <li>• Strong founding team with relevant industry experience</li>
                      <li>• Clear product-market fit with enterprise customers</li>
                      <li>• Defensible technology moat in AI/ML space</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900">Key Concerns:</h4>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                      <li>• Aggressive growth projections lack supporting data</li>
                      <li>• Limited technical depth in leadership team</li>
                      <li>• Competitive landscape analysis insufficient</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-yellow-600" />
                    <span>Risk Assessment</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Financial Risk</span>
                      <Badge className="bg-red-100 text-red-700">High</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Technical Risk</span>
                      <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Market Risk</span>
                      <Badge className="bg-green-100 text-green-700">Low</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Team Risk</span>
                      <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600 mb-1">Medium Risk</div>
                    <p className="text-sm text-gray-600">Overall Investment Risk</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics & Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Financial</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ARR</span>
                        <span className="font-medium">$2M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Growth Rate</span>
                        <span className="font-medium">500% YoY</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customers</span>
                        <span className="font-medium">50+</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Team</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Employees</span>
                        <span className="font-medium">25</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Engineering</span>
                        <span className="font-medium">15</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Founded</span>
                        <span className="font-medium">2022</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Market</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">TAM</span>
                        <span className="font-medium">$50B</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">SAM</span>
                        <span className="font-medium">$5B</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">SOM</span>
                        <span className="font-medium">$500M</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="red-flags" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Red Flags Identified</span>
                </CardTitle>
                <CardDescription>
                  Our AI analysis identified {redFlags.length} potential concerns that require attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {redFlags.map((flag, index) => (
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
                      <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                        <strong>Details:</strong> {flag.details}
                      </div>
                    </div>
                  ))}
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
                  {verificationSummary.map((item, index) => (
                    <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <div className="mt-1">{getStatusIcon(item.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{item.category}</h4>
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
                        </div>
                        <p className="text-sm text-gray-600">{item.details}</p>
                      </div>
                    </div>
                  ))}
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
                  {followUpQuestions.map((section, index) => (
                    <div key={index}>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        <span>{section.category}</span>
                      </h4>
                      <div className="space-y-2 ml-6">
                        {section.questions.map((question, qIndex) => (
                          <div key={qIndex} className="flex items-start space-x-2">
                            <span className="text-blue-600 font-medium text-sm mt-1">{qIndex + 1}.</span>
                            <p className="text-gray-700 text-sm">{question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
