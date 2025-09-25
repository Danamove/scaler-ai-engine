-- Harden security for related candidate information tables
-- These tables contain candidate names and related sensitive data

-- Fix netly_files table security (contains candidate names)
DROP POLICY IF EXISTS "Users can manage own netly_files" ON public.netly_files;

CREATE POLICY "Users can view own netly files only" 
ON public.netly_files 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own netly files only" 
ON public.netly_files 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own netly files only" 
ON public.netly_files 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own netly files only" 
ON public.netly_files 
FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Block anonymous access to netly files" 
ON public.netly_files 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Fix user_past_candidates table security (contains candidate names)
DROP POLICY IF EXISTS "Users can manage own past_candidates" ON public.user_past_candidates;

CREATE POLICY "Users can view own past candidates only" 
ON public.user_past_candidates 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own past candidates only" 
ON public.user_past_candidates 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own past candidates only" 
ON public.user_past_candidates 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own past candidates only" 
ON public.user_past_candidates 
FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Block anonymous access to past candidates" 
ON public.user_past_candidates 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Fix user_blacklist table security (contains company names that could reveal strategy)
DROP POLICY IF EXISTS "Users can manage own blacklist" ON public.user_blacklist;

CREATE POLICY "Users can view own blacklist only" 
ON public.user_blacklist 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own blacklist only" 
ON public.user_blacklist 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own blacklist only" 
ON public.user_blacklist 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own blacklist only" 
ON public.user_blacklist 
FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Block anonymous access to blacklist" 
ON public.user_blacklist 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);