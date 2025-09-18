// app.js — full file with Retake + admin controls

// ---------- Elements ----------
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const singleBtn = document.getElementById("single");
const multiBtn = document.getElementById("multi");
const retakeBtn = document.getElementById("retake");
const countdownEl = document.getElementById("countdown");

const numShotsInput = document.getElementById("numShots");
const countdownTimeInput = document.getElementById("countdownTime");
const adminUnlockBtn = document.getElementById("adminUnlock");
const adminPanel = document.getElementById("adminPanel");

// ---------- State (defaults from inputs) ----------
let numShots = parseInt(numShotsInput?.value || "4", 10);
let countdownTime = parseInt(countdownTimeInput?.value || "3", 10);

// ---------- Camera setup (wait for metadata for iPad) ----------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (err) {
    console.error("Camera start error:", err);
    alert("Cannot access camera. Please allow camera permissions in Safari settings.");
  }
}
startCamera();

// ---------- Helpers ----------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function startCountdown(seconds) {
  return new Promise((resolve) => {
    if (!countdownEl) return resolve();
    countdownEl.style.display = "block";
    let remaining = seconds;
    countdownEl.textContent = remaining;
    const t = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        countdownEl.textContent = remaining;
      } else {
        clearInterval(t);
        countdownEl.style.display = "none";
        resolve();
      }
    }, 1000);
  });
}

function capturePhotoDataURL() {
  const ctx = canvas.getContext("2d");
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  flashEffect();
  return canvas.toDataURL("image/png");
}

function flashEffect() {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = 0;
  el.style.top = 0;
  el.style.right = 0;
  el.style.bottom = 0;
  el.style.background = "white";
  el.style.opacity = "0.9";
  el.style.zIndex = 99999;
  document.body.appendChild(el);
  setTimeout(() => (el.style.transition = "opacity 220ms"), 10);
  setTimeout(() => (el.style.opacity = 0), 80);
  setTimeout(() => el.remove(), 320);
}

// ---------- Display single photo ----------
function displayPhoto(dataUrl) {
  output.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.maxWidth = "100%";
  img.style.borderRadius = "8px";
  img.style.border = "2px solid #333";
  output.appendChild(img);

  // Show retake button, keep single/multi hidden until retake pressed
  retakeBtn.style.display = "inline-block";
}

// ---------- Display stacked vertical collage ----------
async function displayCollage(dataUrls) {
  output.innerHTML = "";

  if (!dataUrls || dataUrls.length === 0) {
    output.textContent = "No photos captured.";
    return;
  }

  // Load all images first
  const imgs = await Promise.all(
    dataUrls.map(
      (src) =>
        new Promise((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => resolve(im); // still resolve to avoid blocking
          im.src = src;
        })
    )
  );

  // Decide output width (keep reasonable for performance)
  const outWidth = Math.min(1200, video.videoWidth || 1200);
  const heights = imgs.map((im) => Math.round((outWidth * im.height) / im.width));
  const totalHeight = heights.reduce((a, b) => a + b, 0);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outWidth;
  outCanvas.height = totalHeight;
  const ctx = outCanvas.getContext("2d");

  // white background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

  // draw sequentially
  let y = 0;
  for (let i = 0; i < imgs.length; i++) {
    const im = imgs[i];
    const h = heights[i];
    // draw image covering its area while preserving aspect ratio (center-crop)
    const ratio = Math.max(outWidth / im.width, h / im.height);
    const sw = Math.round(outWidth / ratio);
    const sh = Math.round(h / ratio);
    const sx = Math.max(0, Math.round((im.width - sw) / 2));
    const sy = Math.max(0, Math.round((im.height - sh) / 2));
    ctx.drawImage(im, sx, sy, sw, sh, 0, y, outWidth, h);
    y += h;
  }

  // Export and show
  const finalData = outCanvas.toDataURL("image/png");
  const finalImg = document.createElement("img");
  finalImg.src = finalData;
  finalImg.style.maxWidth = "100%";
  finalImg.style.borderRadius = "8px";
  finalImg.style.border = "2px solid #333";
  output.appendChild(finalImg);

  // Show retake
  retakeBtn.style.display = "inline-block";
}

// ---------- UI state helpers ----------
function hideCaptureButtons() {
  singleBtn.style.display = "none";
  multiBtn.style.display = "none";
}

function showCaptureButtons() {
  singleBtn.style.display = "inline-block";
  multiBtn.style.display = "inline-block";
}

// ---------- Flow: Single capture ----------
singleBtn.addEventListener("click", async () => {
  // hide choices while capturing
  hideCaptureButtons();
  retakeBtn.style.display = "none";

  await startCountdown(countdownTime);
  // small delay so camera frame stabilizes
  await sleep(120);
  const data = capturePhotoDataURL();
  displayPhoto(data);
});

// ---------- Flow: Multi capture ----------
multiBtn.addEventListener("click", async () => {
  hideCaptureButtons();
  retakeBtn.style.display = "none";

  const shots = Number.isInteger(numShots) && numShots > 0 ? numShots : 4;
  const collected = [];

  for (let i = 0; i < shots; i++) {
    await startCountdown(countdownTime);
    await sleep(120);
    const d = capturePhotoDataURL();
    // small thumbnail feedback
    const thumb = document.createElement("img");
    thumb.src = d;
    thumb.style.maxWidth = "120px";
    thumb.style.margin = "6px";
    output.appendChild(thumb);

    collected.push(d);
    await sleep(180);
  }

  // Compose and display stacked collage
  await displayCollage(collected);
});

// ---------- Retake behavior ----------
retakeBtn.addEventListener("click", () => {
  // Clear output, hide retake, show capture options again
  output.innerHTML = "";
  retakeBtn.style.display = "none";
  showCaptureButtons();
});

// ---------- Admin unlock (simple prompt) ----------
adminUnlockBtn.addEventListener("click", () => {
  const pass = prompt("Enter admin password:");
  if (pass === "1234") {
    adminPanel.style.display = adminPanel.style.display === "block" ? "none" : "block";
  } else if (pass !== null) {
    alert("Wrong password");
  }
});
// Close Admin Panel button
const closeAdminBtn = document.getElementById("closeAdmin");
if (closeAdminBtn) {
  closeAdminBtn.addEventListener("click", () => {
    adminPanel.style.display = "none";
  });
}
// ---------- Admin inputs update live ----------
if (numShotsInput) {
  numShotsInput.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) numShots = v;
  });
}
if (countdownTimeInput) {
  countdownTimeInput.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) countdownTime = v;
  });
}

// ---------- Helpful: hide retake initially ----------
retakeBtn.style.display = "none";
