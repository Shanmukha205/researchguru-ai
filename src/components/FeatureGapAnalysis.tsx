import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, MinusCircle, Info, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FeatureGapAnalysisProps {
  projectId: string | undefined;
}

interface FeatureComparison {
  feature: string;
  yourProduct: boolean | "partial";
  competitor: boolean | "partial";
  priority: "high" | "medium" | "low";
}

export const FeatureGapAnalysis = ({ projectId }: FeatureGapAnalysisProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [features, setFeatures] = useState<FeatureComparison[]>([]);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'feature-gaps', projectId }
      });

      if (error) throw error;

      if (data?.features) {
        setFeatures(data.features);
      }
    } catch (error) {
      console.error('Error fetching feature gaps:', error);
      toast.error('Failed to generate feature analysis. Please try again.');
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

  const renderFeatureStatus = (status: boolean | "partial") => {
    if (status === true) {
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
    } else if (status === "partial") {
      return <MinusCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
    }
    return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
  };

  const getMissingFeatures = () => {
    return features.filter(f => f.yourProduct === false && (f.competitor === true || f.competitor === "partial"));
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const missingFeatures = getMissingFeatures();

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-semibold">
                Feature Gap Analysis
              </CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Compare your product's features against competitors to identify gaps and prioritize development efforts.</p>
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
            Compare features with competitors and identify gaps
            {projectId ? "" : " (showing aggregated analysis across all projects)"}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Analyzing feature gaps...</span>
              </div>
            ) : features.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No feature data available yet. Run more research to generate feature analysis.
              </p>
            ) : (
              <>
                {/* Feature Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium">Feature</th>
                        <th className="text-center py-3 px-4 font-medium">Your Product</th>
                        <th className="text-center py-3 px-4 font-medium">Competitor</th>
                        <th className="text-center py-3 px-4 font-medium">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((item, index) => {
                        const isMissing = item.yourProduct === false && (item.competitor === true || item.competitor === "partial");
                        return (
                          <tr 
                            key={index}
                            className={`border-b border-border/50 ${isMissing ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                          >
                            <td className="py-3 px-4">
                              <span className={isMissing ? "text-red-700 dark:text-red-300 font-medium" : ""}>
                                {item.feature}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex justify-center">
                                {renderFeatureStatus(item.yourProduct)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex justify-center">
                                {renderFeatureStatus(item.competitor)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant={getPriorityBadgeVariant(item.priority) as any}>
                                {item.priority}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Missing Features Summary */}
                {missingFeatures.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                    <h4 className="font-medium text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Missing Features ({missingFeatures.length})
                    </h4>
                    <ul className="space-y-1">
                      {missingFeatures.map((item, index) => (
                        <li key={index} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                          <span>•</span>
                          <span>{item.feature}</span>
                          <Badge variant={getPriorityBadgeVariant(item.priority) as any} className="text-xs">
                            {item.priority}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MinusCircle className="h-4 w-4 text-yellow-600" />
                    <span>Partial</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Missing</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button 
                onClick={handleRegenerate} 
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Regenerate Analysis
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};