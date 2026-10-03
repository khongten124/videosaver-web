// Ultra-Fast Direct Media Download Proxy (Images, Videos, MP3)
// Bypasses browser cross-origin download restrictions by forcing Content-Disposition: attachment

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    const safeFilename = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, "_") : "media_download";
    const mediaResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.tiktok.com/"
      }
    });

    if (!mediaResponse.ok) {
      // If fetching fails, redirect client directly
      return res.redirect(302, url);
    }

    const contentType = mediaResponse.headers.get("content-type") || "application/octet-stream";
    const contentLength = mediaResponse.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    // Fallback: redirect directly to source url
    return res.redirect(302, url);
  }
};
