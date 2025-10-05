-- Add shirih@added-value.co.il to allowed_emails
INSERT INTO public.allowed_emails (email, notes)
VALUES ('shirih@added-value.co.il', 'Updated email address for Shiri')
ON CONFLICT (email) DO NOTHING;