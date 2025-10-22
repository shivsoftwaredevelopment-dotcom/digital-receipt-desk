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
  mobile_number: string;
  address: string;
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

        <div className="receipt-print mx-auto max-w-2xl rounded-lg border bg-card p-6 shadow-strong">
          {/* Header - Compact half-page layout */}
          <div className="mb-6 flex items-start justify-between border-b pb-4">
            <div className="flex-1">
              <h1 className="mb-1 text-xl font-bold">TAX INVOICE</h1>
              <p className="text-xs text-muted-foreground">Receipt #{receipt.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right text-xs">
              <p className="mb-1 font-bold">Shiv Dental Clinic</p>
              <p className="font-medium">{receipt.branch}</p>
              <p>Email: rkprasad0306@gmail.com</p>
              <p>Phone: 9973479904</p>
            </div>
          </div>

          {/* Date and Customer Details - Side by side */}
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-2 font-semibold">Date:</p>
              <p>{new Date(receipt.receipt_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="mb-2 font-semibold">Customer Details:</p>
              <p className="font-medium">{receipt.customer_name}</p>
              <p className="text-xs">{receipt.mobile_number}</p>
              <p className="text-xs">{receipt.address}</p>
            </div>
          </div>

          {/* Items Table - Compact */}
          <div className="mb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-primary">
                  <th className="py-2 text-left text-xs font-semibold">Item</th>
                  <th className="py-2 text-center text-xs font-semibold">Qty</th>
                  <th className="py-2 text-right text-xs font-semibold">Rate</th>
                  <th className="py-2 text-right text-xs font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">₹{item.price.toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold">
                      ₹{(item.quantity * item.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals - Compact */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>₹{receipt.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-primary pt-2 font-bold">
                <span>Total:</span>
                <span className="text-primary">₹{receipt.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer - Compact */}
          <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
            <p>Thank you for your business!</p>
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
