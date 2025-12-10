import { useState } from "react";
import { Lightbulb, Eye, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StrengthsWeaknessesAnalyzer } from "@/components/StrengthsWeaknessesAnalyzer";
import { RiskOpportunityDetector } from "@/components/RiskOpportunityDetector";
import { FeatureGapAnalysis } from "@/components/FeatureGapAnalysis";
import { MarketStrategyGenerator } from "@/components/MarketStrategyGenerator";
import { ResearchHistoryCenter } from "@/components/ResearchHistoryCenter";
import ProjectSelector from "@/components/ProjectSelector";

const AIInsightsCenter = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 animate-fade-in">
          <div className="flex items-center justify-center gap-3">
            <Lightbulb className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              AI INSIGHTS CENTER
            </h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowHistory(true)}
                  className="ml-2"
                >
                  <Eye className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Research History</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive AI-powered analysis to uncover strengths, weaknesses, risks, opportunities, and feature gaps in your product research.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex justify-center animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <ProjectSelector onProjectSelect={setSelectedProjectId} />
        </div>

        {/* Tabs for different insight types */}
        <Tabs defaultValue="analysis" className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="analysis">Analysis Modules</TabsTrigger>
            <TabsTrigger value="strategy">Market Strategy</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="mt-6">
            {/* Insight Modules Grid */}
            <div className="grid gap-6 lg:gap-8">
              {/* Module 1: Strengths & Weaknesses */}
              <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <StrengthsWeaknessesAnalyzer projectId={selectedProjectId} />
              </div>

              {/* Module 2: Risk & Opportunity */}
              <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <RiskOpportunityDetector projectId={selectedProjectId} />
              </div>

              {/* Module 3: Feature Gap Analysis */}
              <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <FeatureGapAnalysis projectId={selectedProjectId} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="strategy" className="mt-6">
            <MarketStrategyGenerator projectId={selectedProjectId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Research History Center Modal */}
      <ResearchHistoryCenter 
        open={showHistory} 
        onOpenChange={setShowHistory} 
      />
    </div>
  );
};

export default AIInsightsCenter;
