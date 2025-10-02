import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Activity, Search, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    projects: 0,
    insights: 0,
    agents: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

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
      title: "Competitors Analyzed",
      value: "0",
      description: "Market competitors tracked",
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
          onClick={() => navigate('/assistant')}
        >
          <CardHeader>
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Brain className="h-6 w-6 text-accent" />
            </div>
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>
              Get instant insights powered by Groq AI
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

      {stats.projects === 0 && (
        <Card className="glass-effect border-border/50 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Welcome to Market Research AI!
            </CardTitle>
            <CardDescription>
              Get started by creating your first research project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Our AI agents will help you analyze sentiment, track competitors, and detect market trends automatically.
            </p>
            <div className="flex gap-4">
              <Button 
                onClick={() => navigate('/research')}
                className="gradient-primary hover:opacity-90 transition-opacity"
              >
                Create Research Project
              </Button>
              <Button 
                onClick={() => navigate('/settings')}
                variant="outline"
              >
                Configure API Keys
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
