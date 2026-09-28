const crypto = require('crypto');

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
    // Ko-fi sends data as form-urlencoded with a 'data' field containing JSON string
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

    const email = payload.email || payload.from_name || 'kofi_user';
    const amount = parseFloat(payload.amount || 0);

    // Generate dynamic unique cryptographic key
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
