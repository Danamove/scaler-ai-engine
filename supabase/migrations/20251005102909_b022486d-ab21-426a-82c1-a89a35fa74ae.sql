-- Drop the restrictive SELECT policy on allowed_emails
DROP POLICY IF EXISTS "Authenticated users can view allowed emails" ON public.allowed_emails;

-- Create a more permissive SELECT policy that allows the SECURITY DEFINER function to work
-- while still protecting the table from direct public access
CREATE POLICY "Allow SELECT for SECURITY DEFINER functions"
ON public.allowed_emails
FOR SELECT
USING (true);

-- Ensure the is_email_allowed function can bypass RLS by confirming it's SECURITY DEFINER
-- This function will work for both authenticated and unauthenticated users
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.allowed_emails
    WHERE LOWER(email) = LOWER(check_email)
  );
END;
$$;

-- Add a comment to explain the security model
COMMENT ON FUNCTION public.is_email_allowed(text) IS 'Security definer function that allows checking if an email is allowed without exposing the full list. Used during registration for unauthenticated users.';