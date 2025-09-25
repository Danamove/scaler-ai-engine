-- Create user_roles table for proper role management
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create audit log table for admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID,
    action TEXT NOT NULL,
    target_user_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can access audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update API costs RLS policies to use role-based access
DROP POLICY IF EXISTS "Admins can view all API costs" ON public.api_costs;
CREATE POLICY "Admins can view all API costs"
ON public.api_costs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update other admin-only table policies
DROP POLICY IF EXISTS "Only admins can modify target_companies" ON public.target_companies;
CREATE POLICY "Only admins can modify target_companies"
ON public.target_companies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify not_relevant_companies" ON public.not_relevant_companies;
CREATE POLICY "Only admins can modify not_relevant_companies"
ON public.not_relevant_companies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify synonyms" ON public.synonyms;
CREATE POLICY "Only admins can modify synonyms"
ON public.synonyms
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify top_universities" ON public.top_universities;
CREATE POLICY "Only admins can modify top_universities"
ON public.top_universities
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for audit log on role changes (only when user is authenticated)
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only log if there's an authenticated user
    IF auth.uid() IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO public.admin_audit_log (admin_user_id, action, target_user_id, details)
            VALUES (auth.uid(), 'ROLE_GRANTED', NEW.user_id, jsonb_build_object('role', NEW.role));
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            INSERT INTO public.admin_audit_log (admin_user_id, action, target_user_id, details)
            VALUES (auth.uid(), 'ROLE_REVOKED', OLD.user_id, jsonb_build_object('role', OLD.role));
            RETURN OLD;
        END IF;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    ELSE
        RETURN OLD;
    END IF;
END;
$$;

CREATE TRIGGER audit_user_roles_changes
    AFTER INSERT OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_role_changes();

-- Add trigger for updating updated_at on user_roles
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin role for existing admin user
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::user_role
FROM public.profiles
WHERE email = 'dana@added-value.co.il'
ON CONFLICT (user_id, role) DO NOTHING;