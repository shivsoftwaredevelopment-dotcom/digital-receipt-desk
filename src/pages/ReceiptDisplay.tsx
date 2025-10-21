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

        <div className="receipt-print rounded-lg border bg-card p-8 shadow-strong md:p-12">
          {/* Header */}
          <div className="mb-8 border-b-2 border-primary pb-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-3xl font-bold text-primary">TAX INVOICE</h1>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold">Shiv Dental Clinic</p>
                  <p className="font-medium">{receipt.branch}</p>
                  <p>Email: rkprasad0306@gmail.com</p>
                  <p>Phone: 9973479904</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Receipt No.</p>
                <p className="font-mono text-sm font-semibold">{receipt.id.slice(0, 8).toUpperCase()}</p>
                <p className="mt-2 text-sm text-muted-foreground">Date</p>
                <p className="font-semibold">{new Date(receipt.receipt_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-primary">Customer Details</h2>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{receipt.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mobile</p>
                  <p className="font-semibold">{receipt.mobile_number}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-primary">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-primary">
                    <th className="py-3 text-left font-semibold">S.No</th>
                    <th className="py-3 text-left font-semibold">Item Name</th>
                    <th className="py-3 text-center font-semibold">Qty</th>
                    <th className="py-3 text-right font-semibold">Rate (₹)</th>
                    <th className="py-3 text-right font-semibold">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3">{index + 1}</td>
                      <td className="py-3">{item.name}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">{item.price.toFixed(2)}</td>
                      <td className="py-3 text-right font-semibold">
                        {(item.quantity * item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-3">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-semibold">₹{receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-semibold">₹{receipt.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-primary pt-3">
                <span className="text-lg font-bold">Total Amount:</span>
                <span className="text-lg font-bold text-primary">
                  ₹{receipt.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
            <p className="font-semibold">Thank you for your business!</p>
            <p className="mt-2">This is a computer-generated receipt</p>
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
