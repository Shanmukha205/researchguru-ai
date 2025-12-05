import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Info, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RiskOpportunityDetectorProps {
  projectId: string | undefined;
}

interface DetectionItem {
  text: string;
  confidence: number;
  impact: "high" | "medium" | "low";
}

export const RiskOpportunityDetector = ({ projectId }: RiskOpportunityDetectorProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [risks, setRisks] = useState<DetectionItem[]>([]);
  const [opportunities, setOpportunities] = useState<DetectionItem[]>([]);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'risks-opportunities', projectId }
      });

      if (error) throw error;

      if (data?.risks && data?.opportunities) {
        setRisks(data.risks);
        setOpportunities(data.opportunities);
      }
    } catch (error) {
      console.error('Error fetching risks/opportunities:', error);
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

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high": return "text-red-500";
      case "medium": return "text-yellow-500";
      case "low": return "text-green-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-semibold">
                Risk & Opportunity Detector
              </CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>AI identifies potential risks and opportunities by analyzing market trends, competitor movements, and industry signals with confidence scoring.</p>
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
            Proactively identify market risks and growth opportunities
            {projectId ? "" : " (showing aggregated insights across all projects)"}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Detecting risks and opportunities...</span>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Risks Column */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm uppercase tracking-wide text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Detected Risks
                  </h3>
                  {risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No risks detected yet. Run more research to identify potential risks.</p>
                  ) : (
                    <ul className="space-y-3">
                      {risks.map((item, index) => (
                        <li 
                          key={index}
                          className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                            <span className="text-sm">{item.text}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Confidence:</span>
                              <Progress value={item.confidence} className="w-16 h-1.5" />
                              <span className="font-medium">{item.confidence}%</span>
                            </div>
                            <span className={`font-medium uppercase ${getImpactColor(item.impact)}`}>
                              {item.impact} impact
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Opportunities Column */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm uppercase tracking-wide text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Opportunities
                  </h3>
                  {opportunities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No opportunities detected yet. Run more research to identify growth potential.</p>
                  ) : (
                    <ul className="space-y-3">
                      {opportunities.map((item, index) => (
                        <li 
                          key={index}
                          className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            <span className="text-sm">{item.text}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Confidence:</span>
                              <Progress value={item.confidence} className="w-16 h-1.5" />
                              <span className="font-medium">{item.confidence}%</span>
                            </div>
                            <span className={`font-medium uppercase ${getImpactColor(item.impact)}`}>
                              {item.impact} potential
                            </span>
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