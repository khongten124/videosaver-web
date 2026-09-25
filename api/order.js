const crypto = require('crypto');

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

function verifyVipKey(keyStr) {
  try {
    if (!keyStr || !keyStr.startsWith('VIP-')) return { valid: false, error: 'Mã VIP Key không đúng định dạng' };
    const parts = keyStr.split('-');
    if (parts.length < 4) return { valid: false, error: 'Mã VIP Key không hợp lệ' };
    
    const sig = parts[1] + parts[2];
    const b64Exp = parts[3];
    let paddedB64 = b64Exp;
    while (paddedB64.length % 4 !== 0) {
      paddedB64 += '=';
    }
    const expStr = Buffer.from(paddedB64, 'base64').toString('utf-8');
    const expiresAt = parseInt(expStr, 10);
    
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false, error: 'Mã VIP Key đã hết hạn sử dụng' };
    }
    
    return {
      valid: true,
      expiresAt: new Date(expiresAt).toISOString(),
      daysLeft: Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
    };
  } catch (e) {
    return { valid: false, error: 'Mã VIP Key không hợp lệ hoặc bị lỗi' };
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action } = req.query || {};

  // 1. Action: Create Order
  if (req.method === "POST" && action === "create") {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomStr = '';
    for (let i = 0; i < 4; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const orderCode = `VIP${randomStr}`;
    const amount = 49000;
    const expireMinutes = 5;
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();

    const bankBin = '970423';
    const bankAccount = '00004362479';
    const bankName = 'TPBank';
    const accountName = 'TONG DUC HONG ANH';
    const qrUrl = `https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.png?amount=${amount}&addInfo=${orderCode}&accountName=${encodeURIComponent(accountName)}`;

    return res.status(200).json({
      success: true,
      orderCode,
      amount,
      bankName,
      bankAccount,
      accountName,
      qrUrl,
      expiresAt,
      expireMinutes
    });
  }

  // 2. Action: Verify / Check VIP Key
  if (req.method === "POST" && action === "verify-key") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const { vipKey } = body || {};
    const result = verifyVipKey(vipKey);
    return res.status(200).json(result);
  }

  // 3. Action: Claim Key with Order Code
  if (req.method === "POST" && action === "claim-key") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const { orderCode } = body || {};
    if (!orderCode || !orderCode.toUpperCase().startsWith('VIP')) {
      return res.status(400).json({ success: false, error: 'Mã đơn hàng không hợp lệ' });
    }

    const { vipKey, expiresAt } = generateVipKey(orderCode.toUpperCase(), 30);
    return res.status(200).json({
      success: true,
      vipKey,
      expiresAt,
      message: 'Kích hoạt VIP 30 ngày thành công!'
    });
  }

  return res.status(200).json({ status: "ok", endpoint: "/api/order" });
};
