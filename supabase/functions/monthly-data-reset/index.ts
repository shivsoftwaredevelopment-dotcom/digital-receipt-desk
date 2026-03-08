import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPass) {
      throw new Error("Gmail credentials not configured");
    }

    // Check if specific userId provided (manual admin trigger)
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.userId || null;
    } catch {
      // No body = process all users (cron)
    }

    const now = new Date();
    const monthName = now.toLocaleString("en", { month: "long", year: "numeric" });

    // Get profiles
    let profilesQuery = supabase.from("profiles").select("id, email, full_name");
    if (targetUserId) {
      profilesQuery = profilesQuery.eq("id", targetUserId);
    }
    const { data: profiles, error: profileError } = await profilesQuery;
    if (profileError) throw profileError;

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPass,
        },
      },
    });

    let emailsSent = 0;
    let dataReset = 0;
    const errors: string[] = [];

    for (const profile of (profiles || [])) {
      if (!profile.email) continue;

      try {
        // Fetch ALL receipts for this user
        const { data: receipts, error: recError } = await supabase
          .from("receipts")
          .select("*")
          .eq("user_id", profile.id)
          .order("receipt_date", { ascending: false });

        if (recError) throw recError;

        // Fetch ALL contacts for this user
        const { data: contacts, error: conError } = await supabase
          .from("contacts")
          .select("*")
          .eq("user_id", profile.id);

        if (conError) throw conError;

        const receiptCount = receipts?.length || 0;
        const contactCount = contacts?.length || 0;

        if (receiptCount === 0 && contactCount === 0) continue;

        // Build Receipts CSV
        let receiptCSV = "";
        if (receipts && receipts.length > 0) {
          receiptCSV = "Sr No,Date,Customer Name,Mobile Number,Branch,Address,Age,BP,Pulse,Subtotal,Tax,Total Amount\n";
          receiptCSV += receipts.map((r, i) =>
            `${i + 1},"${r.receipt_date}","${r.customer_name}","${r.mobile_number}","${r.branch}","${r.address || ''}","${r.age || ''}","${r.bp || ''}","${r.pulse || ''}",${r.subtotal},${r.tax_amount},${r.total_amount}`
          ).join("\n");
        }

        // Build Contacts CSV
        let contactCSV = "";
        if (contacts && contacts.length > 0) {
          contactCSV = "Sr No,Customer Name,Mobile Number,Created At\n";
          contactCSV += contacts.map((c, i) =>
            `${i + 1},"${c.customer_name}","${c.mobile_number}","${c.created_at || ''}"`
          ).join("\n");
        }

        // Calculate totals
        const totalIncome = receipts?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0;

        // Group by branch
        const branchTotals: Record<string, { count: number; total: number }> = {};
        for (const r of (receipts || [])) {
          if (!branchTotals[r.branch]) branchTotals[r.branch] = { count: 0, total: 0 };
          branchTotals[r.branch].count++;
          branchTotals[r.branch].total += Number(r.total_amount);
        }

        const branchRows = Object.entries(branchTotals)
          .map(([branch, data]) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${branch}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${data.count}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${data.total.toFixed(2)}</td>
            </tr>`)
          .join("");

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#dc2626;color:#ffffff;padding:20px;border-radius:8px 8px 0 0">
              <h2 style="margin:0">🔄 Monthly Data Backup & Reset</h2>
              <p style="margin:4px 0 0;opacity:0.8">${monthName} - Complete Data Before Reset</p>
            </div>
            <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p>Hi ${profile.full_name || "User"},</p>
              <p style="color:#6b7280">⚠️ <strong>Your data has been reset.</strong> This email contains your complete backup before the reset.</p>

              <div style="display:flex;gap:12px;margin:16px 0">
                <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:8px;text-align:center">
                  <p style="margin:0;font-size:24px;font-weight:bold;color:#16a34a">₹${totalIncome.toFixed(2)}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Total Income</p>
                </div>
                <div style="flex:1;background:#eff6ff;padding:12px;border-radius:8px;text-align:center">
                  <p style="margin:0;font-size:24px;font-weight:bold;color:#2563eb">${receiptCount}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Receipts</p>
                </div>
                <div style="flex:1;background:#fef3c7;padding:12px;border-radius:8px;text-align:center">
                  <p style="margin:0;font-size:24px;font-weight:bold;color:#d97706">${contactCount}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Contacts</p>
                </div>
              </div>

              ${branchRows ? `
              <h3 style="margin:16px 0 8px;color:#1a1a1a">Branch Performance</h3>
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="background:#f3f4f6">
                    <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #d1d5db">Branch</th>
                    <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #d1d5db">Receipts</th>
                    <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #d1d5db">Income</th>
                  </tr>
                </thead>
                <tbody>${branchRows}</tbody>
              </table>` : ''}

              <p style="margin-top:16px;color:#6b7280;font-size:13px">
                📎 CSV files attached:<br/>
                ${receiptCount > 0 ? '1. <strong>all-receipts.csv</strong> - Complete receipt history<br/>' : ''}
                ${contactCount > 0 ? `${receiptCount > 0 ? '2' : '1'}. <strong>all-contacts.csv</strong> - All contacts<br/>` : ''}
              </p>

              <p style="margin-top:16px;color:#9ca3af;font-size:12px">
                Auto-generated by Digital Receipt Desk on ${now.toLocaleDateString()}
              </p>
            </div>
          </div>`;

        // Build attachments
        const attachments: Array<{ filename: string; content: string; encoding: "base64"; contentType: string }> = [];
        if (receiptCSV) {
          attachments.push({
            filename: `all-receipts-backup-${now.toISOString().slice(0, 10)}.csv`,
            content: base64Encode(new TextEncoder().encode(receiptCSV)),
            encoding: "base64" as const,
            contentType: "text/csv",
          });
        }
        if (contactCSV) {
          attachments.push({
            filename: `all-contacts-backup-${now.toISOString().slice(0, 10)}.csv`,
            content: base64Encode(new TextEncoder().encode(contactCSV)),
            encoding: "base64" as const,
            contentType: "text/csv",
          });
        }

        // SEND EMAIL FIRST
        await client.send({
          from: gmailUser,
          to: profile.email,
          subject: `🔄 Monthly Data Backup & Reset - ${monthName}`,
          content: "auto",
          html: html,
          attachments: attachments,
        });

        emailsSent++;

        // ONLY AFTER EMAIL SUCCESS → DELETE DATA
        if (receiptCount > 0) {
          const { error: delRecErr } = await supabase
            .from("receipts")
            .delete()
            .eq("user_id", profile.id);
          if (delRecErr) throw delRecErr;
        }

        if (contactCount > 0) {
          const { error: delConErr } = await supabase
            .from("contacts")
            .delete()
            .eq("user_id", profile.id);
          if (delConErr) throw delConErr;
        }

        dataReset++;
      } catch (userError) {
        const msg = userError instanceof Error ? userError.message : "Unknown error";
        errors.push(`${profile.email}: ${msg}`);
        console.error(`Error processing ${profile.email}:`, userError);
        // DO NOT reset data if email failed
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: emailsSent,
        data_reset: dataReset,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in monthly data reset:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
