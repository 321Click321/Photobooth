let totalShots = 4;     // default number of photos
let countdownTime = 3;  // default countdown seconds
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
  startCountdown(countdownTime, () => {
   ...
});
    const img = takePhoto();
    showDownloadPrint(img);
  });
});

// Multi-photo (X shots into a 4x6 layout)
multiBtn.addEventListener('click', () => {
  output.innerHTML = '';
  let photos = [];
  let shot = 0;

  function takeNext() {
    if (shot < totalShots) {  // uses global value
    startCountdown(countdownTime, () => {
   ...
});
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
      // build layout as before...
      const layout = document.createElement('canvas');
      layout.width = 1200;
      layout.height = 1800;
      const ctx = layout.getContext('2d');

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, layout.width, layout.height);

      const photoHeight = layout.height / photos.length;

      function drawPhoto(i) {
        if (i >= photos.length) {
          const finalImg = document.createElement('img');
          finalImg.src = layout.toDataURL('image/png');
          showDownloadPrint(finalImg);
          return;
        }
        const img = new Image();
        img.src = photos[i];
        img.onload = () => {
          ctx.drawImage(img, 0, i * photoHeight, layout.width, photoHeight);
          drawPhoto(i + 1);
        };
      }

      drawPhoto(0);
    }
  }

  takeNext();
});
// Admin simple password (tap secret button)
const adminPassword = "1234";

document.getElementById("adminUnlock").addEventListener("click", () => {
  const entered = prompt("Enter admin password:");
  if (entered === adminPassword) {
    document.getElementById("adminPanel").style.display = "block";
  }
});

// Update settings
document.getElementById("numShots").addEventListener("change", (e) => {
  totalShots = parseInt(e.target.value, 10);
});

document.getElementById("countdownTime").addEventListener("change", (e) => {
  countdownTime = parseInt(e.target.value, 10);
});
