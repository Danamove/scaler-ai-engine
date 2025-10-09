-- Add missing columns to raw_data table for better candidate analysis
ALTER TABLE public.raw_data 
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT,
  ADD COLUMN IF NOT EXISTS job_description TEXT,
  ADD COLUMN IF NOT EXISTS degree TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN public.raw_data.location IS 'Current location of the candidate (from linkedinJobLocation)';
COMMENT ON COLUMN public.raw_data.skills IS 'Candidate skills (from linkedinSkillsLabel)';
COMMENT ON COLUMN public.raw_data.job_description IS 'Current job description (from linkedinJobDescription)';
COMMENT ON COLUMN public.raw_data.degree IS 'Academic degree (from linkedinSchoolDegree)';