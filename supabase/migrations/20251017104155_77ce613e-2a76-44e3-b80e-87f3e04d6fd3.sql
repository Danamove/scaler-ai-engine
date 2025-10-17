-- Create user_wanted_universities table
CREATE TABLE public.user_wanted_universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text NOT NULL,
  university_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, job_id, university_name)
);

-- Enable RLS
ALTER TABLE public.user_wanted_universities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own wanted universities only"
ON public.user_wanted_universities
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own wanted universities only"
ON public.user_wanted_universities
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own wanted universities only"
ON public.user_wanted_universities
FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own wanted universities only"
ON public.user_wanted_universities
FOR DELETE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Block anonymous access to wanted universities"
ON public.user_wanted_universities
FOR ALL
USING (false)
WITH CHECK (false);

-- Add use_wanted_universities_filter column to filter_rules
ALTER TABLE public.filter_rules 
ADD COLUMN use_wanted_universities_filter boolean DEFAULT true;

COMMENT ON COLUMN public.filter_rules.use_wanted_universities_filter IS 'Whether to filter candidates by user wanted universities list. When true, only candidates who studied at wanted universities will pass Stage 1.';