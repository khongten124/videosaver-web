module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-RapidAPI-Key, X-RapidAPI-Host"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", message: "VideoSaver API is live on Vercel!" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const url = body && body.url ? body.url.trim() : "";

    if (!url) {
      return res.status(400).json({ success: false, error: "Vui lòng cung cấp link video hợp lệ (url)" });
    }

    // 1. TikTok & Douyin via TikWM
    if (/tiktok\.com|douyin\.com|iesdouyin\.com/i.test(url)) {
      const resp = await fetch("https://www.tikwm.com/api/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: new URLSearchParams({
          url: url,
          count: "12",
          cursor: "0",
          web: "1",
          hd: "1"
        })
      });

      const data = await resp.json();
      if (data && data.code === 0 && data.data) {
        const d = data.data;
        return res.status(200).json({
          success: true,
          id: d.id || String(Date.now()),
          platform: "TikTok / Douyin",
          title: d.title || "Video không logo",
          author: d.author ? (d.author.nickname || d.author.unique_id) : "Creator",
          videoUrl: d.hdplay || d.play || d.wmplay,
          audioUrl: d.music || null,
          musicTitle: d.music_info ? d.music_info.title : (d.title ? `${d.title} (Audio)` : "Nhạc nền"),
          cover: d.cover,
          duration: d.duration || 0
        });
      }
    }

    // 2. Fallback via douyin.wtf
    try {
      const fallbackResp = await fetch(`https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`);
      const fallbackData = await fallbackResp.json();
      if (fallbackData && (fallbackData.url || fallbackData.video_url)) {
        return res.status(200).json({
          success: true,
          id: String(Date.now()),
          platform: "Video Social",
          title: fallbackData.desc || "Video không logo",
          author: fallbackData.author || "Creator",
          videoUrl: fallbackData.url || fallbackData.video_url,
          audioUrl: fallbackData.music_url || null,
          cover: fallbackData.cover
        });
      }
    } catch (e) {}

    return res.status(400).json({
      success: false,
      error: "Không thể bóc tách video từ đường link này. Vui lòng kiểm tra lại link công khai!"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};
