const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../config');

function ticketToken(ref) {
  return crypto.createHmac('sha256', config.jwtSecret).update(String(ref)).digest('hex').slice(0, 20);
}

function gateUrl(ref) {
  return `${config.appUrl}/manage/gate/${encodeURIComponent(ref)}?t=${ticketToken(ref)}`;
}

function verifyTicketToken(ref, token) {
  if (!token) return false;
  const expected = ticketToken(ref);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function ticketQrSvg(ref) {
  return QRCode.toString(gateUrl(ref), {
    type: 'svg',
    margin: 1,
    width: 168,
    color: { dark: '#1b1712', light: '#f6efe3' },
  });
}

function parseScannedRef(raw) {
  const text = String(raw || '').trim();
  const fromUrl = text.match(/\/manage\/gate\/([^/?#]+)/i);
  if (fromUrl) return decodeURIComponent(fromUrl[1]).toUpperCase();
  const ref = text.toUpperCase().match(/SS-[A-Z0-9]{6,12}/);
  return ref ? ref[0] : text.toUpperCase();
}

module.exports = { ticketToken, gateUrl, verifyTicketToken, ticketQrSvg, parseScannedRef };
