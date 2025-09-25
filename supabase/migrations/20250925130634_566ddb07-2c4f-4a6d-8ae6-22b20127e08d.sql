-- 1) Deduplicate filter_rules keeping the most recently updated per (user_id, job_id)
WITH ranked AS (
  SELECT id, user_id, job_id,
         ROW_NUMBER() OVER (PARTITION BY user_id, job_id ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.filter_rules
)
DELETE FROM public.filter_rules fr
USING ranked r
WHERE fr.id = r.id AND r.rn > 1;

-- 2) Enforce uniqueness on (user_id, job_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'filter_rules_user_job_unique'
  ) THEN
    ALTER TABLE public.filter_rules ADD CONSTRAINT filter_rules_user_job_unique UNIQUE (user_id, job_id);
  END IF;
END $$;

-- 3) Seed target companies (idempotent)
INSERT INTO public.target_companies (company_name, category) VALUES
('Microsoft', 'Technology'),('Google', 'Technology'),('Apple', 'Technology'),('Amazon', 'Technology'),('Meta', 'Technology'),
('Netflix', 'Technology'),('Tesla', 'Technology'),('NVIDIA', 'Technology'),('Oracle', 'Technology'),('Salesforce', 'Technology'),
('Adobe', 'Technology'),('IBM', 'Technology'),('Intel', 'Technology'),('Cisco', 'Technology'),('VMware', 'Technology'),
('ServiceNow', 'Technology'),('Snowflake', 'Technology'),('Databricks', 'Technology'),('Palantir', 'Technology'),('Unity', 'Technology'),('Zoom', 'Technology'),
('Wix', 'Israeli Tech'),('Check Point', 'Israeli Tech'),('CyberArk', 'Israeli Tech'),('Nice', 'Israeli Tech'),('Amdocs', 'Israeli Tech'),
('Teva', 'Israeli Tech'),('Rafael', 'Israeli Tech'),('Elbit Systems', 'Israeli Tech'),('Mobileye', 'Israeli Tech'),('Varonis', 'Israeli Tech'),
('SentinelOne', 'Israeli Tech'),('Fiverr', 'Israeli Tech'),('JFrog', 'Israeli Tech'),('IronSource', 'Israeli Tech'),('Playtika', 'Israeli Tech'),
('Outbrain', 'Israeli Tech'),('Taboola', 'Israeli Tech'),
('Goldman Sachs', 'Financial Services'),('JPMorgan Chase', 'Financial Services'),('Morgan Stanley', 'Financial Services'),('BlackRock', 'Financial Services'),
('Visa', 'Financial Services'),('Mastercard', 'Financial Services'),('PayPal', 'Financial Services'),('Stripe', 'Financial Services'),('Fidelity', 'Financial Services'),('Charles Schwab', 'Financial Services'),
('McKinsey & Company', 'Consulting'),('Boston Consulting Group', 'Consulting'),('Bain & Company', 'Consulting'),('Deloitte', 'Consulting'),('PwC', 'Consulting'),('EY', 'Consulting'),('KPMG', 'Consulting'),('Accenture', 'Consulting'),
('OpenAI', 'AI/ML'),('Anthropic', 'AI/ML'),('Scale AI', 'AI/ML'),('Hugging Face', 'AI/ML'),('Cohere', 'AI/ML'),('Stability AI', 'AI/ML'),('Midjourney', 'AI/ML'),('Character.AI', 'AI/ML'),('Perplexity', 'AI/ML'),('Runway', 'AI/ML')
ON CONFLICT DO NOTHING;

-- 4) Seed top universities (idempotent)
INSERT INTO public.top_universities (university_name, country) VALUES
('Hebrew University of Jerusalem', 'Israel'),('Tel Aviv University', 'Israel'),('Technion - Israel Institute of Technology', 'Israel'),('Weizmann Institute of Science', 'Israel'),('Ben-Gurion University of the Negev', 'Israel'),('Bar-Ilan University', 'Israel'),('University of Haifa', 'Israel'),('Ariel University', 'Israel'),
('Harvard University', 'United States'),('Yale University', 'United States'),('Princeton University', 'United States'),('Columbia University', 'United States'),('University of Pennsylvania', 'United States'),('Dartmouth College', 'United States'),('Brown University', 'United States'),('Cornell University', 'United States'),
('Stanford University', 'United States'),('Massachusetts Institute of Technology', 'United States'),('California Institute of Technology', 'United States'),('Carnegie Mellon University', 'United States'),('University of California Berkeley', 'United States'),('Georgia Institute of Technology', 'United States'),('University of Illinois Urbana-Champaign', 'United States'),('University of Washington', 'United States'),('University of Michigan', 'United States'),('University of Texas at Austin', 'United States'),
('University of Oxford', 'United Kingdom'),('University of Cambridge', 'United Kingdom'),('Imperial College London', 'United Kingdom'),('London School of Economics', 'United Kingdom'),('University College London', 'United Kingdom'),('King''s College London', 'United Kingdom'),('University of Edinburgh', 'United Kingdom'),('University of Manchester', 'United Kingdom'),
('ETH Zurich', 'Switzerland'),('EPFL', 'Switzerland'),('Technical University of Munich', 'Germany'),('RWTH Aachen University', 'Germany'),('University of Amsterdam', 'Netherlands'),('Delft University of Technology', 'Netherlands'),('KTH Royal Institute of Technology', 'Sweden'),('Technical University of Denmark', 'Denmark')
ON CONFLICT DO NOTHING;