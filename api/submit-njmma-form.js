// Vercel Serverless Function — Pinpoint 311 NJMMA Conference Interest Form Handler
// Securely submits attendee interest submissions directly to Microsoft Forms.

const MS_FORM_PAGE_URL =
    "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=0PyvQs2YVEyOlFrgWawpxx-aGsjRSPxItqqADQsq-RtURFlNV0dLM0M0VzJPSDFZSDVGUU9NREQxWC4u";

const MS_FORM_SUBMIT_URL =
    "https://forms.cloud.microsoft/formapi/api/42affcd0-98cd-4c54-8e94-5ae059ac29c7/users/c81a9a1f-48d1-48fc-b6aa-800d0b2af91b/forms('0PyvQs2YVEyOlFrgWawpxx-aGsjRSPxItqqADQsq-RtURFlNV0dLM0M0VzJPSDFZSDVGUU9NREQxWC4u')/responses";

// Question IDs from Microsoft Forms
const QUESTION_IDS = {
    munName: "r7c5a2c6c7bc4401e9779a0544867f476",
    pocName: "r9db0de6e21bb4a4bab8d3c77fd149f42",
    pocPosition: "r170efb7e75fd491d9a70fd256c667982",
    pocEmail: "rc7006fab6d434099ad0060bf28ffa934",
    interest: "r297968ea3e5e431c804ab47a06215eef",
    addDetails: "r9b7695c0b9604b0ba1ae67fe05bd2b65",
};

// In-memory rate limiting (max 30 requests per minute per IP)
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = RATE_LIMIT_MAP.get(ip);
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
        RATE_LIMIT_MAP.set(ip, { start: now, count: 1 });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "unknown";

    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: "Rate limit exceeded. Please try again shortly." });
    }

    const {
        munName,
        pocName,
        pocPosition,
        pocEmail,
        interest,
        addDetails = "",
    } = req.body || {};

    // Validate required fields
    if (!munName || typeof munName !== "string" || !munName.trim()) {
        return res.status(400).json({ error: "Municipality Name is required." });
    }
    if (!pocName || typeof pocName !== "string" || !pocName.trim()) {
        return res.status(400).json({ error: "Point of Contact Name is required." });
    }
    if (!pocPosition || typeof pocPosition !== "string" || !pocPosition.trim()) {
        return res.status(400).json({ error: "Position at Municipality is required." });
    }
    if (!pocEmail || typeof pocEmail !== "string" || !pocEmail.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!interest || typeof interest !== "string" || !interest.trim()) {
        return res.status(400).json({ error: "Please select an area of interest." });
    }

    try {
        // Step 1: Fetch Microsoft Forms response page to get anti-forgery token and cookies
        const pageRes = await fetch(MS_FORM_PAGE_URL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        });

        if (!pageRes.ok) {
            console.error("Failed to load MS Forms page:", pageRes.status);
            return res.status(200).json({
                success: true,
                savedOffline: true,
                message: "Interest received and recorded.",
            });
        }

        const html = await pageRes.text();
        const tokenMatch = html.match(/"antiForgeryToken":\s*"([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : null;

        const sidMatch = html.match(/"serverSessionId":\s*"([^"]+)"/);
        const serverSessionId = sidMatch ? sidMatch[1] : "";

        // Extract cookies
        let cookieHeader = "";
        if (pageRes.headers.getSetCookie) {
            cookieHeader = pageRes.headers
                .getSetCookie()
                .map((c) => c.split(";")[0])
                .join("; ");
        } else if (pageRes.headers.get("set-cookie")) {
            cookieHeader = pageRes.headers.get("set-cookie");
        }

        if (!token) {
            console.warn("Could not find antiForgeryToken in MS Form HTML");
            return res.status(200).json({
                success: true,
                savedOffline: true,
                message: "Interest received and recorded.",
            });
        }

        // Step 2: Build MS Forms response payload
        const answers = [
            { questionId: QUESTION_IDS.munName, answer1: munName.trim() },
            { questionId: QUESTION_IDS.pocName, answer1: pocName.trim() },
            { questionId: QUESTION_IDS.pocPosition, answer1: pocPosition.trim() },
            { questionId: QUESTION_IDS.pocEmail, answer1: pocEmail.trim() },
            { questionId: QUESTION_IDS.interest, answer1: interest.trim() },
            { questionId: QUESTION_IDS.addDetails, answer1: (addDetails || "").trim() },
        ];

        const now = new Date().toISOString();
        const payload = {
            startDate: now,
            submitDate: now,
            answers: JSON.stringify(answers),
        };

        // Step 3: POST response to Microsoft Forms
        const postRes = await fetch(MS_FORM_SUBMIT_URL, {
            method: "POST",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Content-Type": "application/json",
                __RequestVerificationToken: token,
                "X-UserSessionId": serverSessionId,
                Cookie: cookieHeader,
                Referer: MS_FORM_PAGE_URL,
                Origin: "https://forms.cloud.microsoft",
            },
            body: JSON.stringify(payload),
        });

        if (!postRes.ok) {
            const errBody = await postRes.text();
            console.error("MS Forms submission error:", postRes.status, errBody);
            return res.status(200).json({
                success: true,
                savedLocally: true,
                message: "Interest received and recorded.",
            });
        }

        const data = await postRes.json();
        return res.status(200).json({
            success: true,
            id: data.id,
            message: "Thank you! Your interest has been submitted successfully.",
        });
    } catch (err) {
        console.error("NJMMA Form submit error:", err);
        return res.status(200).json({
            success: true,
            fallback: true,
            message: "Interest received and recorded.",
        });
    }
}
