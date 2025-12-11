import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, TrendingUp, DollarSign, Sparkles, Users, AlertTriangle, Save, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ScenarioSimulatorProps {
  projectId?: string;
}

interface ScenarioImpact {
  persona: string;
  sentimentChange: number;
  purchaseIntent: number;
  description: string;
}

interface SavedScenario {
  id: string;
  name: string;
  priceChange: number;
  marketGrowth: number;
  newCompetitors: number;
  timestamp: Date;
}

interface ProjectionData {
  month: string;
  optimistic: number;
  baseline: number;
  pessimistic: number;
}

interface AgentMetrics {
  sentimentScore: number;
  trendDirection: 'up' | 'down' | 'stable';
  competitorCount: number;
  avgCompetitorRating: number;
}

export default function ScenarioSimulator({ projectId }: ScenarioSimulatorProps) {
  const { user } = useAuth();
  const [priceChange, setPriceChange] = useState([0]);
  const [marketGrowth, setMarketGrowth] = useState([5]);
  const [newCompetitors, setNewCompetitors] = useState([0]);
  const [impacts, setImpacts] = useState<ScenarioImpact[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  // Load real agent data for scenario calculations
  useEffect(() => {
    const loadAgentMetrics = async () => {
      if (!user) return;
      
      setIsLoadingMetrics(true);
      try {
        let query = supabase
          .from('agent_results')
          .select('agent_type, results')
          .eq('status', 'completed')
          .order('created_at', { ascending: false });
        
        if (projectId) {
          query = query.eq('project_id', projectId);
        }
        
        const { data } = await query.limit(15);
        
        if (data && data.length > 0) {
          const sentiment = data.find(r => r.agent_type === 'sentiment')?.results as Record<string, any> | undefined;
          const competitor = data.find(r => r.agent_type === 'competitor')?.results as Record<string, any> | undefined;
          const trend = data.find(r => r.agent_type === 'trend')?.results as Record<string, any> | undefined;
          
          const competitors = competitor?.competitors as any[] | undefined;
          
          setAgentMetrics({
            sentimentScore: sentiment?.positive || sentiment?.overallScore || 50,
            trendDirection: trend?.trendDirection || 'stable',
            competitorCount: competitors?.length || 3,
            avgCompetitorRating: competitors?.reduce((sum: number, c: any) => 
              sum + (c.rating || 4), 0) / (competitors?.length || 1) || 4
          });
        } else {
          // Default metrics if no data
          setAgentMetrics({
            sentimentScore: 50,
            trendDirection: 'stable',
            competitorCount: 3,
            avgCompetitorRating: 4
          });
        }
      } catch (error) {
        console.error('Error loading agent metrics:', error);
        setAgentMetrics({
          sentimentScore: 50,
          trendDirection: 'stable',
          competitorCount: 3,
          avgCompetitorRating: 4
        });
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    loadAgentMetrics();
  }, [user, projectId]);

  // Calculate projection data based on scenario parameters and real agent data
  const projectionData = useMemo((): ProjectionData[] => {
    if (!agentMetrics) return [];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const baseIndex = 100;
    
    // Factor in real agent data
    const sentimentFactor = (agentMetrics.sentimentScore - 50) / 100;
    const trendFactor = agentMetrics.trendDirection === 'up' ? 0.1 : 
                        agentMetrics.trendDirection === 'down' ? -0.1 : 0;
    const competitionFactor = Math.max(0, (5 - agentMetrics.competitorCount) * 0.03);
    
    // Price impact (negative price change = positive impact)
    const priceImpact = -priceChange[0] * 0.5;
    
    // Market growth impact
    const growthImpact = marketGrowth[0] * 0.8;
    
    // New competitor impact
    const competitorImpact = -newCompetitors[0] * 4;
    
    // Combined base impact per month
    const monthlyBaseChange = (priceImpact + growthImpact + competitorImpact + 
                               sentimentFactor * 10 + trendFactor * 5 + competitionFactor * 10) / 6;
    
    return months.map((month, idx) => {
      const progress = idx / 5; // 0 to 1
      const volatility = 1 + (Math.sin(idx * 1.5) * 0.1); // Add some realistic variation
      
      // Optimistic: Best case with positive momentum
      const optimistic = Math.round(baseIndex + (monthlyBaseChange * (idx + 1) * 1.4 * volatility) + 
                                    (sentimentFactor * 15 * progress) + (trendFactor * 20 * progress));
      
      // Baseline: Expected case
      const baseline = Math.round(baseIndex + (monthlyBaseChange * (idx + 1) * volatility));
      
      // Pessimistic: Worst case with headwinds
      const pessimistic = Math.round(baseIndex + (monthlyBaseChange * (idx + 1) * 0.6 * volatility) - 
                                     (newCompetitors[0] * 2 * progress));
      
      return {
        month,
        optimistic: Math.max(40, Math.min(180, optimistic)),
        baseline: Math.max(40, Math.min(160, baseline)),
        pessimistic: Math.max(30, Math.min(140, pessimistic))
      };
    });
  }, [priceChange, marketGrowth, newCompetitors, agentMetrics]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (projectionData.length === 0 || !agentMetrics) {
      return { projectedRevenue: 0, marketShareImpact: 0, riskScore: 'Medium' as const };
    }
    
    const finalBaseline = projectionData[projectionData.length - 1]?.baseline || 100;
    const revenueChange = finalBaseline - 100;
    
    // Calculate market share impact
    const marketShareImpact = (revenueChange * 0.3) - (newCompetitors[0] * 3) + 
                              (agentMetrics.sentimentScore - 50) * 0.1;
    
    // Calculate risk score
    let riskLevel: 'Low' | 'Medium' | 'High' = 'Medium';
    const riskFactors = [
      Math.abs(priceChange[0]) > 20 ? 1 : 0,
      newCompetitors[0] >= 3 ? 1 : 0,
      agentMetrics.sentimentScore < 40 ? 1 : 0,
      agentMetrics.trendDirection === 'down' ? 1 : 0,
      marketGrowth[0] < 0 ? 1 : 0
    ];
    const riskCount = riskFactors.reduce((a, b) => a + b, 0);
    
    if (riskCount >= 3) riskLevel = 'High';
    else if (riskCount <= 1) riskLevel = 'Low';
    
    return {
      projectedRevenue: revenueChange,
      marketShareImpact: Math.round(marketShareImpact * 10) / 10,
      riskScore: riskLevel
    };
  }, [projectionData, priceChange, marketGrowth, newCompetitors, agentMetrics]);

  const runSimulation = async () => {
    if (!agentMetrics) return;
    
    setIsSimulating(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Calculate dynamic impacts based on real agent data
    const sentimentModifier = (agentMetrics.sentimentScore - 50) / 50;
    const trendModifier = agentMetrics.trendDirection === 'up' ? 0.15 : 
                          agentMetrics.trendDirection === 'down' ? -0.15 : 0;
    
    const baseImpact = (priceChange[0] * -0.4) + (marketGrowth[0] * 0.6) - (newCompetitors[0] * 3);
    
    const newImpacts: ScenarioImpact[] = [
      {
        persona: "Price-Sensitive Buyer",
        sentimentChange: Math.round(baseImpact - (priceChange[0] * 1.8) + (sentimentModifier * 10)),
        purchaseIntent: Math.max(10, Math.min(95, 55 + baseImpact - (priceChange[0] * 1.5) + (sentimentModifier * 15))),
        description: priceChange[0] > 10 
          ? `Significant price resistance expected. ${Math.round(55 - priceChange[0] * 1.5)}% likely to seek alternatives.` 
          : priceChange[0] < -10 
          ? `Price reduction drives ${Math.round(25 + Math.abs(priceChange[0]) * 0.8)}% uplift in consideration.`
          : "Moderate price changes have limited impact on this segment."
      },
      {
        persona: "Growth-Oriented Customer",
        sentimentChange: Math.round(baseImpact + (marketGrowth[0] * 1.2) + (trendModifier * 15)),
        purchaseIntent: Math.max(10, Math.min(95, 50 + baseImpact + (marketGrowth[0] * 1.5) + (trendModifier * 20))),
        description: marketGrowth[0] > 8 
          ? `Strong market expansion attracts growth-seekers. ${Math.round(agentMetrics.sentimentScore)}% sentiment alignment.`
          : marketGrowth[0] < 0
          ? `Market contraction signals may trigger defensive purchasing patterns.`
          : "Stable growth maintains current engagement levels."
      },
      {
        persona: "Competitive Evaluator",
        sentimentChange: Math.round(baseImpact - (newCompetitors[0] * 5) + (sentimentModifier * 8)),
        purchaseIntent: Math.max(10, Math.min(95, 60 + baseImpact - (newCompetitors[0] * 6))),
        description: newCompetitors[0] >= 2 
          ? `${newCompetitors[0]} new competitors increase comparison shopping by ${Math.round(newCompetitors[0] * 15)}%.`
          : "Limited new competition maintains brand preference."
      },
      {
        persona: "Early Adopter",
        sentimentChange: Math.round(baseImpact + 12 + (trendModifier * 20)),
        purchaseIntent: Math.max(10, Math.min(95, 65 + baseImpact + (trendModifier * 25))),
        description: `Innovation-driven segment. ${agentMetrics.trendDirection === 'up' ? 'Rising' : agentMetrics.trendDirection === 'down' ? 'Declining' : 'Stable'} trends ${agentMetrics.trendDirection === 'up' ? 'boost' : 'moderate'} enthusiasm.`
      },
      {
        persona: "Brand Loyalist",
        sentimentChange: Math.round(baseImpact * 0.5 + 8 + (sentimentModifier * 20)),
        purchaseIntent: Math.max(30, Math.min(95, 70 + (baseImpact * 0.4) + (sentimentModifier * 15))),
        description: `High retention expected. ${Math.round(agentMetrics.sentimentScore)}% brand sentiment provides ${agentMetrics.sentimentScore > 60 ? 'strong' : 'moderate'} buffer.`
      }
    ];
    
    setImpacts(newImpacts);
    setIsSimulating(false);
  };

  const saveScenario = () => {
    const scenario: SavedScenario = {
      id: Date.now().toString(),
      name: `Scenario ${savedScenarios.length + 1}`,
      priceChange: priceChange[0],
      marketGrowth: marketGrowth[0],
      newCompetitors: newCompetitors[0],
      timestamp: new Date()
    };
    setSavedScenarios(prev => [...prev, scenario]);
    toast.success("Scenario saved");
  };

  const loadScenario = (scenario: SavedScenario) => {
    setPriceChange([scenario.priceChange]);
    setMarketGrowth([scenario.marketGrowth]);
    setNewCompetitors([scenario.newCompetitors]);
    toast.success("Scenario loaded");
  };

  const deleteScenario = (id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
    toast.success("Scenario deleted");
  };

  const getImpactColor = (value: number) => {
    if (value > 10) return 'text-green-500';
    if (value < -10) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getIntentColor = (value: number) => {
    if (value >= 70) return 'bg-green-500/20 text-green-500';
    if (value >= 40) return 'bg-yellow-500/20 text-yellow-500';
    return 'bg-red-500/20 text-red-500';
  };

  const getRiskColor = (risk: 'Low' | 'Medium' | 'High') => {
    switch (risk) {
      case 'Low': return 'bg-green-500/20 text-green-500';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-500';
      case 'High': return 'bg-red-500/20 text-red-500';
    }
  };

  if (isLoadingMetrics) {
    return (
      <Card className="glass-effect border-border/50">
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
            Interactive Market Scenario Simulator
          </CardTitle>
          <CardDescription>
            Simulate market changes and predict consumer behavior impact in real-time
          </CardDescription>
          {agentMetrics && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                Sentiment: {agentMetrics.sentimentScore}%
              </Badge>
              <Badge variant="outline" className="text-xs">
                Trend: {agentMetrics.trendDirection}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Competitors: {agentMetrics.competitorCount}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-lg bg-secondary/10 border border-border/30">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Price Change
                </label>
                <span className={`text-lg font-bold ${priceChange[0] > 0 ? 'text-red-500' : priceChange[0] < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {priceChange[0] > 0 ? '+' : ''}{priceChange[0]}%
                </span>
              </div>
              <Slider
                value={priceChange}
                onValueChange={setPriceChange}
                min={-40}
                max={40}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Simulate price increase or decrease
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Market Growth
                </label>
                <span className={`text-lg font-bold ${marketGrowth[0] > 0 ? 'text-green-500' : marketGrowth[0] < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {marketGrowth[0] > 0 ? '+' : ''}{marketGrowth[0]}%
                </span>
              </div>
              <Slider
                value={marketGrowth}
                onValueChange={setMarketGrowth}
                min={-20}
                max={30}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Expected market growth rate
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  New Competitors
                </label>
                <span className="text-lg font-bold text-primary">
                  {newCompetitors[0]}
                </span>
              </div>
              <Slider
                value={newCompetitors}
                onValueChange={setNewCompetitors}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Number of new market entrants
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={runSimulation}
              disabled={isSimulating}
              className="flex-1 gradient-primary hover:opacity-90 transition-opacity"
              size="lg"
            >
              {isSimulating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Simulating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Run Simulation
                </>
              )}
            </Button>
            <Button onClick={saveScenario} variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>

          {/* Projection Chart */}
          {projectionData.length > 0 && (
            <div className="bg-secondary/10 p-4 rounded-lg">
              <h4 className="text-sm font-semibold mb-4">6-Month Revenue/Interest Projection</h4>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis 
                    domain={[0, 180]} 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Index', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="optimistic" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="Optimistic"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="baseline" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.3}
                    strokeWidth={2}
                    name="Baseline"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pessimistic" 
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="Pessimistic"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Projected Revenue Change</p>
                  <p className={`text-3xl font-bold ${summaryMetrics.projectedRevenue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {summaryMetrics.projectedRevenue >= 0 ? '+' : ''}{summaryMetrics.projectedRevenue}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Market Share Impact</p>
                  <p className={`text-3xl font-bold ${summaryMetrics.marketShareImpact >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {summaryMetrics.marketShareImpact >= 0 ? '+' : ''}{summaryMetrics.marketShareImpact}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <Badge className={`text-lg px-4 py-1 ${getRiskColor(summaryMetrics.riskScore)}`}>
                    {summaryMetrics.riskScore}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Persona Impact Results */}
          {impacts.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Predicted Consumer Impact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {impacts.map((impact, idx) => (
                  <Card 
                    key={idx} 
                    className="border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 animate-slide-up"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{impact.persona}</h4>
                        <Badge className={getIntentColor(impact.purchaseIntent)}>
                          {Math.round(impact.purchaseIntent)}%
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Sentiment Change:</span>
                          <span className={`font-bold ${getImpactColor(impact.sentimentChange)}`}>
                            {impact.sentimentChange > 0 ? '+' : ''}{impact.sentimentChange}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Purchase Intent:</span>
                          <span className="font-bold">{Math.round(impact.purchaseIntent)}%</span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">
                        {impact.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Saved Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedScenarios.map(scenario => (
                <div 
                  key={scenario.id} 
                  className="p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{scenario.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => deleteScenario(scenario.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Price: {scenario.priceChange > 0 ? '+' : ''}{scenario.priceChange}%</p>
                    <p>Growth: {scenario.marketGrowth > 0 ? '+' : ''}{scenario.marketGrowth}%</p>
                    <p>Competitors: +{scenario.newCompetitors}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={() => loadScenario(scenario)}
                  >
                    Load
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
