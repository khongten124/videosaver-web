const crypto = require('crypto');

const SEPAY_WEBHOOK_SECRET = process.env.SEPAY_WEBHOOK_SECRET || 'whsec_JuzqDsMz74HTH6XRZ6EHbpysx0jxCGym';
const JWT_SECRET = process.env.JWT_SECRET || 'videosaver_vip_secret_key_2026';

function generateVipKey(orderCode, days = 30) {
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `${orderCode}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex').slice(0, 8).toUpperCase();
  const rawKey = `VIP-${signature.slice(0, 4)}-${signature.slice(4, 8)}-${Buffer.from(String(expiresAt)).toString('base64').replace(/=/g, '')}`;
  return {
    vipKey: rawKey,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-SePay-Signature, X-SePay-Timestamp");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const signature = req.headers['x-sepay-signature'] || req.headers['X-SePay-Signature'] || '';
    const timestamp = req.headers['x-sepay-timestamp'] || req.headers['X-SePay-Timestamp'] || '';
    
    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf-8');
    } else {
      rawBody = JSON.stringify(req.body || {});
    }

    // Verify HMAC-SHA256 signature using SePay Webhook Secret
    const stringToSign = `${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac('sha256', SEPAY_WEBHOOK_SECRET).update(stringToSign).digest('hex');
    const expectedSignature = `sha256=${hmac}`;

    const isValid = signature && (signature === expectedSignature || crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)));

    if (!isValid) {
      console.warn('SePay invalid signature:', { received: signature, expected: expectedSignature });
      return res.status(401).json({ success: false, error: "Invalid signature" });
    }

    const data = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
    console.log('SePay Webhook Verified Data:', data);

    const transferAmount = Number(data.transferAmount || data.amount || 0);
    const content = (data.content || data.description || '').toUpperCase();

    // Look for VIP order code (e.g. VIP8899, VIPXXXX)
    const match = content.match(/VIP[A-Z0-9]{3,8}/);
    const orderCode = match ? match[0] : null;

    if (!orderCode) {
      return res.status(200).json({ success: true, message: "Processed (no orderCode found in content)" });
    }

    if (transferAmount < 40000) {
      return res.status(200).json({ success: true, message: "Processed (amount lower than VIP price)" });
    }

    // Save to memory store for instant claim-key matching
    if (!global.SEPAY_PAID_ORDERS) {
      global.SEPAY_PAID_ORDERS = new Set();
    }
    global.SEPAY_PAID_ORDERS.add(orderCode);

    const { vipKey, expiresAt } = generateVipKey(orderCode, 30);
    console.log(`✅ Activated VIP for order ${orderCode}: ${vipKey}`);

    return res.status(200).json({
      success: true,
      orderCode,
      vipKey,
      expiresAt,
      message: "Payment verified successfully by SePay"
    });
  } catch (err) {
    console.error("SePay Webhook Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
