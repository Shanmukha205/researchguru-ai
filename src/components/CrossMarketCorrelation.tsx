import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CorrelationData {
  market1: string;
  market2: string;
  correlation: number;
  insight: string;
}

export default function CrossMarketCorrelation({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [rateLimited, setRateLimited] = useState(false);

  const loadCorrelations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setRateLimited(false);
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'market-correlation', projectId }
      });

      if (error) {
        const errorMsg = error.message || '';
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          setRateLimited(true);
          toast.error("Rate limit exceeded. Please wait a moment before retrying.");
          return;
        }
        throw error;
      }
      if (data?.error && data.error.includes('Rate limit')) {
        setRateLimited(true);
        toast.error("Rate limit exceeded. Please wait a moment before retrying.");
        return;
      }
      if (data?.correlations) {
        setCorrelations(data.correlations);
        setLastUpdated(new Date());
      }
    } catch (error: any) {
      console.error('Error loading correlations:', error);
      if (error?.message?.includes('429') || error?.message?.includes('rate')) {
        setRateLimited(true);
        toast.error("Rate limit exceeded. Please wait a moment before retrying.");
      } else {
        toast.error("Failed to load correlation data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorrelations();
    const interval = setInterval(loadCorrelations, 60000);
    return () => clearInterval(interval);
  }, [user, projectId]);

  const getCorrelationColor = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return 'bg-green-500/20 text-green-500 border-green-500/30';
    if (absCorr >= 0.4) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    return 'bg-red-500/20 text-red-500 border-red-500/30';
  };

  const getCorrelationStrength = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return 'Strong';
    if (absCorr >= 0.4) return 'Moderate';
    return 'Weak';
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Cross-Market Correlation Explorer
            </CardTitle>
            <CardDescription>AI-powered analysis of inter-market relationships</CardDescription>
          </div>
          <Button onClick={loadCorrelations} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-2">
            Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary shimmer"></div>
          </div>
        ) : correlations.length > 0 ? (
          <div className="space-y-4">
            {/* Correlation Heatmap Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {correlations.map((corr, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${getCorrelationColor(corr.correlation)} transition-all duration-300 hover:scale-105 cursor-pointer animate-slide-up`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">
                      {corr.market1} ↔ {corr.market2}
                    </div>
                    <div className="text-2xl font-bold">
                      {corr.correlation.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-xs opacity-80 mb-2">
                    {getCorrelationStrength(corr.correlation)} Correlation
                  </div>
                  <div className="text-xs italic opacity-70">
                    {corr.insight}
                  </div>
                </div>
              ))}
            </div>

            {/* Correlation Matrix Visualization */}
            <div className="bg-secondary/10 p-4 rounded-lg">
              <h4 className="text-sm font-semibold mb-3">Correlation Strength Legend</h4>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500/50"></div>
                  <span className="text-xs">Strong (0.7+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500/50"></div>
                  <span className="text-xs">Moderate (0.4-0.7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/50"></div>
                  <span className="text-xs">Weak (&lt;0.4)</span>
                </div>
              </div>
            </div>
          </div>
        ) : rateLimited ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-amber-500 font-medium">Rate limit exceeded</div>
            <p className="text-sm text-muted-foreground">
              The AI service is busy. Please wait 30 seconds and try again.
            </p>
            <Button onClick={loadCorrelations} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No correlation data available. Analyze multiple markets to see relationships.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
