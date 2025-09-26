-- Add job_id column to raw_data table (allowing nulls initially)
ALTER TABLE public.raw_data 
ADD COLUMN job_id text;

-- Update existing raw_data records to link them to users' latest jobs
UPDATE public.raw_data 
SET job_id = COALESCE(
  (
    SELECT job_id 
    FROM public.jobs 
    WHERE jobs.user_id = raw_data.user_id 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  'default-job'
);

-- Make job_id required for new records
ALTER TABLE public.raw_data 
ALTER COLUMN job_id SET NOT NULL;

-- Add index for better performance
CREATE INDEX idx_raw_data_user_job ON public.raw_data(user_id, job_id);