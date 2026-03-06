import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, LogOut, Search, Trash2, Users, Phone, User } from "lucide-react";

interface Contact {
  id: string;
  customer_name: string;
  mobile_number: string;
  created_at: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchContacts();
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

  const filtered = contacts.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile_number.includes(search)
  );

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
          <div className="flex gap-2">
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
    </div>
  );
};

export default Contacts;
