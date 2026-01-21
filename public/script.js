console.log("✅ script.js loaded from PUBLIC folder");

// Helpers
function getSessionIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("sessionId");
}

// ===========================
// TAKE TRACKING (per session)
// ===========================
function takeKey(sessionId) {
  return `gtk_take_${sessionId || "unknown"}`;
}

function getTakeNumber(sessionId) {
  const n = parseInt(localStorage.getItem(takeKey(sessionId)) || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function setTakeNumber(sessionId, n) {
  localStorage.setItem(takeKey(sessionId), String(n));
}



function getTakeCount() {
  const current = Number(sessionStorage.getItem("takeCount") || 0);
  const next = current + 1;
  sessionStorage.setItem("takeCount", next);
  return next;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#retryBtn");
  if (!btn) return;

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId") || "test";

  window.location.href = `/record.html?sessionId=${encodeURIComponent(sessionId)}`;
});



// ===========================
// INDEX: register + redirect
// ===========================
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  console.log("Register page detected ✅");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (document.getElementById("name")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();
    const role = document.getElementById("role")?.value || "";

    console.log("Submitting register:", { name, email, role });

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });

      if (!res.ok) throw new Error(`Register HTTP ${res.status}`);
      const data = await res.json();

      // 🔄 reset takes for new session
sessionStorage.removeItem("takeCount");
      console.log("Register response:", data);

      window.location.href = `/record.html?sessionId=${encodeURIComponent(
        data.sessionId
      )}`;
    } catch (err) {
      console.error("Register failed:", err);
      alert("Register failed. Open Console for details.");
    }
  });
}

// ===========================
// RECORD: camera + record
// ===========================
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");

if (startBtn && stopBtn && preview) {
  console.log("Record page detected ✅");

  const sessionId = getSessionIdFromUrl() || "test";
  const already = getTakeNumber(sessionId);

  if (already >= 3) {
    if (statusEl) {
      statusEl.textContent = "You’ve used your 3 free takes. Please book a quick review to keep going.";
    }
    // kick them back to results (or landing) so they don't get camera prompt
    window.location.href = `/results.html?sessionId=${encodeURIComponent(sessionId)}`;
    return;
  }



  let mediaRecorder = null;
  let recordedChunks = [];

  (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      preview.srcObject = stream;

      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstart = () => {
        recordedChunks = [];
        stopBtn.disabled = false;
        if (statusEl) statusEl.textContent = "Recording…";
      };

      mediaRecorder.onstop = async () => {
        if (statusEl) statusEl.textContent = "Uploading… (placeholder)";

        const blob = new Blob(recordedChunks, { type: "video/webm" });

        const formData = new FormData();
        formData.append("video", blob, "rehearsal.webm");
        formData.append("sessionId", getSessionIdFromUrl() || "");

        try {
          await fetch("/api/upload", { method: "POST", body: formData });
        } catch (err) {
          console.error("Upload failed:", err);
        }

        const sessionId = getSessionIdFromUrl();
        window.location.href = `/results.html?sessionId=${encodeURIComponent(
          sessionId || ""
        )}`;
      };
    } catch (err) {
      console.error("Camera/mic error:", err);
      if (statusEl) statusEl.textContent = "Camera/mic error: " + err.message;
      startBtn.disabled = true;
    }
  })();

  startBtn.addEventListener("click", () => {
    if (!mediaRecorder) return;
    mediaRecorder.start();
  });

  stopBtn.addEventListener("click", () => {
    if (!mediaRecorder) return;
    stopBtn.disabled = true;
    mediaRecorder.stop();
  });
}

// ===========================
// RESULTS: fetch + render
// ===========================
// ===========================
// RESULTS: delayed fetch + render
// ===========================
const resultsBox = document.getElementById("resultsBox");

if (resultsBox) {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId") || "test";

  const delayMs = 1800 + Math.floor(Math.random() * 1400); // 1.8–3.2s

  const watchdog = setTimeout(() => {
    resultsBox.innerHTML =
      "<p>Still working… if this doesn’t change, check that the server is running and /api/results/test returns JSON.</p>";
  }, 6000);

  setTimeout(() => {
    fetch(`/api/results/${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Results HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const takeNumber = getTakeCount();
        clearTimeout(watchdog);

        const c = data.coaching || {};

        // Take tracking: increment when results are successfully shown
        const takeNumber = getTakeNumber(sessionId) + 1;
        setTakeNumber(sessionId, takeNumber);

        // Optional: show take label somewhere (if you want)
        const takeBadge = `<p class="take-badge">Take ${takeNumber} of 3</p>`;



          // 👇 THIS MUST BE HERE (outside the HTML)
  let takeNote = "";
  if (takeNumber === 1) {
    takeNote = "First takes are about getting comfortable — clarity comes next.";
  } else if (takeNumber === 2) {
    takeNote = "This is where most people start to sound more natural.";
  } else {
    takeNote = "By now, you’re refining rather than starting from scratch.";
  }

        resultsBox.innerHTML = `
  <h2>Your rehearsal snapshot</h2>
  
<p class="take-label">Take ${takeNumber}</p>

  <ul>
    <li><strong>Eyeline stability:</strong> ${data.eyelinePercent}%</li>
    <li><strong>Pace:</strong> ${data.pace}</li>
    <li><strong>Vocal variety:</strong> ${data.vocalVariety}</li>
    <li><strong>Filler words:</strong> ${data.fillerWords}</li>
    <li><strong>Confidence:</strong> ${data.confidenceScore} / 10</li>
  </ul>

  <div class="coach" style="margin-top:12px;">
    <h3>${c.headline || "What stood out most"}</h3>
    <p><strong>Focus:</strong> ${c.focusLabel || "—"}</p>
    <p><strong>Why it matters:</strong> ${c.whyItMatters || ""}</p>
    <p><strong>Quick fix:</strong> ${c.quickFix || ""}</p>
    <p><strong>Next take:</strong> ${c.nextTakePrompt || ""}</p>

      (takeNumber >= 3
      ? `<div class="actions" style="margin-top:16px; text-align:left;">
           <p><strong>Free limit reached:</strong> You’ve used all 3 rehearsal takes.</p>
           <a class="btn btn-next" href="https://YOUR_BOOKING_LINK_HERE" target="_blank" rel="noopener">
             Book a quick review
           </a>
         </div>`
      : `<div class="actions" style="margin-top:16px; text-align:left;">
           <button id="retryBtn" type="button" class="btn btn-next">
             Try another rehearsal
           </button>
         </div>`) +

`;

      })
      .catch((err) => {
        clearTimeout(watchdog);
        resultsBox.innerHTML =
          `<p>Couldn’t load results: <strong>${err.message}</strong></p>` +
          `<p>Check server: <code>node server.js</code> and test <code>/api/results/test</code>.</p>`;
      });
  }, delayMs);
}


