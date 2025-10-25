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

        <div className="receipt-print mx-auto max-w-2xl rounded-lg border bg-card p-4 shadow-strong">
          {/* Header - Minimal spacing */}
          <div className="mb-3 flex items-start justify-between border-b pb-2">
            <div className="flex-1">
              <h1 className="mb-0.5 text-lg font-bold">TAX INVOICE</h1>
              <p className="text-xs text-muted-foreground">#{receipt.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right text-xs leading-tight">
              <p className="font-bold">Shiv Dental Clinic</p>
              <p className="font-medium">{receipt.branch}</p>
              <p>rkprasad0306@gmail.com</p>
              <p>9973479904</p>
            </div>
          </div>

          {/* Date and Customer Details */}
          <div className="mb-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="mb-1 font-semibold">Date:</p>
              <p>{new Date(receipt.receipt_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="mb-1 font-semibold">Customer:</p>
              <p className="font-medium">{receipt.customer_name}</p>
              <p>{receipt.mobile_number}</p>
              <p>{receipt.address}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-primary">
                  <th className="py-1 text-left font-semibold">Item</th>
                  <th className="py-1 text-center font-semibold">Qty</th>
                  <th className="py-1 text-right font-semibold">Rate</th>
                  <th className="py-1 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">₹{item.price.toFixed(2)}</td>
                    <td className="py-1 text-right font-semibold">
                      ₹{(item.quantity * item.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-48 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>₹{receipt.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-primary pt-1 font-bold">
                <span>Total:</span>
                <span className="text-primary">₹{receipt.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 border-t pt-2 text-center text-xs text-muted-foreground">
            <p>Thank You For Visiting My Clinic shop!</p>
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
