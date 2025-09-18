// app.js — photobooth with clear/retake/download, multi thumbnails, 4x6 postcard compose + scaling
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const output = document.getElementById('output');
  const countdownEl = document.getElementById('countdown');

  const singleBtn = document.getElementById('single');
  const multiBtn = document.getElementById('multi');
  const menu = document.getElementById('menu');

  const adminUnlock = document.getElementById('adminUnlock');
  const adminPanel = document.getElementById('adminPanel');
  const closeAdmin = document.getElementById('closeAdmin');

  const numShotsInput = document.getElementById('numShots');
  const countdownInput = document.getElementById('countdownTime');
  const bgColorInput = document.getElementById('bgColor');
  const frameColorInput = document.getElementById('frameColor');
  const photoScaleInput = document.getElementById('photoScale');

  // State
  let capturedPhotos = [];
  let lastSettings = { bg: '#ffffff', frame: '#000000', scale: 100 };
  let adminUnlocked = false;

  // Utilities
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      await new Promise(resolve => {
        if (video.readyState >= 2) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      video.play().catch(()=>{/* autoplay may be blocked, ignore */});
    } catch (e) {
      console.error('Camera start error:', e);
      alert('Camera access required. Please allow camera permissions in Safari settings.');
    }
  }
  startCamera();

  // Countdown (returns Promise)
  function startCountdown(seconds) {
    return new Promise(resolve => {
      countdownEl.style.display = 'block';
      countdownEl.textContent = seconds;
      let s = seconds;
      const t = setInterval(() => {
        s--;
        if (s > 0) {
          countdownEl.textContent = s;
        } else {
          clearInterval(t);
          countdownEl.style.display = 'none';
          resolve();
        }
      }, 1000);
    });
  }

  // Capture frame -> dataURL
  async function captureFrame() {
    // ensure video dimensions ready
    let tries = 0;
    while ((video.videoWidth === 0 || video.videoHeight === 0) && tries < 8) {
      await sleep(60);
      tries++;
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  // Live preview style (admin color choices)
  function updateLivePreviewStyle() {
    const bg = bgColorInput.value || '#ffffff';
    const frame = frameColorInput.value || '#000000';
    output.style.backgroundColor = bg;
    output.style.border = `12px solid ${frame}`;
  }
  // init live preview
  updateLivePreviewStyle();
  bgColorInput.addEventListener('input', updateLivePreviewStyle);
  frameColorInput.addEventListener('input', updateLivePreviewStyle);

  // Single flow
  singleBtn.addEventListener('click', async () => {
    menu.style.display = 'none';
    capturedPhotos = [];
    const seconds = parseInt(countdownInput.value, 10) || 3;
    await startCountdown(seconds);
    await sleep(60);
    const data = await captureFrame();
    capturedPhotos = [data];
    // Show single preview (not postcard)
    showSingle(data);
  });

  // Multi flow: live thumbnails + final postcard
  multiBtn.addEventListener('click', async () => {
    menu.style.display = 'none';
    output.innerHTML = '';
    capturedPhotos = [];
    const shots = parseInt(numShotsInput.value, 10) || 4;
    const seconds = parseInt(countdownInput.value, 10) || 3;

    for (let i = 0; i < shots; i++) {
      await startCountdown(seconds);
      await sleep(80);
      const data = await captureFrame();
      capturedPhotos.push(data);
      // thumbnail preview
      const thumb = new Image();
      thumb.src = data;
      thumb.className = 'thumb';
      output.appendChild(thumb);
      await sleep(200);
    }

    // compose postcard using current admin settings
    const settings = {
      bg: bgColorInput.value || '#ffffff',
      frame: frameColorInput.value || '#000000',
      scale: parseInt(photoScaleInput.value, 10) || 100
    };
    lastSettings = settings;
    const resultCanvas = await composePostcard(capturedPhotos, settings);
    showFinal(resultCanvas);
  });

  // Take photo helper used for retake or future automation
  async function takePhotoForMode(mode = 'single') {
    const seconds = parseInt(countdownInput.value, 10) || 3;
    await startCountdown(seconds);
    await sleep(60);
    const data = await captureFrame();
    return data;
  }

  // Compose postcard (async) — returns canvas
  async function composePostcard(images, settings) {
    const outW = 1200, outH = 1800; // print canvas
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ct = out.getContext('2d');

    // background + outer frame
    ct.fillStyle = settings.bg || '#fff';
    ct.fillRect(0,0,outW,outH);
    ct.lineWidth = 30;
    ct.strokeStyle = settings.frame || '#000';
    ct.strokeRect(0,0,outW,outH);

    const cols = 2;
    const rows = Math.ceil(images.length / cols) || 1;
    const cellW = outW / cols;
    const cellH = outH / rows;
    const slotPadding = 40;
    const slotW = cellW - slotPadding;
    const slotH = cellH - slotPadding;

    // load all images
    const loaded = await Promise.all(images.map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(im);
      im.src = src;
    })));

    for (let i = 0; i < loaded.length; i++) {
      const im = loaded[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW + slotPadding/2;
      const y = row * cellH + slotPadding/2;

      // desired draw area (slot)
      const photoW = slotW;
      const photoH = slotH;

      // apply scale (zoom) centered inside slot
      const scaleFactor = (settings.scale || 100) / 100;
      const drawW = photoW * scaleFactor;
      const drawH = photoH * scaleFactor;
      const destX = x + (photoW - drawW)/2;
      const destY = y + (photoH - drawH)/2;

      // center-crop source to cover drawW x drawH (cover)
      const ratio = Math.max(drawW / im.width, drawH / im.height);
      const srcW = Math.round(drawW / ratio);
      const srcH = Math.round(drawH / ratio);
      const sx = Math.max(0, Math.round((im.width - srcW)/2));
      const sy = Math.max(0, Math.round((im.height - srcH)/2));

      ct.drawImage(im, sx, sy, srcW, srcH, destX, destY, drawW, drawH);

      // slot frame inside
      ct.lineWidth = 12;
      ct.strokeStyle = settings.frame || '#000';
      ct.strokeRect(x, y, photoW, photoH);
    }

    return out;
  }

  // Show single preview (not a postcard): include download/clear/retake
  function showSingle(dataUrl) {
    output.innerHTML = '';
    const img = new Image();
    img.src = dataUrl;
    img.className = 'singlePreview';
    output.appendChild(img);

    // controls
    const controls = document.createElement('div');
    controls.className = 'controlsRow';

    // Download (anchor)
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'photobooth.png';
    a.className = 'downloadBtn';
    a.textContent = 'Download';
    controls.appendChild(a);

    // Retake (shows menu)
    const retake = document.createElement('button');
    retake.textContent = 'Retake';
    retake.onclick = () => { output.innerHTML=''; menu.style.display='block'; };
    controls.appendChild(retake);

    // Clear (same behavior: clear + show menu)
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    clear.onclick = () => { output.innerHTML=''; menu.style.display='block'; };
    controls.appendChild(clear);

    output.appendChild(controls);
    menu.style.display = 'none';
  }

  // Show final postcard canvas (with download/retake/clear)
  function showFinal(canvasEl) {
    output.innerHTML = '';
    canvasEl.className = 'finalPhoto';
    output.appendChild(canvasEl);

    const controls = document.createElement('div');
    controls.className = 'controlsRow';

    // Download anchor styled like a button
    const dl = document.createElement('a');
    dl.href = canvasEl.toDataURL('image/png');
    dl.download = 'photobooth.png';
    dl.textContent = 'Download';
    dl.className = 'downloadBtn';
    controls.appendChild(dl);

    // Retake -> show menu so guest can choose
    const retake = document.createElement('button');
    retake.textContent = 'Retake';
    retake.onclick = () => { output.innerHTML=''; menu.style.display='block'; };
    controls.appendChild(retake);

    // Clear -> same as retake but also clears settings? (keeps admin settings)
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    clear.onclick = () => { output.innerHTML=''; capturedPhotos = []; menu.style.display='block'; };
    controls.appendChild(clear);

    output.appendChild(controls);
    menu.style.display = 'none';
  }

  // Admin unlock (one-time per session)
  adminUnlock.addEventListener('click', () => {
    if (adminUnlocked) {
      adminPanel.style.display = adminPanel.style.display === 'block' ? 'none' : 'block';
      return;
    }
    const pass = prompt('Enter admin password:');
    if (pass === '1234') {
      adminUnlocked = true;
      adminPanel.style.display = 'block';
    } else if (pass !== null) {
      alert('Wrong password');
    }
  });
  closeAdmin.addEventListener('click', () => adminPanel.style.display = 'none');

  // keep admin changes live for preview area
  numShotsInput.addEventListener('input', () => {}); // handled when starting multi
  countdownInput.addEventListener('input', () => { /* live update countdown value */ });
  photoScaleInput.addEventListener('input', () => {}); // used during compose
});
