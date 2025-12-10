import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, CheckCircle, XCircle, Clock, History, Trash2, Key, Sparkles, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportGenerator } from "@/components/ReportGenerator";
import { InsightsSummary } from "@/components/InsightsSummary";
import { AgentMetricsCalculator } from "@/components/AgentMetricsCalculator";
import { GeminiApiKeyModal } from "@/components/GeminiApiKeyModal";
import { ResearchModeSelector } from "@/components/ResearchModeSelector";
import { ResearchLimitationsBox } from "@/components/ResearchLimitationsBox";
import { ErrorExplanationPanel } from "@/components/ErrorExplanationPanel";
import { PerplexityResearchResults } from "@/components/PerplexityResearchResults";
import { PastResultsViewer } from "@/components/PastResultsViewer";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Research() {
  const [productName, setProductName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [researchMode, setResearchMode] = useState<'quick' | 'deep'>('quick');
  const [agentStatus, setAgentStatus] = useState({
    sentiment: "Ready",
    competitor: "Ready",
    trend: "Ready",
  });
  const [agentOutcomes, setAgentOutcomes] = useState<Record<string, any>>({});
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [userGeminiKey, setUserGeminiKey] = useState<string | null>(null);
  const [hasCheckedApiKey, setHasCheckedApiKey] = useState(false);
  const [perplexityResults, setPerplexityResults] = useState<any>(null);
  const [isPerplexityLoading, setIsPerplexityLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showPastResultsViewer, setShowPastResultsViewer] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadRecentHistory();
      loadUserGeminiKey();
    }
  }, [user]);

  const loadUserGeminiKey = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_api_keys")
      .select("key_value")
      .eq("user_id", user.id)
      .eq("key_name", "GEMINI_API_KEY")
      .single();

    if (data?.key_value) {
      setUserGeminiKey(data.key_value);
    }
    setHasCheckedApiKey(true);
  };

  const loadRecentHistory = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentHistory(data);
      }
    } catch (error) {
      console.error('Error loading recent history:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await supabase.from('agent_results').delete().eq('project_id', projectId);
      await supabase.from('insights').delete().eq('project_id', projectId);
      const { error } = await supabase.from('research_projects').delete().eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Project deleted",
        description: "The research project has been removed successfully.",
      });

      loadRecentHistory();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const runPerplexityResearch = async () => {
    setIsPerplexityLoading(true);
    setResearchError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('perplexity-research', {
        body: {
          productName,
          companyName,
          description,
          mode: researchMode
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPerplexityResults(data);
      toast({
        title: `${researchMode === 'quick' ? 'Quick' : 'Deep'} Research Complete`,
        description: "Perplexity analysis finished successfully.",
      });
    } catch (error: any) {
      console.error('Perplexity research error:', error);
      setResearchError(error.message || 'Perplexity research failed');
    } finally {
      setIsPerplexityLoading(false);
    }
  };

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
    setResearchError(null);
    setAgentStatus({
      sentiment: "Pending",
      competitor: "Pending",
      trend: "Pending",
    });

    // Run Perplexity research in parallel
    runPerplexityResearch();

    try {
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

      setAgentStatus({
        sentiment: "In Progress",
        competitor: "In Progress",
        trend: "In Progress",
      });

      const { data, error } = await supabase.functions.invoke('run-agents', {
        body: {
          productName,
          companyName,
          description,
          projectId: project.id,
          userGeminiKey: userGeminiKey,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Edge function returned an error');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAgentStatus({
        sentiment: "Completed",
        competitor: "Completed",
        trend: "Completed",
      });

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

      await supabase
        .from('research_projects')
        .update({ status: 'completed' })
        .eq('id', project.id);

      toast({
        title: "Research completed",
        description: "All agents have finished analyzing. Check the outcomes below.",
      });

      setProductName("");
      setCompanyName("");
      setDescription("");
      loadRecentHistory();
    } catch (error: any) {
      console.error('Research error:', error);
      setResearchError(error.message);
      setAgentStatus({
        sentiment: "Failed",
        competitor: "Failed",
        trend: "Failed",
      });
      
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setResearchError(null);
    handleStartResearch();
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Product Research</h1>
        <p className="text-muted-foreground text-lg">
          Enter product details to start comprehensive market analysis
        </p>
      </div>

      {/* API Key Status Banner */}
      {hasCheckedApiKey && !userGeminiKey && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Using Lovable AI</p>
              <p className="text-xs text-muted-foreground">
                For best results, configure your own Gemini API key in Settings
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowApiKeyModal(true)}>
            Configure API Key
          </Button>
        </div>
      )}

      {hasCheckedApiKey && userGeminiKey && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-600 dark:text-green-400">Gemini API key configured</span>
        </div>
      )}

      <GeminiApiKeyModal 
        open={showApiKeyModal} 
        onOpenChange={setShowApiKeyModal}
        onKeyConfigured={() => loadUserGeminiKey()}
      />

      {/* Recent History Section */}
      {recentHistory.length > 0 && (
        <Card className="glass-effect border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Recent Research History
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 ml-2 hover:bg-primary/10 transition-colors"
                        onClick={() => {
                          try {
                            setIsHistoryExpanded(!isHistoryExpanded);
                          } catch (error) {
                            toast({
                              title: "Unable to open recent history",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {isHistoryExpanded ? (
                          <EyeOff className="h-4 w-4 text-primary" />
                        ) : (
                          <Eye className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isHistoryExpanded ? 'Hide Recent History' : 'View Recent History'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {recentHistory.length} projects
              </Badge>
            </div>
            <CardDescription>Your previously analyzed products and companies</CardDescription>
          </CardHeader>
          
          {/* Collapsible History Content */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isHistoryExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {recentHistory.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary/70 transition-colors animate-fade-in">
                    <div className="flex-1">
                      <h4 className="font-medium">{project.product_name}</h4>
                      <p className="text-sm text-muted-foreground">{project.company_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        project.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                        project.status === 'in_progress' ? 'bg-blue-500/20 text-blue-500' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {project.status}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the research project
                              "{project.product_name}" and all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProject(project.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>
          
          {/* Collapsed Preview - shows summary when collapsed */}
          {!isHistoryExpanded && (
            <CardContent className="pt-0">
              <div 
                className="flex items-center justify-center p-3 rounded-lg bg-secondary/30 border border-border/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setIsHistoryExpanded(true)}
              >
                <Eye className="h-4 w-4 text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Click to view {recentHistory.length} recent projects</span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

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
                className="bg-background/50 min-h-[80px]"
              />
            </div>

            {/* Research Mode Selector */}
            <ResearchModeSelector 
              mode={researchMode}
              onModeChange={setResearchMode}
              disabled={isLoading}
            />

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
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start {researchMode === 'quick' ? 'Quick' : 'Deep'} Research
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

            {/* Perplexity Status */}
            <div className="pt-3 border-t border-border/50">
              <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <span className="font-medium text-sm">Perplexity Research</span>
                <div className="flex items-center gap-2">
                  {isPerplexityLoading ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      <span className="text-sm text-muted-foreground">In Progress</span>
                    </>
                  ) : perplexityResults ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Completed</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-gray-500" />
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Ready</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Explanation Panel */}
      {researchError && (
        <ErrorExplanationPanel 
          error={researchError}
          onRetry={handleRetry}
          isRetrying={isLoading}
        />
      )}

      {/* Perplexity Research Results */}
      {perplexityResults?.data && (
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Perplexity Research Results
                </CardTitle>
                <CardDescription>Real-time web research powered by Perplexity AI</CardDescription>
              </div>
              <Badge variant="outline" className="capitalize bg-purple-500/10">
                {researchMode} Mode
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PerplexityResearchResults 
              data={perplexityResults.data}
              mode={perplexityResults.mode}
              timestamp={perplexityResults.timestamp}
            />
          </CardContent>
        </Card>
      )}

      {/* Agent Outcomes Section */}
      {Object.keys(agentOutcomes).length > 0 && (
        <>
          <Card className="glass-effect border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle>Agent Research Outcomes</CardTitle>
                    <CardDescription>Detailed results from each agent</CardDescription>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-primary/10 transition-colors"
                          onClick={() => setShowPastResultsViewer(true)}
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Previous Results</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {currentProjectId && (
                  <ReportGenerator 
                    data={{
                      projectName: productName || recentHistory[0]?.product_name || 'Research Project',
                      companyName: companyName || recentHistory[0]?.company_name,
                      agentResults: Object.values(agentOutcomes),
                      perplexityData: perplexityResults?.data,
                      researchMode
                    }}
                  />
                )}
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
            <InsightsSummary projectId={currentProjectId} />
          )}

          <AgentMetricsCalculator agentOutcomes={agentOutcomes} />

          {/* Past Results Viewer Modal */}
          <PastResultsViewer
            open={showPastResultsViewer}
            onOpenChange={setShowPastResultsViewer}
            projectId={currentProjectId}
            projectName={productName || recentHistory[0]?.product_name}
          />
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
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-muted-foreground">
                Outcome available - scroll down to view details
              </p>
              {outcome.results?.confidence && (
                <Badge variant="outline" className="text-xs">
                  {outcome.results.confidence}% confidence
                </Badge>
              )}
            </div>
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
      <ErrorExplanationPanel 
        error={outcome.error_message || 'Unknown error occurred'}
        agentType={title}
      />
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
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{title}</h3>
          {results.confidence && (
            <Badge 
              variant="outline" 
              className={`text-xs ${
                results.confidence >= 70 ? 'bg-green-500/10 text-green-600' :
                results.confidence >= 40 ? 'bg-amber-500/10 text-amber-600' :
                'bg-red-500/10 text-red-600'
              }`}
            >
              {results.confidence}% {results.confidenceLevel || 'confidence'}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm">
          {isExpanded ? "Hide Details" : "View Details"}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="space-y-4 text-sm">
          {agentType === 'sentiment' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                  <p className="text-2xl font-bold text-primary">
                    {results.overallScore !== null && results.overallScore !== undefined 
                      ? results.overallScore 
                      : <span className="text-sm text-muted-foreground">No API data</span>}
                  </p>
                </div>
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                  <p className="text-xs text-muted-foreground mb-2">Sentiment Breakdown</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-green-600 dark:text-green-400">Positive: {results.positive}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-red-600 dark:text-red-400">Negative: {results.negative}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span className="text-muted-foreground">Neutral: {results.neutral}%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Evidence snippets */}
              {results.evidenceSnippets && results.evidenceSnippets.length > 0 && (
                <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Supporting Evidence</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {results.evidenceSnippets.slice(0, 3).map((snippet: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>"{snippet}"</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {results.positiveThemes && (
                <div>
                  <p className="font-medium mb-2 text-green-600 dark:text-green-400">Positive Themes:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.positiveThemes.map((theme: string | { theme: string; evidence?: string }, i: number) => (
                      <li key={i}>{typeof theme === 'string' ? theme : theme.theme}</li>
                    ))}
                  </ul>
                </div>
              )}
              {results.negativeThemes && (
                <div>
                  <p className="font-medium mb-2 text-red-600 dark:text-red-400">Negative Themes:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.negativeThemes.map((theme: string | { theme: string; evidence?: string }, i: number) => (
                      <li key={i}>{typeof theme === 'string' ? theme : theme.theme}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {agentType === 'competitor' && results.competitors && (
            <div className="space-y-3">
              {results.competitors.map((comp: any, i: number) => (
                <div key={i} className="p-3 bg-background/50 rounded-lg border border-border/30">
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
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <span className="font-medium">
                      Price: {comp.price !== null && comp.price !== undefined && comp.price !== '' 
                        ? comp.price 
                        : <span className="text-muted-foreground italic">No API data</span>}
                    </span>
                    <span>
                      Rating: {comp.rating !== null && comp.rating !== undefined 
                        ? `${comp.rating}/5` 
                        : <span className="text-muted-foreground italic">No API data</span>}
                    </span>
                  </div>
                  {comp.sourceSnippet && (
                    <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                      {comp.sourceSnippet}
                    </p>
                  )}
                </div>
              ))}
              
              {/* Source domains */}
              {results.sourceDomains && results.sourceDomains.length > 0 && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                  Sources: {results.sourceDomains.join(' • ')}
                </p>
              )}
            </div>
          )}

          {agentType === 'trend' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Trend Score</p>
                  <p className="text-2xl font-bold text-primary">
                    {results.trendScore !== null && results.trendScore !== undefined 
                      ? results.trendScore 
                      : <span className="text-sm text-muted-foreground">No API data</span>}
                  </p>
                </div>
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Growth Rate</p>
                  <p className="text-2xl font-bold text-primary">{results.growthRate}%</p>
                </div>
              </div>
              
              {results.demandPattern && (
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
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
                  <p className="font-medium mb-2">🔥 Top Trending Keywords:</p>
                  <div className="flex flex-wrap gap-2">
                    {results.keywords.map((keyword: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-primary/20 rounded-full text-xs font-medium">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {results.emergingTopics && results.emergingTopics.length > 0 && (
                <div>
                  <p className="font-medium mb-2">📈 Emerging Topics:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.emergingTopics.map((topic: string, i: number) => (
                      <li key={i}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.insights && results.insights.length > 0 && (
                <div>
                  <p className="font-medium mb-2">💡 Key Insights:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {results.insights.map((insight: string, i: number) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.analysisDate && (
                <p className="text-xs text-muted-foreground italic pt-2 border-t border-border/50">
                  Analysis Date: {results.analysisDate}
                </p>
              )}
            </>
          )}

          <div className="pt-3 border-t border-border/50 flex gap-2">
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
              Download JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
