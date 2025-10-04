-- Fix security issue: Remove role column from profiles table
-- Roles should only be managed through user_roles table with proper RLS

-- Remove the role column from profiles table to prevent privilege escalation
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Create a secure function to check if an email is in the allowed list
-- This function uses SECURITY DEFINER to access allowed_emails without exposing the full list
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email TEXT)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.allowed_emails
    WHERE LOWER(email) = LOWER(check_email)
  );
END;
$$;

-- Remove the public SELECT policy from allowed_emails
DROP POLICY IF EXISTS "Everyone can view allowed emails" ON public.allowed_emails;

-- Add a policy that only allows authenticated users to view allowed_emails
CREATE POLICY "Authenticated users can view allowed emails"
ON public.allowed_emails
FOR SELECT
USING (auth.uid() IS NOT NULL);