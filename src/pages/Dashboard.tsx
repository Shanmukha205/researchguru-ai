import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Activity, Search, Brain, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import SearchFilters, { type SearchFilter } from "@/components/SearchFilters";
import FavoriteButton from "@/components/FavoriteButton";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    insights: 0,
    agents: 0,
  });
  const [latestResults, setLatestResults] = useState<any>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadStats();
      loadLatestResults();
      loadRecentProjects();
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

  const loadLatestResults = async () => {
    if (!user) return;

    try {
      const { data: projects } = await supabase
        .from('research_projects')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (projects && projects.length > 0) {
        const { data: results } = await supabase
          .from('agent_results')
          .select('*')
          .eq('project_id', projects[0].id)
          .eq('status', 'completed');

        if (results && results.length > 0) {
          const organized = {
            sentiment: results.find(r => r.agent_type === 'sentiment')?.results as any,
            competitor: results.find(r => r.agent_type === 'competitor')?.results as any,
            trend: results.find(r => r.agent_type === 'trend')?.results as any,
          };
          setLatestResults(organized);
        }
      }
    } catch (error) {
      console.error('Error loading latest results:', error);
    }
  };

  const loadRecentProjects = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentProjects(data);
        setFilteredProjects(data);
      }
    } catch (error) {
      console.error('Error loading recent projects:', error);
    }
  };

  const handleSearch = async (filters: SearchFilter) => {
    if (!user) return;

    try {
      let query = supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id);

      if (filters.searchQuery) {
        query = query.or(`product_name.ilike.%${filters.searchQuery}%,company_name.ilike.%${filters.searchQuery}%`);
      }

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data } = await query.order('created_at', { ascending: false });
      setFilteredProjects(data || []);
    } catch (error) {
      console.error('Search error:', error);
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
      value: ((latestResults?.competitor as any)?.competitors?.length || 0).toString(),
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

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

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

      {/* Search and Filters */}
      <SearchFilters onSearch={handleSearch} />

      {/* Filtered Projects */}
      {filteredProjects.length > 0 && (
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Research Projects
            </CardTitle>
            <CardDescription>Your market research analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary/70 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{project.product_name}</h4>
                      <FavoriteButton itemId={project.id} itemType="project" />
                    </div>
                    <p className="text-sm text-muted-foreground">{project.company_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      project.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                      project.status === 'in_progress' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {latestResults && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Analysis */}
          {latestResults.sentiment && (
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
                <CardDescription>Customer sentiment breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Positive', value: latestResults.sentiment.positive || 0 },
                        { name: 'Neutral', value: latestResults.sentiment.neutral || 0 },
                        { name: 'Negative', value: latestResults.sentiment.negative || 0 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => {
                        const { name, percent } = entry;
                        return `${name}: ${((percent || 0) * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1, 2].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Trend Analysis */}
          {latestResults.trend && latestResults.trend.monthlyData && (
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle>Market Trends</CardTitle>
                <CardDescription>12-month trend analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={latestResults.trend.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Competitor Comparison */}
          {latestResults.competitor && (latestResults.competitor as any).competitors && (
            <Card className="glass-effect border-border/50 lg:col-span-2">
              <CardHeader>
                <CardTitle>Competitor Comparison</CardTitle>
                <CardDescription>Market share distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(latestResults.competitor as any).competitors.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="marketShare" fill="#06b6d4" />
                    <Bar dataKey="rating" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
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
