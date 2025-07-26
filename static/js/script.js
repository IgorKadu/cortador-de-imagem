let img   = new Image();
let canvas= document.getElementById('imgCanvas');
let ctx   = canvas.getContext('2d');

let startX, startY, drawing = false;
let rects = [];

// Componentes da UI
const wrapper = document.getElementById('canvasWrapper');
const controls= document.getElementById('controls');
const list    = document.getElementById('rectList');
const input   = document.getElementById('imgInput');
const btnClear= document.getElementById('clearRects');
const btnDown = document.getElementById('downloadCrops');
const fmtSel  = document.getElementById('formatSelect');
const quality = document.getElementById('qualityInput');

input.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    img.onload = () => {
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      wrapper.classList.remove('d-none');
      controls.classList.remove('d-none');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  drawing = true;
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const rectB = canvas.getBoundingClientRect();
  let x = e.clientX - rectB.left;
  let y = e.clientY - rectB.top;
  redraw();
  ctx.strokeStyle = '#dc3545';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, x - startX, y - startY);
});

canvas.addEventListener('mouseup', e => {
  if (!drawing) return;
  const rectB = canvas.getBoundingClientRect();
  let x2 = e.clientX - rectB.left;
  let y2 = e.clientY - rectB.top;
  let x  = Math.min(startX, x2);
  let y  = Math.min(startY, y2);
  let w  = Math.abs(x2 - startX);
  let h  = Math.abs(y2 - startY);
  rects.push({ x, y, w, h, shape: 'rect' });
  drawing = false;
  redraw();
  updateList();
});

btnClear.addEventListener('click', () => {
  rects = [];
  redraw();
  updateList();
});

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  ctx.strokeStyle = '#dc3545'; ctx.lineWidth = 2;
  rects.forEach(r => {
    if (r.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(r.x + r.w/2, r.y + r.h/2, r.w/2, r.h/2, 0, 0, 2*Math.PI);
      ctx.stroke();
    } else {
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  });
}

function updateList() {
  list.innerHTML = '';
  rects.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-center';
    item.innerHTML = `
      <div>
        #${i+1} — x:${r.x}, y:${r.y}, w:${r.w}, h:${r.h}
      </div>
      <div>
        <select data-index="${i}" class="form-select form-select-sm shape-toggle">
          <option value="rect">Retângulo</option>
          <option value="ellipse" ${r.shape==='ellipse'? 'selected':''}>Elipse</option>
        </select>
        <button data-index="${i}" class="btn btn-sm btn-danger ms-2 del-btn">&times;</button>
      </div>`;
    list.appendChild(item);
  });

  // Eventos delete e toggle shape
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.dataset.index;
      rects.splice(idx,1);
      redraw(); updateList();
    };
  });
  document.querySelectorAll('.shape-toggle').forEach(sel => {
    sel.onchange = () => {
      rects[sel.dataset.index].shape = sel.value;
      redraw();
    };
  });
}

btnDown.addEventListener('click', () => {
  if (!rects.length) {
    alert('Marque pelo menos uma área.');
    return;
  }
  const form = new FormData();
  form.append('image', input.files[0]);
  form.append('rects', JSON.stringify(rects));
  form.append('format', fmtSel.value);
  form.append('quality', quality.value);

  fetch('/crop', { method: 'POST', body: form })
    .then(res => {
      if (!res.ok) throw new Error('Erro ao processar.');
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.download= 'crops.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
});
