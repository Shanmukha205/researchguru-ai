import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import MarketPulseIndex from "@/components/MarketPulseIndex";
import CrossMarketCorrelation from "@/components/CrossMarketCorrelation";
import ConsumerPersonaPredictor from "@/components/ConsumerPersonaPredictor";
import ProjectSelector from "@/components/ProjectSelector";

export default function FutureInsights() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshAll = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Future Insights & Predictive Analytics
        </h1>
        <p className="text-muted-foreground text-lg">
          Next-level market intelligence powered by AI
        </p>
      </div>

      <div className="flex items-center justify-between p-4 glass-effect rounded-lg border border-border/50">
        <ProjectSelector onProjectSelect={setSelectedProjectId} />
        <Button onClick={handleRefreshAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh All Insights
        </Button>
      </div>

      <MarketPulseIndex key={`pulse-${refreshKey}`} projectId={selectedProjectId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrossMarketCorrelation key={`correlation-${refreshKey}`} projectId={selectedProjectId} />
        <ConsumerPersonaPredictor key={`personas-${refreshKey}`} projectId={selectedProjectId} />
      </div>
    </div>
  );
}
