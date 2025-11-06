import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Project {
  id: string;
  product_name: string;
  company_name: string | null;
}

interface ProjectSelectorProps {
  onProjectSelect: (projectId: string | undefined) => void;
}

export default function ProjectSelector({ onProjectSelect }: ProjectSelectorProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("research_projects")
      .select("id, product_name, company_name")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading projects:", error);
      return;
    }

    setProjects(data || []);
  };

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    onProjectSelect(value === "all" ? undefined : value);
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">Filter by Project:</label>
      <Select value={selectedProject} onValueChange={handleProjectChange}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="All Projects (Aggregated View)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects (Aggregated View)</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.product_name}
              {project.company_name && ` - ${project.company_name}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
