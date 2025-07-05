"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  FileText,
  TrendingUp,
  AlertTriangle,
  Search,
  MoreHorizontal,
  Shield,
  User,
  LogOut,
  Clock,
  Download,
  Share2,
  Eye,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

interface Analysis {
  id: string
  company_name: string
  content_source: string
  status: "completed" | "processing" | "failed"
  created_at: string
  red_flags_count: number
  risk_level: "low" | "medium" | "high"
  overall_score: number
  processing_time?: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push("/auth/signin")
          return
        }

        setUser(user)

        // Fetch analyses from database
        const { data: analysesData, error: analysesError } = await supabase
          .from("analyses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (analysesError) {
          console.error("Error fetching analyses:", analysesError)
        } else {
          setAnalyses(analysesData || [])
        }
      } catch (error) {
        console.error("Dashboard initialization error:", error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [router, supabase])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (!confirm("Are you sure you want to delete this analysis?")) return

    try {
      const { error } = await supabase.from("analyses").delete().eq("id", analysisId).eq("user_id", user.id)

      if (error) {
        console.error("Error deleting analysis:", error)
        alert("Failed to delete analysis")
      } else {
        setAnalyses(analyses.filter((a) => a.id !== analysisId))
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("Failed to delete analysis")
    }
  }

  const handleShareAnalysis = async (analysisId: string) => {
    try {
      // Generate a share token
      const shareToken = crypto.randomUUID()

      const { error } = await supabase.from("shared_reports").insert({
        analysis_id: analysisId,
        share_token: shareToken,
        expires_at: null, // No expiration for now
      })

      if (error) {
        console.error("Error creating share link:", error)
        alert("Failed to create share link")
        return
      }

      const shareUrl = `${window.location.origin}/shared/${shareToken}`
      await navigator.clipboard.writeText(shareUrl)
      alert("Share link copied to clipboard!")
    } catch (error) {
      console.error("Share error:", error)
      alert("Failed to create share link")
    }
  }

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-100 text-green-700"
      case "medium":
        return "bg-yellow-100 text-yellow-700"
      case "high":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700"
      case "processing":
        return "bg-blue-100 text-blue-700"
      case "failed":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const filteredAnalyses = analyses.filter((analysis) =>
    analysis.company_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading your dashboard...</p>
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
            <Link href="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">DiligenceAI</span>
            </Link>
            <div className="hidden md:block text-gray-300">|</div>
            <h1 className="hidden md:block text-lg font-semibold text-gray-900">Dashboard</h1>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/upload">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.user_metadata?.full_name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyses.length}</div>
              <p className="text-xs text-muted-foreground">
                {analyses.length > 0
                  ? `Latest: ${new Date(analyses[0]?.created_at).toLocaleDateString()}`
                  : "No analyses yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyses.filter((a) => a.status === "completed").length}</div>
              <p className="text-xs text-muted-foreground">
                {analyses.length > 0
                  ? `${Math.round((analyses.filter((a) => a.status === "completed").length / analyses.length) * 100)}% success rate`
                  : "No data"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Red Flags Found</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyses.reduce((sum, a) => sum + (a.red_flags_count || 0), 0)}</div>
              <p className="text-xs text-muted-foreground">Across all analyses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyses.length > 0
                  ? Math.round(analyses.reduce((sum, a) => sum + (a.overall_score || 0), 0) / analyses.length)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">Investment readiness</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="analyses" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="analyses">Recent Analyses</TabsTrigger>
            </TabsList>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search analyses..."
                  className="pl-8 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <TabsContent value="analyses" className="space-y-4">
            {filteredAnalyses.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm ? "No matching analyses found" : "No analyses yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm
                    ? "Try adjusting your search terms"
                    : "Upload your first pitch deck or startup data to get started with AI-powered due diligence."}
                </p>
                {!searchTerm && (
                  <Link href="/upload">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Start Your First Analysis
                    </Button>
                  </Link>
                )}
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredAnalyses.map((analysis) => (
                  <Card key={analysis.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <FileText className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{analysis.company_name}</h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusBadgeColor(analysis.status)}>{analysis.status}</Badge>
                              <Badge className={getRiskBadgeColor(analysis.risk_level)}>
                                {analysis.risk_level} risk
                              </Badge>
                              <span className="text-sm text-gray-500">{analysis.red_flags_count || 0} red flags</span>
                              <span className="text-sm text-gray-500">Score: {analysis.overall_score || 0}/100</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-gray-400">{analysis.content_source}</span>
                              {analysis.processing_time && (
                                <>
                                  <span className="text-xs text-gray-300">•</span>
                                  <div className="flex items-center space-x-1">
                                    <Clock className="h-3 w-3 text-gray-400" />
                                    <span className="text-xs text-gray-400">
                                      {Math.round(analysis.processing_time / 1000)}s
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {new Date(analysis.created_at).toLocaleDateString()}
                          </span>
                          {analysis.status === "completed" && (
                            <>
                              <Link href={`/analysis/results/${analysis.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              </Link>
                              <Button variant="outline" size="sm" onClick={() => handleShareAnalysis(analysis.id)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/analysis/results/${analysis.id}`}>View Details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/api/generate-pdf/${analysis.id}`} target="_blank">
                                  <Download className="mr-2 h-4 w-4" />
                                  Download PDF
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteAnalysis(analysis.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
