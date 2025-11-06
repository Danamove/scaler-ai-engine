-- Security: Add field length constraints to prevent DoS attacks via oversized strings
-- Migration: Add VARCHAR constraints to TEXT fields

-- Raw data table constraints
ALTER TABLE public.raw_data
  ALTER COLUMN full_name TYPE VARCHAR(200),
  ALTER COLUMN current_title TYPE VARCHAR(300),
  ALTER COLUMN current_company TYPE VARCHAR(200),
  ALTER COLUMN previous_company TYPE VARCHAR(200),
  ALTER COLUMN linkedin_url TYPE VARCHAR(500),
  ALTER COLUMN location TYPE VARCHAR(200),
  ALTER COLUMN education TYPE VARCHAR(500),
  ALTER COLUMN degree TYPE VARCHAR(200),
  ALTER COLUMN skills TYPE VARCHAR(2000),
  ALTER COLUMN job_description TYPE VARCHAR(3000),
  ALTER COLUMN profile_summary TYPE VARCHAR(5000);

-- Profiles table constraints
ALTER TABLE public.profiles
  ALTER COLUMN email TYPE VARCHAR(255),
  ALTER COLUMN full_name TYPE VARCHAR(200);

-- Company lists constraints
ALTER TABLE public.not_relevant_companies
  ALTER COLUMN company_name TYPE VARCHAR(200),
  ALTER COLUMN category TYPE VARCHAR(100);

ALTER TABLE public.target_companies
  ALTER COLUMN company_name TYPE VARCHAR(200),
  ALTER COLUMN category TYPE VARCHAR(100);

ALTER TABLE public.top_universities
  ALTER COLUMN university_name TYPE VARCHAR(300),
  ALTER COLUMN country TYPE VARCHAR(100);

ALTER TABLE public.synonyms
  ALTER COLUMN canonical_term TYPE VARCHAR(100),
  ALTER COLUMN variant_term TYPE VARCHAR(100),
  ALTER COLUMN category TYPE VARCHAR(50);

-- User lists constraints
ALTER TABLE public.user_blacklist
  ALTER COLUMN company_name TYPE VARCHAR(200),
  ALTER COLUMN job_id TYPE VARCHAR(100);

ALTER TABLE public.user_past_candidates
  ALTER COLUMN candidate_name TYPE VARCHAR(200),
  ALTER COLUMN job_id TYPE VARCHAR(100);

ALTER TABLE public.user_wanted_companies
  ALTER COLUMN company_name TYPE VARCHAR(200),
  ALTER COLUMN job_id TYPE VARCHAR(100);

ALTER TABLE public.user_wanted_universities
  ALTER COLUMN university_name TYPE VARCHAR(300),
  ALTER COLUMN job_id TYPE VARCHAR(100);

-- Filter rules constraints
ALTER TABLE public.filter_rules
  ALTER COLUMN job_id TYPE VARCHAR(100);

-- Filtered results constraints
ALTER TABLE public.filtered_results
  ALTER COLUMN job_id TYPE VARCHAR(100);

-- Netly files constraints
ALTER TABLE public.netly_files
  ALTER COLUMN job_id TYPE VARCHAR(100),
  ALTER COLUMN candidate_name TYPE VARCHAR(200);

-- Jobs table constraints (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    ALTER TABLE public.jobs
      ALTER COLUMN job_name TYPE VARCHAR(200);
  END IF;
END $$;

-- Admin audit log constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_log') THEN
    ALTER TABLE public.admin_audit_log
      ALTER COLUMN action TYPE VARCHAR(100);
  END IF;
END $$;
