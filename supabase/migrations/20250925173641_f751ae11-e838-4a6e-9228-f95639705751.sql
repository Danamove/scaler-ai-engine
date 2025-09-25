-- Fix RLS security for raw_data table containing sensitive candidate PII
-- Drop existing permissive policy and replace with restrictive policies

DROP POLICY IF EXISTS "Users can manage own raw_data" ON public.raw_data;

-- Create restrictive policies that explicitly deny access except for authenticated users accessing their own data
CREATE POLICY "Users can view own candidate data only" 
ON public.raw_data 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own candidate data only" 
ON public.raw_data 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own candidate data only" 
ON public.raw_data 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own candidate data only" 
ON public.raw_data 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Ensure no anonymous access to candidate PII
CREATE POLICY "Deny all access to anonymous users" 
ON public.raw_data 
FOR ALL 
TO anon
USING (false);

-- Apply same security fix to filtered_results table which contains references to raw_data
DROP POLICY IF EXISTS "Users can manage own filtered_results" ON public.filtered_results;

CREATE POLICY "Users can view own filtered results only" 
ON public.filtered_results 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own filtered results only" 
ON public.filtered_results 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own filtered results only" 
ON public.filtered_results 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own filtered results only" 
ON public.filtered_results 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to filtered results" 
ON public.filtered_results 
FOR ALL 
TO anon
USING (false);