import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Access denied - Admin only");

    const { action, userId, email, password } = await req.json();

    switch (action) {
      case "delete_user": {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        // Profile and roles will cascade delete
        return new Response(
          JSON.stringify({ success: true, message: "User deleted successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "block_user": {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h", // ~100 years
        });
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, message: "User blocked successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unblock_user": {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, message: "User unblocked successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_user": {
        const updates: Record<string, unknown> = {};
        if (email) updates.email = email;
        if (password && password.length >= 6) updates.password = password;

        if (Object.keys(updates).length === 0) {
          throw new Error("No valid updates provided");
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
        if (error) throw error;

        // Also update email in profiles table if email changed
        if (email) {
          await supabaseAdmin
            .from("profiles")
            .update({ email })
            .eq("id", userId);
        }

        return new Response(
          JSON.stringify({ success: true, message: "User updated successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_user": {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (error) throw error;
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              banned_until: data.user.banned_until,
              created_at: data.user.created_at,
              last_sign_in_at: data.user.last_sign_in_at,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "generate_link": {
        // Generate a magic link for admin to login as user
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: email,
        });
        if (error) throw error;
        
        return new Response(
          JSON.stringify({
            success: true,
            // Return the hashed token properties for client-side session
            properties: data.properties,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Admin action error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
