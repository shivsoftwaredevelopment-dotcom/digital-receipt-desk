import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, FileText, User, LogOut, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface Receipt {
  total_amount: number;
  receipt_date: string;
  branch: string;
}

interface DashboardStats {
  totalIncome: number;
  totalReceipts: number;
  branchData: { branch: string; amount: number; count: number }[];
  monthlyData: { month: string; amount: number }[];
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalReceipts: 0,
    branchData: [],
    monthlyData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("total_amount, receipt_date, branch");

      if (error) throw error;

      const receipts = data as Receipt[];
      const totalIncome = receipts.reduce((sum, r) => sum + Number(r.total_amount), 0);
      
      // Branch analysis
      const branchMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(r => {
        const current = branchMap.get(r.branch) || { amount: 0, count: 0 };
        branchMap.set(r.branch, {
          amount: current.amount + Number(r.total_amount),
          count: current.count + 1
        });
      });
      const branchData = Array.from(branchMap.entries()).map(([branch, data]) => ({
        branch,
        amount: data.amount,
        count: data.count
      }));

      // Monthly analysis (last 6 months)
      const monthMap = new Map<string, number>();
      receipts.forEach(r => {
        const date = new Date(r.receipt_date);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Number(r.total_amount));
      });
      const monthlyData = Array.from(monthMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .slice(-6);

      setStats({
        totalIncome,
        totalReceipts: receipts.length,
        branchData,
        monthlyData
      });
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
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
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
           <p className="text-3xl font-bold text-primary">Devlop By- Raunak Kumar</p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/receipt-form")}>
              <Plus className="mr-2 h-4 w-4" />
              New Receipt
            </Button>
            <Button variant="outline" onClick={() => navigate("/history")}>
              <FileText className="mr-2 h-4 w-4" />
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

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalIncome.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReceipts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Receipt Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{stats.totalReceipts > 0 ? (stats.totalIncome / stats.totalReceipts).toFixed(2) : '0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Monthly Income Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  amount: {
                    label: "Income",
                    color: "hsl(var(--chart-1))"
                  }
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Branch Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Branch Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  branch: {
                    label: "Branch",
                    color: "hsl(var(--chart-2))"
                  }
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.branchData}
                      dataKey="amount"
                      nameKey="branch"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `₹${entry.amount.toFixed(0)}`}
                    >
                      {stats.branchData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-4 space-y-2">
                {stats.branchData.map((branch, index) => (
                  <div key={branch.branch} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span>{branch.branch}</span>
                    </div>
                    <span className="font-semibold">{branch.count} receipts</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
