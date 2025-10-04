import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { toast } = useToast();
  const { user } = useAuth();

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

      // Update project status
      await supabase
        .from('research_projects')
        .update({ status: 'completed' })
        .eq('id', project.id);

      toast({
        title: "Research completed",
        description: "All agents have finished analyzing. Check the dashboard for results.",
      });

      // Reset form
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
      toast({
        title: "Research failed",
        description: error.message || "Failed to complete research. Please try again.",
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
            <AgentStatus name="Sentiment Agent" status={agentStatus.sentiment} />
            <AgentStatus name="Competitor Agent" status={agentStatus.competitor} />
            <AgentStatus name="Trends Agent" status={agentStatus.trend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AgentStatus({ name, status }: { name: string; status: string }) {
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
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50">
      <span className="font-medium">{name}</span>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${config.color}`} />
        <Icon className={`h-4 w-4 ${status === "In Progress" ? "animate-spin" : ""}`} />
        <span className="text-sm text-muted-foreground">{status}</span>
      </div>
    </div>
  );
}
