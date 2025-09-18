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

let numShots = parseInt(numShotsInput.value, 10);
let countdownTime = parseInt(countdownTimeInput.value, 10);

// Start camera
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
    console.error("Camera error:", err);
    alert("Could not access camera. Please allow camera permissions.");
  }
}

startCamera();

// Capture single frame
function capturePhoto() {
  const context = canvas.getContext("2d");
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;

  canvas.width = w;
  canvas.height = h;
  context.drawImage(video, 0, 0, w, h);

  return canvas.toDataURL("image/png");
}

// Display a single photo
function displayPhoto(photoData) {
  output.innerHTML = "";
  const img = document.createElement("img");
  img.src = photoData;
  img.style.maxWidth = "100%";
  img.style.border = "2px solid #333";
  img.style.borderRadius = "8px";
  output.appendChild(img);

  // show Retake
  retakeBtn.style.display = "inline-block";
}

// Display collage
function displayCollage(images) {
  output.innerHTML = "";

  const cols = Math.min(images.length, 2); 
  const rows = Math.ceil(images.length / cols);

  const singleW = 320;
  const singleH = 240;

  const collage = document.createElement("canvas");
  const ctx = collage.getContext("2d");
  collage.width = cols * singleW;
  collage.height = rows * singleH;

  let loaded = 0;
  images.forEach((data, i) => {
    const img = new Image();
    img.onload = () => {
      const x = (i % cols) * singleW;
      const y = Math.floor(i / cols) * singleH;
      ctx.drawImage(img, x, y, singleW, singleH);

      loaded++;
      if (loaded === images.length) {
        const finalImg = document.createElement("img");
        finalImg.src = collage.toDataURL("image/png");
        finalImg.style.maxWidth = "100%";
        finalImg.style.border = "2px solid #333";
        finalImg.style.borderRadius = "8px";
        output.innerHTML = "";
        output.appendChild(finalImg);

        // show Retake
        retakeBtn.style.display = "inline-block";
      }
    };
    img.src = data;
  });
}

// Countdown function
function startCountdown(seconds) {
  return new Promise((resolve) => {
    countdownEl.style.display = "block";
    let remaining = seconds;

    countdownEl.textContent = remaining;
    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        countdownEl.style.display = "none";
        resolve();
      } else {
        countdownEl.textContent = remaining;
      }
    }, 1000);
  });
}

// Single photo capture
singleBtn.addEventListener("click", async () => {
  retakeBtn.style.display = "none";
  await startCountdown(countdownTime);
  const photo = capturePhoto();
  displayPhoto(photo);
});

// Multi-photo capture
multiBtn.addEventListener("click", async () => {
  retakeBtn.style.display = "none";
  let photos = [];

  for (let i = 0; i < numShots; i++) {
    await startCountdown(countdownTime);
    photos.push(capturePhoto());
  }

  displayCollage(photos);
});

// Retake button clears output
retakeBtn.addEventListener("click", () => {
  output.innerHTML = "";
  retakeBtn.style.display = "none";
});

// Admin panel
adminUnlockBtn.addEventListener("click", () => {
  adminPanel.style.display = 
    adminPanel.style.display === "none" ? "block" : "none";
});

numShotsInput.addEventListener("input", () => {
  numShots = parseInt(numShotsInput.value, 10);
});

countdownTimeInput.addEventListener("input", () => {
  countdownTime = parseInt(countdownTimeInput.value, 10);
});
