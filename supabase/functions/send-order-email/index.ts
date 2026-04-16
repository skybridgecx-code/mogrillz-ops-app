import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "MoGrillz <orders@mogrillzva.com>";

interface OrderEmailPayload {
  to: string;
  subject: string;
  template: string;
  data: {
    customerName: string;
    orderNumber: string;
    totalFormatted: string;
    itemsText: string;
    fulfillmentMethod: string;
    serviceWindow: string;
    supportEmail: string;
  };
}

function buildHtmlEmail(data: OrderEmailPayload["data"]): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#E8B84B;font-size:32px;margin:0;">MoGrillz</h1>
      <p style="color:#9A7840;font-size:12px;letter-spacing:2px;margin-top:8px;">PREMIUM HALAL KITCHEN</p>
    </div>
    
    <div style="background-color:#131313;border:1px solid #2A1A00;border-radius:4px;padding:32px;">
      <h2 style="color:#EEEAE0;font-size:20px;margin:0 0 8px 0;">Order Confirmed</h2>
      <p style="color:#C08030;font-size:14px;margin:0 0 24px 0;">Thank you, ${data.customerName}!</p>
      
      <div style="border-top:1px solid #2A1A00;border-bottom:1px solid #2A1A00;padding:20px 0;margin-bottom:24px;">
        <p style="color:#9A7840;font-size:11px;letter-spacing:1px;margin:0 0 4px 0;">ORDER NUMBER</p>
        <p style="color:#E8B84B;font-size:18px;font-weight:bold;margin:0;">${data.orderNumber}</p>
      </div>
      
      <div style="margin-bottom:24px;">
        <p style="color:#9A7840;font-size:11px;letter-spacing:1px;margin:0 0 8px 0;">YOUR ORDER</p>
        <pre style="color:#EEEAE0;font-size:14px;margin:0;white-space:pre-wrap;font-family:Arial,sans-serif;">${data.itemsText}</pre>
      </div>
      
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
        <div>
          <p style="color:#9A7840;font-size:11px;letter-spacing:1px;margin:0 0 4px 0;">${data.fulfillmentMethod.toUpperCase()}</p>
          <p style="color:#EEEAE0;font-size:14px;margin:0;">${data.serviceWindow}</p>
        </div>
        <div style="text-align:right;">
          <p style="color:#9A7840;font-size:11px;letter-spacing:1px;margin:0 0 4px 0;">TOTAL</p>
          <p style="color:#E8B84B;font-size:18px;font-weight:bold;margin:0;">${data.totalFormatted}</p>
        </div>
      </div>
      
      <p style="color:#C08030;font-size:13px;line-height:1.6;margin:0;">
        Chef Mo will confirm your pickup details shortly. Questions? Reply to this email or contact ${data.supportEmail}.
      </p>
    </div>
    
    <p style="color:#5A4A30;font-size:11px;text-align:center;margin-top:24px;">
      MoGrillz · Premium Zabiha Halal · DMV Area
    </p>
  </div>
</body>
</html>
  `.trim();
}

function buildTextEmail(data: OrderEmailPayload["data"]): string {
  return `
MoGrillz - Order Confirmed

Thank you, ${data.customerName}!

ORDER NUMBER: ${data.orderNumber}

YOUR ORDER:
${data.itemsText}

${data.fulfillmentMethod.toUpperCase()}: ${data.serviceWindow}
TOTAL: ${data.totalFormatted}

Chef Mo will confirm your pickup details shortly.
Questions? Contact ${data.supportEmail}

---
MoGrillz · Premium Zabiha Halal · DMV Area
  `.trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: OrderEmailPayload;

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload.to || !payload.subject || !payload.data) {
    return new Response(JSON.stringify({ error: "Missing required fields: to, subject, data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: buildHtmlEmail(payload.data),
        text: buildTextEmail(payload.data),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      return new Response(JSON.stringify({ error: "Email send failed", details: result }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(JSON.stringify({ error: "Email send failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
