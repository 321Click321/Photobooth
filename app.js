/* app.js — Photo Booth core
   - Multi-shot capture with countdown
   - Templates: strip (4-up), 2x2 grid, single 4x6
   - Logo overlay (upload in admin)
   - Download / Print
   - Admin settings saved to localStorage
*/

// ---------- state & defaults ----------
let totalShots = parseInt(localStorage.getItem('pb_totalShots') || '4', 10);
let countdownTime = parseInt(localStorage.getItem('pb_countdown') || '3', 10);
let activeTemplate = localStorage.getItem('pb_template') || 'strip';
let logoDataUrl = localStorage.getItem('pb_logo') || null;
let logoScale = parseInt(localStorage.getItem('pb_logoScale') || '25', 10); // %
let logoPos = localStorage.getItem('pb_logoPos') || 'bottom-right';

// DOM
const video = document.getElementById('video');
const canvas = document.getElementById('captureCanvas');
const output = document.getElementById('output');
const countdownEl = document.getElementById('countdown');
const singleBtn = document.getElementById('single');
const multiBtn = document.getElementById('multi');
const templateSelect = document.getElementById('templateSelect');
const retakeBtn = document.getElementById('retake');

// Admin DOM
const adminUnlock = document.getElementById('adminUnlock');
const adminPanel = document.getElementById('adminPanel');
const numShotsInput = document.getElementById('numShots');
const countdownInput = document.getElementById('countdownTime');
const adminTemplate = document.getElementById('adminTemplate');
const logoUpload = document.getElementById('logoUpload');
const logoScaleInput = document.getElementById('logoScale');
const logoPosInput = document.getElementById('logoPos');
const saveSettingsBtn = document.getElementById('saveSettings');
const closeAdminBtn = document.getElementById('closeAdmin');

// Initialize UI from saved settings
function initUIFromSettings(){
  numShotsInput.value = totalShots;
  countdownInput.value = countdownTime;
  adminTemplate.value = activeTemplate;
  templateSelect.value = activeTemplate;
  logoScaleInput.value = logoScale;
  logoPosInput.value = logoPos;
}
initUIFromSettings();

// ---------- camera ----------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = stream;
    return new Promise(resolve => {
      video.onloadedmetadata = () => { video.play(); resolve(); };
    });
  } catch (err) {
    console.error('camera error', err);
    alert('Camera access needed. Please allow camera permissions.');
  }
}
startCamera();

// ---------- helpers ----------
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function startCountdown(seconds){
  return new Promise(resolve => {
    countdownEl.style.display = 'block';
    countdownEl.textContent = seconds;
    let s = seconds;
    const t = setInterval(() => {
      s--;
      if (s > 0) countdownEl.textContent = s;
      else {
        clearInterval(t);
        countdownEl.style.display = 'none';
        resolve();
      }
    }, 1000);
  });
}

function captureFrameDataURL(){
  const ctx = canvas.getContext('2d');
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  // small flash effect
  flashEffect();
  return canvas.toDataURL('image/png');
}

function flashEffect(){
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = 0; el.style.top = 0; el.style.right = 0; el.style.bottom = 0;
  el.style.background = 'white'; el.style.opacity = '0.9'; el.style.zIndex = 99999;
  document.body.appendChild(el);
  setTimeout(()=> el.style.transition = 'opacity 250ms', 10);
  setTimeout(()=> el.style.opacity = 0, 80);
  setTimeout(()=> document.body.removeChild(el), 340);
}

// ---------- composition (templates) ----------
async function composeImages(dataUrls, template){
  // target print sizes (pixels) — choose large enough for good prints
  // We'll treat 4x6 portrait as 1200x1800
  const P4W = 1200, P4H = 1800;

  if(template === 'strip'){
    // vertical 4-up (portrait); supports variable shots, but will stack
    const count = dataUrls.length;
    const canvasOut = document.createElement('canvas');
    canvasOut.width = P4W;
    canvasOut.height = P4H;
    const ctx = canvasOut.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0,canvasOut.width,canvasOut.height);

    const slotH = Math.floor(canvasOut.height / count);
    for(let i=0;i<count;i++){
      await drawImageOnCtx(ctx, dataUrls[i], 0, i*slotH, canvasOut.width, slotH);
    }
    applyLogoToCanvas(ctx, canvasOut);
    return canvasOut.toDataURL('image/png');
  }

  if(template === 'grid'){
    // 2x2 grid on landscape-ish canvas; we will put on 1600x1200
    const canvasOut = document.createElement('canvas');
    canvasOut.width = 1600;
    canvasOut.height = 1200;
    const ctx = canvasOut.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0,canvasOut.width,canvasOut.height);

    const cols = 2, rows = Math.ceil(dataUrls.length/cols);
    const cellW = Math.floor(canvasOut.width / cols);
    const cellH = Math.floor(canvasOut.height / rows);
    for(let i=0;i<dataUrls.length;i++){
      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * cellH;
      await drawImageOnCtx(ctx, dataUrls[i], x, y, cellW, cellH);
    }
    applyLogoToCanvas(ctx, canvasOut);
    return canvasOut.toDataURL('image/png');
  }

  if(template === 'single4x6'){
    // center single on 4x6
    const canvasOut = document.createElement('canvas');
    canvasOut.width = P4W;
    canvasOut.height = P4H;
    const ctx = canvasOut.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0,canvasOut.width,canvasOut.height);

    // draw centered with margins
    await drawImageOnCtx(ctx, dataUrls[0], 40, 40, canvasOut.width - 80, canvasOut.height - 80);
    applyLogoToCanvas(ctx, canvasOut);
    return canvasOut.toDataURL('image/png');
  }

  // fallback: just use first
  return dataUrls[0];
}

function drawImageOnCtx(ctx, dataUrl, x, y, w, h){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      // preserve aspect ratio, cover the box
      const ratio = Math.max(w/img.width, h/img.height);
      const sw = Math.ceil(w/ratio);
      const sh = Math.ceil(h/ratio);
      const sx = Math.floor((img.width - sw)/2);
      const sy = Math.floor((img.height - sh)/2);
      // draw as cover
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      res();
    };
    img.onerror = () => { console.warn('img load err'); res(); };
    img.src = dataUrl;
  });
}

function applyLogoToCanvas(ctx, canvasEl){
  if(!logoDataUrl) return;
  const img = new Image();
  img.src = logoDataUrl;
  // We draw synchronously when loaded; but applyLogoToCanvas is called after images loaded
  // So we return a Promise-based approach if needed; here we'll draw when loaded (async)
  img.onload = () => {
    const baseW = canvasEl.width;
    const baseH = canvasEl.height;
    const scale = logoScale / 100;
    const logoW = Math.floor(baseW * 0.25 * scale);
    const logoH = Math.floor( (img.height/img.width) * logoW );
    let dx = baseW - logoW - 30;
    let dy = baseH - logoH - 30;
    if(logoPos === 'bottom-left'){ dx = 30; dy = baseH - logoH - 30; }
    if(logoPos === 'top-right'){ dx = baseW - logoW - 30; dy = 30; }
    if(logoPos === 'top-left'){ dx = 30; dy = 30; }
    ctx.globalAlpha = 0.95;
    ctx.drawImage(img, dx, dy, logoW, logoH);
    ctx.globalAlpha = 1;
  };
}

// ---------- flow: single & multi ----------
singleBtn.addEventListener('click', async () => {
  const url = await doCaptureSequence(1);
  showResultAndActions(url);
});

multiBtn.addEventListener('click', async () => {
  const shots = parseInt(totalShots, 10) || 4;
  const urls = await doCaptureSequence(shots);
  const outDataUrl = await composeImages(urls, activeTemplate);
  showResultAndActions(outDataUrl);
});

async function doCaptureSequence(count){
  output.innerHTML = '';
  const results = [];
  for(let i=0;i<count;i++){
    await startCountdown(countdownTime);
    // small pause for camera to stabilize
    await sleep(150);
    const d = captureFrameDataURL();
    results.push(d);
    // small feedback in output: show thumbnail while capturing
    const thumb = document.createElement('img'); thumb.src = d; thumb.style.maxWidth = '120px'; thumb.style.margin='6px';
    output.appendChild(thumb);
    await sleep(250);
  }
  return results;
}

// ---------- present final result + actions ----------
function showResultAndActions(dataUrl){
  output.innerHTML = '';
  const finalImg = document.createElement('img');
  finalImg.src = dataUrl;
  finalImg.style.maxWidth = '100%';
  finalImg.style.border = '2px solid #333';
  finalImg.style.borderRadius = '8px';
  output.appendChild(finalImg);

  // download
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'photo-strip.png';
  a.className = 'btn';
  a.textContent = 'Download';
  output.appendChild(a);

  // print
  const p = document.createElement('button');
  p.className = 'btn';
  p.textContent = 'Print';
  p.onclick = () => openPrintWindow(dataUrl);
  output.appendChild(p);

  // QR helper (attempts to create QR via a public API if online)
  const q = document.createElement('button');
  q.className = 'btn';
  q.textContent = 'Generate QR (online)';
  q.onclick = async () => {
    try {
      // Warning: encoding large data urls into QR may fail or be too large.
      // Best practice: upload image to a server and point QR to that URL.
      const api = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';
      const enc = encodeURIComponent(dataUrl);
      const qrUrl = api + enc;
      window.open(qrUrl, '_blank');
    } catch(err){ alert('QR generation failed — try uploading to a gallery first.'); }
  };
  output.appendChild(q);

  retakeBtn.style.display = 'inline-block';
  retakeBtn.onclick = () => {
    output.innerHTML = '';
    retakeBtn.style.display = 'none';
  };
}

function openPrintWindow(dataUrl){
  const w = window.open('', '_blank');
  const html = `
    <html><head><title>Print</title>
    <style>body{margin:0;padding:0;text-align:center} img{max-width:100%;height:auto}</style>
    </head><body><img src="${dataUrl}" /></body></html>`;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=> w.print(), 600);
}

// ---------- admin panel logic ----------
adminUnlock.addEventListener('click', async () => {
  const pass = prompt('Enter admin password:');
  if(pass === '1234'){
    adminPanel.style.display = 'block';
    adminPanel.setAttribute('aria-hidden','false');
  } else {
    alert('Wrong password');
  }
});

closeAdminBtn.addEventListener('click', () => {
  adminPanel.style.display = 'none';
  adminPanel.setAttribute('aria-hidden','true');
});

// logo upload
logoUpload.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    logoDataUrl = reader.result;
    localStorage.setItem('pb_logo', logoDataUrl);
    alert('Logo uploaded (saved for this device).');
  };
  reader.readAsDataURL(f);
});

// save settings
saveSettingsBtn.addEventListener('click', () => {
  totalShots = parseInt(numShotsInput.value || numShotsInput.getAttribute('value'), 10) || 4;
  countdownTime = parseInt(countdownInput.value || countdownInput.getAttribute('value'), 10) || 3;
  activeTemplate = adminTemplate.value || 'strip';
  logoScale = parseInt(logoScaleInput.value, 10) || 25;
  logoPos = logoPosInput.value || 'bottom-right';

  // persist
  localStorage.setItem('pb_totalShots', String(totalShots));
  localStorage.setItem('pb_countdown', String(countdownTime));
  localStorage.setItem('pb_template', activeTemplate);
  localStorage.setItem('pb_logoScale', String(logoScale));
  localStorage.setItem('pb_logoPos', logoPos);

  templateSelect.value = activeTemplate;
  alert('Settings saved.');
});

templateSelect.addEventListener('change', (e) => {
  activeTemplate = e.target.value;
  localStorage.setItem('pb_template', activeTemplate);
});
