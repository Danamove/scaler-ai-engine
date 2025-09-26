-- SECURITY FIX: Remove all existing conflicting RLS policies for profiles table
-- and implement secure, restrictive policies

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny profile deletion" ON public.profiles;
DROP POLICY IF EXISTS "Service role restricted access" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

-- Create secure, restrictive RLS policies for profiles table

-- 1. STRICT policy: Only authenticated users can access their own profile data
CREATE POLICY "users_can_view_own_profile_only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- 2. STRICT policy: Only authenticated users can insert their own profile
CREATE POLICY "users_can_insert_own_profile_only" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. STRICT policy: Only authenticated users can update their own profile
CREATE POLICY "users_can_update_own_profile_only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. STRICT policy: Completely deny profile deletion for security
CREATE POLICY "deny_all_profile_deletion" 
ON public.profiles 
FOR DELETE 
USING (false);

-- 5. CRITICAL: Explicitly deny ALL access to anonymous users
CREATE POLICY "deny_anonymous_access_to_profiles" 
ON public.profiles 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Ensure RLS is enabled (it should already be, but this is critical)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add comment for security documentation
COMMENT ON TABLE public.profiles IS 'Contains sensitive user data (emails, names). Protected by strict RLS policies - users can only access their own profile data.';