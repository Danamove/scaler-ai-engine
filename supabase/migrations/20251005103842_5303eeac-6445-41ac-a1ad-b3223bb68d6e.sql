-- Normalize existing emails to avoid case/whitespace mismatches
UPDATE public.allowed_emails
SET email = LOWER(TRIM(email));

-- Make the function robust to case and whitespace variations
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.allowed_emails
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(check_email))
  );
END;
$$;

COMMENT ON FUNCTION public.is_email_allowed(text) IS 'Security definer function that checks if an email exists in allowed_emails, robust to case and whitespace.';