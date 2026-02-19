import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Printer, ArrowLeft, LogOut, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
}

const ReceiptDisplay = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

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
      setReceipt(data as unknown as Receipt);
    } catch (error) {
      toast.error("Failed to load receipt");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const element = document.getElementById("receipt-print-area");
    if (!element) return;
    
    toast.loading("Generating PDF...");
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`receipt-${receipt?.customer_name || "download"}.pdf`);
      toast.dismiss();
      toast.success("PDF downloaded!");
    } catch (err) {
      toast.dismiss();
      toast.error("Failed to generate PDF");
    }
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
              Print / PDF
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
            <div className="absolute font-semibold" style={{ top: '26.5%', left: '48%', color: '#000' }}>
              {receipt.customer_name}
            </div>

            {/* Age */}
            <div className="absolute font-semibold" style={{ top: '26.5%', left: '79%', color: '#000' }}>
              {receipt.age}
            </div>

            {/* Date */}
            <div className="absolute font-semibold" style={{ top: '26.5%', left: '88%', color: '#000' }}>
              {new Date(receipt.receipt_date).toLocaleDateString()}
            </div>

            {/* Address */}
            <div className="absolute font-semibold" style={{ top: '30%', left: '48%', color: '#000' }}>
              {receipt.address}
            </div>

            {/* BP */}
            <div className="absolute font-semibold" style={{ top: '30%', left: '75%', color: '#000' }}>
              {receipt.bp || '-'}
            </div>

            {/* Pulse */}
            <div className="absolute font-semibold" style={{ top: '30%', left: '90%', color: '#000' }}>
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

            {/* Subtotal, Tax, Total */}
            <div className="absolute" style={{ bottom: '18%', left: '35%', width: '30%', color: '#000' }}>
              <div className="flex justify-between font-semibold mb-1">
                <span>Subtotal:</span>
                <span>₹{receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Tax:</span>
                <span>₹{receipt.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-black pt-1">
                <span>Total:</span>
                <span>₹{receipt.total_amount.toFixed(2)}</span>
              </div>
            </div>
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
