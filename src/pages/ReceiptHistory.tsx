import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Eye, Trash2, LogOut, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Receipt {
  id: string;
  customer_name: string;
  mobile_number: string;
  receipt_date: string;
  total_amount: number;
  branch: string;
  created_at: string;
}

const ReceiptHistory = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, customer_name, mobile_number, receipt_date, total_amount, branch, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts(data as Receipt[]);
      setFilteredReceipts(data as Receipt[]);
    } catch (error) {
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = receipts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(receipt => 
        receipt.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.mobile_number.includes(searchTerm) ||
        new Date(receipt.receipt_date).toLocaleDateString().includes(searchTerm)
      );
    }

    // Branch filter
    if (branchFilter !== "all") {
      filtered = filtered.filter(receipt => receipt.branch === branchFilter);
    }

    setFilteredReceipts(filtered);
  }, [searchTerm, branchFilter, receipts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this receipt?")) return;

    try {
      const { error } = await supabase.from("receipts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Receipt deleted successfully");
      fetchReceipts();
    } catch (error) {
      toast.error("Failed to delete receipt");
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-primary">Receipt History</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              <Button onClick={() => navigate("/receipt-form")}>
                New Receipt
              </Button>
              <Button variant="outline" onClick={() => navigate("/profile")}>
                Profile
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, mobile, or date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filter by branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                <SelectItem value="Near Shivaji Chowk Banka">Near Shivaji Chowk Banka</SelectItem>
                <SelectItem value="Nimiya Belhar Banka">Nimiya Belhar Banka</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {receipts.length === 0 ? "No receipts found" : "No matching receipts found"}
            </p>
            <Button onClick={() => navigate("/receipt-form")} className="mt-4">
              Create New Receipt
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card shadow-strong">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      {new Date(receipt.receipt_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {receipt.customer_name}
                    </TableCell>
                    <TableCell>{receipt.mobile_number}</TableCell>
                    <TableCell>{receipt.branch}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{receipt.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/receipt/${receipt.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(receipt.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptHistory;
