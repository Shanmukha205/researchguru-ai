import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronDown, ChevronUp, TrendingUp, Users, BarChart3, Sparkles, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PastResultsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName?: string;
}

interface AgentResult {
  id: string;
  agent_type: string;
  status: string;
  results: any;
  error_message: string | null;
  created_at: string;
  execution_time_ms: number | null;
  tokens_used: number | null;
}

interface Insight {
  id: string;
  insight_type: string;
  data: any;
  created_at: string;
}

export function PastResultsViewer({ open, onOpenChange, projectId, projectName }: PastResultsViewerProps) {
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open && projectId) {
      loadPastResults();
    }
  }, [open, projectId]);

  const loadPastResults = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Load agent results
      const { data: results, error: resultsError } = await supabase
        .from('agent_results')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (resultsError) throw resultsError;

      // Load insights
      const { data: insightsData, error: insightsError } = await supabase
        .from('insights')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (insightsError) throw insightsError;

      setAgentResults(results || []);
      setInsights(insightsData || []);

      // Auto-expand all sections initially
      const initialExpanded: Record<string, boolean> = {};
      (results || []).forEach((r) => {
        initialExpanded[r.id] = true;
      });
      (insightsData || []).forEach((i) => {
        initialExpanded[i.id] = true;
      });
      setExpandedSections(initialExpanded);
    } catch (err: any) {
      console.error('Error loading past results:', err);
      setError('Unable to load past results. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getAgentIcon = (agentType: string) => {
    switch (agentType) {
      case 'sentiment':
        return <BarChart3 className="h-4 w-4" />;
      case 'competitor':
        return <Users className="h-4 w-4" />;
      case 'trend':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getAgentTitle = (agentType: string) => {
    switch (agentType) {
      case 'sentiment':
        return 'Sentiment Analysis';
      case 'competitor':
        return 'Competitor Analysis';
      case 'trend':
        return 'Trend Detection';
      default:
        return agentType.charAt(0).toUpperCase() + agentType.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderSentimentResults = (results: any) => {
    if (!results) return <p className="text-sm text-muted-foreground">No data available</p>;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
            <p className="text-2xl font-bold text-primary">
              {results.overallScore ?? 'No API data'}
            </p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Breakdown</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-600">Positive: {results.positive ?? 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-600">Negative: {results.negative ?? 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-muted-foreground">Neutral: {results.neutral ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {results.positiveThemes && results.positiveThemes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-green-600 mb-2">Positive Themes:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {results.positiveThemes.map((theme: any, i: number) => (
                <li key={i}>{typeof theme === 'string' ? theme : theme.theme}</li>
              ))}
            </ul>
          </div>
        )}

        {results.negativeThemes && results.negativeThemes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-red-600 mb-2">Negative Themes:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {results.negativeThemes.map((theme: any, i: number) => (
                <li key={i}>{typeof theme === 'string' ? theme : theme.theme}</li>
              ))}
            </ul>
          </div>
        )}

        {results.confidence && (
          <Badge variant="outline" className="text-xs">
            Confidence: {results.confidence}%
          </Badge>
        )}
      </div>
    );
  };

  const renderCompetitorResults = (results: any) => {
    if (!results?.competitors || results.competitors.length === 0) {
      return <p className="text-sm text-muted-foreground">No competitor data available</p>;
    }

    return (
      <div className="space-y-3">
        {results.competitors.map((comp: any, i: number) => (
          <div key={i} className="p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{comp.name}</p>
                <p className="text-xs text-muted-foreground">{comp.company}</p>
              </div>
              {comp.confidence && (
                <Badge variant="outline" className="text-xs">
                  {comp.confidence}% confident
                </Badge>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <span>Price: {comp.price ?? <span className="text-muted-foreground italic">No API data</span>}</span>
              <span>Rating: {comp.rating ? `${comp.rating}/5` : <span className="text-muted-foreground italic">No API data</span>}</span>
            </div>
            {comp.sourceSnippet && (
              <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                {comp.sourceSnippet}
              </p>
            )}
          </div>
        ))}
        
        {results.sourceDomains && results.sourceDomains.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            Sources: {results.sourceDomains.join(' • ')}
          </p>
        )}
      </div>
    );
  };

  const renderTrendResults = (results: any) => {
    if (!results) return <p className="text-sm text-muted-foreground">No trend data available</p>;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Trend Score</p>
            <p className="text-2xl font-bold text-primary">
              {results.trendScore ?? 'No API data'}
            </p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Growth Rate</p>
            <p className="text-2xl font-bold text-primary">{results.growthRate ?? 0}%</p>
          </div>
        </div>

        {results.demandPattern && (
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Demand Pattern</p>
            <p className={`text-lg font-semibold capitalize ${
              results.demandPattern === 'rising' ? 'text-green-500' :
              results.demandPattern === 'declining' ? 'text-red-500' :
              'text-yellow-500'
            }`}>
              {results.demandPattern}
            </p>
          </div>
        )}

        {results.keywords && results.keywords.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Trending Keywords:</p>
            <div className="flex flex-wrap gap-2">
              {results.keywords.map((keyword: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {results.emergingTopics && results.emergingTopics.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Emerging Topics:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {results.emergingTopics.map((topic: any, i: number) => (
                <li key={i}>{typeof topic === 'string' ? topic : topic.topic}</li>
              ))}
            </ul>
          </div>
        )}

        {results.confidence && (
          <Badge variant="outline" className="text-xs">
            Confidence: {results.confidence}%
          </Badge>
        )}
      </div>
    );
  };

  const renderAgentResults = (result: AgentResult) => {
    if (result.status === 'failed') {
      return (
        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
          <p className="text-sm text-destructive">
            Error: {result.error_message || 'Unknown error occurred'}
          </p>
        </div>
      );
    }

    switch (result.agent_type) {
      case 'sentiment':
        return renderSentimentResults(result.results);
      case 'competitor':
        return renderCompetitorResults(result.results);
      case 'trend':
        return renderTrendResults(result.results);
      default:
        return (
          <pre className="text-xs bg-secondary/30 p-3 rounded-lg overflow-auto max-h-48">
            {JSON.stringify(result.results, null, 2)}
          </pre>
        );
    }
  };

  const renderInsight = (insight: Insight) => {
    const data = insight.data as any;
    
    return (
      <div className="space-y-3">
        {data.summary && (
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{data.summary}</p>
          </div>
        )}
        
        {data.keyFindings && data.keyFindings.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Key Findings:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {data.keyFindings.map((finding: string, i: number) => (
                <li key={i}>{finding}</li>
              ))}
            </ul>
          </div>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recommendations:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {data.recommendations.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const hasNoResults = agentResults.length === 0 && insights.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Past Results Viewer
          </DialogTitle>
          <DialogDescription>
            {projectName ? `Previous results for "${projectName}"` : 'Previously generated agent outputs'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[65vh] pr-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Loading past results...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-8 w-8 mb-4" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={loadPastResults}>
                Try Again
              </Button>
            </div>
          ) : hasNoResults ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-4" />
              <p className="text-sm">No previously generated results available for this project.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agent Results */}
              {agentResults.map((result) => (
                <div 
                  key={result.id} 
                  className="border border-border/50 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(result.id)}
                    className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getAgentIcon(result.agent_type)}
                      <span className="font-medium">{getAgentTitle(result.agent_type)}</span>
                      <Badge 
                        variant={result.status === 'completed' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {result.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(result.created_at)}
                      </div>
                      {expandedSections[result.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  
                  {expandedSections[result.id] && (
                    <div className="p-4 border-t border-border/50">
                      {renderAgentResults(result)}
                      
                      {(result.execution_time_ms || result.tokens_used) && (
                        <div className="mt-4 pt-3 border-t border-border/30 flex gap-4 text-xs text-muted-foreground">
                          {result.execution_time_ms && (
                            <span>Execution time: {result.execution_time_ms}ms</span>
                          )}
                          {result.tokens_used && (
                            <span>Tokens used: {result.tokens_used}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Insights */}
              {insights.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Generated Insights
                  </h3>
                  {insights.map((insight) => (
                    <div 
                      key={insight.id} 
                      className="border border-border/50 rounded-lg overflow-hidden mb-3"
                    >
                      <button
                        onClick={() => toggleSection(insight.id)}
                        className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="font-medium capitalize">
                            {insight.insight_type.replace(/_/g, ' ')} Insight
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(insight.created_at)}
                          </div>
                          {expandedSections[insight.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                      
                      {expandedSections[insight.id] && (
                        <div className="p-4 border-t border-border/50">
                          {renderInsight(insight)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
