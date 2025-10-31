-- Add age, bp, and pulse columns to receipts table
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bp TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS pulse TEXT;