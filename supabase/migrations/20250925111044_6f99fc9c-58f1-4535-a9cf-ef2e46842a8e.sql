-- Add columns for Stage 1 built-in filter options
ALTER TABLE public.filter_rules 
ADD COLUMN use_not_relevant_filter BOOLEAN DEFAULT false,
ADD COLUMN use_target_companies_filter BOOLEAN DEFAULT false;