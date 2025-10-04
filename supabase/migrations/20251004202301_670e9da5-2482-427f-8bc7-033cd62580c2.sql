-- Create allowed_emails table
CREATE TABLE public.allowed_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view allowed emails"
ON public.allowed_emails
FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert allowed emails"
ON public.allowed_emails
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can delete allowed emails"
ON public.allowed_emails
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Pre-populate with the authorized emails
INSERT INTO public.allowed_emails (email, notes) VALUES
  ('dana@added-value.co.il', 'Admin user'),
  ('andreas@added-value.co.il', 'Authorized user'),
  ('katinka@added-value.co.il', 'Authorized user'),
  ('alex@added-value.co.il', 'Authorized user'),
  ('eszterz@added-value.co.il', 'Authorized user'),
  ('shiri@added-value.co.il', 'Authorized user'),
  ('chen@added-value.co.il', 'Authorized user'),
  ('mikaka@added-value.co.il', 'Authorized user'),
  ('danana@added-value.co.il', 'Authorized user')
ON CONFLICT (email) DO NOTHING;