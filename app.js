let totalShots = 4; // default value
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const output = document.getElementById('output');
const singleBtn = document.getElementById('single');
const multiBtn = document.getElementById('multi');
const countdownEl = document.getElementById('countdown');

// Start camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
  })
  .catch(err => {
    alert('Camera access denied or unavailable.');
  });

function takePhoto() {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  return img;
}

function showDownloadPrint(img) {
  output.innerHTML = '';
  output.appendChild(img);

  const downloadBtn = document.createElement('a');
  downloadBtn.innerText = 'Download';
  downloadBtn.href = img.src;
  downloadBtn.download = 'photobooth.png';
  output.appendChild(downloadBtn);

  const printBtn = document.createElement('button');
  printBtn.innerText = 'Print';
  printBtn.onclick = () => {
    const w = window.open('');
    w.document.write('<img src="' + img.src + '" style="width:100%">');
    w.print();
    w.close();
  };
  output.appendChild(printBtn);
}

function startCountdown(seconds, callback) {
  countdownEl.style.display = 'block';
  countdownEl.innerText = seconds;
  const interval = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      countdownEl.innerText = seconds;
    } else {
      clearInterval(interval);
      countdownEl.style.display = 'none';
      callback();
    }
  }, 1000);
}

// Single photo
singleBtn.addEventListener('click', () => {
  startCountdown(3, () => {
    const img = takePhoto();
    showDownloadPrint(img);
  });
});

// Multi-photo (4 shots into a 4x6 layout)
multiBtn.addEventListener('click', () => {
  output.innerHTML = '';
  let photos = [];
  let shot = 0;
// use global setting

  function takeNext() {
    if (shot < totalShots) {
      startCountdown(3, () => {
        // Capture photo as base64 string
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL('image/png');
        photos.push(dataURL);

        shot++;
        takeNext();
      });
    } else {
      // All photos taken -> build layout
      const layout = document.createElement('canvas');
      layout.width = 1200;  // 4x6 portrait
      layout.height = 1800;
      const ctx = layout.getContext('2d');

      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, layout.width, layout.height);

      const photoHeight = layout.height / photos.length;

      // Draw photos one by one in order
      function drawPhoto(i) {
        if (i >= photos.length) {
          // All done, export final
          const finalImg = document.createElement('img');
          finalImg.src = layout.toDataURL('image/png');
          showDownloadPrint(finalImg);
          return;
        }
        const img = new Image();
        img.src = photos[i];
        img.onload = () => {
          ctx.drawImage(img, 0, i * photoHeight, layout.width, photoHeight);
          drawPhoto(i + 1); // next photo
        };
      }

      drawPhoto(0);
    }
  }

  takeNext();
});
// Admin simple password (example: 1234)
const adminPassword = "1234";

document.addEventListener("keydown", (e) => {
  if (e.key === "a") { // press 'a' to unlock admin
    const entered = prompt("Enter admin password:");
    if (entered === adminPassword) {
      document.getElementById("adminPanel").style.display = "block";
    }
  }
});

// Listen for number change
document.getElementById("numShots").addEventListener("change", (e) => {
  totalShots = parseInt(e.target.value, 10);
});
