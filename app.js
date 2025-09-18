// app.js - robust full implementation

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const output = document.getElementById('output');
  const countdownEl = document.getElementById('countdown');

  const singleBtn = document.getElementById('single');
  const multiBtn = document.getElementById('multi');
  const retakeBtn = document.getElementById('retake');

  const adminUnlock = document.getElementById('adminUnlock');
  const adminPanel = document.getElementById('adminPanel');
  const closeAdmin = document.getElementById('closeAdmin');
  const updatePreviewBtn = document.getElementById('updatePreview');

  const numShotsInput = document.getElementById('numShots');
  const countdownInput = document.getElementById('countdownTime');
  const templateColorInput = document.getElementById('templateColor');
  const frameColorInput = document.getElementById('frameColor');

  // State
  let numShots = parseInt(numShotsInput.value, 10) || 4;
  let countdownTime = parseInt(countdownInput.value, 10) || 3;
  let capturedPhotos = []; // data URLs
  let lastCanvas = null;   // last composed canvas
  let adminUnlocked = false;

  // Helpers
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      // wait for video metadata
      await new Promise(resolve => {
        if (video.readyState >= 2) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      // ensure playsinline/muted for autoplay on iOS
      try { video.play(); } catch (e) { /* ignore */ }
      console.log('Camera started');
    } catch (err) {
      console.error('Camera error:', err);
      alert('Camera access is required. Please allow camera permissions.');
    }
  }

  startCamera();

  // Countdown returns a Promise
  function startCountdown(seconds) {
    return new Promise(resolve => {
      countdownEl.style.display = 'block';
      let s = seconds;
      countdownEl.textContent = s;
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

  // Capture frame (ensures video size available)
  async function captureFrame() {
    // wait small time if video dimensions are zero
    let tries = 0;
    while ((video.videoWidth === 0 || video.videoHeight === 0) && tries < 8) {
      await sleep(80);
      tries++;
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  // Update live preview visuals (background + output border) so admin sees effect immediately
  function updateLivePreviewStyle() {
    const bg = templateColorInput.value || '#ffffff';
    const frame = frameColorInput.value || '#000000';
    output.style.backgroundColor = bg;
    // use visible border showing frame color (not too thick)
    output.style.border = `12px solid ${frame}`;
  }

  // Compose images onto final postcard canvas (returns dataURL and canvas)
  async function composePostcard(images, settings = {}) {
    const bg = settings.bg || templateColorInput.value || '#ffffff';
    const frame = settings.frame || frameColorInput.value || '#000000';

    const outW = 1200, outH = 1800; // 4x6 portrait at good resolution
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ct = out.getContext('2d');

    // background
    ct.fillStyle = bg;
    ct.fillRect(0, 0, outW, outH);

    // layout logic:
    // if 1 image -> centered large with margin
    // if 2 images -> vertical or 2-up top/bottom (we'll use 2x2 grid behavior)
    // else -> 2x2 grid (or fill available cells)
    const cols = 2;
    const rows = Math.ceil(images.length / cols) || 1;

    const cellW = outW / cols;
    const cellH = outH / rows;

    // shrink photos inside their cell so bg shows
    const shrinkFactor = 0.65; // 65% of cell
    const photoW = cellW * shrinkFactor;
    const photoH = cellH * shrinkFactor;
    const xOffset = (cellW - photoW) / 2;
    const yOffset = (cellH - photoH) / 2;

    // load images
    const loadedImgs = await Promise.all(images.map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(im);
      im.src = src;
    })));

    for (let i = 0; i < loadedImgs.length; i++) {
      const im = loadedImgs[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW + xOffset;
      const y = row * cellH + yOffset;

      // draw cover-style inside slot (center-crop)
      const ratio = Math.max(photoW / im.width, photoH / im.height);
      const srcW = Math.round(photoW / ratio);
      const srcH = Math.round(photoH / ratio);
      const sx = Math.max(0, Math.round((im.width - srcW) / 2));
      const sy = Math.max(0, Math.round((im.height - srcH) / 2));
      ct.drawImage(im, sx, sy, srcW, srcH, x, y, photoW, photoH);

      // frame stroke
      ct.lineWidth = Math.max(4, Math.round(Math.min(outW, outH) * 0.01)); // relative thickness
      ct.strokeStyle = frame;
      ct.strokeRect(x, y, photoW, photoH);
    }

    return { dataUrl: out.toDataURL('image/png'), canvas: out };
  }

  // Show final collage and download
  function showFinal(canvasObj) {
    output.innerHTML = '';
    const img = new Image();
    img.src = canvasObj.toDataURL('image/png');
    img.style.maxWidth = '92%';
    output.appendChild(img);

    // download button
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'photobooth.png';
    a.textContent = '⬇️ Download Photo';
    a.className = 'download-btn';
    a.style.display = 'inline-block';
    a.style.marginTop = '12px';
    output.appendChild(a);

    lastCanvas = canvasObj;
  }

  // Show a quick thumbnail while capturing
  function showThumbnail(dataUrl) {
    const t = new Image();
    t.src = dataUrl;
    t.style.maxWidth = '100px';
    t.style.margin = '6px';
    output.appendChild(t);
  }

  // Single flow
  singleBtn.addEventListener('click', async () => {
    singleBtn.disabled = true;
    multiBtn.disabled = true;
    retakeBtn.style.display = 'none';

    await startCountdown(countdownTime);
    await sleep(80);
    const data = await captureFrame();
    // show single preview composed into 4x6 template as single image
    const { canvas } = await composePostcard([data], { bg: templateColorInput.value, frame: frameColorInput.value });
    showFinal(canvas);

    singleBtn.disabled = false;
    multiBtn.disabled = false;
    retakeBtn.style.display = 'inline-block';
  });

  // Multi flow
  multiBtn.addEventListener('click', async () => {
    singleBtn.disabled = true;
    multiBtn.disabled = true;
    retakeBtn.style.display = 'none';
    capturedPhotos = [];
    output.innerHTML = ''; // start fresh

    for (let i = 0; i < numShots; i++) {
      await startCountdown(countdownTime);
      await sleep(80);
      const data = await captureFrame();
      capturedPhotos.push(data);
      // show thumbnail preview
      showThumbnail(data);
      // short pause to avoid freeze
      await sleep(250);
    }

    // compose final postcard
    const { canvas } = await composePostcard(capturedPhotos, { bg: templateColorInput.value, frame: frameColorInput.value });
    showFinal(canvas);

    singleBtn.disabled = false;
    multiBtn.disabled = false;
    retakeBtn.style.display = 'inline-block';
    capturedPhotos = [];
  });

  // Retake clears output and allows choices again
  retakeBtn.addEventListener('click', () => {
    output.innerHTML = '';
    retakeBtn.style.display = 'none';
    capturedPhotos = [];
  });

  // Admin open (one-time unlock per session)
  adminUnlock.addEventListener('click', () => {
    if (adminUnlocked) {
      // toggle
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

  // Apply admin settings live
  numShotsInput.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) numShots = v;
  });
  countdownInput.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) countdownTime = v;
  });

  // Live preview: update output appearance immediately even before any photos taken
  templateColorInput.addEventListener('input', updateLivePreviewStyle);
  frameColorInput.addEventListener('input', updateLivePreviewStyle);
  updatePreviewBtn.addEventListener('click', async () => {
    // If there is a last canvas (last collage), re-compose it with new colors
    if (lastCanvas) {
      // if we can extract previous images from lastCanvas? We saved lastCanvas only.
      // Instead, if user wants to reapply to the lastCanvas image, we just keep lastCanvas and recompose using lastCanvas image.
      // But the best approach is: if there is window.lastCapturedImages (we store that when we compose), recompose.
      if (window.lastCapturedImages && window.lastCapturedImages.length > 0) {
        const { canvas } = await composePostcard(window.lastCapturedImages, { bg: templateColorInput.value, frame: frameColorInput.value });
        showFinal(canvas);
      } else {
        // fallback: show lastCanvas but with different border/background in the UI
        updateLivePreviewStyle();
        if (lastCanvas) showFinal(lastCanvas);
      }
    } else {
      alert('No previous session to update. Take photos first.');
    }
  });

  // store captured arrays globally when we compose so Update Preview can recompose
  // We hook composePostcard in the flows to set window.lastCapturedImages
  const origCompose = composePostcard;
  composePostcard = async function(images, settings) {
    window.lastCapturedImages = images.slice();
    return await origCompose(images, settings);
  };

  // initialize live preview style on load
  updateLivePreviewStyle();
});
