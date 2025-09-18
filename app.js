const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");
const countdownEl = document.getElementById("countdown");

let capturedPhotos = [];
let lastSettings = { bg: "#ffffff", frame: "#000000" };

// 🎥 Start camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => { video.srcObject = stream; })
  .catch(err => console.error("Camera error:", err));

// 📸 Single photo
document.getElementById("single").addEventListener("click", () => {
  startCountdown(() => takePhoto("single"));
});

// 📸 Multi-photo session
document.getElementById("multi").addEventListener("click", () => {
  startMultiCapture();
});

// Countdown
function startCountdown(callback) {
  let count = parseInt(document.getElementById("countdownTime").value, 10) || 3;
  countdownEl.style.display = "block";

  let interval = setInterval(() => {
    countdownEl.textContent = count;
    count--;
    if (count < 0) {
      clearInterval(interval);
      countdownEl.style.display = "none";
      callback();
    }
  }, 1000);
}

// Take photo
function takePhoto(mode, resolve) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (mode === "single") {
    capturedPhotos = [canvas.toDataURL("image/png")];
    finishSession();
  } else if (mode === "multi") {
    capturedPhotos.push(canvas.toDataURL("image/png"));
    resolve();
  }
}

// Multi capture
async function startMultiCapture() {
  capturedPhotos = [];
  let numShots = parseInt(document.getElementById("numShots").value, 10) || 4;

  for (let i = 0; i < numShots; i++) {
    await new Promise(resolve => {
      startCountdown(() => takePhoto("multi", resolve));
    });
  }
  finishSession();
}

// Finish & compose postcard
function finishSession() {
  const bg = document.getElementById("bgColor").value;
  const frame = document.getElementById("frameColor").value;
  lastSettings = { bg, frame };

  const postcard = composePostcard(capturedPhotos, lastSettings);
  showFinal(postcard);
}

// Compose postcard
function composePostcard(photos, settings) {
  const w = 1200, h = 1800; // 4x6 ratio
  const postcardCanvas = document.createElement("canvas");
  postcardCanvas.width = w;
  postcardCanvas.height = h;
  const pctx = postcardCanvas.getContext("2d");

  // Background
  pctx.fillStyle = settings.bg;
  pctx.fillRect(0, 0, w, h);

  // Grid layout
  const cols = 2;
  const rows = Math.ceil(photos.length / cols);
  const photoW = w / cols - 40;
  const photoH = h / rows - 40;

  photos.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    const col = i % cols;
    const row = Math.floor(i / cols);
    img.onload = () => {
      const x = col * (photoW + 40) + 20;
      const y = row * (photoH + 40) + 20;
      pctx.drawImage(img, x, y, photoW, photoH);

      // Frame
      pctx.strokeStyle = settings.frame;
      pctx.lineWidth = 15;
      pctx.strokeRect(x, y, photoW, photoH);
    };
  });

  return postcardCanvas;
}

// Show result with buttons
function showFinal(postcardCanvas) {
  output.innerHTML = "";
  output.appendChild(postcardCanvas);

  const controls = document.createElement("div");
  controls.style.marginTop = "10px";

  // Retake
  const retakeBtn = document.createElement("button");
  retakeBtn.textContent = "Retake";
  retakeBtn.onclick = () => {
    output.innerHTML = "";
    capturedPhotos = [];
  };

  // Clear
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.onclick = () => {
    output.innerHTML = "";
    capturedPhotos = [];
    document.getElementById("menu").style.display = "block";
  };

  // Download
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download";
  downloadBtn.onclick = () => {
    const link = document.createElement("a");
    link.download = "photobooth.png";
    link.href = postcardCanvas.toDataURL("image/png");
    link.click();
  };

  controls.appendChild(retakeBtn);
  controls.appendChild(clearBtn);
  controls.appendChild(downloadBtn);
  output.appendChild(controls);

  // Hide menu after capture
  document.getElementById("menu").style.display = "none";
}

// 🔐 Admin unlock
document.getElementById("adminUnlock").addEventListener("click", () => {
  const pass = prompt("Enter admin password:");
  if (pass === "321click") {
    document.getElementById("adminPanel").style.display = "block";
  }
});

document.getElementById("closeAdmin").addEventListener("click", () => {
  document.getElementById("adminPanel").style.display = "none";
});
