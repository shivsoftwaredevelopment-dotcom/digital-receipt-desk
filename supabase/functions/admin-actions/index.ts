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

    const body = await req.json();
    const { action, userId, email, password } = body;

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
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: email,
        });
        if (error) throw error;
        
        return new Response(
          JSON.stringify({
            success: true,
            properties: data.properties,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "send_credentials": {
        const targetEmail = body.targetEmail;
        const targetPassword = body.targetPassword;
        const siteUrl = body.siteUrl || "https://digital-receipt-desk.lovable.app";

        if (!targetEmail) throw new Error("Email is required");
        if (!targetPassword) throw new Error("Password is required");

        const gmailUser = Deno.env.get("GMAIL_USER");
        const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
        if (!gmailUser || !gmailPass) throw new Error("Email service not configured");

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1a1a1a; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0;">🔐 Your Login Credentials</h1>
            </div>
            <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px;">Hello,</p>
              <p>Your account has been set up. Here are your login details:</p>
              <div style="background: #ffffff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 8px 0;"><strong>📧 Email:</strong> ${targetEmail}</p>
                <p style="margin: 8px 0;"><strong>🔑 Password:</strong> ${targetPassword}</p>
                <p style="margin: 8px 0;"><strong>🌐 Login URL:</strong> <a href="${siteUrl}/auth" style="color: #3b82f6;">${siteUrl}/auth</a></p>
              </div>
              <p style="color: #666; font-size: 13px;">⚠️ Please change your password after first login for security.</p>
              <p style="margin-top: 20px;">Best regards,<br/>Admin Team</p>
            </div>
          </div>
        `;

        const emailResponse = await fetch("https://smtp-relay.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: gmailUser, name: "Digital Receipt System" },
            to: [{ email: targetEmail }],
            subject: "Your Login Credentials - Digital Receipt System",
            htmlContent: emailHtml,
          }),
        });

        // Fallback: use raw SMTP via Gmail
        if (!emailResponse.ok) {
          // Use Deno's built-in fetch to send via a simple email API
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          const client = new SMTPClient({
            connection: {
              hostname: "smtp.gmail.com",
              port: 465,
              tls: true,
              auth: { username: gmailUser, password: gmailPass },
            },
          });

          await client.send({
            from: gmailUser,
            to: targetEmail,
            subject: "Your Login Credentials - Digital Receipt System",
            content: "auto",
            html: emailHtml,
          });

          await client.close();
        }

        return new Response(
          JSON.stringify({ success: true, message: `Credentials sent to ${targetEmail}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "transfer_data": {
        const sourceId = body.fromUserId;
        const targetId = body.toUserId;

        if (!sourceId || !targetId) throw new Error("Both source and target user IDs are required");
        if (sourceId === targetId) throw new Error("Source and target users must be different");

        // Transfer receipts
        const { data: receiptData, error: receiptError } = await supabaseAdmin
          .from("receipts")
          .update({ user_id: targetId })
          .eq("user_id", sourceId)
          .select("id");
        if (receiptError) throw receiptError;

        // Transfer contacts
        const { data: contactData, error: contactError } = await supabaseAdmin
          .from("contacts")
          .update({ user_id: targetId })
          .eq("user_id", sourceId)
          .select("id");
        if (contactError) throw contactError;

        return new Response(
          JSON.stringify({
            success: true,
            message: `Transferred ${receiptData?.length || 0} receipts and ${contactData?.length || 0} contacts successfully`,
            receipts_transferred: receiptData?.length || 0,
            contacts_transferred: contactData?.length || 0,
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
