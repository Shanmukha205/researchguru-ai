CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: project_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_role AS ENUM (
    'owner',
    'editor',
    'viewer'
);


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier AS ENUM (
    'free',
    'standard',
    'pro'
);


--
-- Name: check_data_sufficiency(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_data_sufficiency(p_project_id uuid, p_min_embeddings integer DEFAULT 5) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    embedding_count INT;
    agent_count INT;
    result JSONB;
BEGIN
    -- Count embeddings for project
    SELECT COUNT(*) INTO embedding_count
    FROM public.research_embeddings
    WHERE project_id = p_project_id;
    
    -- Count completed agent results
    SELECT COUNT(*) INTO agent_count
    FROM public.agent_results
    WHERE project_id = p_project_id AND status = 'completed';
    
    result := jsonb_build_object(
        'is_sufficient', embedding_count >= p_min_embeddings AND agent_count >= 2,
        'embedding_count', embedding_count,
        'agent_count', agent_count,
        'needs_feedback_loop', embedding_count < p_min_embeddings
    );
    
    RETURN result;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, subscription_tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'free'
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: has_project_access(uuid, uuid, public.project_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid, _min_role public.project_role DEFAULT 'viewer'::public.project_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: match_embeddings(public.vector, double precision, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_embeddings(query_embedding public.vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10, filter_project_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, project_id uuid, content_type text, content_text text, content_chunk text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        re.id,
        re.project_id,
        re.content_type,
        re.content_text,
        re.content_chunk,
        re.metadata,
        1 - (re.embedding <=> query_embedding) AS similarity
    FROM public.research_embeddings re
    WHERE 
        (filter_project_id IS NULL OR re.project_id = filter_project_id)
        AND 1 - (re.embedding <=> query_embedding) > match_threshold
    ORDER BY re.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: agent_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agent_type text NOT NULL,
    keywords text[] DEFAULT '{}'::text[],
    sentiment_threshold numeric DEFAULT 0.5,
    filters jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    agent_type text NOT NULL,
    status text DEFAULT 'pending'::text,
    results jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_time_ms integer,
    tokens_used integer,
    CONSTRAINT agent_results_agent_type_check CHECK ((agent_type = ANY (ARRAY['sentiment'::text, 'competitor'::text, 'trends'::text]))),
    CONSTRAINT agent_results_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    insight_type text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_url text,
    download_date timestamp with time zone DEFAULT now()
);


--
-- Name: profile_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    action_type text NOT NULL,
    action_details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    subscription_tier public.subscription_tier DEFAULT 'free'::public.subscription_tier NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    agent_result_id uuid,
    user_id uuid NOT NULL,
    comment_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    shared_with_user_id uuid NOT NULL,
    role public.project_role DEFAULT 'viewer'::public.project_role NOT NULL,
    shared_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    agent_result_id uuid,
    content_type text NOT NULL,
    content_text text NOT NULL,
    content_chunk text NOT NULL,
    embedding public.vector(768),
    metadata jsonb DEFAULT '{}'::jsonb,
    run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Untitled Note'::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_name text NOT NULL,
    company_name text,
    description text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT research_projects_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: research_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    agents_triggered jsonb DEFAULT '[]'::jsonb,
    embeddings_count integer DEFAULT 0,
    feedback_loop_triggered boolean DEFAULT false,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: saved_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    query_name text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    achievement_type text NOT NULL,
    achievement_name text NOT NULL,
    achievement_description text NOT NULL,
    earned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    activity_type text NOT NULL,
    activity_date date DEFAULT CURRENT_DATE NOT NULL,
    activity_count integer DEFAULT 1 NOT NULL
);


--
-- Name: user_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    key_name text NOT NULL,
    key_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_type text NOT NULL,
    item_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_name text NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspace_annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    annotation_text text NOT NULL,
    annotation_type text DEFAULT 'note'::text NOT NULL,
    position_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_annotations_annotation_type_check CHECK ((annotation_type = ANY (ARRAY['note'::text, 'highlight'::text, 'comment'::text])))
);


--
-- Name: workspace_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_owner_id uuid NOT NULL,
    collaborator_email text NOT NULL,
    collaborator_user_id uuid,
    role text DEFAULT 'viewer'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT workspace_collaborators_role_check CHECK ((role = ANY (ARRAY['viewer'::text, 'editor'::text, 'admin'::text]))),
    CONSTRAINT workspace_collaborators_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: agent_configurations agent_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_configurations
    ADD CONSTRAINT agent_configurations_pkey PRIMARY KEY (id);


--
-- Name: agent_results agent_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_results
    ADD CONSTRAINT agent_results_pkey PRIMARY KEY (id);


--
-- Name: insights insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_pkey PRIMARY KEY (id);


--
-- Name: profile_downloads profile_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_downloads
    ADD CONSTRAINT profile_downloads_pkey PRIMARY KEY (id);


--
-- Name: profile_history profile_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_history
    ADD CONSTRAINT profile_history_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_comments project_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_pkey PRIMARY KEY (id);


--
-- Name: project_shares project_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_pkey PRIMARY KEY (id);


--
-- Name: project_shares project_shares_project_id_shared_with_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_project_id_shared_with_user_id_key UNIQUE (project_id, shared_with_user_id);


--
-- Name: research_embeddings research_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_embeddings
    ADD CONSTRAINT research_embeddings_pkey PRIMARY KEY (id);


--
-- Name: research_notes research_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_notes
    ADD CONSTRAINT research_notes_pkey PRIMARY KEY (id);


--
-- Name: research_projects research_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_projects
    ADD CONSTRAINT research_projects_pkey PRIMARY KEY (id);


--
-- Name: research_runs research_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_runs
    ADD CONSTRAINT research_runs_pkey PRIMARY KEY (id);


--
-- Name: saved_queries saved_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_queries
    ADD CONSTRAINT saved_queries_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_user_id_achievement_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_type_key UNIQUE (user_id, achievement_type);


--
-- Name: user_activity user_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_pkey PRIMARY KEY (id);


--
-- Name: user_activity user_activity_user_id_activity_type_activity_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_user_id_activity_type_activity_date_key UNIQUE (user_id, activity_type, activity_date);


--
-- Name: user_api_keys user_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_api_keys
    ADD CONSTRAINT user_api_keys_pkey PRIMARY KEY (id);


--
-- Name: user_api_keys user_api_keys_user_id_key_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_api_keys
    ADD CONSTRAINT user_api_keys_user_id_key_name_key UNIQUE (user_id, key_name);


--
-- Name: user_favorites user_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorites
    ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: workspace_annotations workspace_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_annotations
    ADD CONSTRAINT workspace_annotations_pkey PRIMARY KEY (id);


--
-- Name: workspace_collaborators workspace_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_collaborators
    ADD CONSTRAINT workspace_collaborators_pkey PRIMARY KEY (id);


--
-- Name: workspace_collaborators workspace_collaborators_workspace_owner_id_collaborator_ema_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_collaborators
    ADD CONSTRAINT workspace_collaborators_workspace_owner_id_collaborator_ema_key UNIQUE (workspace_owner_id, collaborator_email);


--
-- Name: idx_agent_results_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_results_created_at ON public.agent_results USING btree (created_at DESC);


--
-- Name: idx_agent_results_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_results_search ON public.agent_results USING gin (to_tsvector('english'::regconfig, COALESCE((results)::text, ''::text)));


--
-- Name: idx_agent_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_results_status ON public.agent_results USING btree (status);


--
-- Name: idx_agent_results_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_results_type ON public.agent_results USING btree (agent_type);


--
-- Name: idx_project_comments_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_comments_project_id ON public.project_comments USING btree (project_id);


--
-- Name: idx_project_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_comments_user_id ON public.project_comments USING btree (user_id);


--
-- Name: idx_project_shares_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_shares_project_id ON public.project_shares USING btree (project_id);


--
-- Name: idx_project_shares_shared_with_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_shares_shared_with_user_id ON public.project_shares USING btree (shared_with_user_id);


--
-- Name: idx_research_projects_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_projects_created_at ON public.research_projects USING btree (created_at DESC);


--
-- Name: idx_research_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_projects_status ON public.research_projects USING btree (status);


--
-- Name: idx_research_projects_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_projects_user_id ON public.research_projects USING btree (user_id);


--
-- Name: idx_user_achievements_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_achievements_user_id ON public.user_achievements USING btree (user_id);


--
-- Name: idx_user_activity_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_user_date ON public.user_activity USING btree (user_id, activity_date);


--
-- Name: idx_user_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_read ON public.user_notifications USING btree (user_id, read);


--
-- Name: idx_user_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: research_embeddings_content_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_embeddings_content_type_idx ON public.research_embeddings USING btree (content_type);


--
-- Name: research_embeddings_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_embeddings_embedding_idx ON public.research_embeddings USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: research_embeddings_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_embeddings_project_id_idx ON public.research_embeddings USING btree (project_id);


--
-- Name: research_embeddings_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_embeddings_run_id_idx ON public.research_embeddings USING btree (run_id);


--
-- Name: agent_configurations update_agent_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_configurations_updated_at BEFORE UPDATE ON public.agent_configurations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: agent_results update_agent_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_results_updated_at BEFORE UPDATE ON public.agent_results FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: project_comments update_project_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_comments_updated_at BEFORE UPDATE ON public.project_comments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: research_notes update_research_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_research_notes_updated_at BEFORE UPDATE ON public.research_notes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: research_projects update_research_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_research_projects_updated_at BEFORE UPDATE ON public.research_projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: user_api_keys update_user_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON public.user_api_keys FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: user_settings update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: workspace_annotations update_workspace_annotations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_annotations_updated_at BEFORE UPDATE ON public.workspace_annotations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: agent_results agent_results_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_results
    ADD CONSTRAINT agent_results_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: insights insights_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: profile_downloads profile_downloads_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_downloads
    ADD CONSTRAINT profile_downloads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: profile_history profile_history_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_history
    ADD CONSTRAINT profile_history_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_comments project_comments_agent_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_agent_result_id_fkey FOREIGN KEY (agent_result_id) REFERENCES public.agent_results(id) ON DELETE CASCADE;


--
-- Name: project_comments project_comments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: project_shares project_shares_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: research_embeddings research_embeddings_agent_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_embeddings
    ADD CONSTRAINT research_embeddings_agent_result_id_fkey FOREIGN KEY (agent_result_id) REFERENCES public.agent_results(id) ON DELETE CASCADE;


--
-- Name: research_embeddings research_embeddings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_embeddings
    ADD CONSTRAINT research_embeddings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: research_notes research_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_notes
    ADD CONSTRAINT research_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: research_projects research_projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_projects
    ADD CONSTRAINT research_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: research_runs research_runs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_runs
    ADD CONSTRAINT research_runs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: user_api_keys user_api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_api_keys
    ADD CONSTRAINT user_api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: workspace_annotations workspace_annotations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_annotations
    ADD CONSTRAINT workspace_annotations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.research_projects(id) ON DELETE CASCADE;


--
-- Name: workspace_annotations workspace_annotations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_annotations
    ADD CONSTRAINT workspace_annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_collaborators workspace_collaborators_collaborator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_collaborators
    ADD CONSTRAINT workspace_collaborators_collaborator_user_id_fkey FOREIGN KEY (collaborator_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_collaborators workspace_collaborators_workspace_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_collaborators
    ADD CONSTRAINT workspace_collaborators_workspace_owner_id_fkey FOREIGN KEY (workspace_owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: project_shares Project owners can manage shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project owners can manage shares" ON public.project_shares USING ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = project_shares.project_id) AND (research_projects.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = project_shares.project_id) AND (research_projects.user_id = auth.uid())))));


--
-- Name: user_achievements System can create achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create achievements" ON public.user_achievements FOR INSERT WITH CHECK (true);


--
-- Name: user_notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.user_notifications FOR INSERT WITH CHECK (true);


--
-- Name: user_activity System can manage activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage activity" ON public.user_activity WITH CHECK (true);


--
-- Name: agent_results Users can create agent results for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create agent results for their projects" ON public.agent_results FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = agent_results.project_id) AND (research_projects.user_id = auth.uid())))));


--
-- Name: workspace_annotations Users can create annotations on accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create annotations on accessible projects" ON public.workspace_annotations FOR INSERT WITH CHECK (((auth.uid() = user_id) AND public.has_project_access(auth.uid(), project_id)));


--
-- Name: project_comments Users can create comments on accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create comments on accessible projects" ON public.project_comments FOR INSERT WITH CHECK (((auth.uid() = user_id) AND public.has_project_access(auth.uid(), project_id)));


--
-- Name: profile_downloads Users can create downloads for their profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create downloads for their profiles" ON public.profile_downloads FOR INSERT WITH CHECK ((profile_id IN ( SELECT user_profiles.id
   FROM public.user_profiles
  WHERE (user_profiles.user_id = auth.uid()))));


--
-- Name: profile_history Users can create history for their profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create history for their profiles" ON public.profile_history FOR INSERT WITH CHECK ((profile_id IN ( SELECT user_profiles.id
   FROM public.user_profiles
  WHERE (user_profiles.user_id = auth.uid()))));


--
-- Name: insights Users can create insights for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create insights for their projects" ON public.insights FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = insights.project_id) AND (research_projects.user_id = auth.uid())))));


--
-- Name: research_notes Users can create their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own notes" ON public.research_notes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_profiles Users can create their own profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own profiles" ON public.user_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: research_projects Users can create their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own projects" ON public.research_projects FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_settings Users can create their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: research_embeddings Users can delete embeddings for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete embeddings for their projects" ON public.research_embeddings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.research_projects rp
  WHERE ((rp.id = research_embeddings.project_id) AND (rp.user_id = auth.uid())))));


--
-- Name: user_api_keys Users can delete their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own API keys" ON public.user_api_keys FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: workspace_annotations Users can delete their own annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own annotations" ON public.workspace_annotations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: project_comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own comments" ON public.project_comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: research_notes Users can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notes" ON public.research_notes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_profiles Users can delete their own profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own profiles" ON public.user_profiles FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: research_projects Users can delete their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own projects" ON public.research_projects FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can delete their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own settings" ON public.user_settings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profile_downloads Users can delete their profile downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their profile downloads" ON public.profile_downloads FOR DELETE USING ((profile_id IN ( SELECT user_profiles.id
   FROM public.user_profiles
  WHERE (user_profiles.user_id = auth.uid()))));


--
-- Name: research_embeddings Users can insert embeddings for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert embeddings for their projects" ON public.research_embeddings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.research_projects rp
  WHERE ((rp.id = research_embeddings.project_id) AND (rp.user_id = auth.uid())))));


--
-- Name: user_api_keys Users can insert their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own API keys" ON public.user_api_keys FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: research_runs Users can insert their own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own runs" ON public.research_runs FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: agent_configurations Users can manage their own agent configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own agent configurations" ON public.agent_configurations USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_favorites Users can manage their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own favorites" ON public.user_favorites USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: saved_queries Users can manage their own saved queries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own saved queries" ON public.saved_queries USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_results Users can update agent results for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update agent results for their projects" ON public.agent_results FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = agent_results.project_id) AND (research_projects.user_id = auth.uid())))));


--
-- Name: workspace_collaborators Users can update their invitation status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their invitation status" ON public.workspace_collaborators FOR UPDATE USING ((collaborator_email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text)) WITH CHECK ((collaborator_email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text));


--
-- Name: user_api_keys Users can update their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own API keys" ON public.user_api_keys FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: workspace_annotations Users can update their own annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own annotations" ON public.workspace_annotations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: project_comments Users can update their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own comments" ON public.project_comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: research_notes Users can update their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notes" ON public.research_notes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.user_notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: user_profiles Users can update their own profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profiles" ON public.user_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: research_projects Users can update their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own projects" ON public.research_projects FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: research_runs Users can update their own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own runs" ON public.research_runs FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: user_settings Users can update their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: agent_results Users can view agent results for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view agent results for their projects" ON public.agent_results FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = agent_results.project_id) AND (research_projects.user_id = auth.uid())))));


--
-- Name: workspace_annotations Users can view annotations on accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view annotations on accessible projects" ON public.workspace_annotations FOR SELECT USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_comments Users can view comments on accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments on accessible projects" ON public.project_comments FOR SELECT USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: profile_downloads Users can view downloads of their profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view downloads of their profiles" ON public.profile_downloads FOR SELECT USING ((profile_id IN ( SELECT user_profiles.id
   FROM public.user_profiles
  WHERE (user_profiles.user_id = auth.uid()))));


--
-- Name: research_embeddings Users can view embeddings for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view embeddings for their projects" ON public.research_embeddings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.research_projects rp
  WHERE ((rp.id = research_embeddings.project_id) AND (rp.user_id = auth.uid())))));


--
-- Name: profile_history Users can view history of their profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view history of their profiles" ON public.profile_history FOR SELECT USING ((profile_id IN ( SELECT user_profiles.id
   FROM public.user_profiles
  WHERE (user_profiles.user_id = auth.uid()))));


--
-- Name: insights Users can view insights for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view insights for their projects" ON public.insights FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = insights.project_id) AND (research_projects.user_id = auth.uid())))));


--
-- Name: project_shares Users can view shares for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view shares for their projects" ON public.project_shares FOR SELECT USING (((shared_with_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.research_projects
  WHERE ((research_projects.id = project_shares.project_id) AND (research_projects.user_id = auth.uid()))))));


--
-- Name: workspace_collaborators Users can view their invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their invitations" ON public.workspace_collaborators FOR SELECT USING ((collaborator_email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text));


--
-- Name: user_api_keys Users can view their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own API keys" ON public.user_api_keys FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_achievements Users can view their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own achievements" ON public.user_achievements FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_activity Users can view their own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own activity" ON public.user_activity FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: research_notes Users can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notes" ON public.research_notes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.user_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_profiles Users can view their own profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profiles" ON public.user_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: research_projects Users can view their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own projects" ON public.research_projects FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: research_runs Users can view their own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own runs" ON public.research_runs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_settings Users can view their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: workspace_collaborators Workspace owners can manage collaborators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners can manage collaborators" ON public.workspace_collaborators USING ((auth.uid() = workspace_owner_id)) WITH CHECK ((auth.uid() = workspace_owner_id));


--
-- Name: agent_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_results ENABLE ROW LEVEL SECURITY;

--
-- Name: insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_history ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: research_embeddings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.research_embeddings ENABLE ROW LEVEL SECURITY;

--
-- Name: research_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: research_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: research_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_queries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_queries ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: user_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: user_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_annotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_annotations ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_collaborators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_collaborators ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


