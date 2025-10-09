-- Create user_wanted_companies table
CREATE TABLE public.user_wanted_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id, company_name)
);

-- Enable RLS
ALTER TABLE public.user_wanted_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Block anonymous access to wanted companies"
  ON public.user_wanted_companies
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Users can view own wanted companies only"
  ON public.user_wanted_companies
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own wanted companies only"
  ON public.user_wanted_companies
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own wanted companies only"
  ON public.user_wanted_companies
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own wanted companies only"
  ON public.user_wanted_companies
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_user_wanted_companies_user_job 
  ON public.user_wanted_companies(user_id, job_id);