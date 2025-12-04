import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Activity, Search, Brain, Sparkles, Target, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    insights: 0,
    agents: 0,
  });
  const [latestInsights, setLatestInsights] = useState<any[]>([]);
  const [agentStatuses, setAgentStatuses] = useState({
    sentiment: { active: true, status: 'Ready' },
    competitor: { active: true, status: 'Ready' },
    trend: { active: true, status: 'Ready' },
    insights: { active: true, status: 'Ready' },
  });

  useEffect(() => {
    if (user) {
      loadStats();
      loadLatestInsights();
      checkAgentStatuses();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const [projectsData, insightsData, agentsData] = await Promise.all([
        supabase.from('research_projects').select('id', { count: 'exact' }),
        supabase.from('insights').select('id', { count: 'exact' }),
        supabase.from('agent_results').select('id', { count: 'exact' }),
      ]);

      setStats({
        projects: projectsData.count || 0,
        insights: insightsData.count || 0,
        agents: agentsData.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadLatestInsights = async () => {
    if (!user) return;

    try {
      const { data: insights } = await supabase
        .from('insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      if (insights) {
        setLatestInsights(insights);
      }
    } catch (error) {
      console.error('Error loading latest insights:', error);
    }
  };

  const checkAgentStatuses = async () => {
    if (!user) return;

    try {
      const { data: recentResults } = await supabase
        .from('agent_results')
        .select('agent_type, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentResults && recentResults.length > 0) {
        const newStatuses = { ...agentStatuses };
        recentResults.forEach(result => {
          const agentType = result.agent_type as keyof typeof agentStatuses;
          if (newStatuses[agentType]) {
            newStatuses[agentType] = { 
              active: true, 
              status: 'Completed' 
            };
          }
        });
        setAgentStatuses(newStatuses);
      }
    } catch (error) {
      console.error('Error checking agent statuses:', error);
    }
  };

  const statCards = [
    {
      title: "Total Projects",
      value: stats.projects.toString(),
      description: "Research projects created",
      icon: BarChart3,
      color: "text-blue-400",
    },
    {
      title: "Insights Generated",
      value: stats.insights.toString(),
      description: "AI-powered insights",
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      title: "Active Users",
      value: "1",
      description: "Team members",
      icon: Users,
      color: "text-cyan-400",
    },
    {
      title: "Agent Results",
      value: stats.agents.toString(),
      description: "AI agent analyses",
      icon: Activity,
      color: "text-green-400",
    },
  ];

  const agentCards = [
    {
      name: "Sentiment Analysis Agent",
      description: "Analyzes customer sentiment and feedback",
      icon: TrendingUp,
      color: "text-purple-400",
      status: agentStatuses.sentiment,
    },
    {
      name: "Competitor Analysis Agent",
      description: "Tracks and compares market competitors",
      icon: Target,
      color: "text-cyan-400",
      status: agentStatuses.competitor,
    },
    {
      name: "Trend Detection Agent",
      description: "Identifies market trends and patterns",
      icon: Activity,
      color: "text-green-400",
      status: agentStatuses.trend,
    },
    {
      name: "Insights Generation Agent",
      description: "Generates actionable business insights",
      icon: Brain,
      color: "text-blue-400",
      status: agentStatuses.insights,
    },
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Market Research Dashboard
        </h1>
        <p className="text-muted-foreground text-lg">
          AI-powered insights for your business intelligence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="glass-effect border-border/50 hover:border-primary/50 transition-all hover:scale-105 cursor-pointer"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Visualization Section */}
      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Active AI Agents
          </CardTitle>
          <CardDescription>Real-time status of market research agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {agentCards.map((agent) => (
              <Card 
                key={agent.name}
                className="border-border/50 hover:border-primary/30 transition-all"
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center ${
                      agent.status.status === 'Completed' ? 'bg-green-500/20' : 
                      agent.status.status === 'Fetching' ? 'bg-blue-500/20 animate-pulse' : 
                      'bg-secondary/50'
                    }`}>
                      <agent.icon className={`h-6 w-6 ${agent.color}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.status.status === 'Completed' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-500">Active</span>
                        </>
                      ) : agent.status.status === 'Fetching' ? (
                        <>
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                          <span className="text-xs text-blue-500">Fetching</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 rounded-full bg-muted" />
                          <span className="text-xs text-muted-foreground">Ready</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Latest Insights Section */}
      {latestInsights.length > 0 && (
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Latest AI Insights
            </CardTitle>
            <CardDescription>Recent AI-powered market intelligence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestInsights.slice(0, 4).map((insight, index) => (
                <Card key={insight.id || index} className="border-border/50 bg-secondary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">{insight.insight_type?.replace(/-/g, ' ') || 'Insight'}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {typeof insight.data === 'object' 
                            ? (insight.data as any)?.summary || 'Analysis completed'
                            : 'Analysis completed'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(insight.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          className="glass-effect border-border/50 hover:border-primary/50 transition-all cursor-pointer group"
          onClick={() => navigate('/research')}
        >
          <CardHeader>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Start New Research</CardTitle>
            <CardDescription>
              Analyze products and companies with AI-powered agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Go to Research
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="glass-effect border-border/50 hover:border-accent/50 transition-all cursor-pointer group"
          onClick={() => navigate('/ai-assistant')}
        >
          <CardHeader>
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Brain className="h-6 w-6 text-accent" />
            </div>
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>
              Get instant insights powered by AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Chat Now
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="glass-effect border-border/50 hover:border-secondary/50 transition-all cursor-pointer group"
          onClick={() => navigate('/comparison')}
        >
          <CardHeader>
            <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Sparkles className="h-6 w-6 text-secondary" />
            </div>
            <CardTitle>Compare Products</CardTitle>
            <CardDescription>
              Side-by-side competitor analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Comparison
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}