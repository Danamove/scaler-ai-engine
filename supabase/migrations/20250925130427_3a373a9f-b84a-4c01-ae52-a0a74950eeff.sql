-- Force delete all data with CASCADE to handle any dependencies
DELETE FROM public.target_companies;
DELETE FROM public.top_universities; 
DELETE FROM public.not_relevant_companies;
DELETE FROM public.synonyms;