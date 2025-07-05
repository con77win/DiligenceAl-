import { FinancialDataWidget } from "@/components/financial-data-widget"

export default function FinancialDataPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-4">Financial Data Intelligence</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Retrieve comprehensive financial data for any company using our multi-source intelligence platform. Get
            funding information, employee counts, valuations, and more from trusted sources.
          </p>
        </div>

        <FinancialDataWidget />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-lg border">
            <div className="text-2xl font-bold text-primary mb-2">5+</div>
            <div className="text-sm text-muted-foreground">Data Sources</div>
            <div className="text-xs mt-1">Crunchbase, LinkedIn, SerpAPI, and more</div>
          </div>

          <div className="text-center p-6 rounded-lg border">
            <div className="text-2xl font-bold text-primary mb-2">24h</div>
            <div className="text-sm text-muted-foreground">Cache Duration</div>
            <div className="text-xs mt-1">Fast retrieval with smart caching</div>
          </div>

          <div className="text-center p-6 rounded-lg border">
            <div className="text-2xl font-bold text-primary mb-2">99%</div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
            <div className="text-xs mt-1">Reliable data with fallback sources</div>
          </div>
        </div>
      </div>
    </div>
  )
}
