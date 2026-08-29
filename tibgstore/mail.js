const nodemailer = require("nodemailer");

function env(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback || "";
  return String(raw).trim().replace(/^['"]|['"]$/g, "");
}

function inr(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function enabled() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

function fromAddress() {
  const from = env("SMTP_FROM") || env("SMTP_USER");
  const user = env("SMTP_USER");
  if (from && from.includes("<") && from.includes(">")) return from;
  const email = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (from && email && from !== email[0]) return `${from.replace(email[0], "").trim()} <${email[0]}>`;
  if (from && from.includes("@")) return from;
  return user;
}

function adminAddress(site) {
  return env("ADMIN_EMAIL") || (site && site.email) || env("SMTP_USER");
}

function transporter() {
  const port = Number(env("SMTP_PORT", "587"));
  const secure = env("SMTP_SECURE").toLowerCase() === "true" || port === 465;
  return nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure,
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS").replace(/\s+/g, ""),
    },
  });
}

function totals(order) {
  const sub = (order.lines || []).reduce((n, l) => n + Number(l.unit || 0) * Number(l.qty || 0), 0);
  const discount = Number(order.discount || 0);
  const codFee = Number(order.codFee || 0);
  const total = Number(order.total || sub - discount);
  const ship =
    order.ship != null ? Number(order.ship) : Math.max(0, total - (sub - discount) - codFee);
  return { sub, discount, ship, codFee, total };
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shortId(id) {
  const s = String(id || "");
  return s.length > 18 ? s.slice(0, 8) + "…" + s.slice(-6) : s || "—";
}

function itemRows(order) {
  return (order.lines || [])
    .map(
      (l) => `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #ececec;font-size:14px;color:#111">
          <div style="font-weight:600">${esc(l.name)}</div>
          <div style="color:#888;font-size:12px;margin-top:3px">${inr(l.unit)} each</div>
        </td>
        <td style="padding:14px 8px;border-bottom:1px solid #ececec;text-align:center;color:#555;font-size:14px;white-space:nowrap">${l.qty}</td>
        <td style="padding:14px 0;border-bottom:1px solid #ececec;text-align:right;font-size:14px;font-weight:600;white-space:nowrap">${inr(l.unit * l.qty)}</td>
      </tr>`
    )
    .join("");
}

function wrap({ preheader, inner, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TIBGSTORE</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || "")}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e6e3">
        <tr>
          <td style="background:#0b0b0b;padding:22px 32px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:15px;letter-spacing:0.22em;font-weight:700">TIBG STORE</td>
                <td align="right" style="font-family:Arial,Helvetica,sans-serif;color:#bdbdbd;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">India · INR</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#111111">${inner}</td>
        </tr>
        <tr>
          <td style="padding:18px 32px 24px;border-top:1px solid #ececec;font-family:Arial,Helvetica,sans-serif;color:#8a8a86;font-size:12px;line-height:1.6">${footer || ""}</td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function shipBlock(order) {
  const s = order.shipTo;
  const text = s
    ? [s.line1, s.line2, `${s.city || ""} ${s.pin || ""}`.trim(), s.state].filter(Boolean).join(", ")
    : order.address || "";
  return text;
}

function buyerHtml(order, site) {
  const first = esc((order.name || "there").split(" ")[0]);
  const t = totals(order);
  const siteEmail = site.email || env("ADMIN_EMAIL") || "";
  const sitePhone = site.phone || "";
  const cod = order.method === "cod" || order.status === "cod";
  return wrap({
    preheader: cod
      ? `Cash on delivery. Your TIBGSTORE order is ${inr(t.total)}.`
      : `Payment received. Your TIBGSTORE order is ${inr(t.total)}.`,
    footer: `${esc(site.address || "")}${sitePhone ? " · " + esc(sitePhone) : ""}${siteEmail ? ` · <a href="mailto:${esc(siteEmail)}" style="color:#111">${esc(siteEmail)}</a>` : ""}<br>This is an automated receipt. Reply if something looks wrong.`,
    inner: `
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#888;font-weight:700">${cod ? "Cash on delivery" : "Payment received"}</p>
      <h1 style="margin:0 0 10px;font-size:28px;line-height:1.2;font-weight:600">Thank you, ${first}.</h1>
      <p style="margin:0 0 24px;color:#5c5c5c;font-size:15px;line-height:1.55">${
        cod
          ? "Your COD order is in. Pay the courier in cash when it arrives. Complete PCs are assembled and burn-tested before they ship."
          : "Your order is confirmed. Complete PCs are assembled, burn-tested for 24 hours, and photographed before they ship."
      }</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;margin:0 0 28px">
        <tr>
          <td style="padding:14px 16px;width:50%;vertical-align:top">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:6px">Order</div>
            <div style="font-size:13px;font-weight:600;word-break:break-all">${esc(shortId(order.id))}</div>
          </td>
          <td style="padding:14px 16px;width:50%;vertical-align:top">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:6px">Fulfillment</div>
            <div style="font-size:13px;font-weight:600">${esc(order.fulfillment || "Ground shipping")}</div>
            ${order.phone ? `<div style="font-size:12px;color:#555;margin-top:4px">${esc(order.phone)}</div>` : ""}
            <div style="font-size:12px;color:#555;margin-top:4px">${cod ? "Pay cash on delivery" : "Paid online"}</div>
          </td>
        </tr>
        ${
          shipBlock(order)
            ? `<tr><td colspan="2" style="padding:0 16px 14px">
                <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:6px">Ship to</div>
                <div style="font-size:13px;line-height:1.45">${esc(shipBlock(order))}</div>
              </td></tr>`
            : ""
        }
      </table>

      <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#888;font-weight:700">Items</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:8px;border-bottom:1px solid #111;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888">Product</td>
          <td style="padding-bottom:8px;border-bottom:1px solid #111;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;text-align:center">Qty</td>
          <td style="padding-bottom:8px;border-bottom:1px solid #111;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;text-align:right">Amount</td>
        </tr>
        ${itemRows(order)}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Subtotal</td><td style="padding:8px 0;text-align:right;font-size:14px">${inr(t.sub)}</td></tr>
        ${t.discount ? `<tr><td style="padding:8px 0;color:#666;font-size:14px">Discount${order.promo ? " · " + esc(order.promo) : ""}</td><td style="padding:8px 0;text-align:right;font-size:14px">−${inr(t.discount)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Shipping</td><td style="padding:8px 0;text-align:right;font-size:14px">${t.ship ? inr(t.ship) : "Free"}</td></tr>
        ${t.codFee ? `<tr><td style="padding:8px 0;color:#666;font-size:14px">COD fee</td><td style="padding:8px 0;text-align:right;font-size:14px">${inr(t.codFee)}</td></tr>` : ""}
        <tr><td style="padding:14px 0 0;border-top:1px solid #111;font-size:15px;font-weight:700">${cod ? "Total due on delivery" : "Total paid"}</td><td style="padding:14px 0 0;border-top:1px solid #111;text-align:right;font-size:20px;font-weight:700">${inr(t.total)}</td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#0b0b0b">
        <tr><td style="padding:18px 20px;color:#ffffff;font-size:13px;line-height:1.6">
          <strong>What happens next</strong><br>
          We confirm the build, run a 24-hour burn-in on complete PCs, and email a photo of your unit before dispatch.
        </td></tr>
      </table>`
  });
}

function adminHtml(order) {
  const t = totals(order);
  return wrap({
    preheader: `${order.method === "cod" ? "COD" : "Paid"} ${inr(t.total)} · ${order.name || order.email || "new order"}`,
    footer: "Internal sale notice. Do not forward to the customer.",
    inner: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
        <tr>
          <td>
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#888;font-weight:700">${order.method === "cod" ? "New COD order" : "New paid order"}</p>
            <h1 style="margin:0;font-size:26px;font-weight:600">${inr(t.total)}</h1>
          </td>
          <td align="right" valign="top">
            <span style="display:inline-block;background:#111;color:#fff;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;padding:6px 10px;font-weight:700">${order.method === "cod" ? "COD" : "Paid"}</span>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;margin:0 0 24px">
        <tr>
          <td style="padding:14px 16px;width:50%;vertical-align:top;font-size:13px">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:6px">Customer</div>
            <div style="font-weight:700">${esc(order.name || "—")}</div>
            <div style="color:#555;margin-top:3px">${esc(order.email || "no email")}</div>
            <div style="color:#111;margin-top:6px;font-weight:700">${esc(order.phone || "No phone")}</div>
          </td>
          <td style="padding:14px 16px;width:50%;vertical-align:top;font-size:13px">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:6px">Ship / pickup</div>
            <div style="font-weight:700">${esc(order.fulfillment || "—")}</div>
            <div style="color:#555;margin-top:3px">${esc(shipBlock(order) || "No address given")}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 16px 14px;font-size:12px;color:#888">
            Order ${esc(order.id || "—")}${order.promo ? " · coupon " + esc(order.promo) : ""}
          </td>
        </tr>
      </table>

      <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#888;font-weight:700">To build / pick</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemRows(order)}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Subtotal</td><td style="padding:8px 0;text-align:right">${inr(t.sub)}</td></tr>
        ${t.discount ? `<tr><td style="padding:8px 0;color:#666;font-size:14px">Discount</td><td style="padding:8px 0;text-align:right">−${inr(t.discount)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;font-size:14px">Shipping</td><td style="padding:8px 0;text-align:right">${t.ship ? inr(t.ship) : "Free"}</td></tr>
        ${t.codFee ? `<tr><td style="padding:8px 0;color:#666;font-size:14px">COD fee</td><td style="padding:8px 0;text-align:right">${inr(t.codFee)}</td></tr>` : ""}
        <tr><td style="padding:14px 0 0;border-top:1px solid #111;font-weight:700">${order.method === "cod" ? "Collect on delivery" : "Collected"}</td><td style="padding:14px 0 0;border-top:1px solid #111;text-align:right;font-size:18px;font-weight:700">${inr(t.total)}</td></tr>
      </table>`
  });
}

function buyerText(order) {
  const lines = (order.lines || []).map((l) => `${l.qty}× ${l.name} — ${inr(l.unit * l.qty)}`).join("\n");
  return `TIBGSTORE — order confirmed\n\nHi ${order.name || "there"},\nWe received your payment.\n\nOrder ${order.id}\n${order.fulfillment || ""}\n${order.address || ""}\n\n${lines}\n\n${order.promo ? `Coupon ${order.promo}: -${inr(order.discount || 0)}\n` : ""}Total paid: ${inr(order.total)}\n`;
}

async function send(opts) {
  if (!enabled()) {
    console.log("SMTP not configured — skipped email:", opts.subject);
    return { skipped: true };
  }
  const info = await transporter().sendMail({
    from: fromAddress(),
    ...opts,
  });
  return { id: info.messageId };
}

async function sendOrderEmails(order, site) {
  const siteInfo = site || {};
  const jobs = [];
  if (order.email) {
    jobs.push(
      send({
        to: order.email,
        subject: `${order.method === "cod" ? "TIBGSTORE COD order" : "TIBGSTORE order confirmed"} · ${inr(order.total)}`,
        text: buyerText(order),
        html: buyerHtml(order, siteInfo),
      })
    );
  }
  const adminTo = adminAddress(siteInfo);
  if (adminTo) {
    jobs.push(
      send({
        to: adminTo,
        subject: `New TIBGSTORE order · ${order.name || order.email || order.id} · ${inr(order.total)}`,
        text: `${order.name}\n${order.email}\n${order.phone || ""}\n${(order.lines || []).map((l) => `${l.qty}× ${l.name}`).join(", ")}\nTotal ${inr(order.total)}`,
        html: adminHtml(order),
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    failed.forEach((f) => console.error("Order email failed:", f.reason && f.reason.message));
    throw failed[0].reason;
  }
  return { sent: jobs.length };
}

async function sendTest(to) {
  return send({
    to,
    subject: "TIBGSTORE SMTP test",
    text: "SMTP is working. Order receipts will use this mailbox.",
    html: wrap({
      preheader: "SMTP is working.",
      footer: "Test message from TIBGSTORE.",
      inner: "<h1 style='margin:0 0 8px;font-size:24px'>SMTP is ready.</h1><p style='margin:0;color:#5c5c5c'>Order receipts for buyers and sale notices for admin will use this layout.</p>",
    }),
  });
}

module.exports = { enabled, sendOrderEmails, sendTest, adminAddress };
