import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Shield, Users, FileText, Palette, Trash2, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  profile_image_url: string | null;
  receipt_count: number;
}

interface Template {
  id: string;
  name: string;
  header_bg_color: string;
  header_text_color: string;
  body_bg_color: string;
  body_text_color: string;
  accent_color: string;
  font_family: string;
  is_default: boolean;
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState<Partial<Template>>({
    name: "",
    header_bg_color: "#1a1a1a",
    header_text_color: "#ffffff",
    body_bg_color: "#ffffff",
    body_text_color: "#000000",
    accent_color: "#3b82f6",
    font_family: "Arial",
  });

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast.error("Access denied - Admin only");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await Promise.all([fetchUsers(), fetchTemplates()]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        profile_image_url
      `);

    if (profiles) {
      const usersWithDetails = await Promise.all(
        profiles.map(async (profile) => {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          const { count } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);

          return {
            id: profile.id,
            email: authUser?.user?.email || "",
            full_name: profile.full_name,
            phone: profile.phone,
            profile_image_url: profile.profile_image_url,
            receipt_count: count || 0,
          };
        })
      );
      setUsers(usersWithDetails);
    }
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("receipt_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setTemplates(data);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name) {
      toast.error("Template name is required");
      return;
    }

    try {
      const templateData = {
        name: newTemplate.name,
        header_bg_color: newTemplate.header_bg_color || "#1a1a1a",
        header_text_color: newTemplate.header_text_color || "#ffffff",
        body_bg_color: newTemplate.body_bg_color || "#ffffff",
        body_text_color: newTemplate.body_text_color || "#000000",
        accent_color: newTemplate.accent_color || "#3b82f6",
        font_family: newTemplate.font_family || "Arial",
      };

      const { error } = await supabase
        .from("receipt_templates")
        .insert([templateData]);

      if (error) throw error;
      toast.success("Template created successfully");
      fetchTemplates();
      setNewTemplate({
        name: "",
        header_bg_color: "#1a1a1a",
        header_text_color: "#ffffff",
        body_bg_color: "#ffffff",
        body_text_color: "#000000",
        accent_color: "#3b82f6",
        font_family: "Arial",
      });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("receipt_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">Admin Panel</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Palette className="mr-2 h-4 w-4" />
              Receipt Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Receipts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Avatar>
                            <AvatarImage src={user.profile_image_url || ""} />
                            <AvatarFallback>{user.full_name?.[0] || user.email[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>{user.full_name || "Not set"}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.phone || "Not set"}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            onClick={() => navigate(`/admin/user/${user.id}/receipts`)}
                          >
                            {user.receipt_count} receipts
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="templateName">Template Name</Label>
                      <Input
                        id="templateName"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fontFamily">Font Family</Label>
                      <Input
                        id="fontFamily"
                        value={newTemplate.font_family}
                        onChange={(e) => setNewTemplate({ ...newTemplate, font_family: e.target.value })}
                        placeholder="Arial"
                      />
                    </div>
                    <div>
                      <Label htmlFor="headerBg">Header Background</Label>
                      <div className="flex gap-2">
                        <Input
                          id="headerBg"
                          type="color"
                          value={newTemplate.header_bg_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, header_bg_color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={newTemplate.header_bg_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, header_bg_color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="headerText">Header Text</Label>
                      <div className="flex gap-2">
                        <Input
                          id="headerText"
                          type="color"
                          value={newTemplate.header_text_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, header_text_color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={newTemplate.header_text_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, header_text_color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bodyBg">Body Background</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bodyBg"
                          type="color"
                          value={newTemplate.body_bg_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, body_bg_color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={newTemplate.body_bg_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, body_bg_color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bodyText">Body Text</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bodyText"
                          type="color"
                          value={newTemplate.body_text_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, body_text_color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={newTemplate.body_text_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, body_text_color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="accent">Accent Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="accent"
                          type="color"
                          value={newTemplate.accent_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, accent_color: e.target.value })}
                          className="w-16"
                        />
                        <Input
                          value={newTemplate.accent_color}
                          onChange={(e) => setNewTemplate({ ...newTemplate, accent_color: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleCreateTemplate}>
                    <Save className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Existing Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          <div className="mt-2 flex gap-2">
                            <div className="flex items-center gap-1">
                              <div className="h-6 w-6 rounded border" style={{ backgroundColor: template.header_bg_color }} />
                              <div className="h-6 w-6 rounded border" style={{ backgroundColor: template.body_bg_color }} />
                              <div className="h-6 w-6 rounded border" style={{ backgroundColor: template.accent_color }} />
                            </div>
                            <span className="text-sm text-muted-foreground">{template.font_family}</span>
                          </div>
                        </div>
                        {!template.is_default && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;