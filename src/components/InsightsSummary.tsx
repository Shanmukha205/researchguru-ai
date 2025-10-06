import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface InsightsSummaryProps {
  projectId: string;
}

export const InsightsSummary = ({ projectId }: InsightsSummaryProps) => {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { projectId }
      });

      if (error) throw error;
      setInsights(data.insights);
      toast.success('AI insights generated successfully');
    } catch (error: any) {
      console.error('Error generating insights:', error);
      toast.error(error.message || 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (value: number) => {
    if (value > 60) return 'text-green-600';
    if (value > 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI-Powered Insights
        </CardTitle>
        <CardDescription>
          Get automated analysis and recommendations based on all agent results
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!insights ? (
          <Button onClick={generateInsights} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Insights'}
          </Button>
        ) : (
          <div className="space-y-6">
            {/* Key Findings */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Key Findings
              </h3>
              <ul className="space-y-2">
                {insights.keyFindings?.map((finding: string, idx: number) => (
                  <li key={idx} className="text-sm pl-4 border-l-2 border-primary/20">
                    {finding}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sentiment Analysis */}
            {insights.sentimentAnalysis && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Sentiment Analysis</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Positive</span>
                      <span className={getSentimentColor(insights.sentimentAnalysis.positive)}>
                        {insights.sentimentAnalysis.positive}%
                      </span>
                    </div>
                    <Progress value={insights.sentimentAnalysis.positive} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Neutral</span>
                      <span>{insights.sentimentAnalysis.neutral}%</span>
                    </div>
                    <Progress value={insights.sentimentAnalysis.neutral} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Negative</span>
                      <span className={getSentimentColor(insights.sentimentAnalysis.negative)}>
                        {insights.sentimentAnalysis.negative}%
                      </span>
                    </div>
                    <Progress value={insights.sentimentAnalysis.negative} className="h-2" />
                  </div>
                </div>
              </div>
            )}

            {/* Trends */}
            {insights.trends?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trends
                </h3>
                <div className="flex flex-wrap gap-2">
                  {insights.trends.map((trend: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {trend}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies */}
            {insights.anomalies?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  Anomalies
                </h3>
                <ul className="space-y-2">
                  {insights.anomalies.map((anomaly: string, idx: number) => (
                    <li key={idx} className="text-sm pl-4 border-l-2 border-yellow-600/20">
                      {anomaly}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Recommendations</h3>
                <ul className="space-y-2">
                  {insights.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm pl-4 border-l-2 border-green-600/20">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={generateInsights} variant="outline" size="sm" disabled={loading}>
              Regenerate Insights
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
