-- Replace min_years_experience with exclude_location_terms in filter_rules table
ALTER TABLE public.filter_rules 
DROP COLUMN IF EXISTS min_years_experience;

ALTER TABLE public.filter_rules 
ADD COLUMN exclude_location_terms TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.filter_rules.exclude_location_terms IS 'Array of location terms to exclude (cities, regions) - only applies to candidate location, not entire profile';