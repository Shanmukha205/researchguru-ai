import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportGenerator } from "@/components/ReportGenerator";
import { InsightsSummary } from "@/components/InsightsSummary";
import { ShareProjectDialog } from "@/components/ShareProjectDialog";
import { ProjectComments } from "@/components/ProjectComments";
import { useActivityTracking } from "@/hooks/useActivityTracking";
export default function Research() {
  const [productName, setProductName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState({
    sentiment: "Ready",
    competitor: "Ready",
    trend: "Ready",
  });
  const [agentOutcomes, setAgentOutcomes] = useState<Record<string, any>>({});
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { trackActivity } = useActivityTracking();

  const handleStartResearch = async () => {
    if (!productName.trim()) {
      toast({
        title: "Product name required",
        description: "Please enter a product or company name to research",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAgentStatus({
      sentiment: "Pending",
      competitor: "Pending",
      trend: "Pending",
    });

    try {
      // Create research project
      const { data: project, error: projectError } = await supabase
        .from('research_projects')
        .insert({
          product_name: productName,
          company_name: companyName,
          description: description,
          status: 'in_progress',
          user_id: user?.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      setCurrentProjectId(project.id);

      toast({
        title: "Research started",
        description: "AI agents are analyzing your request...",
      });

      // Update status to in progress
      setAgentStatus({
        sentiment: "In Progress",
        competitor: "In Progress",
        trend: "In Progress",
      });

      // Call the run-agents function
      const { data, error } = await supabase.functions.invoke('run-agents', {
        body: {
          productName,
          companyName,
          description,
          projectId: project.id,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Edge function returned an error');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update status to completed
      setAgentStatus({
        sentiment: "Completed",
        competitor: "Completed",
        trend: "Completed",
      });

      // Fetch agent outcomes from database
      const { data: agentResults, error: resultsError } = await supabase
        .from('agent_results')
        .select('*')
        .eq('project_id', project.id);

      if (!resultsError && agentResults) {
        const outcomes: Record<string, any> = {};
        agentResults.forEach(result => {
          outcomes[result.agent_type] = result;
        });
        setAgentOutcomes(outcomes);
      }

      // Update project status
      await supabase
        .from('research_projects')
        .update({ status: 'completed' })
        .eq('id', project.id);

      toast({
        title: "Research completed",
        description: "All agents have finished analyzing. Check the outcomes below.",
      });

      // Reset form but keep outcomes visible
      setProductName("");
      setCompanyName("");
      setDescription("");
    } catch (error: any) {
      console.error('Research error:', error);
      setAgentStatus({
        sentiment: "Failed",
        competitor: "Failed",
        trend: "Failed",
      });
      
      // Try to fetch any partial results
      if (currentProjectId) {
        const { data: agentResults } = await supabase
          .from('agent_results')
          .select('*')
          .eq('project_id', currentProjectId);

        if (agentResults) {
          const outcomes: Record<string, any> = {};
          agentResults.forEach(result => {
            outcomes[result.agent_type] = result;
          });
          setAgentOutcomes(outcomes);
        }
      }

      toast({
        title: "Research failed",
        description: error.message || "Failed to complete research. Check outcomes below for partial results.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Product Research</h1>
        <p className="text-muted-foreground text-lg">
          Enter product details to start comprehensive market analysis
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Research Input
            </CardTitle>
            <CardDescription>
              Provide product or company information for analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product/Company Name *</label>
              <Input
                placeholder="e.g., Boat Airdopes 131"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input
                placeholder="e.g., Boat"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                placeholder="Add any additional context or specific areas to focus on..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background/50 min-h-[100px]"
              />
            </div>

            <Button
              onClick={handleStartResearch}
              disabled={isLoading}
              className="w-full gradient-primary hover:opacity-90 transition-opacity"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Start Research
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Agent Status</CardTitle>
            <CardDescription>Monitor AI agents progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgentStatus 
              name="Sentiment Agent" 
              status={agentStatus.sentiment}
              outcome={agentOutcomes['sentiment']}
            />
            <AgentStatus 
              name="Competitor Agent" 
              status={agentStatus.competitor}
              outcome={agentOutcomes['competitor']}
            />
            <AgentStatus 
              name="Trends Agent" 
              status={agentStatus.trend}
              outcome={agentOutcomes['trend']}
            />
          </CardContent>
        </Card>
      </div>

      {/* Outcomes Section */}
      {Object.keys(agentOutcomes).length > 0 && (
        <>
          <Card className="glass-effect border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Research Outcomes</CardTitle>
                  <CardDescription>Detailed results from each agent</CardDescription>
                </div>
          <div className="flex gap-2">
            {currentProjectId && (
              <>
                <ShareProjectDialog 
                  projectId={currentProjectId}
                  projectName={productName || 'Research Project'}
                />
                <ReportGenerator 
                  data={{
                    projectName: productName || 'Research Project',
                    companyName: companyName,
                    agentResults: Object.values(agentOutcomes)
                  }}
                />
              </>
            )}
          </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {agentOutcomes['sentiment'] && (
                <OutcomeCard
                  title="Sentiment Analysis"
                  agentType="sentiment"
                  outcome={agentOutcomes['sentiment']}
                />
              )}
              {agentOutcomes['competitor'] && (
                <OutcomeCard
                  title="Competitor Analysis"
                  agentType="competitor"
                  outcome={agentOutcomes['competitor']}
                />
              )}
              {agentOutcomes['trend'] && (
                <OutcomeCard
                  title="Market Trends"
                  agentType="trend"
                  outcome={agentOutcomes['trend']}
                />
              )}
            </CardContent>
          </Card>

      {currentProjectId && (
        <>
          <InsightsSummary projectId={currentProjectId} />
          <ProjectComments projectId={currentProjectId} />
        </>
      )}
        </>
      )}
    </div>
  );
}

function AgentStatus({ 
  name, 
  status, 
  outcome 
}: { 
  name: string; 
  status: string;
  outcome?: any;
}) {
  const statusConfig = {
    Ready: { color: "bg-gray-500", icon: Clock },
    Pending: { color: "bg-yellow-500", icon: Clock },
    "In Progress": { color: "bg-blue-500 animate-pulse", icon: Loader2 },
    Completed: { color: "bg-green-500", icon: CheckCircle },
    Failed: { color: "bg-red-500", icon: XCircle },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Ready;
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50">
        <span className="font-medium">{name}</span>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${config.color}`} />
          <Icon className={`h-4 w-4 ${status === "In Progress" ? "animate-spin" : ""}`} />
          <span className="text-sm text-muted-foreground">{status}</span>
        </div>
      </div>
      
      {outcome && (
        <div className="ml-4 p-3 rounded-lg bg-background/50 border border-border/30">
          {outcome.status === 'failed' ? (
            <p className="text-sm text-destructive">Error: {outcome.error_message || 'Unknown error'}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              ✓ Outcome available - scroll down to view details
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function OutcomeCard({ 
  title, 
  agentType, 
  outcome 
}: { 
  title: string; 
  agentType: string;
  outcome: any;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (outcome.status === 'failed') {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/50">
        <h3 className="font-semibold text-destructive mb-2">{title} - Failed</h3>
        <p className="text-sm text-muted-foreground">{outcome.error_message || 'Unknown error occurred'}</p>
      </div>
    );
  }

  const results = outcome.results;
  
  if (!results) {
    return (
      <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">No outcome generated</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
      <div 
        className="flex items-center justify-between cursor-pointer mb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-semibold">{title}</h3>
        <Button variant="ghost" size="sm">
          {isExpanded ? "Hide Details" : "View Details"}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="space-y-3 text-sm">
          {agentType === 'sentiment' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                  <p className="text-2xl font-bold">{results.overallScore || 'N/A'}</p>
                </div>
                <div className="p-3 bg-background/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Sentiment</p>
                  <div className="space-y-1">
                    <p className="text-green-500">Positive: {results.positive}%</p>
                    <p className="text-red-500">Negative: {results.negative}%</p>
                    <p className="text-gray-500">Neutral: {results.neutral}%</p>
                  </div>
                </div>
              </div>
              {results.positiveThemes && (
                <div>
                  <p className="font-medium mb-2">Positive Themes:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.positiveThemes.map((theme: string, i: number) => (
                      <li key={i}>{theme}</li>
                    ))}
                  </ul>
                </div>
              )}
              {results.negativeThemes && (
                <div>
                  <p className="font-medium mb-2">Negative Themes:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.negativeThemes.map((theme: string, i: number) => (
                      <li key={i}>{theme}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {agentType === 'competitor' && results.competitors && (
            <div className="space-y-3">
              {results.competitors.map((comp: any, i: number) => (
                <div key={i} className="p-3 bg-background/50 rounded-lg">
                  <p className="font-medium">{comp.name}</p>
                  <p className="text-xs text-muted-foreground">{comp.company}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <span>Price: {comp.price}</span>
                    <span>Rating: {comp.rating}/5</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {agentType === 'trend' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Trend Score</p>
                  <p className="text-2xl font-bold">{results.trendScore || 'N/A'}</p>
                </div>
                <div className="p-3 bg-background/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Growth Rate</p>
                  <p className="text-2xl font-bold">{results.growthRate}%</p>
                </div>
              </div>
              {results.keywords && (
                <div>
                  <p className="font-medium mb-2">Trending Keywords:</p>
                  <div className="flex flex-wrap gap-2">
                    {results.keywords.map((keyword: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-primary/20 rounded-md text-xs">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {results.insights && (
                <div>
                  <p className="font-medium mb-2">Key Insights:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.insights.map((insight: string, i: number) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="pt-3 border-t border-border/50">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${agentType}-results.json`;
                a.click();
              }}
            >
              Download as JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
