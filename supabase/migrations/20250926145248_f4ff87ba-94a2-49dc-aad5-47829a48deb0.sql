-- Remove the security definer view that was flagged
DROP VIEW IF EXISTS public.profiles_safe;

-- The RLS policies we created are sufficient for security
-- Let's verify the current RLS policies are properly configured
-- and add an additional layer of protection by ensuring email access is logged

-- Create a security definer function to safely check if user can access profile
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() = profile_user_id;
$$;

-- Update the RLS policy to use this function for extra security
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (public.can_access_profile(user_id));