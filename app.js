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

// Multi-photo (3 shots)
multiBtn.addEventListener('click', () => {
  output.innerHTML = '';
  let photos = [];
  let shot = 0;

  function takeNext() {
    if (shot < 3) {
      startCountdown(3, () => {
        const img = takePhoto();
        photos.push(img);
        output.appendChild(img);
        shot++;
        takeNext();
      });
    } else {
      // After all shots, show download/print of last one
      showDownloadPrint(photos[photos.length - 1]);
    }
  }

  takeNext();
});
