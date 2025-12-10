import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Eye, Search, Calendar, Filter, Clock, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { PastResultsViewer } from "./PastResultsViewer";

interface ResearchRun {
  id: string;
  project_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  agents_triggered: unknown[];
  metadata: unknown;
  project?: {
    product_name: string;
    company_name: string | null;
  };
}

interface ResearchHistoryCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ResearchHistoryCenter = ({ open, onOpenChange }: ResearchHistoryCenterProps) => {
  const { user } = useAuth();
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showResultsViewer, setShowResultsViewer] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchHistory();
    }
  }, [open, user]);

  const fetchHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch research runs with project details
      const { data: runsData, error: runsError } = await supabase
        .from("research_runs")
        .select(`
          id,
          project_id,
          started_at,
          completed_at,
          status,
          agents_triggered,
          metadata
        `)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);

      if (runsError) throw runsError;

      // Fetch project details for each run
      const projectIds = [...new Set(runsData?.map(r => r.project_id) || [])];
      const { data: projects, error: projectsError } = await supabase
        .from("research_projects")
        .select("id, product_name, company_name")
        .in("id", projectIds);

      if (projectsError) throw projectsError;

      // Map projects to runs
      const runsWithProjects = runsData?.map(run => ({
        ...run,
        agents_triggered: Array.isArray(run.agents_triggered) ? run.agents_triggered : [],
        project: projects?.find(p => p.id === run.project_id)
      })) || [];

      setRuns(runsWithProjects);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load research history");
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = runs.filter(run => {
    const matchesSearch = run.project?.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          run.project?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || run.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/20 text-green-500";
      case "running": return "bg-blue-500/20 text-blue-500";
      case "failed": return "bg-red-500/20 text-red-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const viewResults = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowResultsViewer(true);
  };

  const getResearchMode = (metadata: unknown) => {
    if (!metadata || typeof metadata !== 'object') return "Standard";
    const meta = metadata as Record<string, unknown>;
    return meta.researchMode === "deep" ? "Deep Research" : "Quick Research";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Research History Center
            </DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* History List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRuns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No research runs match your filters"
                  : "No research history available yet"}
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {filteredRuns.map((run) => (
                  <Card key={run.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">
                            {run.project?.product_name || "Unknown Product"}
                          </h3>
                          <Badge className={getStatusColor(run.status)}>
                            {run.status}
                          </Badge>
                        </div>
                        {run.project?.company_name && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {run.project.company_name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(run.started_at), "MMM d, yyyy HH:mm")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {getResearchMode(run.metadata)}
                            </Badge>
                          </span>
                        </div>
                        {run.agents_triggered.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {run.agents_triggered.map((agent, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {String(agent)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => viewResults(run.project_id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Results Viewer */}
      <PastResultsViewer
        projectId={selectedProjectId}
        open={showResultsViewer}
        onOpenChange={(open) => {
          setShowResultsViewer(open);
          if (!open) setSelectedProjectId(null);
        }}
      />
    </>
  );
};
