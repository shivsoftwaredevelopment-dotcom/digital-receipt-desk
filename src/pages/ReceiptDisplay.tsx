import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Printer, ArrowLeft, LogOut } from "lucide-react";

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
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
              Print Receipt
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="receipt-print relative mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
          <img 
            src={new URL('../assets/prescription-template.jpg', import.meta.url).href}
            alt="Prescription Template"
            className="print-bg absolute inset-0 h-full w-full object-contain"
          />
          
          {/* Overlay text on the template */}
          <div className="relative h-full w-full p-8">
            {/* Name, Age, Date line */}
            <div className="absolute text-sm" style={{ top: '105mm', left: '75mm', width: '120mm' }}>
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{receipt.customer_name}</span>
                <span className="font-medium">{receipt.age}</span>
                <span className="font-medium">{new Date(receipt.receipt_date).toLocaleDateString()}</span>
              </div>
            </div>
            
            {/* Address, BP, Pulse line */}
            <div className="absolute text-sm" style={{ top: '120mm', left: '60mm', width: '135mm' }}>
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium flex-1">{receipt.address}</span>
                <span className="font-medium w-24">{receipt.bp || '-'}</span>
                <span className="font-medium w-24">{receipt.pulse || '-'}</span>
              </div>
            </div>

            {/* Items list */}
            <div className="absolute text-sm" style={{ top: '145mm', left: '50mm', width: '145mm' }}>
              <div className="space-y-2">
                {receipt.items.map((item, index) => (
                  <div key={index} className="flex justify-between gap-4">
                    <span className="font-semibold flex-1">{item.name}</span>
                    <span className="font-semibold w-16">Qty: {item.quantity}</span>
                    <span className="font-semibold w-20 text-right">₹{item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax and Total details */}
            <div className="absolute text-sm" style={{ bottom: '50mm', right: '30mm', width: '80mm' }}>
              <div className="space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-medium">₹{receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-medium">Tax:</span>
                  <span className="font-medium">₹{receipt.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-foreground/20 pt-2">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold">₹{receipt.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-bg {
            display: none !important;
          }
          .receipt-print {
            background: white !important;
            box-shadow: none !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptDisplay;
