-- Add branch field to receipts table
ALTER TABLE public.receipts ADD COLUMN branch text NOT NULL DEFAULT 'Near Shivaji Chowk Banka';