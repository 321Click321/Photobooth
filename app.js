const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");

let capturedPhotos = [];
let isMulti = false;
let numShots = 4;
let countdownTime = 3;
let lastSettings = { bg: "#ffffff", frame: "#000000", scale: 100 };

// Start camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => { video.srcObject = stream; })
  .catch(err => console.error("Camera error:", err));

// Countdown helper
function startCountdown(cb) {
  let countdown = countdownTime;
  const countdownEl = document.getElementById("countdown");
  countdownEl.style.display = "block";
  countdownEl.innerText = countdown;
  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownEl.innerText = countdown;
    } else {
      clearInterval(interval);
      countdownEl.style.display = "none";
      cb();
    }
  }, 1000);
}

// Capture single shot
function takePhoto() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// Multi-session handler
function startSession(multi) {
  isMulti = multi;
  capturedPhotos = [];
  if (isMulti) {
    captureMulti(0);
  } else {
    startCountdown(() => {
      const photo = takePhoto();
      capturedPhotos.push(photo);
      finishSession();
    });
  }
}

function captureMulti(i) {
  if (i >= numShots) {
    finishSession();
    return;
  }
  startCountdown(() => {
    const photo = takePhoto();
    capturedPhotos.push(photo);

    // Show live preview
    const img = document.createElement("img");
    img.src = photo;
    img.style.width = "120px";
    img.style.margin = "5px";
    output.appendChild(img);

    setTimeout(() => captureMulti(i + 1), 500);
  });
}

// Final postcard creation
function finishSession() {
  const bg = document.getElementById("bgColor").value;
  const frame = document.getElementById("frameColor").value;
  const scale = parseInt(document.getElementById("photoScale").value, 10) || 100;
  lastSettings = { bg, frame, scale };

  const postcard = composePostcard(capturedPhotos, lastSettings);
  showFinal(postcard);
}

// Compose postcard with scaling
function composePostcard(photos, settings) {
  const w = 1200, h = 1800; // 4x6 ratio
  const postcardCanvas = document.createElement("canvas");
  postcardCanvas.width = w;
  postcardCanvas.height = h;
  const pctx = postcardCanvas.getContext("2d");

  // Background
  pctx.fillStyle = settings.bg;
  pctx.fillRect(0, 0, w, h);

  // Outer border
  pctx.strokeStyle = settings.frame;
  pctx.lineWidth = 30;
  pctx.strokeRect(0, 0, w, h);

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

      const scaleFactor = settings.scale / 100;
      const drawW = photoW * scaleFactor;
      const drawH = photoH * scaleFactor;
      const offsetX = x + (photoW - drawW) / 2;
      const offsetY = y + (photoH - drawH) / 2;

      pctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      // Slot frame
      pctx.strokeStyle = settings.frame;
      pctx.lineWidth = 15;
      pctx.strokeRect(x, y, photoW, photoH);
    };
  });

  return postcardCanvas;
}

// Show final output
function showFinal(canvasEl) {
  output.innerHTML = "";
  output.appendChild(canvasEl);

  // Download button
  const dl = document.createElement("a");
  dl.innerText = "Download Photo";
  dl.href = canvasEl.toDataURL("image/png");
  dl.download = "photobooth.png";
  dl.className = "downloadBtn";
  output.appendChild(dl);

  // Retake options
  const retake = document.createElement("button");
  retake.innerText = "Retake";
  retake.onclick = () => {
    output.innerHTML = "";
  };
  output.appendChild(retake);
}

// Event listeners
document.getElementById("single").onclick = () => startSession(false);
document.getElementById("multi").onclick = () => {
  numShots = parseInt(document.getElementById("numShots").value, 10);
  startSession(true);
};

// Admin toggle
document.getElementById("adminUnlock").onclick = () => {
  const pass = prompt("Enter Admin Password:");
  if (pass === "321click") {
    document.getElementById("adminPanel").style.display = "block";
  } else {
    alert("Wrong password!");
  }
};
document.getElementById("closeAdmin").onclick = () => {
  document.getElementById("adminPanel").style.display = "none";
};
