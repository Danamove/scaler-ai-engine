-- Remove duplicates from user_blacklist table
DELETE FROM public.user_blacklist 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, job_id, company_name) id 
    FROM public.user_blacklist 
    ORDER BY user_id, job_id, company_name, created_at DESC
);

-- Remove duplicates from user_past_candidates table  
DELETE FROM public.user_past_candidates 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, job_id, candidate_name) id 
    FROM public.user_past_candidates 
    ORDER BY user_id, job_id, candidate_name, created_at DESC
);

-- Add unique constraint to user_blacklist table
ALTER TABLE public.user_blacklist 
ADD CONSTRAINT unique_user_job_company 
UNIQUE (user_id, job_id, company_name);

-- Add unique constraint to user_past_candidates table
ALTER TABLE public.user_past_candidates 
ADD CONSTRAINT unique_user_job_candidate 
UNIQUE (user_id, job_id, candidate_name);