import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, RefreshCw, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StrengthsWeaknessesAnalyzerProps {
  projectId: string | undefined;
}

interface InsightItem {
  text: string;
  confidence: number;
}

export const StrengthsWeaknessesAnalyzer = ({ projectId }: StrengthsWeaknessesAnalyzerProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [strengths, setStrengths] = useState<InsightItem[]>([]);
  const [weaknesses, setWeaknesses] = useState<InsightItem[]>([]);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'strengths-weaknesses', projectId }
      });

      if (error) throw error;

      if (data?.strengths && data?.weaknesses) {
        setStrengths(data.strengths);
        setWeaknesses(data.weaknesses);
      }
    } catch (error) {
      console.error('Error fetching strengths/weaknesses:', error);
      toast.error('Failed to generate insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [projectId]);

  const handleRegenerate = () => {
    fetchInsights();
  };

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-semibold">
                Strengths & Weaknesses Analyzer
              </CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>AI-powered analysis of your product's competitive advantages and areas needing improvement based on market data and sentiment analysis.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Identify key strengths to leverage and weaknesses to address
            {projectId ? "" : " (showing aggregated insights across all projects)"}
          </CardDescription>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Analyzing data...</span>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Strengths Column */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm uppercase tracking-wide text-green-600 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Strengths
                  </h3>
                  {strengths.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No strengths identified yet. Run more research to generate insights.</p>
                  ) : (
                    <ul className="space-y-2">
                      {strengths.map((item, index) => (
                        <li 
                          key={index}
                          className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm">{item.text}</span>
                            <div className="text-xs text-muted-foreground mt-1">
                              Confidence: {item.confidence}%
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Weaknesses Column */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Weaknesses
                  </h3>
                  {weaknesses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No weaknesses identified yet. Run more research to generate insights.</p>
                  ) : (
                    <ul className="space-y-2">
                      {weaknesses.map((item, index) => (
                        <li 
                          key={index}
                          className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50"
                        >
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm">{item.text}</span>
                            <div className="text-xs text-muted-foreground mt-1">
                              Confidence: {item.confidence}%
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button 
                onClick={handleRegenerate} 
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Regenerate Insights
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};