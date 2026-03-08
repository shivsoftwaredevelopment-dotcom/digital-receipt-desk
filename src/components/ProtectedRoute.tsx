import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Maintenance from "@/pages/Maintenance";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          checkAdminAndMaintenance(session.user.id);
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkAdminAndMaintenance(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminAndMaintenance = async (userId: string) => {
    const [roleResult, settingsResult] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle(),
    ]);

    setIsAdmin(!!roleResult.data);
    setMaintenanceMode(settingsResult.data?.value === "true");
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (maintenanceMode && !isAdmin) {
    return <Maintenance />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
