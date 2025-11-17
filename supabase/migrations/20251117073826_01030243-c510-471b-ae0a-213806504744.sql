-- Clean up all records with invalid job_id (not 36 characters UUID)
-- This will remove legacy data that causes configuration save issues

DELETE FROM public.filter_rules WHERE LENGTH(job_id::text) != 36;
DELETE FROM public.jobs WHERE LENGTH(job_id) != 36;
DELETE FROM public.user_blacklist WHERE job_id IS NOT NULL AND LENGTH(job_id) != 36;
DELETE FROM public.user_wanted_companies WHERE LENGTH(job_id) != 36;
DELETE FROM public.user_wanted_universities WHERE LENGTH(job_id) != 36;
DELETE FROM public.user_past_candidates WHERE job_id IS NOT NULL AND LENGTH(job_id) != 36;