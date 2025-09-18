// app.js — pro photobooth features: overlay, flash, live multi preview, scale preview, compose/download

document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const output = document.getElementById('output');
  const countdownEl = document.getElementById('countdown');

  const singleBtn = document.getElementById('single');
  const multiBtn = document.getElementById('multi');
  const menu = document.getElementById('menu');

  const overlayFrame = document.querySelector('.overlay-frame');

  // Admin DOM
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

  // state
  let capturedPhotos = [];
  let lastCapturedSingle = null;
  let adminUnlocked = false;
  let lastSettings = { bg:'#ffffff', frame:'#000000', scale:100 };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Start camera
  async function startCamera(){
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }});
      video.srcObject = stream;
      await new Promise(resolve => {
        if (video.readyState >= 2) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      // play
      video.play().catch(()=>{});
    } catch(e) {
      console.error('camera error', e);
      alert('Camera access required. Please allow camera permissions.');
    }
  }
  startCamera();

  // update preview area style
  function updatePreviewAreaStyle(){
    output.style.backgroundColor = bgColorInput.value || '#ffffff';
    // keep a light border while composing (will be removed for final)
    output.style.border = `8px solid ${frameColorInput.value || '#000000'}`;
  }
  bgColorInput.addEventListener('input', updatePreviewAreaStyle);
  frameColorInput.addEventListener('input', updatePreviewAreaStyle);
  updatePreviewAreaStyle();

  // draw scale preview box (4x6) — uses lastCapturedSingle if present
  function drawScalePreview(){
    const w = scalePreviewCanvas.width;
    const h = scalePreviewCanvas.height;
    scalePreviewCtx.clearRect(0,0,w,h);

    // background + outer frame of preview
    scalePreviewCtx.fillStyle = bgColorInput.value || '#ffffff';
    scalePreviewCtx.fillRect(0,0,w,h);
    scalePreviewCtx.strokeStyle = frameColorInput.value || '#000000';
    scalePreviewCtx.lineWidth = 6;
    scalePreviewCtx.strokeRect(0,0,w,h);

    const scalePercent = parseInt(photoScaleInput.value,10) || 100;

    // draw a slot rectangle representing scaled photo inside the 4x6
    const slotW = w * 0.8;
    const slotH = h * 0.8;
    const drawW = slotW * (scalePercent/100);
    const drawH = slotH * (scalePercent/100);
    const dx = (w - drawW)/2;
    const dy = (h - drawH)/2;

    // inner light rectangle to indicate coverage area
    scalePreviewCtx.fillStyle = 'rgba(255,255,255,0.12)';
    scalePreviewCtx.fillRect(dx, dy, drawW, drawH);

    // if an image exists, draw a small preview cropped/centered to simulate final crop
    if (lastCapturedSingle) {
      const img = new Image();
      img.onload = () => {
        // center-crop the source to cover drawW x drawH
        const ratio = Math.max(drawW / img.width, drawH / img.height);
        const srcW = Math.round(drawW / ratio);
        const srcH = Math.round(drawH / ratio);
        const sx = Math.max(0, Math.round((img.width - srcW)/2));
        const sy = Math.max(0, Math.round((img.height - srcH)/2));
        scalePreviewCtx.drawImage(img, sx, sy, srcW, srcH, dx, dy, drawW, drawH);
      };
      img.src = lastCapturedSingle;
    } else {
      // placeholder text
      scalePreviewCtx.fillStyle = '#ddd';
      scalePreviewCtx.font = '12px Arial';
      scalePreviewCtx.fillText(`Scale: ${scalePercent}%`, 8, 16);
      scalePreviewCtx.fillStyle = 'rgba(0,0,0,0.06)';
      scalePreviewCtx.fillRect((w-slotW)/2, (h-slotH)/2, slotW, slotH);
    }
  }
  photoScaleInput.addEventListener('input', drawScalePreview);

  // countdown with overlay flash each tick
  async function startCountdown(seconds){
    countdownEl.style.display = 'block';
    countdownEl.textContent = seconds;
    for (let s = seconds; s > 0; s--){
      countdownEl.textContent = s;
      // flash overlay for each tick
      overlayFrame.classList.add('flash');
      setTimeout(()=> overlayFrame.classList.remove('flash'), 300);
      await sleep(1000);
    }
    countdownEl.style.display = 'none';
  }

  // capture current video frame -> dataURL
  async function captureFrame(){
    // wait for sizes
    let tries = 0;
    while ((video.videoWidth === 0 || video.videoHeight === 0) && tries < 8) {
      await sleep(60);
      tries++;
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  // compose postcard (async) returns canvas element
  async function composePostcard(images, settings){
    const outW = 1200, outH = 1800; // print canvas (4x6)
    const out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    const ct = out.getContext('2d');

    // background + outer frame
    ct.fillStyle = settings.bg || '#ffffff';
    ct.fillRect(0,0,outW,outH);

    ct.lineWidth = 30;
    ct.strokeStyle = settings.frame || '#000000';
    ct.strokeRect(0,0,outW,outH);

    // layout: 2 columns, rows = ceil(n/2)
    const cols = 2;
    const rows = Math.max(1, Math.ceil(images.length / cols));
    const cellW = outW / cols;
    const cellH = outH / rows;
    const padding = 40;
    const slotW = cellW - padding;
    const slotH = cellH - padding;

    // load images
    const loaded = await Promise.all(images.map(src => new Promise(res=>{
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(im);
      im.src = src;
    })));

    for (let i=0;i<loaded.length;i++){
      const im = loaded[i];
      const col = i % cols;
      const row = Math.floor(i/cols);
      const x = col*cellW + padding/2;
      const y = row*cellH + padding/2;

      const photoW = slotW;
      const photoH = slotH;

      const scaleFactor = (settings.scale || 100)/100;
      const drawW = photoW * scaleFactor;
      const drawH = photoH * scaleFactor;
      const destX = x + (photoW - drawW)/2;
      const destY = y + (photoH - drawH)/2;

      // center-crop source to "cover" drawW x drawH
      const ratio = Math.max(drawW / im.width, drawH / im.height);
      const srcW = Math.round(drawW / ratio);
      const srcH = Math.round(drawH / ratio);
      const sx = Math.max(0, Math.round((im.width - srcW)/2));
      const sy = Math.max(0, Math.round((im.height - srcH)/2));

      ct.drawImage(im, sx, sy, srcW, srcH, destX, destY, drawW, drawH);

      // thin slot frame
      ct.lineWidth = 12;
      ct.strokeStyle = settings.frame || '#000000';
      ct.strokeRect(x, y, photoW, photoH);
    }

    return out;
  }

  // show final canvas with blue download, retake, clear
  function showFinal(canvasEl){
    // remove temporary preview border to avoid double-frame look
    output.style.border = 'none';
    output.innerHTML = '';
    canvasEl.className = 'finalPhoto';
    output.appendChild(canvasEl);

    const controls = document.createElement('div');
    controls.className = 'controlsRow';

    // download anchor (blue)
    const dl = document.createElement('a');
    dl.href = canvasEl.toDataURL('image/png');
    dl.download = '321click_photobooth.png';
    dl.textContent = 'Download';
    dl.className = 'downloadBtn';
    controls.appendChild(dl);

    // retake
    const retake = document.createElement('button');
    retake.textContent = 'Retake';
    retake.onclick = () => { output.innerHTML=''; menu.style.display='flex'; updatePreviewAreaStyle(); };
    controls.appendChild(retake);

    // clear
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    clear.onclick = () => { output.innerHTML=''; capturedPhotos=[]; menu.style.display='flex'; updatePreviewAreaStyle(); };
    controls.appendChild(clear);

    output.appendChild(controls);
    menu.style.display = 'none';
  }

  // show single preview (composed to postcard) — wrapper kept for clarity
  async function handleSingleCapture(){
    menu.style.display = 'none';
    output.innerHTML = '';
    capturedPhotos = [];
    const seconds = parseInt(countdownInput.value,10) || 3;
    await startCountdown(seconds);
    await sleep(80);
    const data = await captureFrame();
    lastCapturedSingle = data;
    drawScalePreview(); // update admin preview
    capturedPhotos.push(data);

    const settings = {
      bg: bgColorInput.value || '#ffffff',
      frame: frameColorInput.value || '#000000',
      scale: parseInt(photoScaleInput.value,10) || 100
    };
    lastSettings = settings;
    const canvasEl = await composePostcard(capturedPhotos, settings);
    showFinal(canvasEl);
  }

  // multi flow: show progressive postcard updates after each shot
  async function handleMultiCapture(){
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
      lastCapturedSingle = data; // for admin preview
      drawScalePreview();

      // update live postcard preview with current images
      const settings = {
        bg: bgColorInput.value || '#ffffff',
        frame: frameColorInput.value || '#000000',
        scale: parseInt(photoScaleInput.value,10) || 100
      };
      lastSettings = settings;
      const previewCanvas = await composePostcard(capturedPhotos, settings);
      // show progressive postcard scaled to fit
      output.innerHTML = '';
      previewCanvas.className = 'finalPhoto';
      output.appendChild(previewCanvas);

      // also show small thumbnails under it
      const thumbsRow = document.createElement('div');
      thumbsRow.style.marginTop = '8px';
      thumbsRow.style.display = 'flex';
      thumbsRow.style.gap = '6px';
      capturedPhotos.forEach(src => {
        const t = new Image(); t.src = src; t.className='thumb';
        thumbsRow.appendChild(t);
      });
      output.appendChild(thumbsRow);

      await sleep(220); // small pause so UI updates smoothly
    }

    // final composition is already shown above; ensure Download/controls appended
    const finalCanvas = await composePostcard(capturedPhotos, lastSettings);
    showFinal(finalCanvas);
  }

  // drawScalePreview uses the function defined earlier in this scope
  function drawScalePreview(){
    // local implementation mirrors earlier UI behaviour
    const w = scalePreviewCanvas.width;
    const h = scalePreviewCanvas.height;
    scalePreviewCtx.clearRect(0,0,w,h);

    scalePreviewCtx.fillStyle = bgColorInput.value || '#ffffff';
    scalePreviewCtx.fillRect(0,0,w,h);
    scalePreviewCtx.strokeStyle = frameColorInput.value || '#000000';
    scalePreviewCtx.lineWidth = 6;
    scalePreviewCtx.strokeRect(0,0,w,h);

    const scalePercent = parseInt(photoScaleInput.value,10) || 100;
    const slotW = w*0.8, slotH = h*0.8;
    const drawW = slotW * (scalePercent/100);
    const drawH = slotH * (scalePercent/100);
    const dx = (w - drawW)/2, dy = (h - drawH)/2;

    // inner rect to show coverage
    scalePreviewCtx.fillStyle = 'rgba(255,255,255,0.08)';
    scalePreviewCtx.fillRect(dx, dy, drawW, drawH);

    // if we have lastCapturedSingle, draw it as a preview inside the draw area
    if (lastCapturedSingle) {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.max(drawW / img.width, drawH / img.height);
        const sW = Math.round(drawW / ratio);
        const sH = Math.round(drawH / ratio);
        const sx = Math.max(0, Math.round((img.width - sW)/2));
        const sy = Math.max(0, Math.round((img.height - sH)/2));
        scalePreviewCtx.drawImage(img, sx, sy, sW, sH, dx, dy, drawW, drawH);
      };
      img.src = lastCapturedSingle;
    } else {
      scalePreviewCtx.fillStyle = '#ccc';
      scalePreviewCtx.font = '12px Arial';
      scalePreviewCtx.fillText(`Scale: ${scalePercent}%`, 8, 16);
    }
  }
  photoScaleInput.addEventListener('input', drawScalePreview);

  // event bindings
  singleBtn.addEventListener('click', handleSingleCapture);
  multiBtn.addEventListener('click', handleMultiCapture);

  // admin unlock
  adminUnlock.addEventListener('click', () => {
    if (adminUnlocked) {
      adminPanel.style.display = adminPanel.style.display === 'block' ? 'none' : 'block';
      drawScalePreview();
      return;
    }
    const pass = prompt('Enter admin password:');
    if (pass === '1234') {
      adminUnlocked = true;
      adminPanel.style.display = 'block';
      drawScalePreview();
    } else if (pass !== null) {
      alert('Wrong password');
    }
  });
  closeAdmin.addEventListener('click', () => adminPanel.style.display = 'none');

  // initial preview draw
  drawScalePreview();
});
