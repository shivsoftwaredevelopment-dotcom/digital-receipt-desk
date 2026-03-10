ALTER TABLE public.receipt_templates
ADD COLUMN custom_text text DEFAULT '',
ADD COLUMN custom_text_left text DEFAULT '50%',
ADD COLUMN custom_text_top text DEFAULT '50%',
ADD COLUMN custom_text_color text DEFAULT '#000000',
ADD COLUMN custom_text_font_size text DEFAULT '14px';