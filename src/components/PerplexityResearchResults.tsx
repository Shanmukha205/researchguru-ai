import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target, Lightbulb, Globe } from "lucide-react";
import { ResearchLimitationsBox } from "./ResearchLimitationsBox";

interface PerplexityData {
  marketOverview?: string;
  sentimentSummary?: {
    overall: string;
    confidence: number;
    details?: string;
  };
  competitors?: Array<{
    name: string;
    price?: string;
    rating?: string;
    keyDifference?: string;
  }>;
  trends?: string[];
  keyInsights?: string[];
  limitations?: string[];
  suggestions?: string[];
  sources?: string[];
}

interface PerplexityResearchResultsProps {
  data: PerplexityData;
  mode: 'quick' | 'deep';
  timestamp: string;
}

export function PerplexityResearchResults({ data, mode, timestamp }: PerplexityResearchResultsProps) {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'bg-green-500/20 text-green-600 dark:text-green-400';
      case 'negative': return 'bg-red-500/20 text-red-600 dark:text-red-400';
      default: return 'bg-gray-500/20 text-gray-600 dark:text-gray-400';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-500';
    if (confidence >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {mode} Research
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Market Overview */}
      {data.marketOverview && (
        <Card className="border-border/50 bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Market Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.marketOverview}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sentiment Summary */}
      {data.sentimentSummary && (
        <Card className="border-border/50 bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Sentiment Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className={getSentimentColor(data.sentimentSummary.overall)}>
                {data.sentimentSummary.overall}
              </Badge>
              <span className={`text-sm font-medium ${getConfidenceColor(data.sentimentSummary.confidence)}`}>
                {data.sentimentSummary.confidence}% confidence
              </span>
            </div>
            {data.sentimentSummary.details && (
              <p className="text-sm text-muted-foreground">
                {data.sentimentSummary.details}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Competitors */}
      {data.competitors && data.competitors.length > 0 && (
        <Card className="border-border/50 bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Competitive Landscape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {data.competitors.map((comp, i) => (
                <div key={i} className="p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{comp.name}</p>
                      {comp.keyDifference && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {comp.keyDifference}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {comp.price && (
                        <p className="text-sm font-semibold text-primary">{comp.price}</p>
                      )}
                      {comp.rating && (
                        <p className="text-xs text-muted-foreground">Rating: {comp.rating}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends */}
      {data.trends && data.trends.length > 0 && (
        <Card className="border-border/50 bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Market Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.trends.map((trend, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  {trend}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      {data.keyInsights && data.keyInsights.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.keyInsights.map((insight, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-primary font-bold">{i + 1}.</span>
                  <span className="text-foreground">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Limitations & Suggestions */}
      <ResearchLimitationsBox
        limitations={data.limitations || []}
        suggestions={data.suggestions || []}
        sources={data.sources}
      />
    </div>
  );
}
