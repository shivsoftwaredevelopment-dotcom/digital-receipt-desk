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

        <div className="receipt-print relative mx-auto max-w-4xl" style={{ aspectRatio: '8.5/11' }}>
          <img 
            src={new URL('../assets/prescription-template.jpg', import.meta.url).href}
            alt="Prescription Template"
            className="absolute inset-0 h-full w-full object-contain"
          />
          
          {/* Overlay text on the template */}
          <div className="relative h-full w-full p-8">
            {/* Name, Age, Date line - positioned on first dotted line */}
            <div className="absolute" style={{ top: '300px', left: '360px', right: '40px' }}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{receipt.customer_name}</span>
                <span className="font-medium">{receipt.age}</span>
                <span className="font-medium">{new Date(receipt.receipt_date).toLocaleDateString()}</span>
              </div>
            </div>
            
            {/* Address, BP, Pulse line - positioned on second dotted line */}
            <div className="absolute" style={{ top: '305px', left: '360px', right: '40px' }}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex-1">{receipt.address}</span>
                <span className="font-medium w-32">{receipt.bp || '-'}</span>
                <span className="font-medium w-32">{receipt.pulse || '-'}</span>
              </div>
            </div>

            {/* Items list - positioned in the center empty space */}
            <div className="absolute" style={{ top: '380px', left: '100px', right: '100px' }}>
              <div className="space-y-3">
                {receipt.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-base" style={{ color: '#000000' }}>
                    <span className="font-semibold">{item.name}</span>
                    <span className="font-semibold">Qty: {item.quantity}</span>
                    <span className="font-semibold">₹{item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax and Total details */}
            <div className="absolute" style={{ bottom: '150px', right: '100px', width: '300px' }}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-medium">₹{receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Tax:</span>
                  <span className="font-medium">₹{receipt.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-foreground/20 pt-1">
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
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptDisplay;
