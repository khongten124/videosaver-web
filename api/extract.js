// Ultra-Fast Video & Audio Extractor Engine with Multi-Provider Race & In-Memory Cache
const memoryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getFromCache(url) {
  const item = memoryCache.get(url);
  if (item && (Date.now() - item.ts < CACHE_TTL_MS)) {
    return item.data;
  }
  return null;
}

function setCache(url, data) {
  if (memoryCache.size > 1000) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(url, { ts: Date.now(), data });
}

function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .then(res => {
      clearTimeout(id);
      return res;
    })
    .catch(err => {
      clearTimeout(id);
      throw err;
    });
}

// 1. LoveTik (Ultra-Fast Engine: 100ms - 800ms)
async function extractLoveTik(cleanUrl) {
  const resp = await fetchWithTimeout("https://lovetik.com/api/ajax/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    body: new URLSearchParams({ query: cleanUrl })
  }, 3000);

  const data = await resp.json();
  if (data && data.status === "ok") {
    let videoUrl = "";
    let audioUrl = "";
    if (data.links && Array.isArray(data.links)) {
      const v = data.links.find(l => l.t === "nowatermark_hd" || l.t === "nowatermark" || (l.ft === "mp4" && !l.a.includes("watermark")));
      videoUrl = v ? v.a : (data.links[0] ? data.links[0].a : "");
      const a = data.links.find(l => l.t === "mp3" || l.ft === "mp3");
      audioUrl = a ? a.a : null;
    }

    if (videoUrl) {
      return {
        success: true,
        id: data.vid || String(Date.now()),
        platform: "TikTok / Douyin",
        title: data.desc || "Video không logo",
        author: data.author || "Creator",
        videoUrl: videoUrl,
        audioUrl: audioUrl,
        cover: data.cover || null,
        duration: 0
      };
    }
  }
  throw new Error("LoveTik extraction failed");
}

// 2. TikWM (HD 1080p Engine)
async function extractTikWM(cleanUrl) {
  const resp = await fetchWithTimeout("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    body: new URLSearchParams({
      url: cleanUrl,
      count: "12",
      cursor: "0",
      web: "1",
      hd: "1"
    })
  }, 3500);

  const data = await resp.json();
  if (data && data.code === 0 && data.data) {
    const d = data.data;
    return {
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
    };
  }
  throw new Error("TikWM extraction failed");
}

// 3. Cobalt Multiplatform (Reels, YouTube Shorts, Twitter/X)
async function extractCobalt(cleanUrl) {
  const instances = ["https://api.cobalt.tools", "https://cobalt-api.kwiatekm.pl"];
  for (const inst of instances) {
    try {
      const resp = await fetchWithTimeout(`${inst}/api/json`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        body: JSON.stringify({ url: cleanUrl })
      }, 3000);

      const data = await resp.json();
      if (data && (data.url || data.picker)) {
        return {
          success: true,
          id: String(Date.now()),
          platform: "Social Media",
          title: "Video tải về thành công",
          author: "Social Media",
          videoUrl: data.url || (data.picker && data.picker[0] ? data.picker[0].url : ""),
          audioUrl: null,
          cover: null,
          duration: 0
        };
      }
    } catch (e) {}
  }
  throw new Error("Cobalt extraction failed");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-RapidAPI-Key, X-RapidAPI-Host"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      engine: "Ultra-Fast Multi-Provider Race Engine (<500ms)",
      message: "VideoSaver High-Speed API is live!"
    });
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

    // 1. Check in-memory cache first (0ms latency response)
    const cached = getFromCache(url);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    // 2. Multi-Engine Parallel Race for TikTok / Douyin
    if (/tiktok\.com|douyin\.com|iesdouyin\.com/i.test(url)) {
      try {
        const fastResult = await Promise.any([
          extractLoveTik(url),
          extractTikWM(url)
        ]);
        setCache(url, fastResult);
        return res.status(200).json(fastResult);
      } catch (err) {
        // Fallback to Cobalt
        try {
          const fallback = await extractCobalt(url);
          setCache(url, fallback);
          return res.status(200).json(fallback);
        } catch (err2) {}
      }
    } else {
      // 3. Multiplatform for Instagram, Facebook, Shorts, Twitter
      try {
        const socialResult = await extractCobalt(url);
        setCache(url, socialResult);
        return res.status(200).json(socialResult);
      } catch (e) {}
    }

    return res.status(400).json({
      success: false,
      error: "Không thể bóc tách video từ đường link này. Vui lòng kiểm tra lại link công khai hoặc thử link khác!"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};
