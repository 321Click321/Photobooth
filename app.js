// app.js — single + multi photobooth with scale preview, clear, retake, download, and single outer frame

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
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
  const scalePreviewCanvas = document.getElementById('scalePreview');
  const scalePreviewCtx = scalePreviewCanvas.getContext('2d');

  // State
  let capturedPhotos = [];            // data URLs for the last session
  let lastCapturedSingle = null;      // dataURL of last single capture (used for scale preview)
  let lastSettings = { bg:'#fff', frame:'#000', scale:100 };
  let adminUnlocked = false;

  // small helper
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      await new Promise(resolve => {
        if (video.readyState >= 2) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      // try to play (may be blocked until user interaction)
      video.play().catch(()=>{});
    } catch (err) {
      console.error('Camera error:', err);
      alert('Camera access is required. Please allow camera permissions in Safari settings.');
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

  // Capture current frame and return dataURL
  async function captureFrame() {
    // ensure video dims
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

  // Live preview area styling from admin colors
  function updatePreviewAreaStyle() {
    const bg = bgColorInput.value || '#ffffff';
    const frame = frameColorInput.value || '#000000';
    // Use background and light border in output area while composing
    output.style.backgroundColor = bg;
    output.style.border = `8px solid ${frame}`;
  }
  updatePreviewAreaStyle();
  bgColorInput.addEventListener('input', updatePreviewAreaStyle);
  frameColorInput.addEventListener('input', updatePreviewAreaStyle);

  // Draw scale preview (uses lastCapturedSingle if present)
  function drawScalePreview() {
    const w = scalePreviewCanvas.width;
    const h = scalePreviewCanvas.height;
    scalePreviewCtx.clearRect(0,0,w,h);

    // background showing bg and outer frame
    scalePreviewCtx.fillStyle = bgColorInput.value || '#ffffff';
    scalePreviewCtx.fillRect(0,0,w,h);
    scalePreviewCtx.strokeStyle = frameColorInput.value || '#000000';
    scalePreviewCtx.lineWidth = 6;
    scalePreviewCtx.strokeRect(0,0,w,h);

    const scalePercent = parseInt(photoScaleInput.value,10) || 100;

    if (!lastCapturedSingle) {
      // show a placeholder rectangle showing the scale ratio
      scalePreviewCtx.fillStyle = 'rgba(0,0,0,0.06)';
      const boxW = w*0.7;
      const boxH = h*0.7;
      scalePreviewCtx.fillRect((w-boxW)/2, (h-boxH)/2, boxW, boxH);
      scalePreviewCtx.fillStyle = '#666';
      scalePreviewCtx.font = '12px Arial';
      scalePreviewCtx.fillText(`Scale: ${scalePercent}%`, 10, 18);
      return;
    }

    // draw lastCapturedSingle into preview at scaled size (centered)
    const img = new Image();
    img.onload = () => {
      const slotW = w * 0.8;
      const slotH = h * 0.8;
      const sf = scalePercent/100;
      const drawW = slotW * sf;
      const drawH = slotH * sf;
      const dx = (w - drawW)/2;
      const dy = (h - drawH)/2;

      // center-crop source like cover
      const ratio = Math.max(drawW / img.width, drawH / img.height);
      const sx = Math.max(0, Math.round((img.width - Math.round(drawW/ratio))/2));
      const sy = Math.max(0, Math.round((img.height - Math.round(drawH/ratio))/2));
      const sW = Math.round(drawW/ratio);
      const sH = Math.round(drawH/ratio);

      scalePreviewCtx.drawImage(img, sx, sy, sW, sH, dx, dy, drawW, drawH);
      // overlay text
      scalePreviewCtx.fillStyle = 'rgba(255,255,255,0.8)';
      scalePreviewCtx.font = '12px Arial';
      scalePreviewCtx.fillText(`Scale: ${scalePercent}%`, 10, 16);
    };
    img.src = lastCapturedSingle;
  }
  photoScaleInput.addEventListener('input', drawScalePreview);

  // Show single preview (compose into postcard so download includes frame)
  async function showSingleComposed(dataUrl) {
    // Compose postcard with single image
    const settings = {
      bg: bgColorInput.value || '#ffffff',
      frame: frameColorInput.value || '#000000',
      scale: parseInt(photoScaleInput.value,10) || 100
    };
    lastSettings = settings;
    const canvasEl = await composePostcard([dataUrl], settings);
    showFinal(canvasEl);
  }

  // Show final postcard canvas with controls (download blue, clear, retake)
  function showFinal(canvasEl) {
    // remove CSS border to avoid double frame look
    output.style.border = 'none';
    output.innerHTML = '';
    canvasEl.className = 'finalPhoto';
    output.appendChild(canvasEl);

    const controls = document.createElement('div');
    controls.className = 'controlsRow';

    // Download (anchor styled)
    const dl = document.createElement('a');
    dl.href = canvasEl.toDataURL('image/png');
    dl.download = '321click_photobooth.png';
    dl.textContent = 'Download';
    dl.className = 'downloadBtn';
    controls.appendChild(dl);

    // Retake -> go back to menu
    const retake = document.createElement('button');
    retake.textContent = 'Retake';
    retake.onclick = () => { output.innerHTML = ''; menu.style.display = 'block'; updatePreviewAreaStyle(); };
    controls.appendChild(retake);

    // Clear -> same as retake but also clears capturedPhotos
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    clear.onclick = () => { output.innerHTML = ''; capturedPhotos = []; menu.style.display = 'block'; updatePreviewAreaStyle(); };
    controls.appendChild(clear);

    output.appendChild(controls);
    menu.style.display = 'none';
  }

  // Compose postcard: returns a canvas element (async)
  async function composePostcard(images, settings) {
    const outW = 1200, outH = 1800; // 4x6 printable canvas
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ct = out.getContext('2d');

    // background + outer frame
    ct.fillStyle = settings.bg || '#fff';
    ct.fillRect(0,0,outW,outH);

    // outer frame (single)
    ct.lineWidth = 30;
    ct.strokeStyle = settings.frame || '#000';
    ct.strokeRect(0,0,outW,outH);

    const cols = 2;
    const rows = Math.max(1, Math.ceil(images.length / cols));
    const cellW = outW / cols;
    const cellH = outH / rows;
    const padding = 40;
    const slotW = cellW - padding;
    const slotH = cellH - padding;

    // Load images (promise)
    const loaded = await Promise.all(images.map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(im);
      im.src = src;
    })));

    for (let i=0;i<loaded.length;i++){
      const im = loaded[i];
      const col = i % cols;
      const row = Math.floor(i/cols);
      const x = col * cellW + padding/2;
      const y = row * cellH + padding/2;

      // desired draw area (slot)
      const photoW = slotW;
      const photoH = slotH;

      // scale factor (centered zoom)
      const scaleFactor = (settings.scale||100)/100;
      const drawW = photoW * scaleFactor;
      const drawH = photoH * scaleFactor;
      const destX = x + (photoW - drawW)/2;
      const destY = y + (photoH - drawH)/2;

      // center-crop source like "cover"
      const ratio = Math.max(drawW / im.width, drawH / im.height);
      const sW = Math.round(drawW / ratio);
      const sH = Math.round(drawH / ratio);
      const sx = Math.max(0, Math.round((im.width - sW)/2));
      const sy = Math.max(0, Math.round((im.height - sH)/2));

      ct.drawImage(im, sx, sy, sW, sH, destX, destY, drawW, drawH);

      // draw slot frame (thin) — this is the per-photo inner frame
      ct.lineWidth = 12;
      ct.strokeStyle = settings.frame || '#000';
      ct.strokeRect(x, y, photoW, photoH);
    }

    return out;
  }

  // Single flow: capture, store lastCapturedSingle, compose and show final postcard
  singleBtn.addEventListener('click', async () => {
    menu.style.display = 'none';
    output.innerHTML = '';
    capturedPhotos = [];
    const seconds = parseInt(countdownInput.value,10) || 3;
    await startCountdown(seconds);
    await sleep(80);
    const data = await captureFrame();
    lastCapturedSingle = data;
    drawScalePreview();           // update admin preview if open
    // compose into postcard so download contains frame
    const settings = {
      bg: bgColorInput.value || '#ffffff',
      frame: frameColorInput.value || '#000000',
      scale: parseInt(photoScaleInput.value,10) || 100
    };
    lastSettings = settings;
    const canvasEl = await composePostcard([data], settings);
    showFinal(canvasEl);
  });

  // Multi flow: show live thumbnails and compose final postcard
  multiBtn.addEventListener('click', async () => {
    menu.style.display = 'none';
    output.innerHTML = '';
    capturedPhotos = [];
    const shots = parseInt(numShotsInput.value,10) || 4;
    const seconds = parseInt(countdownInput.value,10) || 3;

    for (let i=0;i<shots;i++){
      await startCountdown(seconds);
      await sleep(80);
      const data = await captureFrame();
      capturedPhotos.push(data);
      // show thumbnail
      const thumb = new Image();
      thumb.src = data;
      thumb.className = 'thumb';
      output.appendChild(thumb);
      // save lastCapturedSingle to allow scale preview
      lastCapturedSingle = data;
      drawScalePreview();
      await sleep(200);
    }

    const settings = {
      bg: bgColorInput.value || '#ffffff',
      frame: frameColorInput.value || '#000000',
      scale: parseInt(photoScaleInput.value,10) || 100
    };
    lastSettings = settings;

    const composited = await composePostcard(capturedPhotos, settings);
    showFinal(composited);
  });

  // drawScalePreview wrapper
  function drawScalePreview() {
    try { // safe guard if admin not present
      const fn = window.drawScalePreviewInternal;
      if (typeof fn === 'function') fn();
    } catch(e){}
  }

  // Expose a function for the earlier defined preview drawing (keeps code modular)
  window.drawScalePreviewInternal = function() {
    // use previously defined drawScalePreview() closure
    // call the closure declared earlier
    // Since we defined drawScalePreview earlier, just call it:
    try {
      // call function defined in outer scope:
      const ev = new Event('noop');
    } catch(e){}
  };
  // Instead of the above no-op, just call the local drawScalePreview function defined earlier:
  // (we defined it earlier in this scope so we can call it directly)
  // but to keep consistency just call the function name:
  // (the function exists above as drawScalePreview)
  // ensure it's available:
  if (typeof drawScalePreview === 'function') {
    // wire to a global so admin input can call it
    window.drawScalePreviewInternal = drawScalePreview;
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
      // draw preview when panel opens
      drawScalePreview();
    } else if (pass !== null) {
      alert('Wrong password');
    }
  });

  closeAdmin.addEventListener('click', () => adminPanel.style.display = 'none');

  // update live preview area on admin changes
  bgColorInput.addEventListener('input', updatePreviewAreaStyle);
  frameColorInput.addEventListener('input', updatePreviewAreaStyle);
  photoScaleInput.addEventListener('input', drawScalePreview);

});
