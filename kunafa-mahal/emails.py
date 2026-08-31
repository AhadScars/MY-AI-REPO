"""Kunafa Mahal HTML email layouts — table-based for Gmail."""
from __future__ import annotations

import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOGO = ROOT / "assets" / "brand" / "logo.jpg"

MAROON = "#961B27"
MAROON_DEEP = "#4A0A10"
CREAM = "#F6EDE4"
IVORY = "#FBF7F2"
GOLD = "#C4A35A"
INK = "#2A2A2A"
MUTED = "#6A5A58"

STATUS_LABELS = {
    "placed": "Order placed",
    "confirmed": "Kitchen confirmed",
    "preparing": "On the griddle",
    "out": "Out for delivery",
    "delivered": "Delivered",
    "ready": "Ready for pickup",
    "collected": "Collected",
    "cancelled": "Cancelled",
}


def inr(n) -> str:
    try:
        return "₹" + format(int(n or 0), ",")
    except (TypeError, ValueError):
        return "₹0"


def escape(val) -> str:
    return html.escape(str(val or ""), quote=True)


def wrap(title: str, inner: str, preheader: str = "") -> str:
    preview = escape(preheader)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:{IVORY};font-family:'Georgia',Times,'Times New Roman',serif;color:{INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{IVORY};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eadfd4;">
          <tr>
            <td style="background:{MAROON};padding:28px 32px 24px;text-align:center;">
              <img src="cid:km-logo" width="72" height="72" alt="Kunafa Mahal" style="display:block;margin:0 auto 12px;border-radius:50%;border:1px solid rgba(246,237,228,0.35);" />
              <div style="font-family:Georgia,serif;font-style:italic;font-size:30px;line-height:1;color:{CREAM};">Kunafa Mahal</div>
              <div style="margin-top:8px;letter-spacing:0.22em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{GOLD};">Hazratganj · Lucknow</div>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:{GOLD};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:{INK};">
              {inner}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:{MUTED};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM};border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    Shop 4, New Market, Zone 2, Near Multilevel Parking, Hazratganj, Lucknow 226001<br />
                    Open daily 12:00 pm – 11:45 pm · +91 73070 97771
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9a8b88;">Indulge in royal flavors · Pure vegetarian café</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def button(href: str, label: str) -> str:
    return (
        f'<a href="{escape(href)}" style="display:inline-block;background:{MAROON};color:{CREAM};'
        f"text-decoration:none;padding:12px 22px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;"
        f'font-size:14px;font-weight:700;letter-spacing:0.02em;">{escape(label)}</a>'
    )


def badge(text: str) -> str:
    return (
        f'<span style="display:inline-block;background:{CREAM};color:{MAROON};'
        f"border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;"
        f'letter-spacing:0.08em;text-transform:uppercase;">{escape(text)}</span>'
    )


def order_table(order: dict) -> str:
    rows = []
    for item in order.get("items") or []:
        rows.append(
            "<tr>"
            f'<td style="padding:10px 0;border-bottom:1px solid #f0e6dc;">{escape(item.get("qty"))} × {escape(item.get("name"))}</td>'
            f'<td align="right" style="padding:10px 0;border-bottom:1px solid #f0e6dc;white-space:nowrap;">{inr(item.get("line"))}</td>'
            "</tr>"
        )
    tot = order.get("totals") or {}
    loy = order.get("loyalty") or {}
    extras = [
        ("Subtotal", inr(tot.get("subtotal"))),
        ("Packaging", inr(tot.get("packaging"))),
    ]
    if order.get("type") != "pickup":
        extras.append(("Delivery", inr(tot.get("delivery"))))
    extras.append(("GST 5%", inr(tot.get("gst"))))
    if tot.get("discount"):
        extras.append((tot.get("promoLabel") or "Offer", "−" + inr(tot.get("discount"))))
    if tot.get("loyalty") or loy.get("rupees"):
        extras.append(("Loyalty", "−" + inr(tot.get("loyalty") or loy.get("rupees"))))
    extra_html = "".join(
        f'<tr><td style="padding:6px 0;color:{MUTED};">{escape(k)}</td>'
        f'<td align="right" style="padding:6px 0;color:{MUTED};">{escape(v)}</td></tr>'
        for k, v in extras
    )
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;">
        {''.join(rows)}
        {extra_html}
        <tr>
          <td style="padding:12px 0 0;font-weight:700;color:{MAROON_DEEP};">To pay</td>
          <td align="right" style="padding:12px 0 0;font-weight:700;color:{MAROON};font-size:20px;">{inr(tot.get("grand"))}</td>
        </tr>
      </table>
    """


def loyalty_card(order: dict) -> str:
    loy = order.get("loyalty") or {}
    earned = loy.get("earned") or 0
    used = loy.get("used") or 0
    if not earned and not used:
        return ""
    bal = loy.get("balance") or 0
    used_bit = f" · used {inr(loy.get('rupees') or used)}" if used else ""
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:{CREAM};border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:{MAROON};font-weight:700;">Loyalty</div>
            <div style="margin-top:6px;">This order earned <strong>{inr(earned)}</strong> (5%){used_bit}.<br />Balance now <strong>{inr(bal)}</strong>.</div>
          </td>
        </tr>
      </table>
    """


def guest_order(order: dict, site: str) -> tuple[str, str]:
    oid = order.get("id") or ""
    name = order.get("name") or "guest"
    kind = "Café pickup" if order.get("type") == "pickup" else "Delivery"
    track = f"{site.rstrip('/')}/track.html?id={oid}"
    subject = f"Your Kunafa Mahal order {oid}"
    text = (
        f"Shukriya {name},\nWe have your ticket {oid} ({kind}).\n"
        f"To pay: {inr((order.get('totals') or {}).get('grand'))}\nTrack: {track}\n"
    )
    inner = f"""
      <p style="margin:0 0 8px;">{badge(kind)}</p>
      <h1 style="margin:10px 0 8px;font-family:Georgia,serif;font-weight:500;font-size:30px;color:{MAROON_DEEP};">Shukriya, {escape(name)}</h1>
      <p style="margin:0 0 16px;">Your royal ticket is with the Hazratganj kitchen.</p>
      <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:{GOLD};font-weight:700;">Order {escape(oid)}</p>
      {order_table(order)}
      {loyalty_card(order)}
      <p style="margin:22px 0 8px;">{button(track, "Track this order")}</p>
    """
    return subject, wrap(subject, inner, f"Order {oid} confirmed — Kunafa Mahal"), text


def cafe_order(order: dict, site: str) -> tuple[str, str, str]:
    oid = order.get("id") or ""
    subject = f"New order {oid} — Kunafa Mahal"
    kind = "PICKUP" if order.get("type") == "pickup" else "DELIVERY"
    track = f"{site.rstrip('/')}/admin.html"
    text = f"New {kind} {oid}\n{order.get('name')} · {order.get('phone')}\n"
    inner = f"""
      <p style="margin:0 0 8px;">{badge(kind)}</p>
      <h1 style="margin:10px 0 8px;font-family:Georgia,serif;font-weight:500;font-size:28px;color:{MAROON_DEEP};">New ticket {escape(oid)}</h1>
      <p style="margin:0 0 4px;"><strong>{escape(order.get("name"))}</strong> · {escape(order.get("phone"))}</p>
      <p style="margin:0 0 16px;color:{MUTED};">{escape(order.get("address") or "Café pickup")} {escape(order.get("zoneName") or "")}</p>
      {order_table(order)}
      {loyalty_card(order)}
      <p style="margin:18px 0 8px;">{button(track, "Open admin desk")}</p>
    """
    return subject, wrap(subject, inner, f"New {kind} order {oid}"), text


def status_mail(order: dict, site: str) -> tuple[str, str, str]:
    oid = order.get("id") or ""
    status = order.get("status") or ""
    label = STATUS_LABELS.get(status, status)
    track = f"{site.rstrip('/')}/track.html?id={oid}"
    subject = f"Order {oid}: {label}"
    text = f"Your order {oid} is now: {label}. Track: {track}\n"
    inner = f"""
      <p style="margin:0 0 8px;">{badge(label)}</p>
      <h1 style="margin:10px 0 8px;font-family:Georgia,serif;font-weight:500;font-size:28px;color:{MAROON_DEEP};">Salaam, {escape(order.get("name"))}</h1>
      <p style="margin:0 0 16px;">Your Kunafa Mahal order <strong>{escape(oid)}</strong> is now <strong>{escape(label)}</strong>.</p>
      {order_table(order)}
      <p style="margin:22px 0 8px;">{button(track, "Follow the ticket")}</p>
    """
    return subject, wrap(subject, inner, label), text


def contact_mail(row: dict) -> tuple[str, str, str]:
    name = row.get("name") or "Guest"
    subject = f"Website message from {name}"
    text = f"{name} · {row.get('reach')}\n\n{row.get('msg')}\n"
    inner = f"""
      <p style="margin:0 0 8px;">{badge("Contact")}</p>
      <h1 style="margin:10px 0 8px;font-family:Georgia,serif;font-weight:500;font-size:28px;color:{MAROON_DEEP};">A note from {escape(name)}</h1>
      <p style="margin:0 0 16px;color:{MUTED};">{escape(row.get("reach"))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM};border-radius:12px;">
        <tr><td style="padding:16px 18px;white-space:pre-wrap;">{escape(row.get("msg"))}</td></tr>
      </table>
    """
    return subject, wrap(subject, inner, f"Message from {name}"), text
