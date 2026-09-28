const crypto = require('crypto');

const KOFI_VERIFICATION_TOKEN = process.env.KOFI_VERIFICATION_TOKEN || '7b2e9869-d16b-4bea-bf69-97e1d9794f6c';
const JWT_SECRET = process.env.JWT_SECRET || 'videosaver_vip_secret_key_2026';

function generateVipKey(emailOrId, days = 30) {
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `${emailOrId}:${expiresAt}`;
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

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        const params = new URLSearchParams(payload);
        if (params.has('data')) {
          payload = JSON.parse(params.get('data'));
        }
      }
    } else if (payload && payload.data && typeof payload.data === 'string') {
      try {
        payload = JSON.parse(payload.data);
      } catch (e) {}
    }

    console.log("Ko-fi Webhook Payload received:", payload);

    // Verify Ko-fi Verification Token if provided
    const token = payload.verification_token || payload.kofi_transaction_id;
    if (KOFI_VERIFICATION_TOKEN && payload.verification_token && payload.verification_token !== KOFI_VERIFICATION_TOKEN) {
      console.warn("Invalid Ko-fi verification token received:", payload.verification_token);
      return res.status(401).json({ success: false, error: "Invalid verification token" });
    }

    const email = payload.email || payload.from_name || 'kofi_user';
    const amount = parseFloat(payload.amount || 0);

    const { vipKey, expiresAt } = generateVipKey(email, 30);
    console.log(`✅ Generated Dynamic VIP Key for Ko-fi user (${email}): ${vipKey}`);

    return res.status(200).json({
      success: true,
      email,
      vipKey,
      expiresAt,
      message: "Ko-fi payment processed and dynamic VIP key generated successfully"
    });
  } catch (err) {
    console.error("Ko-fi Webhook error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
