const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const output = document.getElementById('output');
const captureBtn = document.getElementById('capture');

// Ask for camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
  })
  .catch(err => {
    alert('Camera access denied or unavailable.');
  });

captureBtn.addEventListener('click', () => {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  output.innerHTML = '';
  output.appendChild(img);

  // Create download button
  const downloadBtn = document.createElement('a');
  downloadBtn.innerText = 'Download';
  downloadBtn.href = img.src;
  downloadBtn.download = 'photobooth.png';
  output.appendChild(downloadBtn);

  // Create print button
  const printBtn = document.createElement('button');
  printBtn.innerText = 'Print';
  printBtn.onclick = () => {
    const w = window.open('');
    w.document.write('<img src="' + img.src + '" style="width:100%">');
    w.print();
    w.close();
  };
  output.appendChild(printBtn);
});
