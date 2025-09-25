-- Drop existing RLS policies on profiles table
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create explicit security definer function to check if user can access profile
CREATE OR REPLACE FUNCTION public.can_access_own_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() = profile_user_id;
$$;

-- Create restrictive RLS policies that explicitly deny anonymous access
CREATE POLICY "Authenticated users can view own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_access_own_profile(user_id));

CREATE POLICY "Authenticated users can insert own profile only"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_own_profile(user_id));

CREATE POLICY "Authenticated users can update own profile only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.can_access_own_profile(user_id))
WITH CHECK (public.can_access_own_profile(user_id));

-- Explicitly deny all access to anonymous users
CREATE POLICY "Deny all access to anonymous users"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;