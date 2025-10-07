-- Create enum for project roles
CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'viewer');

-- Create project_shares table for collaboration
CREATE TABLE public.project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  role public.project_role NOT NULL DEFAULT 'viewer',
  shared_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, shared_with_user_id)
);

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- Create project_comments table
CREATE TABLE public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  agent_result_id UUID REFERENCES public.agent_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- Create user_notifications table
CREATE TABLE public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Create user_achievements table for gamification
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_type)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Create user_activity table for tracking engagement
CREATE TABLE public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, activity_type, activity_date)
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has access to a project
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID, _min_role project_role DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.research_projects WHERE id = _project_id AND user_id = _user_id
    UNION
    SELECT 1 FROM public.project_shares 
    WHERE project_id = _project_id 
      AND shared_with_user_id = _user_id
      AND (
        (_min_role = 'viewer') OR
        (_min_role = 'editor' AND role IN ('editor', 'owner')) OR
        (_min_role = 'owner' AND role = 'owner')
      )
  )
$$;

-- RLS Policies for project_shares
CREATE POLICY "Users can view shares for their projects"
ON public.project_shares FOR SELECT
USING (
  shared_with_user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.research_projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Project owners can manage shares"
ON public.project_shares FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.research_projects WHERE id = project_id AND user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.research_projects WHERE id = project_id AND user_id = auth.uid())
);

-- RLS Policies for project_comments
CREATE POLICY "Users can view comments on accessible projects"
ON public.project_comments FOR SELECT
USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users can create comments on accessible projects"
ON public.project_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  public.has_project_access(auth.uid(), project_id)
);

CREATE POLICY "Users can update their own comments"
ON public.project_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.project_comments FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for user_notifications
CREATE POLICY "Users can view their own notifications"
ON public.user_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.user_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.user_notifications FOR INSERT
WITH CHECK (true);

-- RLS Policies for user_achievements
CREATE POLICY "Users can view their own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (true);

-- RLS Policies for user_activity
CREATE POLICY "Users can view their own activity"
ON public.user_activity FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage activity"
ON public.user_activity FOR ALL
WITH CHECK (true);

-- Add trigger for comment updates
CREATE TRIGGER update_project_comments_updated_at
BEFORE UPDATE ON public.project_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX idx_project_shares_shared_with_user_id ON public.project_shares(shared_with_user_id);
CREATE INDEX idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX idx_project_comments_user_id ON public.project_comments(user_id);
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_read ON public.user_notifications(user_id, read);
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX idx_user_activity_user_date ON public.user_activity(user_id, activity_date);