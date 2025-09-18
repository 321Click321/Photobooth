const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");

const singleBtn = document.getElementById("single");
const multiBtn = document.getElementById("multi");
const retakeBtn = document.getElementById("retake");
const countdownEl = document.getElementById("countdown");

const adminPanel = document.getElementById("adminPanel");
const adminUnlockBtn = document.getElementById("adminUnlock");
const closeAdminBtn = document.getElementById("closeAdmin");

let capturedPhotos = [];
let isMulti = false;
let numShots = 4;
let countdownTime = 3;

// Access camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
  })
  .catch(err => console.error("Camera error:", err));

// Countdown
function countdown(cb) {
  let timeLeft = countdownTime;
  countdownEl.style.display = "block";
  countdownEl.textContent = timeLeft;

  const timer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timer);
      countdownEl.style.display = "none";
      cb();
    } else {
      countdownEl.textContent = timeLeft;
    }
  }, 1000);
}

// Take photo
function takePhoto(cb) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/png");
  capturedPhotos.push(dataUrl);
  cb && cb(dataUrl);
}

// Start single photo
singleBtn.addEventListener("click", () => {
  isMulti = false;
  capturedPhotos = [];
  countdown(() => {
    takePhoto(photo => {
      showPreview(photo);
    });
  });
});

// Start multi-photo
multiBtn.addEventListener("click", () => {
  isMulti = true;
  capturedPhotos = [];
  let shotsTaken = 0;

  function takeNext() {
    countdown(() => {
      takePhoto(() => {
        shotsTaken++;
        if (shotsTaken < numShots) {
          setTimeout(takeNext, 500);
        } else {
          finishSession();
        }
      });
    });
  }

  takeNext();
});

// Retake
retakeBtn.addEventListener("click", () => {
  output.innerHTML = "";
  capturedPhotos = [];
  singleBtn.disabled = false;
  multiBtn.disabled = false;
  retakeBtn.style.display = "none";
});

// Show preview for single photo
function showPreview(photo) {
  output.innerHTML = "";
  const img = new Image();
  img.src = photo;
  output.appendChild(img);

  retakeBtn.style.display = "inline-block";
}

// Finish multi-session: create postcard layout
function finishSession() {
  output.innerHTML = "";

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 1200;  // 4x6 postcard (portrait)
  finalCanvas.height = 1800;
  const fctx = finalCanvas.getContext("2d");

  // Background color from admin panel
  const bgColor = document.getElementById("templateColor")?.value || "#ffffff";
  fctx.fillStyle = bgColor;
  fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  // Place photos in 2x2 grid with padding
  const rows = 2, cols = 2;
  const cellW = finalCanvas.width / cols;
  const cellH = finalCanvas.height / rows;
  const photoW = cellW * 0.85; // shrink to 85% of cell
  const photoH = cellH * 0.85;
  const xOffset = (cellW - photoW) / 2;
  const yOffset = (cellH - photoH) / 2;

  capturedPhotos.forEach((photo, i) => {
    const img = new Image();
    img.src = photo;
    img.onload = () => {
      const x = (i % cols) * cellW + xOffset;
      const y = Math.floor(i / cols) * cellH + yOffset;
      fctx.drawImage(img, x, y, photoW, photoH);

      if (i === capturedPhotos.length - 1) {
        const finalImg = new Image();
        finalImg.src = finalCanvas.toDataURL("image/png");
        output.appendChild(finalImg);
      }
    };
  });

  capturedPhotos = [];
  singleBtn.disabled = false;
  multiBtn.disabled = false;
  retakeBtn.style.display = "inline-block";
}

// ---------- Admin unlock ----------
adminUnlockBtn.addEventListener("click", () => {
  const pass = prompt("Enter admin password:");
  if (pass === "1234") {
    adminPanel.style.display = "block";
  } else if (pass !== null) {
    alert("Wrong password");
  }
});

// ---------- Close Admin Panel ----------
closeAdminBtn.addEventListener("click", () => {
  adminPanel.style.display = "none";
});

// ---------- Sync admin inputs ----------
document.getElementById("numShots").addEventListener("input", e => {
  numShots = parseInt(e.target.value) || 4;
});

document.getElementById("countdownTime").addEventListener("input", e => {
  countdownTime = parseInt(e.target.value) || 3;
});
