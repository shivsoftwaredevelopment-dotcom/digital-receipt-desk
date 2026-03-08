import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, LogOut, Search, Trash2, Users, Phone, User,
  Download, Mail, FileSpreadsheet, CalendarDays
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Contact {
  id: string;
  customer_name: string;
  mobile_number: string;
  created_at: string;
}

interface Receipt {
  customer_name: string;
  mobile_number: string;
  branch: string;
  receipt_date: string;
  total_amount: number;
  items: any;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [sending, setSending] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchContacts();
    fetchReceipts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("customer_name", { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("customer_name, mobile_number, branch, receipt_date, total_amount, items");
      if (error) throw error;
      setReceipts(data || []);
    } catch {
      // silent
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
      setContacts(contacts.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Get unique branches & months from receipts
  const branches = [...new Set(receipts.map((r) => r.branch))];
  const months = [...new Set(receipts.map((r) => {
    const d = new Date(r.receipt_date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }))].sort().reverse();

  // Filter contacts based on receipts for branch/month/date range
  const getFilteredExportData = () => {
    let filtered = receipts;
    if (selectedBranch !== "all") {
      filtered = filtered.filter((r) => r.branch === selectedBranch);
    }
    if (selectedMonth !== "all") {
      filtered = filtered.filter((r) => {
        const d = new Date(r.receipt_date);
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return m === selectedMonth;
      });
    }
    if (dateFrom) {
      filtered = filtered.filter((r) => r.receipt_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((r) => r.receipt_date <= dateTo);
    }
    // Deduplicate by mobile number
    const seen = new Set<string>();
    return filtered.filter((r) => {
      if (seen.has(r.mobile_number)) return false;
      seen.add(r.mobile_number);
      return true;
    });
  };

  const exportToCSV = () => {
    const data = getFilteredExportData();
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    const header = "Customer Name,Mobile Number,Branch\n";
    const rows = data.map((r) => `"${r.customer_name}","${r.mobile_number}","${r.branch}"`).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const monthLabel = selectedMonth === "all" ? "all-months" : selectedMonth;
    const branchLabel = selectedBranch === "all" ? "all-branches" : selectedBranch.replace(/\s+/g, "-");
    a.download = `contacts-${branchLabel}-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  const sendToEmail = async () => {
    const data = getFilteredExportData();
    if (data.length === 0) {
      toast.error("No data to send");
      return;
    }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get profile email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single();

      const toEmail = profile?.email || user.email;

      const { data: result, error } = await supabase.functions.invoke("send-contacts-email", {
        body: {
          to_email: toEmail,
          contacts: data.map((r) => ({
            customer_name: r.customer_name,
            mobile_number: r.mobile_number,
            branch: r.branch,
          })),
          branch_filter: selectedBranch,
          month_filter: selectedMonth,
          date_from: dateFrom || "all",
          date_to: dateTo || "all",
        },
      });

      if (error) throw error;
      toast.success(`Contact details sent to ${toEmail}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const filtered = contacts.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile_number.includes(search)
  );

  const exportData = getFilteredExportData();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Contacts</h1>
              <p className="text-sm text-muted-foreground">
                {contacts.length} saved contacts
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" onClick={() => setShowExport(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? "No contacts found" : "No contacts saved yet. Create a receipt to auto-save contacts."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((contact) => (
              <Card key={contact.id} className="shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{contact.customer_name}</p>
                      <a
                        href={`tel:${contact.mobile_number}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.mobile_number}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteContact(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Contacts</DialogTitle>
            <DialogDescription>
              Filter by branch, month, or custom date range, then download CSV or send to your email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Branch</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> From Date
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> To Date
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground mb-2">
                {exportData.length} contacts found
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {exportData.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                    <span className="font-medium">{r.customer_name}</span>
                    <span className="text-muted-foreground">{r.mobile_number}</span>
                  </div>
                ))}
                {exportData.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No contacts for selected filters</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button className="flex-1" onClick={exportToCSV} disabled={exportData.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={sendToEmail}
                disabled={exportData.length === 0 || sending}
              >
                <Mail className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send to Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contacts;
