-- Add address column to receipts table
ALTER TABLE public.receipts 
ADD COLUMN address TEXT NOT NULL DEFAULT '';