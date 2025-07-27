document.addEventListener('DOMContentLoaded', () => {
    // Elementos da UI principal
    const imgInput = document.getElementById('imgInput');
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const openEditorBtn = document.getElementById('openEditorBtn');
    const autoGridCheckbox = document.getElementById('autoGridCheckbox');
    const controls = document.getElementById('controls');
    const rectListDiv = document.getElementById('rectList');
    const downloadBtn = document.getElementById('downloadCrops');

    let originalImage = null;
    const rects = [];

    imgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            originalImage = new Image();
            originalImage.onload = () => {
                imagePreview.src = originalImage.src;
                previewSection.classList.remove('d-none');
                controls.classList.add('d-none');
                rects.length = 0;
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    openEditorBtn.addEventListener('click', () => {
        if (originalImage) launchFullscreenEditor();
    });

    function launchFullscreenEditor() {
        const overlay = document.createElement('div');
        overlay.id = 'fullscreen-editor-overlay';
        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d');
        const okButton = document.createElement('button');
        okButton.textContent = 'Confirmar Cortes';
        okButton.className = 'btn btn-success btn-lg editor-button';
        okButton.style.left = '50%';
        okButton.style.transform = 'translateX(-50%)';
        overlay.appendChild(canvas);
        overlay.appendChild(okButton);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        let drawing = false;
        let isDragging = false;
        let selectedRectIndex = null;
        let dragOffsetX, dragOffsetY;
        let startX, startY;

        const getMousePos = (evt) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (evt.clientX - rect.left) * (canvas.width / rect.width),
                y: (evt.clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        const getRectAtPos = (pos) => {
            for (let i = rects.length - 1; i >= 0; i--) {
                const r = rects[i];
                if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
                    return i;
                }
            }
            return null;
        };

        const redraw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(originalImage, 0, 0);
            rects.forEach((r, index) => {
                ctx.strokeStyle = (isDragging && index === selectedRectIndex) ? '#ffc107' : '#198754';
                ctx.lineWidth = (isDragging && index === selectedRectIndex) ? 3 : 2;
                ctx.strokeRect(r.x, r.y, r.w, r.h);
            });
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            const rectIndex = getRectAtPos(pos);
            if (rectIndex !== null && !autoGridCheckbox.checked) {
                isDragging = true;
                selectedRectIndex = rectIndex;
                const selectedRect = rects[selectedRectIndex];
                dragOffsetX = pos.x - selectedRect.x;
                dragOffsetY = pos.y - selectedRect.y;
                canvas.style.cursor = 'grabbing';
            } else {
                drawing = true;
                startX = pos.x;
                startY = pos.y;
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            const pos = getMousePos(e);
            if (isDragging) {
                const selectedRect = rects[selectedRectIndex];
                selectedRect.x = pos.x - dragOffsetX;
                selectedRect.y = pos.y - dragOffsetY;
                redraw();
            } else if (drawing) {
                redraw();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 3;
                ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
            } else {
                canvas.style.cursor = (getRectAtPos(pos) !== null && !autoGridCheckbox.checked) ? 'move' : 'crosshair';
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            canvas.style.cursor = 'crosshair';
            if (isDragging) {
                isDragging = false;
                selectedRectIndex = null;
                redraw();
            } else if (drawing) {
                drawing = false;
                const pos = getMousePos(e);
                const width = pos.x - startX;
                const height = pos.y - startY;
                if (Math.abs(width) < 5 || Math.abs(height) < 5) {
                    redraw();
                    return;
                }
                const drawnRect = {
                    x: width > 0 ? startX : pos.x,
                    y: height > 0 ? startY : pos.y,
                    w: Math.abs(width),
                    h: Math.abs(height),
                    shape: 'rect'
                };

                if (autoGridCheckbox.checked) {
                    rects.length = 0;
                    const templateW = drawnRect.w;
                    const templateH = drawnRect.h;
                    const startX = drawnRect.x % templateW;
                    const startY = drawnRect.y % templateH;
                    for (let y = startY; y + templateH <= originalImage.height; y += templateH) {
                        for (let x = startX; x + templateW <= originalImage.width; x += templateW) {
                            rects.push({ x: x, y: y, w: templateW, h: templateH, shape: 'rect' });
                        }
                    }
                } else {
                    rects.push(drawnRect);
                }
                redraw();
            }
        });

        canvas.addEventListener('mouseleave', () => {
            canvas.style.cursor = 'default';
        });

        redraw();

        const closeEditor = () => {
            document.body.removeChild(overlay);
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleEsc);
            updateMainUI();
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape') closeEditor();
        };
        okButton.addEventListener('click', closeEditor);
        document.addEventListener('keydown', handleEsc);
    }

    function updateMainUI() {
        rectListDiv.innerHTML = '';
        if (rects.length === 0) {
            controls.classList.add('d-none');
            return;
        }
        controls.classList.remove('d-none');
        if (rects.length > 10) {
            const summaryItem = document.createElement('div');
            summaryItem.className = 'list-group-item';
            summaryItem.innerHTML = `<strong>${rects.length} recortes gerados.</strong><br><small>Clique em "Recortar e Baixar" para obter o arquivo ZIP.</small>`;
            rectListDiv.appendChild(summaryItem);
        } else {
            rects.forEach((r, index) => {
                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.textContent = `Recorte #${index + 1} (${r.shape}) - W: ${Math.round(r.w)}, H: ${Math.round(r.h)}`;
                rectListDiv.appendChild(item);
            });
        }
    }

    downloadBtn.addEventListener('click', async () => {
        if (!imgInput.files[0] || rects.length === 0) {
            alert('Nenhum recorte selecionado para baixar.');
            return;
        }
        const formData = new FormData();
        formData.append('image', imgInput.files[0]);
        formData.append('rects', JSON.stringify(rects));
        formData.append('format', document.getElementById('formatSelect').value);
        formData.append('quality', document.getElementById('qualityInput').value);
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Processando...';
        try {
            const response = await fetch('/crop', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Erro do servidor: ${await response.text()}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'crops.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(`Falha no download: ${error.message}`);
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Recortar e Baixar';
        }
    });
});
