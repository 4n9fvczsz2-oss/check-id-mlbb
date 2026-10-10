const express = require("express");
const path = require("path");
const validasi = require("./lib/validasi");
const countryList = require("./utils/data.json");

const PORT = process.env.PORT || 3000;
const app = express();

// دومين المتجر المسموح له
const ALLOWED = ["https://twix-store.com", "https://www.twix-store.com"];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Vary", "Origin");
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// حد بسيط للطلبات: 30 في الدقيقة لكل IP
const hits = new Map();
function limited(ip) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    if (hits.size > 5000) hits.clear();
    return arr.length > 30;
}

app.get("/api/validasi", async (req, res) => {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    if (limited(ip)) {
        return res.status(429).json({ status: "failed", message: "Too many requests" });
    }

    const id = String(req.query.id || "").trim();
    const serverid = String(req.query.serverid || "").trim();
    if (!/^\d{5,12}$/.test(id) || !/^\d{1,6}$/.test(serverid)) {
        return res.status(400).json({ status: "failed", message: "Invalid id or serverid" });
    }

    try {
        const response = await validasi(id, serverid);

        let nick = response["in-game-nickname"];
        if (nick) {
            nick = String(nick).replace(/\+/g, " ");
            try { nick = decodeURIComponent(nick); } catch (e) {}
        }
        if (!nick) {
            return res.status(404).json({ status: "failed", message: "Account not found" });
        }

        const code = String(response.country || "").toUpperCase();
        const entry = countryList.find(a => a.countryShortCode == response.country);

        return res.json({
            status: "success",
            result: {
                nickname: nick,
                country: entry?.countryName || "Unknown",
                countryCode: code || null
            }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ status: "failed", message: "Account not found or service unavailable" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
});
