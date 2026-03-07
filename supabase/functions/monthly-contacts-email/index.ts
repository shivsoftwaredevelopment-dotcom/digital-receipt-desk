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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPass) {
      throw new Error("Gmail credentials not configured");
    }

    // Get current month info
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, current month
    // We want last month's data
    const lastMonth = month === 0 ? 11 : month - 1;
    const lastMonthYear = month === 0 ? year - 1 : year;
    const startDate = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;

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

      // Get receipts for this user for last month
      const { data: receipts, error: recError } = await supabase
        .from("receipts")
        .select("customer_name, mobile_number, branch, receipt_date")
        .eq("user_id", profile.id)
        .gte("receipt_date", startDate)
        .lt("receipt_date", endDate);

      if (recError || !receipts || receipts.length === 0) continue;

      // Deduplicate by mobile
      const seen = new Set<string>();
      const uniqueContacts = receipts.filter((r) => {
        if (seen.has(r.mobile_number)) return false;
        seen.add(r.mobile_number);
        return true;
      });

      // Group by branch
      const branchGroups: Record<string, typeof uniqueContacts> = {};
      for (const c of uniqueContacts) {
        if (!branchGroups[c.branch]) branchGroups[c.branch] = [];
        branchGroups[c.branch].push(c);
      }

      const monthName = new Date(lastMonthYear, lastMonth).toLocaleString("en", { month: "long", year: "numeric" });

      let branchSections = "";
      for (const [branch, contacts] of Object.entries(branchGroups)) {
        const rows = contacts
          .map(
            (c, i) => `
          <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${c.customer_name}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${c.mobile_number}</td>
          </tr>`
          )
          .join("");

        branchSections += `
          <h3 style="margin:16px 0 8px;color:#1a1a1a">${branch} (${contacts.length} contacts)</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #d1d5db">#</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #d1d5db">Name</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #d1d5db">Mobile</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1a1a;color:#ffffff;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Monthly Contact Report</h2>
            <p style="margin:4px 0 0;opacity:0.8">${monthName} - Branch-wise Summary</p>
          </div>
          <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>Hi ${profile.full_name || "User"},</p>
            <p style="color:#6b7280">Here is your monthly customer contact summary with <strong>${uniqueContacts.length}</strong> unique contacts.</p>
            ${branchSections}
            <p style="margin-top:16px;color:#9ca3af;font-size:12px">
              Auto-generated by Digital Receipt Desk on ${now.toLocaleDateString()}
            </p>
          </div>
        </div>`;

      await client.send({
        from: gmailUser,
        to: profile.email,
        subject: `Monthly Contact Report - ${monthName}`,
        content: "auto",
        html: html,
      });

      emailsSent++;
    }

    await client.close();

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in monthly email:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
