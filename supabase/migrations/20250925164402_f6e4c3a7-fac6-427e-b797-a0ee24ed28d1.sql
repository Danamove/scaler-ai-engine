-- Fix function search path security issues for any remaining functions
-- Ensure check_job_quota function has proper security settings
CREATE OR REPLACE FUNCTION public.check_job_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.jobs WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Job quota exceeded. Maximum 10 jobs allowed per user.';
  END IF;
  RETURN NEW;
END;
$$;

-- Add missing triggers and ensure proper audit logging
CREATE TRIGGER update_audit_log_updated_at
    BEFORE UPDATE ON public.admin_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert admin user role assignment (safely handle if user doesn't exist)  
DO $$
BEGIN
  -- Try to insert admin role for dana@added-value.co.il if profile exists
  INSERT INTO public.user_roles (user_id, role)
  SELECT user_id, 'admin'::user_role
  FROM public.profiles
  WHERE email = 'dana@added-value.co.il'
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- If no rows were affected, it means the user doesn't exist yet
  -- This is fine as they'll get admin role when they sign up and create a profile
END $$;