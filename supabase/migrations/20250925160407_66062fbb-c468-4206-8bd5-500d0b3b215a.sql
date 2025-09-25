-- Create jobs table to track user jobs and enforce quotas
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for job access
CREATE POLICY "Users can view their own jobs" 
ON public.jobs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs" 
ON public.jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
ON public.jobs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" 
ON public.jobs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check job quota (max 10 jobs per user)
CREATE OR REPLACE FUNCTION public.check_job_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.jobs WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Job quota exceeded. Maximum 10 jobs allowed per user.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce job quota
CREATE TRIGGER enforce_job_quota
BEFORE INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.check_job_quota();