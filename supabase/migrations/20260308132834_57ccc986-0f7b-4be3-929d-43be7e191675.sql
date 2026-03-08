
CREATE POLICY "Admins can view all receipts"
ON public.receipts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all receipts"
ON public.receipts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all contacts"
ON public.contacts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all contacts"
ON public.contacts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
