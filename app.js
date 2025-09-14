// ------------------ Variables ------------------
let totalShots = 4;      // default number of photos
let countdownTime = 3;   // default countdown seconds
let currentShot = 0;
let capturedImages = [];

// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const countdownEl = document.getElementById("countdown");

// ------------------ Camera Setup ------------------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    console.error("Camera error:", err);
    alert("Could not access camera. Please allow camera permissions.");
  }
}
startCamera();

// ------------------ Countdown ------------------
function startCountdown(seconds, onComplete) {
  countdownEl.style.display = "block";
  countdownEl.textContent = seconds;

  const timer = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      countdownEl.textContent = seconds;
    } else {
      clearInterval(timer);
      countdownEl.style.display = "none";
      onComplete();
    }
  }, 1000);
}

// ------------------ Capture Photo ------------------
function capturePhoto() {
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// ------------------ Display Result ------------------
function displaySinglePhoto(imgData) {
  output.innerHTML = "";
  const img = document.createElement("img");
  img.src = imgData;
  img.style.maxWidth = "100%";
  img.style.borderRadius = "8px";
  output.appendChild(img);
}

function displayCollage(images) {
  output.innerHTML = "";
  const rows = 2;
  const cols = Math.ceil(images.length / rows);

  // Create a collage canvas
  const collage = document.createElement("canvas");
  const ctx = collage.getContext("2d");
  const w = 640;
  const h = 480;
  collage.width = cols * w;
  collage.height = rows * h;

  images.forEach((imgData, i) => {
    const img = new Image();
    img.src = imgData;
    const x = (i % cols) * w;
    const y = Math.floor(i / cols) * h;
    img.onload = () => ctx.drawImage(img, x, y, w, h);
  });

  const finalImg = document.createElement("img");
  finalImg.src = collage.toDataURL("image/png");
  finalImg.style.maxWidth = "100%";
  finalImg.style.border = "2px solid #333";
  finalImg.style.borderRadius = "8px";
  output.appendChild(finalImg);
}

// ------------------ Button Actions ------------------
document.getElementById("single").addEventListener("click", () => {
  startCountdown(countdownTime, () => {
    const imgData = capturePhoto();
    displaySinglePhoto(imgData);
  });
});

document.getElementById("multi").addEventListener("click", () => {
  capturedImages = [];
  currentShot = 0;
  takeNextPhoto();
});

function takeNextPhoto() {
  if (currentShot < totalShots) {
    startCountdown(countdownTime, () => {
      const imgData = capturePhoto();
      capturedImages.push(imgData);
      currentShot++;
      takeNextPhoto();
    });
  } else {
    displayCollage(capturedImages);
  }
}

// ------------------ Admin Unlock ------------------
const adminPassword = "1234";

document.getElementById("adminUnlock").addEventListener("click", () => {
  const entered = prompt("Enter admin password:");
  if (entered === adminPassword) {
    document.getElementById("adminPanel").style.display = "block";
  } else {
    alert("Wrong password");
  }
});

document.getElementById("closeAdmin").addEventListener("click", () => {
  document.getElementById("adminPanel").style.display = "none";
});

// Update settings live
document.getElementById("numShots").addEventListener("change", (e) => {
  totalShots = parseInt(e.target.value, 10);
});

document.getElementById("countdownTime").addEventListener("change", (e) => {
  countdownTime = parseInt(e.target.value, 10);
});
