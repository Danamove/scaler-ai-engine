-- Create API cost tracking table
CREATE TABLE public.api_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_costs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all API costs" 
ON public.api_costs 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'::user_role));

CREATE POLICY "System can insert API costs" 
ON public.api_costs 
FOR INSERT 
WITH CHECK (true);

-- Set dana@added-value.co.il as admin (update if profile exists, insert if not)
INSERT INTO public.profiles (user_id, email, role, full_name)
SELECT 
  auth.users.id,
  'dana@added-value.co.il',
  'admin'::user_role,
  'Dana Admin'
FROM auth.users 
WHERE auth.users.email = 'dana@added-value.co.il'
ON CONFLICT (user_id) DO UPDATE SET 
  role = 'admin'::user_role,
  email = 'dana@added-value.co.il';