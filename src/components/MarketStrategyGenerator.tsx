import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Target, Users, DollarSign, Megaphone, Shield, Rocket, ChevronDown, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MarketStrategyGeneratorProps {
  projectId: string | undefined;
}

interface StrategySection {
  title: string;
  icon: React.ElementType;
  content: string;
  confidence: number;
  recommendations: string[];
}

export const MarketStrategyGenerator = ({ projectId }: MarketStrategyGeneratorProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [strategies, setStrategies] = useState<StrategySection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const generateStrategy = async () => {
    if (!projectId) {
      toast.error("Please select a project first");
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all agent results for the project
      const { data: agentResults, error: resultsError } = await supabase
        .from("agent_results")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "completed");

      if (resultsError) throw resultsError;

      // Fetch project details
      const { data: project, error: projectError } = await supabase
        .from("research_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      // Aggregate all insights
      const sentimentData = agentResults?.find(r => r.agent_type === "sentiment")?.results;
      const competitorData = agentResults?.find(r => r.agent_type === "competitor")?.results;
      const trendData = agentResults?.find(r => r.agent_type === "trend")?.results;

      // Call edge function to generate strategies
      const { data, error } = await supabase.functions.invoke("generate-strategy", {
        body: {
          projectName: project.product_name,
          companyName: project.company_name,
          sentimentData,
          competitorData,
          trendData
        }
      });

      if (error) throw error;

      if (data?.strategies) {
        setStrategies(data.strategies);
        setExpandedSections(new Set([data.strategies[0]?.title]));
        toast.success("Market strategies generated successfully");
      }
    } catch (error) {
      console.error("Error generating strategy:", error);
      toast.error("Failed to generate strategies. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const exportAsPDF = () => {
    toast.info("Preparing PDF export...");
    // Create printable content
    const content = strategies.map(s => 
      `${s.title}\nConfidence: ${s.confidence}%\n\n${s.content}\n\nRecommendations:\n${s.recommendations.map(r => `• ${r}`).join('\n')}\n\n`
    ).join('---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'market-strategy.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Strategy exported successfully");
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500/20 text-green-500";
    if (confidence >= 60) return "bg-yellow-500/20 text-yellow-500";
    return "bg-red-500/20 text-red-500";
  };

  const iconMap: Record<string, React.ElementType> = {
    "Go-To-Market Strategy": Rocket,
    "User Segmentation Strategy": Users,
    "Pricing Strategy": DollarSign,
    "Marketing Messaging Blueprint": Megaphone,
    "Risk Mitigation Plan": Shield,
    "Opportunity Exploitation Roadmap": Target
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>AI Market Strategy Generator</CardTitle>
              <CardDescription>
                Transform research insights into actionable business strategies
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {strategies.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportAsPDF}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            <Button 
              onClick={generateStrategy} 
              disabled={isLoading || !projectId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Strategy
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!projectId && (
          <div className="text-center py-8 text-muted-foreground">
            Select a project to generate market strategies
          </div>
        )}

        {projectId && strategies.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Generate Strategy" to create AI-powered business strategies based on your research data
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing data and generating strategies...</p>
          </div>
        )}

        {strategies.length > 0 && !isLoading && (
          <div className="space-y-4">
            {strategies.map((strategy, index) => {
              const Icon = iconMap[strategy.title] || Target;
              const isExpanded = expandedSections.has(strategy.title);
              
              return (
                <Collapsible 
                  key={index} 
                  open={isExpanded}
                  onOpenChange={() => toggleSection(strategy.title)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-medium">{strategy.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getConfidenceColor(strategy.confidence)}>
                          {strategy.confidence}% confidence
                        </Badge>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 bg-background/50 rounded-b-lg border border-t-0 border-border/50 space-y-4">
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {strategy.content}
                      </p>
                      {strategy.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Key Recommendations:</h4>
                          <ul className="space-y-2">
                            {strategy.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-primary">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
