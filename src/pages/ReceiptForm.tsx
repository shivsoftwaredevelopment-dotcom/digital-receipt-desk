import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, LogOut, FileText, History, User } from "lucide-react";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name required").max(100),
  quantity: z.number().positive("Quantity must be positive").max(10000),
  price: z.number().positive("Price must be positive").max(1000000),
});

const receiptSchema = z.object({
  customerName: z.string().trim().min(1, "Name required").max(100),
  mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, "Enter valid 10-digit mobile"),
  address: z.string().trim().min(1, "Address required").max(200),
  branch: z.string().min(1, "Branch required"),
  date: z.string().min(1, "Date required"),
  items: z.array(itemSchema).min(1, "Add at least one item"),
  taxRate: z.number().min(0).max(100),
});

interface Item {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

const ReceiptForm = () => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [branch, setBranch] = useState("Near Shivaji Chowk Banka");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<Item[]>([
    { id: "1", name: "", quantity: 1, price: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(18);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), name: "", quantity: 1, price: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const calculateTax = () => {
    return (calculateSubtotal() * taxRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = receiptSchema.parse({
        customerName,
        mobileNumber,
        address,
        branch,
        date,
        items: items.map(({ id, ...item }) => item),
        taxRate,
      });

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in to create receipts");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("receipts")
        .insert({
          user_id: user.id,
          customer_name: validated.customerName,
          mobile_number: validated.mobileNumber,
          address: validated.address,
          branch: validated.branch,
          receipt_date: validated.date,
          items: validated.items,
          subtotal: calculateSubtotal(),
          tax_amount: calculateTax(),
          total_amount: calculateTotal(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Receipt created successfully!");
      navigate(`/receipt/${data.id}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to create receipt");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Receipt</h1>
              <p className="text-sm text-muted-foreground">Fill in the details below</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/history")}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <Button variant="outline" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6 shadow-medium">
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
              <CardDescription>Enter customer information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Doe"
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number *</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter customer address"
                  maxLength={200}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch *</Label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Near Shivaji Chowk Banka">
                        Near Shivaji Chowk Banka
                      </SelectItem>
                      <SelectItem value="Nimiya Belhar Banka">
                        Nimiya Belhar Banka
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Receipt Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6 shadow-medium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Items</CardTitle>
                  <CardDescription>Add items to the receipt</CardDescription>
                </div>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Item Name *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        placeholder="Product name"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10000"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (₹) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        max="1000000"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, "price", Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-sm text-muted-foreground">
                      Total: ₹{(item.quantity * item.price).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mb-6 shadow-medium">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 rounded-lg bg-muted p-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax ({taxRate}%):</span>
                  <span>₹{calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total:</span>
                  <span className="text-primary">₹{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating Receipt..." : "Generate Receipt"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ReceiptForm;
