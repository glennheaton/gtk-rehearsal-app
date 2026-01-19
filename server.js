require("dotenv").config();

console.log("MC env loaded:", {
  hasKey: !!process.env.MAILCHIMP_API_KEY,
  hasAudience: !!process.env.MAILCHIMP_AUDIENCE_ID,
  dc: (process.env.MAILCHIMP_API_KEY || "").split("-")[1] || null,
  tag: process.env.MAILCHIMP_TAG
});


const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// --------------------
// Middleware
// --------------------
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------
// Mailchimp helpers
// --------------------
function getMailchimpDc(apiKey) {
  const parts = (apiKey || "").split("-");
  return parts.length === 2 ? parts[1] : null;
}

async function upsertMailchimpContact({ email, firstName, role, tag }) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  const dc = getMailchimpDc(apiKey);

  if (!apiKey || !audienceId || !dc) {
    throw new Error("Mailchimp env vars missing or invalid");
  }

  const emailLower = String(email).toLowerCase().trim();
  const subscriberHash = crypto
    .createHash("md5")
    .update(emailLower)
    .digest("hex");

  const authHeader = `Basic ${Buffer.from(`any:${apiKey}`).toString("base64")}`;

  const memberUrl = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`;

  await fetch(memberUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      email_address: emailLower,
      status_if_new: "subscribed",
      status: "subscribed",
      merge_fields: {
        FNAME: firstName || "",
        ROLE: role || "",
      },
    }),
  });

  if (tag) {
    const tagUrl = `${memberUrl}/tags`;
    await fetch(tagUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        tags: [{ name: tag, status: "active" }],
      }),
    });
  }
}

// --------------------
// Register
// --------------------
app.post("/api/register", async (req, res) => {
  const { name, email, role } = req.body;
  const sessionId = Date.now().toString();

  try {
    await upsertMailchimpContact({
      email,
      firstName: (name || "").split(" ")[0],
      role,
      tag: process.env.MAILCHIMP_TAG || "GTK_Rehearsal",
    });
  } catch (err) {
    console.error("Mailchimp error:", err.message);
  }

  res.json({ sessionId });
});

// --------------------
// Upload (placeholder)
// --------------------
app.post("/api/upload", (req, res) => {
  res.json({ status: "ok" });
});

// --------------------
// Results + coaching
// --------------------
app.get("/api/results/:sessionId", (req, res) => {
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  const results = {
    eyelinePercent: Math.round(rand(62, 92)),
    pace: ["A little fast", "Good", "A little slow"][Math.floor(rand(0, 3))],
    vocalVariety: ["Quite monotone", "Some variation", "Good variation"][Math.floor(rand(0, 3))],
    fillerWords: Math.floor(rand(4, 15)),
    confidenceScore: rand(5.8, 8.3).toFixed(1),
    note:
      "These are automated rehearsal indicators. They highlight patterns, not polish or credibility.",
  };

  results.coaching = {
    headline: "What stood out most",
    focusLabel: "Opening clarity",
    whyItMatters:
      "People decide very quickly whether to keep watching.",
    quickFix:
      "Open with one clear sentence about who you help and how.",
    nextTakePrompt:
      "Record a short 10–12 second version focusing only on clarity.",
    bridge:
      "If you want help shaping this into a strong GTK, book a quick chat.",
  };

  res.json(results);
});

// --------------------
// Home
// --------------------
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
