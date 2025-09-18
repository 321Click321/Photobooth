const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");

const singleBtn = document.getElementById("single");
const multiBtn = document.getElementById("multi");
const retakeBtn = document.getElementById("retake");
const countdownEl = document.getElementById("countdown");

let capturedPhotos = [];
let numShots = 4;
let countdownTime = 3;
let lastSettings = { bg: "#ffffff", frame: "#000000" };

// Start camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(err => console.error("Camera error:", err));

// Countdown
function startCountdown(seconds, callback) {
  countdownEl.style.display = "block";
  countdownEl.textContent = seconds;
  let counter = seconds;

  const interval = setInterval(() => {
    counter--;
    if (counter > 0) {
      countdownEl.textContent = counter;
    } else {
      clearInterval(interval);
      countdownEl.style.display = "none";
      callback();
    }
  }, 1000);
}

// Capture one photo
function capturePhoto() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// Single photo mode
singleBtn.addEventListener("click", () => {
  startCountdown(countdownTime, () => {
    output.innerHTML = "";
    const photo = capturePhoto();
    const img = new Image();
    img.src = photo;
    output.appendChild(img);
    retakeBtn.style.display = "inline-block";
  });
});

// Multi-session
multiBtn.addEventListener("click", () => {
  capturedPhotos = [];
  takeNextPhoto(0);
});

function takeNextPhoto(i) {
  if (i < numShots) {
    startCountdown(countdownTime, () => {
      const photo = capturePhoto();
      capturedPhotos.push(photo);
      setTimeout(() => takeNextPhoto(i + 1), 500); // small pause
    });
  } else {
    finishSession();
  }
}

// Build final collage
function finishSession() {
  output.innerHTML = "";

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 1200;
  finalCanvas.height = 1800;
  const fctx = finalCanvas.getContext("2d");

  // Get current admin colors
  const bgColor = document.getElementById("templateColor")?.value || "#ffffff";
  const frameColor = document.getElementById("frameColor")?.value || "#000000";
  lastSettings = { bg: bgColor, frame: frameColor };

  // Fill background
  fctx.fillStyle = bgColor;
  fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  const rows = 2, cols = 2;
  const cellW = finalCanvas.width / cols;
  const cellH = finalCanvas.height / rows;
  const photoW = cellW * 0.65;  // now 65%
  const photoH = cellH * 0.65;
  const xOffset = (cellW - photoW) / 2;
  const yOffset = (cellH - photoH) / 2;

  let loaded = 0;
  capturedPhotos.forEach((photo, i) => {
    const img = new Image();
    img.src = photo;
    img.onload = () => {
      const x = (i % cols) * cellW + xOffset;
      const y = Math.floor(i / cols) * cellH + yOffset;

      fctx.drawImage(img, x, y, photoW, photoH);

      // Border
      fctx.lineWidth = 20;
      fctx.strokeStyle = frameColor;
      fctx.strokeRect(x, y, photoW, photoH);

      loaded++;
      if (loaded === capturedPhotos.length) {
        showFinalCollage(finalCanvas);
      }
    };
  });

  capturedPhotos = [];
  retakeBtn.style.display = "inline-block";
}

// Show collage and download button
function showFinalCollage(canvasObj) {
  output.innerHTML = "";
  const finalImg = new Image();
  finalImg.src = canvasObj.toDataURL("image/png");
  output.appendChild(finalImg);

  const downloadBtn = document.createElement("a");
  downloadBtn.textContent = "⬇️ Download Photo";
  downloadBtn.href = finalImg.src;
  downloadBtn.download = "photobooth.png";
  downloadBtn.className = "download-btn";
  output.appendChild(downloadBtn);

  window.lastCanvas = canvasObj;
}

// Retake
retakeBtn.addEventListener("click", () => {
  output.innerHTML = "";
  retakeBtn.style.display = "none";
  capturedPhotos = [];
});

// Admin unlock
const adminUnlock = document.getElementById("adminUnlock");
const adminPanel = document.getElementById("adminPanel");
const closeAdmin = document.getElementById("closeAdmin");

adminUnlock.addEventListener("click", () => {
  const pass = prompt("Enter Admin Password:");
  if (pass === "1234") {
    adminPanel.style.display = "block";
  } else {
    alert("Wrong password");
  }
});

closeAdmin.addEventListener("click", () => {
  adminPanel.style.display = "none";
});

// Admin settings
document.getElementById("numShots").addEventListener("input", e => {
  numShots = parseInt(e.target.value);
});
document.getElementById("countdownTime").addEventListener("input", e => {
  countdownTime = parseInt(e.target.value);
});

// 🎨 Live background + frame preview
document.getElementById("templateColor").addEventListener("input", e => {
  output.style.backgroundColor = e.target.value;
});
document.getElementById("frameColor").addEventListener("input", e => {
  output.style.border = `10px solid ${e.target.value}`;
});
