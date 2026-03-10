import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Printer, ArrowLeft, LogOut } from "lucide-react";
import prescriptionTemplate from "@/assets/prescription-template.jpg";

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface Receipt {
  id: string;
  customer_name: string;
  age: string;
  mobile_number: string;
  address: string;
  bp: string;
  pulse: string;
  branch: string;
  receipt_date: string;
  items: ReceiptItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  template_id: string | null;
}

interface TemplateCustomText {
  custom_text: string | null;
  custom_text_left: string | null;
  custom_text_top: string | null;
  custom_text_color: string | null;
  custom_text_font_size: string | null;
}

const ReceiptDisplay = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [customText, setCustomText] = useState<TemplateCustomText | null>(null);

  useEffect(() => {
    fetchReceipt();
  }, [id]);

  const fetchReceipt = async () => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      const receiptData = data as unknown as Receipt;
      setReceipt(receiptData);

      // Fetch custom text from template if template_id exists
      if (receiptData.template_id) {
        const { data: tplData } = await supabase
          .from("receipt_templates")
          .select("custom_text, custom_text_left, custom_text_top, custom_text_color, custom_text_font_size")
          .eq("id", receiptData.template_id)
          .single();
        if (tplData) setCustomText(tplData as TemplateCustomText);
      }
    } catch (error) {
      toast.error("Failed to load receipt");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Receipt not found</h2>
          <Button onClick={() => navigate("/")} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Navigation buttons - hidden when printing */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate("/receipt-form")}>
              New Receipt
            </Button>
            <Button variant="outline" onClick={() => navigate("/history")}>
              History
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Receipt container - fixed A4 aspect ratio */}
        <div id="receipt-print-area" className="receipt-container relative mx-auto" style={{ width: '100%', maxWidth: '794px', aspectRatio: '210/297' }}>
          {/* Background image - visible on screen, hidden on print */}
          <img
            src={prescriptionTemplate}
            alt="Prescription Template"
            className="print-bg absolute inset-0 h-full w-full object-fill"
          />

          {/* Text overlay - all positions in percentage */}
          <div className="relative h-full w-full" style={{ fontSize: '12px' }}>
            
            {/* Name */}
            <div className="absolute font-semibold" style={{ top: '25.5%', left: '48%', color: '#000' }}>
              {receipt.customer_name}
            </div>

            {/* Age */}
            <div className="absolute font-semibold" style={{ top: '25.5%', left: '79%', color: '#000' }}>
              {receipt.age}
            </div>

            {/* Date */}
            <div className="absolute font-semibold" style={{ top: '25.5%', left: '88%', color: '#000' }}>
              {new Date(receipt.receipt_date).toLocaleDateString('en-GB')}
            </div>

            {/* Address */}
            <div className="absolute font-semibold" style={{ top: '28%', left: '48%', color: '#000' }}>
              {receipt.address}
            </div>

            {/* BP */}
            <div className="absolute font-semibold" style={{ top: '28%', left: '75%', color: '#000' }}>
              {receipt.bp || '-'}
            </div>

            {/* Pulse */}
            <div className="absolute font-semibold" style={{ top: '28%', left: '90%', color: '#000' }}>
              {receipt.pulse || '-'}
            </div>

            {/* Items */}
            <div className="absolute" style={{ top: '38%', left: '35%', right: '5%', color: '#000' }}>
              {receipt.items.map((item, index) => (
                <div key={index} className="flex justify-between font-semibold mb-2" style={{ fontSize: '13px' }}>
                  <span style={{ width: '50%' }}>{item.name}</span>
                  <span style={{ width: '20%', textAlign: 'center' }}>Qty: {item.quantity}</span>
                  <span style={{ width: '30%', textAlign: 'right' }}>₹{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Custom Text from Template */}
            {customText?.custom_text && (
              <div
                className="absolute font-semibold"
                style={{
                  left: customText.custom_text_left || '50%',
                  top: customText.custom_text_top || '50%',
                  color: customText.custom_text_color || '#000',
                  fontSize: customText.custom_text_font_size || '14px',
                }}
              >
                {customText.custom_text}
              </div>
            )}

            {/* Subtotal, Tax, Total */}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm;
            height: 297mm;
          }
          .no-print {
            display: none !important;
          }
          .min-h-screen {
            min-height: auto !important;
            padding: 0 !important;
            background: white !important;
          }
          .mx-auto {
            max-width: none !important;
            margin: 0 !important;
          }
          /* Hide background image on print - only text prints */
          .print-bg {
            display: none !important;
          }
          /* Make receipt fill entire page */
          .receipt-container {
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            margin: 0 !important;
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptDisplay;
