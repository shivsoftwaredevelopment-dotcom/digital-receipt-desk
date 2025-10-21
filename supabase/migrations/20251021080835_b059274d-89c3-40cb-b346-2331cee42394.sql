-- Create receipts table to store all receipt data
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to manage their own receipts
CREATE POLICY "Users can view their own receipts"
  ON public.receipts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own receipts"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts"
  ON public.receipts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts"
  ON public.receipts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();