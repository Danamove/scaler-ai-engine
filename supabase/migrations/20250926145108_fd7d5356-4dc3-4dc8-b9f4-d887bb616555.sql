-- Fix security issue: Strengthen RLS policies on profiles table to prevent any potential email exposure

-- Drop existing policies to rebuild them more securely
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Service role limited profile access" ON public.profiles;
DROP POLICY IF EXISTS "Block all anonymous access to profiles" ON public.profiles;

-- Create strict RLS policies with explicit protection for email addresses
-- 1. Completely block anonymous access
CREATE POLICY "Block anonymous access to profiles" 
ON public.profiles 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- 2. Allow users to view only their own profile (authenticated users only)
CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 3. Ensure service role access is properly restricted
CREATE POLICY "Service role restricted access" 
ON public.profiles 
FOR ALL 
TO service_role 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. Add explicit protection: Create a view that excludes emails for any potential public access
-- This ensures emails are never exposed even if policies are misconfigured
CREATE OR REPLACE VIEW public.profiles_safe AS 
SELECT 
  id,
  user_id,
  full_name,
  role,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the safe view for authenticated users only
GRANT SELECT ON public.profiles_safe TO authenticated;