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
import { ArrowLeft, Shield, Users, FileText, Palette, Trash2, Save, Edit, Ban, Unlock, Eye, LogIn, ArrowRightLeft, Wrench, RotateCcw, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  profile_image_url: string | null;
  receipt_count: number;
  banned_until: string | null;
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
  custom_text: string;
  custom_text_left: string;
  custom_text_top: string;
  custom_text_color: string;
  custom_text_font_size: string;
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
    custom_text: "",
    custom_text_left: "50",
    custom_text_top: "50",
    custom_text_color: "#000000",
    custom_text_font_size: "14",
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferFromUser, setTransferFromUser] = useState<string>("");
  const [transferToUser, setTransferToUser] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [resettingData, setResettingData] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<string>("all");
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [credUser, setCredUser] = useState<User | null>(null);
  const [credPassword, setCredPassword] = useState("");
  const [sendingCred, setSendingCred] = useState(false);

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
      await Promise.all([fetchUsers(), fetchTemplates(), fetchMaintenanceMode()]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const callAdminAction = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await supabase.functions.invoke("admin-actions", { body });
    if (res.error) throw new Error(res.error.message);
    if (!res.data.success) throw new Error(res.data.error);
    return res.data;
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select(`id, email, full_name, phone, profile_image_url`);

    if (profiles) {
      const usersWithDetails = await Promise.all(
        profiles.map(async (profile) => {
          const { count } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);

          let bannedUntil = null;
          try {
            const result = await callAdminAction({ action: "get_user", userId: profile.id });
            bannedUntil = result.user?.banned_until || null;
          } catch {
            // ignore errors for individual user lookups
          }

          return {
            id: profile.id,
            email: profile.email || "No email",
            full_name: profile.full_name,
            phone: profile.phone,
            profile_image_url: profile.profile_image_url,
            receipt_count: count || 0,
            banned_until: bannedUntil,
          };
        })
      );
      setUsers(usersWithDetails);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditEmail(user.email);
    setEditPassword("");
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const body: Record<string, unknown> = { action: "update_user", userId: editingUser.id };
      if (editEmail && editEmail !== editingUser.email) body.email = editEmail;
      if (editPassword && editPassword.length >= 6) body.password = editPassword;
      if (!body.email && !body.password) {
        toast.error("No changes to update");
        return;
      }
      await callAdminAction(body);
      toast.success("User updated successfully");
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await callAdminAction({ action: "delete_user", userId });
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      await callAdminAction({ action: "block_user", userId });
      toast.success("User blocked successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      await callAdminAction({ action: "unblock_user", userId });
      toast.success("User unblocked successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewUser = (user: User) => {
    setViewingUser(user);
    setViewDialogOpen(true);
  };

  const handleDirectLogin = async (userId: string, userEmail: string) => {
    try {
      const result = await callAdminAction({ action: "generate_link", userId, email: userEmail });
      // Sign out admin first, then use the token to sign in as user
      await supabase.auth.signOut();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: result.properties.hashed_token,
        type: "magiclink",
      });
      if (error) throw error;
      toast.success(`Logged in as ${userEmail}`);
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTransferData = async () => {
    if (!transferFromUser || !transferToUser) {
      toast.error("दोनों users select करें");
      return;
    }
    if (transferFromUser === transferToUser) {
      toast.error("Source और Target user अलग होने चाहिए");
      return;
    }
    setTransferring(true);
    try {
      const result = await callAdminAction({
        action: "transfer_data",
        fromUserId: transferFromUser,
        toUserId: transferToUser,
      });
      toast.success(result.message);
      setTransferDialogOpen(false);
      setTransferFromUser("");
      setTransferToUser("");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTransferring(false);
    }
  };
  const handleDataReset = async () => {
    setResettingData(true);
    try {
      const body: Record<string, unknown> = {};
      if (resetTarget !== "all") body.userId = resetTarget;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("monthly-data-reset", { body });
      if (res.error) throw new Error(res.error.message);
      if (!res.data.success) throw new Error(res.data.error);

      toast.success(`✅ Data backup email sent & reset done! (${res.data.emails_sent} emails, ${res.data.data_reset} users reset)`);
      if (res.data.errors?.length) {
        toast.error(`⚠️ कुछ errors: ${res.data.errors.join(", ")}`);
      }
      setResetDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResettingData(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!credUser) return;
    if (!credPassword || credPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSendingCred(true);
    try {
      // First update the password
      await callAdminAction({
        action: "update_user",
        userId: credUser.id,
        password: credPassword,
      });
      // Then send credentials via email
      await callAdminAction({
        action: "send_credentials",
        targetEmail: credUser.email,
        targetPassword: credPassword,
      });
      toast.success(`Credentials sent to ${credUser.email}`);
      setCredDialogOpen(false);
      setCredPassword("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSendingCred(false);
    }
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("receipt_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setTemplates(data);
  };

  const fetchMaintenanceMode = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    setMaintenanceMode(data?.value === "true");
  };

  const toggleMaintenanceMode = async () => {
    const newValue = !maintenanceMode;
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({ value: String(newValue), updated_at: new Date().toISOString() })
        .eq("key", "maintenance_mode");
      if (error) throw error;
      setMaintenanceMode(newValue);
      toast.success(newValue ? "Maintenance mode ON - Users will see maintenance page" : "Maintenance mode OFF - Site is live");
    } catch (error: any) {
      toast.error(error.message);
    }
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
        custom_text: newTemplate.custom_text || "",
        custom_text_left: (newTemplate.custom_text_left || "50") + "%",
        custom_text_top: (newTemplate.custom_text_top || "50") + "%",
        custom_text_color: newTemplate.custom_text_color || "#000000",
        custom_text_font_size: (newTemplate.custom_text_font_size || "14") + "px",
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
        custom_text: "",
        custom_text_left: "50",
        custom_text_top: "50",
        custom_text_color: "#000000",
        custom_text_font_size: "14",
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="maintenance-toggle" className="text-sm cursor-pointer">
                Maintenance
              </Label>
              <Switch
                id="maintenance-toggle"
                checked={maintenanceMode}
                onCheckedChange={toggleMaintenanceMode}
              />
            </div>
            <Button variant="destructive" onClick={() => setResetDialogOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Data
            </Button>
            <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer Data
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
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
                        <TableCell>
                          {user.banned_until ? (
                            <span className="text-xs text-destructive font-medium">Blocked</span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">Active</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewUser(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <LogIn className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Login as this user?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    You will be logged in as {user.email}. Your current admin session will end.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDirectLogin(user.id, user.email)}>
                                    Login as User
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <Dialog open={editDialogOpen && editingUser?.id === user.id} onOpenChange={setEditDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit User</DialogTitle>
                                  <DialogDescription>Update user email and password</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email</Label>
                                    <Input
                                      id="edit-email"
                                      type="email"
                                      value={editEmail}
                                      onChange={(e) => setEditEmail(e.target.value)}
                                      placeholder="user@example.com"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-password">New Password (optional)</Label>
                                    <Input
                                      id="edit-password"
                                      type="password"
                                      value={editPassword}
                                      onChange={(e) => setEditPassword(e.target.value)}
                                      placeholder="Leave empty to keep current"
                                      minLength={6}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Password must be at least 6 characters
                                    </p>
                                  </div>
                                  <Button onClick={handleUpdateUser} className="w-full">
                                    Update User
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCredUser(user);
                                setCredPassword("");
                                setCredDialogOpen(true);
                              }}
                              title="Send Credentials"
                            >
                              <Send className="h-4 w-4" />
                            </Button>

                            {user.banned_until ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnblockUser(user.id)}
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Block User?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will prevent {user.email} from accessing the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleBlockUser(user.id)}>
                                      Block
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete {user.email} and all their data. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Send Credentials Dialog */}
            <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Credentials</DialogTitle>
                  <DialogDescription>
                    Set a password and send login details to {credUser?.email}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={credUser?.email || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cred-password">Password</Label>
                    <Input
                      id="cred-password"
                      type="text"
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      placeholder="Enter password (min 6 chars)"
                      minLength={6}
                    />
                  </div>
                  <Button
                    onClick={handleSendCredentials}
                    className="w-full"
                    disabled={sendingCred || credPassword.length < 6}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {sendingCred ? "Sending..." : "Update Password & Send Email"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* View User Dialog */}
            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>User Details</DialogTitle>
                  <DialogDescription>Complete user information</DialogDescription>
                </DialogHeader>
                {viewingUser && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={viewingUser.profile_image_url || ""} />
                        <AvatarFallback className="text-2xl">
                          {viewingUser.full_name?.[0] || viewingUser.email[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-semibold">{viewingUser.full_name || "No name set"}</h3>
                        <p className="text-sm text-muted-foreground">{viewingUser.email}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 border-t pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">User ID:</div>
                        <div className="text-sm text-muted-foreground">{viewingUser.id}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Email:</div>
                        <div className="text-sm text-muted-foreground">{viewingUser.email}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Full Name:</div>
                        <div className="text-sm text-muted-foreground">{viewingUser.full_name || "Not set"}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Phone:</div>
                        <div className="text-sm text-muted-foreground">{viewingUser.phone || "Not set"}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Total Receipts:</div>
                        <div className="text-sm text-muted-foreground">{viewingUser.receipt_count}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Account Status:</div>
                        <div className="text-sm">
                          {viewingUser.banned_until ? (
                            <span className="text-destructive font-medium">Blocked</span>
                          ) : (
                            <span className="text-green-600 font-medium">Active</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 border-t pt-4">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/admin/user/${viewingUser.id}/receipts`)}
                        className="flex-1"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Receipts
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setViewDialogOpen(false);
                          handleEditUser(viewingUser);
                        }}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit User
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Transfer Data Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transfer User Data</DialogTitle>
                  <DialogDescription>
                    एक user का सारा data (receipts + contacts) दूसरे user को transfer करें। यह action irreversible है।
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Source User (जिसका data transfer होगा)</Label>
                    <Select value={transferFromUser} onValueChange={setTransferFromUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Source user select करें" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email} ({u.receipt_count} receipts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target User (जिसको data मिलेगा)</Label>
                    <Select value={transferToUser} onValueChange={setTransferToUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Target user select करें" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter((u) => u.id !== transferFromUser).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email} ({u.receipt_count} receipts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {transferFromUser && transferToUser && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                      <p className="font-medium text-destructive">⚠️ Warning</p>
                      <p className="text-muted-foreground">
                        <strong>{users.find(u => u.id === transferFromUser)?.full_name || users.find(u => u.id === transferFromUser)?.email}</strong> का सारा data{" "}
                        <strong>{users.find(u => u.id === transferToUser)?.full_name || users.find(u => u.id === transferToUser)?.email}</strong> को transfer होगा।
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={handleTransferData}
                    disabled={!transferFromUser || !transferToUser || transferring}
                    className="w-full"
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {transferring ? "Transferring..." : "Transfer Data"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {/* Reset Data Dialog */}
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>🔄 Data Reset (Backup + Delete)</DialogTitle>
                  <DialogDescription>
                    पहले सारा data email पर भेजा जाएगा, फिर receipts और contacts delete होंगे। जब तक email नहीं जाएगा, data delete नहीं होगा।
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>किसका data reset करना है?</Label>
                    <Select value={resetTarget} onValueChange={setResetTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔴 सभी Users (All)</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email} ({u.receipt_count} receipts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                    <p className="font-medium text-destructive">⚠️ Important</p>
                    <p className="text-muted-foreground">
                      1. पहले सारा data CSV attachment के साथ email भेजा जाएगा<br/>
                      2. Email successfully भेजने के बाद ही data delete होगा<br/>
                      3. अगर email fail हो तो data safe रहेगा
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={resettingData}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {resettingData ? "Processing... Email भेज रहे हैं..." : "Backup Email & Reset Data"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>क्या आप sure हैं?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {resetTarget === "all"
                            ? "सभी users का data email पर भेजकर delete होगा।"
                            : `${users.find(u => u.id === resetTarget)?.full_name || users.find(u => u.id === resetTarget)?.email} का data email पर भेजकर delete होगा।`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDataReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          हां, Reset करें
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="templateName">Template Name *</Label>
                    <Input
                      id="templateName"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      placeholder="Enter template name"
                    />
                  </div>

                  {/* Custom Text Overlay Section */}
                  <div>
                    <h3 className="font-semibold mb-3 text-foreground">Custom Text Overlay (Receipt)</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label htmlFor="customText">Custom Text</Label>
                        <Input
                          id="customText"
                          value={newTemplate.custom_text}
                          onChange={(e) => setNewTemplate({ ...newTemplate, custom_text: e.target.value })}
                          placeholder="Enter custom text to show on receipt"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customLeft">Left Position (%)</Label>
                        <Input
                          id="customLeft"
                          type="number"
                          min="0"
                          max="100"
                          value={newTemplate.custom_text_left}
                          onChange={(e) => setNewTemplate({ ...newTemplate, custom_text_left: e.target.value })}
                          placeholder="50"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customTop">Top Position (%)</Label>
                        <Input
                          id="customTop"
                          type="number"
                          min="0"
                          max="100"
                          value={newTemplate.custom_text_top}
                          onChange={(e) => setNewTemplate({ ...newTemplate, custom_text_top: e.target.value })}
                          placeholder="50"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customColor">Text Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="customColor"
                            type="color"
                            value={newTemplate.custom_text_color}
                            onChange={(e) => setNewTemplate({ ...newTemplate, custom_text_color: e.target.value })}
                            className="w-16"
                          />
                          <Input
                            value={newTemplate.custom_text_color}
                            onChange={(e) => setNewTemplate({ ...newTemplate, custom_text_color: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="customFontSize">Font Size (px)</Label>
                        <Input
                          id="customFontSize"
                          type="number"
                          min="8"
                          max="72"
                          value={newTemplate.custom_text_font_size}
                          onChange={(e) => setNewTemplate({ ...newTemplate, custom_text_font_size: e.target.value })}
                          placeholder="14"
                        />
                      </div>
                    </div>

                    {/* Live Preview Box */}
                    {newTemplate.custom_text && (
                      <div className="mt-4">
                        <Label>Preview</Label>
                        <div
                          className="relative mt-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20"
                          style={{ width: '100%', height: '200px' }}
                        >
                          <span
                            className="absolute font-semibold whitespace-nowrap"
                            style={{
                              left: `${newTemplate.custom_text_left || 50}%`,
                              top: `${newTemplate.custom_text_top || 50}%`,
                              color: newTemplate.custom_text_color || '#000000',
                              fontSize: `${newTemplate.custom_text_font_size || 14}px`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            {newTemplate.custom_text}
                          </span>
                        </div>
                      </div>
                    )}
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
                          {template.custom_text && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Text: "<span className="font-medium" style={{ color: template.custom_text_color }}>{template.custom_text}</span>" 
                              — Left: {template.custom_text_left}, Top: {template.custom_text_top}, Size: {template.custom_text_font_size}
                            </div>
                          )}
                          {/* Preview */}
                          {template.custom_text && (
                            <div className="relative mt-2 rounded border border-dashed border-muted-foreground/30 bg-muted/10" style={{ width: '100%', height: '120px' }}>
                              <span
                                className="absolute font-semibold whitespace-nowrap"
                                style={{
                                  left: template.custom_text_left || '50%',
                                  top: template.custom_text_top || '50%',
                                  color: template.custom_text_color || '#000',
                                  fontSize: template.custom_text_font_size || '14px',
                                  transform: 'translate(-50%, -50%)',
                                }}
                              >
                                {template.custom_text}
                              </span>
                            </div>
                          )}
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