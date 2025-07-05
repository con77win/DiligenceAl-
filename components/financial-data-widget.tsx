"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  RefreshCw,
  Building2,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  AlertCircle,
  CheckCircle,
} from "lucide-react"

interface FinancialData {
  totalFunding?: string
  revenue?: string
  valuation?: string
  employeeCount?: string
  foundedYear?: string
  lastFundingRound?: string
  investors?: string[]
  headquarters?: string
  industry?: string
  description?: string
}

interface FinancialDataResult {
  success: boolean
  companyName?: string
  domain?: string
  financialData?: FinancialData
  source?: string
  retrievalTimestamp?: string
  cached?: boolean
  error?: {
    message: string
    source: string
    details: string
  }
}

export function FinancialDataWidget() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FinancialDataResult | null>(null)

  const handleSearch = async (forceRefresh = false) => {
    if (!query.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/financial-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: query.trim(),
          forceRefresh,
        }),
      })

      const data: FinancialDataResult = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: {
          message: "Failed to fetch financial data",
          source: "Client",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: string | undefined) => {
    if (!value) return "N/A"
    return value.startsWith("$") ? value : `$${value}`
  }

  const formatNumber = (value: string | undefined) => {
    if (!value) return "N/A"
    const num = Number.parseInt(value.replace(/,/g, ""))
    if (isNaN(num)) return value
    return num.toLocaleString()
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Financial Data Retrieval
          </CardTitle>
          <CardDescription>
            Enter a company name or website URL to retrieve comprehensive financial data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Stripe, airbnb.com, or https://www.uber.com"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="min-w-[100px]">
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            {result && (
              <Button
                variant="outline"
                onClick={() => handleSearch(true)}
                disabled={loading}
                title="Force refresh (bypass cache)"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
            <Separator />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {result && !loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  {result.companyName || query}
                </CardTitle>
                {result.domain && (
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span>{result.domain}</span>
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                {result.cached && (
                  <Badge variant="secondary" className="text-xs">
                    Cached
                  </Badge>
                )}
                {result.source && (
                  <Badge variant="outline" className="text-xs">
                    {result.source}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {result.success && result.financialData ? (
              <div className="space-y-6">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Total Funding
                    </div>
                    <div className="text-lg font-semibold">{formatCurrency(result.financialData.totalFunding)}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Revenue
                    </div>
                    <div className="text-lg font-semibold">{formatCurrency(result.financialData.revenue)}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Valuation
                    </div>
                    <div className="text-lg font-semibold">{formatCurrency(result.financialData.valuation)}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Employees
                    </div>
                    <div className="text-lg font-semibold">{formatNumber(result.financialData.employeeCount)}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Founded
                    </div>
                    <div className="text-lg font-semibold">{result.financialData.foundedYear || "N/A"}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      Headquarters
                    </div>
                    <div className="text-lg font-semibold">{result.financialData.headquarters || "N/A"}</div>
                  </div>
                </div>

                {/* Additional Information */}
                {(result.financialData.industry || result.financialData.lastFundingRound) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.financialData.industry && (
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Industry</div>
                          <div className="font-medium">{result.financialData.industry}</div>
                        </div>
                      )}
                      {result.financialData.lastFundingRound && (
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Last Funding Round</div>
                          <div className="font-medium">{result.financialData.lastFundingRound}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Investors */}
                {result.financialData.investors && result.financialData.investors.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Key Investors</div>
                      <div className="flex flex-wrap gap-2">
                        {result.financialData.investors.map((investor, index) => (
                          <Badge key={index} variant="secondary">
                            {investor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Description */}
                {result.financialData.description && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Description</div>
                      <div className="text-sm leading-relaxed">{result.financialData.description}</div>
                    </div>
                  </>
                )}

                {/* Metadata */}
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Retrieved on {new Date(result.retrievalTimestamp || "").toLocaleString()}
                  {result.cached && " (from cache)"}
                </div>
              </div>
            ) : (
              /* Error State */
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">{result.error?.message}</div>
                    {result.error?.details && <div className="text-sm opacity-75">{result.error.details}</div>}
                    <div className="text-sm opacity-75">Source: {result.error?.source}</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
