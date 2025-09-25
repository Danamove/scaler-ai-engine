-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'user');

-- Create profiles table for user management
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create built-in lists tables (admin only)
CREATE TABLE public.not_relevant_companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL UNIQUE,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.target_companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL UNIQUE,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.top_universities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    university_name TEXT NOT NULL UNIQUE,
    country TEXT DEFAULT 'Israel',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.synonyms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    canonical_term TEXT NOT NULL,
    variant_term TEXT NOT NULL,
    category TEXT NOT NULL, -- 'title', 'skill', etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(canonical_term, variant_term)
);

-- Enable RLS on built-in lists
ALTER TABLE public.not_relevant_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synonyms ENABLE ROW LEVEL SECURITY;

-- Built-in lists policies (read for all, write for admin only)
CREATE POLICY "Everyone can view not_relevant_companies" ON public.not_relevant_companies FOR SELECT USING (true);
CREATE POLICY "Only admins can modify not_relevant_companies" ON public.not_relevant_companies FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Everyone can view target_companies" ON public.target_companies FOR SELECT USING (true);
CREATE POLICY "Only admins can modify target_companies" ON public.target_companies FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Everyone can view top_universities" ON public.top_universities FOR SELECT USING (true);
CREATE POLICY "Only admins can modify top_universities" ON public.top_universities FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Everyone can view synonyms" ON public.synonyms FOR SELECT USING (true);
CREATE POLICY "Only admins can modify synonyms" ON public.synonyms FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create raw data table
CREATE TABLE public.raw_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    current_title TEXT,
    current_company TEXT,
    previous_company TEXT,
    linkedin_url TEXT,
    profile_summary TEXT,
    education TEXT,
    years_of_experience INTEGER,
    months_in_current_role INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user-specific lists
CREATE TABLE public.user_blacklist (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    job_id TEXT, -- for per-job filtering
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.user_past_candidates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    job_id TEXT, -- for per-job filtering
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create filtering rules table
CREATE TABLE public.filter_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL,
    min_years_experience INTEGER DEFAULT 0,
    min_months_current_role INTEGER DEFAULT 0,
    exclude_terms TEXT[], -- array of terms to exclude
    must_have_terms TEXT[], -- array of required terms
    required_titles TEXT[], -- array of required titles
    require_top_uni BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create filtered results table
CREATE TABLE public.filtered_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL,
    raw_data_id UUID NOT NULL REFERENCES public.raw_data(id) ON DELETE CASCADE,
    stage_1_passed BOOLEAN NOT NULL DEFAULT false,
    stage_2_passed BOOLEAN NOT NULL DEFAULT false,
    filter_reasons TEXT[], -- reasons why filtered out
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Netly files table
CREATE TABLE public.netly_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    additional_data JSONB, -- flexible storage for additional fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user tables
ALTER TABLE public.raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_past_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filtered_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.netly_files ENABLE ROW LEVEL SECURITY;

-- User data policies
CREATE POLICY "Users can manage own raw_data" ON public.raw_data FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own blacklist" ON public.user_blacklist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own past_candidates" ON public.user_past_candidates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own filter_rules" ON public.filter_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own filtered_results" ON public.filtered_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own netly_files" ON public.netly_files FOR ALL USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_filter_rules_updated_at BEFORE UPDATE ON public.filter_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();