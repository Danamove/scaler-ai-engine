-- Fix profiles table security by replacing function-based policies with direct authentication checks
-- The current security model may have vulnerabilities in the can_access_own_profile function

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert own profile only" ON public.profiles;  
DROP POLICY IF EXISTS "Authenticated users can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Deny all access to anonymous users" ON public.profiles;

-- Create new restrictive policies that directly use auth.uid() for maximum security
CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile only" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Explicitly deny DELETE operations to prevent accidental profile deletion
CREATE POLICY "Deny profile deletion" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (false);

-- Completely block anonymous access to sensitive user data
CREATE POLICY "Block all anonymous access to profiles" 
ON public.profiles 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Additional security: Create restrictive policy for service role to prevent admin overreach
CREATE POLICY "Service role limited profile access" 
ON public.profiles 
FOR ALL 
TO service_role
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);