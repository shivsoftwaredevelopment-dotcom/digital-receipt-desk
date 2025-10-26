-- Function to make first user an admin automatically
CREATE OR REPLACE FUNCTION public.make_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user (no other users exist)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE id != NEW.id LIMIT 1) THEN
    -- Update the default 'user' role to 'admin' for the first user
    UPDATE public.user_roles 
    SET role = 'admin'::app_role 
    WHERE user_id = NEW.id AND role = 'user'::app_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically make first user admin
DROP TRIGGER IF EXISTS make_first_user_admin_trigger ON public.user_roles;
CREATE TRIGGER make_first_user_admin_trigger
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.make_first_user_admin();

-- Function to manually make a user admin by email
CREATE OR REPLACE FUNCTION public.make_user_admin_by_email(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get user id from auth.users by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;

  -- Delete existing user role
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Insert admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin'::app_role);
END;
$$;