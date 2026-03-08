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

    // Calculate last 7 days range
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    // Get all users with profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name");

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

    for (const profile of (profiles || [])) {
      if (!profile.email) continue;

      // Get receipts for this user for last week
      const { data: receipts, error: recError } = await supabase
        .from("receipts")
        .select("customer_name, mobile_number, branch, receipt_date, total_amount")
        .eq("user_id", profile.id)
        .gte("receipt_date", startDate)
        .lte("receipt_date", endDate)
        .order("receipt_date", { ascending: false });

      if (recError || !receipts || receipts.length === 0) continue;

      // Build CSV for receipts
      const receiptCSVHeader = "Sr No,Date,Customer Name,Mobile Number,Branch,Amount\n";
      const receiptCSVRows = receipts
        .map((r, i) => `${i + 1},"${r.receipt_date}","${r.customer_name}","${r.mobile_number}","${r.branch}",${r.total_amount}`)
        .join("\n");
      const receiptCSV = receiptCSVHeader + receiptCSVRows;

      // Build unique contacts CSV
      const seen = new Set<string>();
      const uniqueContacts = receipts.filter((r) => {
        if (seen.has(r.mobile_number)) return false;
        seen.add(r.mobile_number);
        return true;
      });

      const contactCSVHeader = "Sr No,Customer Name,Mobile Number,Branch\n";
      const contactCSVRows = uniqueContacts
        .map((c, i) => `${i + 1},"${c.customer_name}","${c.mobile_number}","${c.branch}"`)
        .join("\n");
      const contactCSV = contactCSVHeader + contactCSVRows;

      // Total income
      const totalIncome = receipts.reduce((sum, r) => sum + Number(r.total_amount), 0);

      // Group by branch
      const branchTotals: Record<string, { count: number; total: number }> = {};
      for (const r of receipts) {
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

      const weekLabel = `${startDate} to ${endDate}`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1a1a;color:#ffffff;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">📊 Weekly Receipt Report</h2>
            <p style="margin:4px 0 0;opacity:0.8">${weekLabel}</p>
          </div>
          <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>Hi ${profile.full_name || "User"},</p>
            <p style="color:#6b7280">Here is your weekly summary:</p>

            <div style="display:flex;gap:12px;margin:16px 0">
              <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:8px;text-align:center">
                <p style="margin:0;font-size:24px;font-weight:bold;color:#16a34a">₹${totalIncome.toFixed(2)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Total Income</p>
              </div>
              <div style="flex:1;background:#eff6ff;padding:12px;border-radius:8px;text-align:center">
                <p style="margin:0;font-size:24px;font-weight:bold;color:#2563eb">${receipts.length}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Receipts</p>
              </div>
              <div style="flex:1;background:#fef3c7;padding:12px;border-radius:8px;text-align:center">
                <p style="margin:0;font-size:24px;font-weight:bold;color:#d97706">${uniqueContacts.length}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Unique Contacts</p>
              </div>
            </div>

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
            </table>

            <p style="margin-top:16px;color:#6b7280;font-size:13px">
              📎 Two CSV files attached:<br/>
              1. <strong>weekly-receipts.csv</strong> - All receipt details<br/>
              2. <strong>weekly-contacts.csv</strong> - Unique customer contacts
            </p>

            <p style="margin-top:16px;color:#9ca3af;font-size:12px">
              Auto-generated by Digital Receipt Desk on ${now.toLocaleDateString()}
            </p>
          </div>
        </div>`;

      await client.send({
        from: gmailUser,
        to: profile.email,
        subject: `Weekly Receipt Report - ${weekLabel}`,
        content: "auto",
        html: html,
        attachments: [
          {
            filename: `weekly-receipts-${startDate}-to-${endDate}.csv`,
            content: base64Encode(new TextEncoder().encode(receiptCSV)),
            encoding: "base64" as const,
            contentType: "text/csv",
          },
          {
            filename: `weekly-contacts-${startDate}-to-${endDate}.csv`,
            content: base64Encode(new TextEncoder().encode(contactCSV)),
            encoding: "base64" as const,
            contentType: "text/csv",
          },
        ],
      });

      emailsSent++;
    }

    await client.close();

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in weekly email:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
