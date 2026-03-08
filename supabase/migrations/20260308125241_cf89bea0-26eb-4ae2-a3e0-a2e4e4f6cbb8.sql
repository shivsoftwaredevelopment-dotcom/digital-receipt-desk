
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT 'false',
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read site settings" ON public.site_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can update
CREATE POLICY "Admins can manage site settings" ON public.site_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default maintenance mode setting
INSERT INTO public.site_settings (key, value) VALUES ('maintenance_mode', 'false');
