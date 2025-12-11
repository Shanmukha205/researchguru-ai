import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingDown, TrendingUp, Minus, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PersonaData {
  name: string;
  description: string;
  icon: string;
  priceImpact: number;
  featureImpact: number;
  launchImpact: number;
  confidence: 'High' | 'Medium' | 'Low';
  priceSensitivity: number;
  featurePriority: number;
  trendAlignment: number;
}

interface AgentResult {
  agent_type: string;
  results: any;
  created_at: string;
}

const PERSONA_COLORS = ['#8b5cf6', '#06b6d4', '#10b981'];

export default function ConsumerPersonaPredictor({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [agentData, setAgentData] = useState<{
    sentiment: any;
    competitor: any;
    trend: any;
  } | null>(null);

  // Generate dynamic behavior data for chart based on personas
  const behaviorChartData = useMemo(() => {
    if (personas.length === 0) return [];
    
    return [
      {
        scenario: 'Base',
        ...Object.fromEntries(personas.map((p, i) => [`persona${i}`, 100]))
      },
      {
        scenario: 'Price +10%',
        ...Object.fromEntries(personas.map((p, i) => [`persona${i}`, Math.max(20, 100 + p.priceImpact)]))
      },
      {
        scenario: 'Feature -1',
        ...Object.fromEntries(personas.map((p, i) => [`persona${i}`, Math.max(20, 100 + p.featureImpact)]))
      },
      {
        scenario: 'New Launch',
        ...Object.fromEntries(personas.map((p, i) => [`persona${i}`, Math.min(120, 100 + p.launchImpact)]))
      }
    ];
  }, [personas]);

  const fetchAgentData = async () => {
    if (!user) return null;
    
    try {
      let query = supabase
        .from('agent_results')
        .select('agent_type, results, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      
      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      
      if (!data || data.length === 0) return null;
      
      // Get most recent of each type
      const sentiment = data.find(r => r.agent_type === 'sentiment')?.results;
      const competitor = data.find(r => r.agent_type === 'competitor')?.results;
      const trend = data.find(r => r.agent_type === 'trend')?.results;
      
      return { sentiment, competitor, trend };
    } catch (error) {
      console.error('Error fetching agent data:', error);
      return null;
    }
  };

  const generateDynamicPersonas = (agentData: { sentiment: any; competitor: any; trend: any }): PersonaData[] => {
    const { sentiment, competitor, trend } = agentData;
    
    // Extract real metrics from agent data
    const positiveScore = sentiment?.positive || sentiment?.overallScore || 50;
    const negativeScore = sentiment?.negative || 20;
    const competitorCount = competitor?.competitors?.length || 3;
    const avgCompetitorRating = competitor?.competitors?.reduce((sum: number, c: any) => sum + (c.rating || 4), 0) / (competitorCount || 1);
    const trendDirection = trend?.trendDirection || 'stable';
    const trendScore = trend?.trendScore || 50;
    
    // Calculate base modifiers from real data
    const sentimentModifier = (positiveScore - negativeScore) / 100;
    const competitionModifier = (avgCompetitorRating - 3) / 5;
    const trendModifier = trendDirection === 'up' ? 0.15 : trendDirection === 'down' ? -0.15 : 0;
    
    // Generate unique personas based on actual market data
    const personas: PersonaData[] = [
      {
        name: positiveScore > 60 ? 'Enthusiastic Adopter' : positiveScore > 40 ? 'Pragmatic Buyer' : 'Skeptical Evaluator',
        description: positiveScore > 60 
          ? `Excited by the ${Math.round(positiveScore)}% positive sentiment. Actively recommends to peers and tolerates premium pricing.`
          : positiveScore > 40
          ? `Balanced view of product value. Weighs ${competitorCount} alternatives before deciding.`
          : `Cautious due to mixed sentiment. Requires strong value proposition to convert.`,
        icon: positiveScore > 60 ? '🚀' : positiveScore > 40 ? '⚖️' : '🔍',
        priceImpact: Math.round(-8 + (sentimentModifier * 15) - (competitionModifier * 5)),
        featureImpact: Math.round(-12 + (sentimentModifier * 8)),
        launchImpact: Math.round(15 + (sentimentModifier * 20) + (trendModifier * 10)),
        confidence: positiveScore > 60 || negativeScore < 15 ? 'High' : positiveScore > 40 ? 'Medium' : 'Low',
        priceSensitivity: Math.round(50 - (sentimentModifier * 30)),
        featurePriority: Math.round(60 + (sentimentModifier * 20)),
        trendAlignment: Math.round(50 + (trendScore - 50) * 0.8)
      },
      {
        name: competitorCount > 4 ? 'Comparison Shopper' : competitorCount > 2 ? 'Selective Researcher' : 'Brand Focused',
        description: competitorCount > 4
          ? `Actively comparing across ${competitorCount} competitors. Price and features are primary decision factors.`
          : competitorCount > 2
          ? `Evaluates top ${competitorCount} options. Quality and reputation matter more than lowest price.`
          : `Limited market exploration. Brand trust drives purchase with ${Math.round(avgCompetitorRating * 20)}% loyalty factor.`,
        icon: competitorCount > 4 ? '📊' : competitorCount > 2 ? '🎯' : '💎',
        priceImpact: Math.round(-15 + (competitionModifier * 10) - (competitorCount * 1.5)),
        featureImpact: Math.round(-18 + (competitorCount * 2)),
        launchImpact: Math.round(8 - (competitorCount * 1.5) + (trendModifier * 15)),
        confidence: sentiment && competitor ? 'High' : sentiment || competitor ? 'Medium' : 'Low',
        priceSensitivity: Math.round(70 + (competitorCount * 3)),
        featurePriority: Math.round(75 - (competitionModifier * 10)),
        trendAlignment: Math.round(40 + (trendScore - 50) * 0.5)
      },
      {
        name: trendDirection === 'up' ? 'Trend Follower' : trendDirection === 'down' ? 'Value Hunter' : 'Steady Adopter',
        description: trendDirection === 'up'
          ? `Aligned with ${Math.round(trendScore)}% trend momentum. Early majority adopter willing to pay for trending products.`
          : trendDirection === 'down'
          ? `Seeks deals as market cools. ${Math.round(100 - trendScore)}% focus on value over novelty.`
          : `Consistent purchase patterns regardless of trends. Reliability and proven performance matter most.`,
        icon: trendDirection === 'up' ? '📈' : trendDirection === 'down' ? '💰' : '⭐',
        priceImpact: Math.round(-6 + (trendModifier * 25)),
        featureImpact: Math.round(-10 + (trendModifier * 15)),
        launchImpact: Math.round(20 + (trendScore - 50) * 0.6),
        confidence: trend ? 'High' : 'Medium',
        priceSensitivity: Math.round(45 + (trendDirection === 'down' ? 25 : trendDirection === 'up' ? -10 : 0)),
        featurePriority: Math.round(55 + (trendScore - 50) * 0.4),
        trendAlignment: trendScore
      }
    ];

    return personas;
  };

  const loadPersonas = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setRateLimited(false);
      
      // First try to get real agent data
      const fetchedAgentData = await fetchAgentData();
      
      if (fetchedAgentData && (fetchedAgentData.sentiment || fetchedAgentData.competitor || fetchedAgentData.trend)) {
        setAgentData(fetchedAgentData);
        const dynamicPersonas = generateDynamicPersonas(fetchedAgentData);
        setPersonas(dynamicPersonas);
        setLastUpdated(new Date());
      } else {
        // Fall back to AI-generated personas
        const { data, error } = await supabase.functions.invoke('generate-insights', {
          body: { type: 'consumer-personas', projectId }
        });

        if (error) {
          const errorMsg = error.message || '';
          if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
            setRateLimited(true);
            toast.error("Rate limit exceeded. Please wait a moment before retrying.");
            return;
          }
          throw error;
        }
        
        if (data?.error && data.error.includes('Rate limit')) {
          setRateLimited(true);
          toast.error("Rate limit exceeded. Please wait a moment before retrying.");
          return;
        }
        
        if (data?.personas) {
          // Add confidence scores to AI-generated personas
          const enhancedPersonas = data.personas.map((p: any) => ({
            ...p,
            confidence: 'Medium' as const,
            priceSensitivity: 50 + Math.random() * 30,
            featurePriority: 50 + Math.random() * 30,
            trendAlignment: 50 + Math.random() * 30
          }));
          setPersonas(enhancedPersonas);
          setLastUpdated(new Date());
        }
      }
    } catch (error: any) {
      console.error('Error loading personas:', error);
      if (error?.message?.includes('429') || error?.message?.includes('rate')) {
        setRateLimited(true);
        toast.error("Rate limit exceeded. Please wait a moment before retrying.");
      } else {
        toast.error("Failed to load persona data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, [user, projectId]);

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (impact < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-500';
    if (impact < 0) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getConfidenceBadge = (confidence: 'High' | 'Medium' | 'Low') => {
    switch (confidence) {
      case 'High':
        return <Badge className="bg-green-500/20 text-green-500 gap-1"><CheckCircle className="h-3 w-3" /> High</Badge>;
      case 'Medium':
        return <Badge className="bg-yellow-500/20 text-yellow-500">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-red-500/20 text-red-500 gap-1"><AlertCircle className="h-3 w-3" /> Low</Badge>;
    }
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Consumer Persona Predictor & Behavior Simulator
            </CardTitle>
            <CardDescription>AI-generated buyer personas with predictive behavior analysis</CardDescription>
          </div>
          <Button onClick={loadPersonas} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-muted-foreground">
              Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
            </p>
            {agentData && (
              <Badge variant="outline" className="text-xs">
                Data-Driven
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary shimmer"></div>
          </div>
        ) : personas.length > 0 ? (
          <div className="space-y-6">
            {/* Persona Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona, idx) => (
                <Card key={idx} className="border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                        {persona.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{persona.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
                      </div>
                      
                      {/* Confidence Badge */}
                      <div className="flex items-center gap-2">
                        {getConfidenceBadge(persona.confidence)}
                      </div>
                      
                      {/* Impact Predictions */}
                      <div className="w-full space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Price +10%:</span>
                          <div className="flex items-center gap-1">
                            {getImpactIcon(persona.priceImpact)}
                            <span className={getImpactColor(persona.priceImpact)}>
                              {persona.priceImpact > 0 ? '+' : ''}{persona.priceImpact}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Feature Removal:</span>
                          <div className="flex items-center gap-1">
                            {getImpactIcon(persona.featureImpact)}
                            <span className={getImpactColor(persona.featureImpact)}>
                              {persona.featureImpact > 0 ? '+' : ''}{persona.featureImpact}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">New Launch:</span>
                          <div className="flex items-center gap-1">
                            {getImpactIcon(persona.launchImpact)}
                            <span className={getImpactColor(persona.launchImpact)}>
                              {persona.launchImpact > 0 ? '+' : ''}{persona.launchImpact}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Behavior Simulation Graph - Multi-line */}
            <div className="bg-secondary/10 p-4 rounded-lg">
              <h4 className="text-sm font-semibold mb-4">Persona Behavior Trends (Interest Score)</h4>
              {behaviorChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={behaviorChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="scenario" 
                      tick={{ fontSize: 12 }}
                      className="text-xs"
                    />
                    <YAxis 
                      domain={[0, 130]} 
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Interest Score', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      className="text-xs"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => {
                        const idx = parseInt(name.replace('persona', ''));
                        return [value, personas[idx]?.name || name];
                      }}
                    />
                    <Legend 
                      formatter={(value: string) => {
                        const idx = parseInt(value.replace('persona', ''));
                        return personas[idx]?.name || value;
                      }}
                    />
                    {personas.map((persona, idx) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={`persona${idx}`}
                        stroke={PERSONA_COLORS[idx % PERSONA_COLORS.length]}
                        strokeWidth={3}
                        dot={{ fill: PERSONA_COLORS[idx % PERSONA_COLORS.length], r: 5 }}
                        activeDot={{ r: 7 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Not enough data to visualize behavior trends.
                </div>
              )}
            </div>
          </div>
        ) : rateLimited ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-amber-500 font-medium">Rate limit exceeded</div>
            <p className="text-sm text-muted-foreground">
              The AI service is busy. Please wait 30 seconds and try again.
            </p>
            <Button onClick={loadPersonas} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No persona data available. Run market analysis to generate consumer profiles.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
