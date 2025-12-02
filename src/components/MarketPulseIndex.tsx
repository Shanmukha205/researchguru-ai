import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface MarketPulseData {
  score: number;
  summary: string;
  sentiment: number;
  competition: number;
  trend: number;
}

export default function MarketPulseIndex({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const [pulseData, setPulseData] = useState<MarketPulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [rateLimited, setRateLimited] = useState(false);

  const loadMarketPulse = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setRateLimited(false);
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'market-pulse', projectId }
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
      if (data?.pulseData) {
        setPulseData(data.pulseData);
        setLastUpdated(new Date());
      }
    } catch (error: any) {
      console.error('Error loading market pulse:', error);
      if (error?.message?.includes('429') || error?.message?.includes('rate')) {
        setRateLimited(true);
        toast.error("Rate limit exceeded. Please wait a moment before retrying.");
      } else {
        toast.error("Failed to load market pulse data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketPulse();
    const interval = setInterval(loadMarketPulse, 45000); // Refresh every 45 seconds
    return () => clearInterval(interval);
  }, [user, projectId]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const gaugeData = pulseData ? [
    { name: 'Score', value: pulseData.score },
    { name: 'Remaining', value: 100 - pulseData.score }
  ] : [];

  const COLORS = ['#10b981', '#1f2937'];

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary animate-pulse" />
              AI-Driven Market Pulse Index
            </CardTitle>
            <CardDescription>Real-time unified market intelligence score</CardDescription>
          </div>
          <Button onClick={loadMarketPulse} variant="outline" size="sm" className="gap-2">
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
        ) : pulseData ? (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={gaugeData}
                      cx="50%"
                      cy="50%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {gaugeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(pulseData.score)}`}>
                      {pulseData.score}
                    </div>
                    <div className="text-xs text-muted-foreground">MPI Score</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground italic">"{pulseData.summary}"</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{pulseData.sentiment}%</div>
                <div className="text-xs text-muted-foreground">Sentiment</div>
              </div>
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-cyan-400">{pulseData.competition}%</div>
                <div className="text-xs text-muted-foreground">Competition</div>
              </div>
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{pulseData.trend}%</div>
                <div className="text-xs text-muted-foreground">Trend</div>
              </div>
            </div>
          </div>
        ) : rateLimited ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-amber-500 font-medium">Rate limit exceeded</div>
            <p className="text-sm text-muted-foreground">
              The AI service is busy. Please wait 30 seconds and try again.
            </p>
            <Button onClick={loadMarketPulse} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No market data available. Run a research project to generate insights.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
