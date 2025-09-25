-- Additional security hardening for raw_data table to prevent any potential service role bypass
-- Add explicit restrictions for service role access to candidate PII

CREATE POLICY "Service role cannot access candidate data" 
ON public.raw_data 
FOR ALL 
TO service_role
USING (false)
WITH CHECK (false);

-- Add explicit policy to ensure postgres role cannot access candidate data
CREATE POLICY "Postgres role cannot access candidate data" 
ON public.raw_data 
FOR ALL 
TO postgres
USING (false)  
WITH CHECK (false);

-- Ensure only the owner can access their own candidate data - strengthen existing policy
DROP POLICY IF EXISTS "Users can view own candidate data only" ON public.raw_data;
CREATE POLICY "Users can view own candidate data only" 
ON public.raw_data 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Strengthen INSERT policy with additional null check
DROP POLICY IF EXISTS "Users can insert own candidate data only" ON public.raw_data;
CREATE POLICY "Users can insert own candidate data only" 
ON public.raw_data 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Strengthen UPDATE policy with additional null check
DROP POLICY IF EXISTS "Users can update own candidate data only" ON public.raw_data;
CREATE POLICY "Users can update own candidate data only" 
ON public.raw_data 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Strengthen DELETE policy with additional null check
DROP POLICY IF EXISTS "Users can delete own candidate data only" ON public.raw_data;
CREATE POLICY "Users can delete own candidate data only" 
ON public.raw_data 
FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);