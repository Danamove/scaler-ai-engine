-- Add use_wanted_companies_filter column to filter_rules table
ALTER TABLE public.filter_rules 
ADD COLUMN use_wanted_companies_filter boolean DEFAULT true;

COMMENT ON COLUMN public.filter_rules.use_wanted_companies_filter IS 'Whether to filter candidates by user wanted companies list. When true, only candidates from wanted companies will pass Stage 1.';