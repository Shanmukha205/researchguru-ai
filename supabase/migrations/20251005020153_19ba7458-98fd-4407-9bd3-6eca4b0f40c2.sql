-- Create user_favorites table for saving favorite projects and queries
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'project', 'query', 'agent'
  item_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites"
ON public.user_favorites
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create saved_queries table
CREATE TABLE public.saved_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query_name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved queries"
ON public.saved_queries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create agent_configurations table for custom agent settings
CREATE TABLE public.agent_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_type TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  sentiment_threshold DECIMAL DEFAULT 0.5,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agent configurations"
ON public.agent_configurations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_agent_configurations_updated_at
BEFORE UPDATE ON public.agent_configurations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add search index to agent_results for better search performance
CREATE INDEX idx_agent_results_search ON public.agent_results USING gin(to_tsvector('english', COALESCE(results::text, '')));

-- Add status index for filtering
CREATE INDEX idx_agent_results_status ON public.agent_results(status);
CREATE INDEX idx_agent_results_type ON public.agent_results(agent_type);
CREATE INDEX idx_research_projects_status ON public.research_projects(status);
CREATE INDEX idx_research_projects_created_at ON public.research_projects(created_at DESC);