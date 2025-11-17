/* QR Reader PRO - Dual Auto Mode + Full history buttons
   Requires lucide script (included via CDN in index.html) and jsQR + qrcode-generator
*/

let currentPage = 1;
const itemsPerPage = 6;

// helpers
function showToast(msg, timeout = 2500){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(()=> t.classList.remove('show'), timeout);
}

function isValidURL(text){
  try { new URL(text); return true; } catch { return false; }
}

function autoResizeTextarea(){
  this.style.height='auto';
  this.style.height = (this.scrollHeight) + 'px';
}
document.getElementById('textInput').addEventListener('input', autoResizeTextarea);

// QR read from File (drag/drop or file input)
function readQRCode(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = function(e){
      const img = new Image();
      img.onload = function(){
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        try{
          const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if(code) resolve(code.data);
          else reject('No se detectó QR');
        }catch(err){ reject('Error procesando imagen'); }
      };
      img.onerror = ()=> reject('No se pudo cargar la imagen');
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// QR read from URL
function readQRCodeFromURL(url){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function(){
      try{
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if(code) resolve(code.data);
        else reject('No se detectó QR en la URL');
      }catch(e){ reject('Error procesando imagen'); }
    };
    img.onerror = ()=> reject('No se pudo cargar la imagen desde la URL (CORS o inexistente)');
    img.src = url;
  });
}

// generate stylized QR (SVG)
function generateStylizedQR(text,size=240){
  const qr = qrcode(0,'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  const cell = size / (modules + 8);
  const margin = cell * 4;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  function addCorner(x,y){
    const corner = cell*7;
    const r = cell;
    svg += `<rect x="${x}" y="${y}" width="${corner}" height="${corner}" fill="black" rx="${r}" ry="${r}"/>`;
    svg += `<rect x="${x+cell}" y="${y+cell}" width="${corner-2*cell}" height="${corner-2*cell}" fill="white" rx="${r}" ry="${r}"/>`;
    svg += `<rect x="${x+2*cell}" y="${y+2*cell}" width="${corner-4*cell}" height="${corner-4*cell}" fill="black" rx="${r*2.5}" ry="${r*2.5}"/>`;
  }
  addCorner(margin,margin);
  addCorner(size-margin-cell*7,margin);
  addCorner(margin,size-margin-cell*7);
  for(let r=0;r<modules;r++){
    for(let c=0;c<modules;c++){
      if(qr.isDark(r,c)){
        const x = margin + c*cell;
        const y = margin + r*cell;
        if(!((r<7 && c<7) || (r<7 && c>=modules-7) || (r>=modules-7 && c<7))){
          svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="black" />`;
        }
      }
    }
  }
  svg += '</svg>';
  return svg;
}

// history management
function saveHistory(text, title=""){
  let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
  // avoid duplicates: allow same text if different timestamp
  history.unshift({ text, title, date: new Date().toISOString(), mini: generateStylizedQR(text,64) });
  // keep only last 200
  if(history.length>200) history = history.slice(0,200);
  localStorage.setItem('qrHistory', JSON.stringify(history));
  updateHistoryDisplay();
}

function fetchFavicon(url){
  try{
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  }catch(e){ return null; }
}

function updateHistoryDisplay(){
  const historyList = document.getElementById('historyList');
  const searchInput = document.getElementById('searchInput');
  const searchTerm = (searchInput.value || '').toLowerCase();
  let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
  if(searchTerm) history = history.filter(item => (item.text || '').toLowerCase().includes(searchTerm) || (item.title||'').toLowerCase().includes(searchTerm));
  const totalPages = Math.max(1, Math.ceil(history.length / itemsPerPage));
  if(currentPage>totalPages) currentPage = totalPages;
  const start = (currentPage-1)*itemsPerPage;
  const items = history.slice(start,start+itemsPerPage);
  historyList.innerHTML = '';
  items.forEach((item,idx)=>{
    const globalIndex = start + idx;
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="history-item-qr">${item.mini}</div>
      <div class="history-item-content">
        <div class="history-item-title" title="${item.title||item.text}">${(item.title||item.text).substring(0,40)}</div>
        <div class="history-item-text">${(item.text||'').substring(0,120)}</div>
      </div>
      <div class="history-item-actions">
        <button class="action-icon view-btn" data-index="${globalIndex}" title="Ver"><i data-lucide="eye"></i></button>
        ${isValidURL(item.text) ? `<img class="fav" src="${fetchFavicon(item.text)}" alt="" width="20" height="20" style="border-radius:4px;margin-left:4px">` : ''}
        ${isValidURL(item.text) ? `<button class="action-icon open-url-btn" data-url="${item.text}" title="Abrir enlace"><i data-lucide="external-link"></i></button>` : ''}
        <button class="action-icon copy-btn" data-text="${encodeURIComponent(item.text||'')}" title="Copiar"><i data-lucide="copy"></i></button>
        <button class="action-icon delete-btn" data-index="${globalIndex}" title="Eliminar"><i data-lucide="trash-2"></i></button>
      </div>
    `;
    historyList.appendChild(li);
  });

  document.getElementById('currentPage').textContent = `${currentPage} / ${totalPages}`;

  // attach events
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', ()=>{
    const i = parseInt(btn.getAttribute('data-index'));
    viewHistoryItem(i);
  }));
  document.querySelectorAll('.open-url-btn').forEach(btn => btn.addEventListener('click', ()=>{
    const u = btn.getAttribute('data-url');
    window.open(u,'_blank');
  }));
  document.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', ()=>{
    const t = decodeURIComponent(btn.getAttribute('data-text')||'');
    navigator.clipboard.writeText(t).then(()=> showToast('Copiado al portapapeles'));
  }));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', ()=>{
    const i = parseInt(btn.getAttribute('data-index'));
    deleteHistoryItem(i);
  }));

  // render lucide icons for these items
  if(window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function viewHistoryItem(index){
  const history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
  const item = history[index];
  if(!item) return;
  document.getElementById('textInput').value = item.text;
  autoResizeTextarea.call(document.getElementById('textInput'));
  document.getElementById('qrOutput').innerHTML = generateStylizedQR(item.text,280);
}

// delete
function deleteHistoryItem(index){
  let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
  if(index<0 || index>=history.length) return;
  history.splice(index,1);
  localStorage.setItem('qrHistory', JSON.stringify(history));
  updateHistoryDisplay();
  showToast('Elemento eliminado');
}

// handle file input and drag/drop
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
dropZone.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', ()=>{ const f = fileInput.files[0]; if(f) handleFile(f); });

dropZone.addEventListener('dragover',(e)=>{ e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave',()=> dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop',(e)=>{ e.preventDefault(); dropZone.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if(f) handleFile(f); });

function handleFile(file){
  readQRCode(file).then(text=>{
    document.getElementById('textInput').value = text;
    autoResizeTextarea.call(document.getElementById('textInput'));
    document.getElementById('qrOutput').innerHTML = generateStylizedQR(text,280);
    saveHistory(text);
    showToast('QR leído');
  }).catch(err=>{ console.error(err); showToast(err); });
}

// copy and download
document.getElementById('copyBtn').addEventListener('click', ()=>{
  const t = document.getElementById('textInput').value;
  if(!t) return showToast('Nada para copiar');
  navigator.clipboard.writeText(t).then(()=> showToast('Copiado al portapapeles'));
});

document.getElementById('downloadBtn').addEventListener('click', ()=>{
  const svg = document.querySelector('#qrOutput svg');
  if(!svg) return;
  const data = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([data], {type:'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download='qr.svg'; document.body.appendChild(a); a.click(); a.remove();
});

// pagination & search
document.getElementById('prevPage').addEventListener('click', ()=>{ if(currentPage>1) { currentPage--; updateHistoryDisplay(); } });
document.getElementById('nextPage').addEventListener('click', ()=>{ const h = JSON.parse(localStorage.getItem('qrHistory')||'[]'); const total = Math.max(1,Math.ceil(h.length/itemsPerPage)); if(currentPage<total){ currentPage++; updateHistoryDisplay(); } });
document.getElementById('searchInput').addEventListener('input', ()=>{ currentPage=1; updateHistoryDisplay(); });

// theme toggle
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', ()=>{
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  showToast('Tema cambiado');
});

// auto-detect ?url=
const params = new URLSearchParams(window.location.search);
const qrImageUrl = params.get('url');
if(qrImageUrl){
  (async ()=>{
    try{
      const t = await readQRCodeFromURL(qrImageUrl);
      document.getElementById('textInput').value = t;
      autoResizeTextarea.call(document.getElementById('textInput'));
      document.getElementById('qrOutput').innerHTML = generateStylizedQR(t,280);
      saveHistory(t);
      showToast('QR leído desde URL');
    }catch(e){ console.error(e); showToast(e); }
  })();
}

// initialize
document.addEventListener('DOMContentLoaded', ()=>{
  updateHistoryDisplay();
  // render icons initially
  if(window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
});
