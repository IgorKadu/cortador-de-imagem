document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos da UI ---
    const imgInput = document.getElementById('imgInput');
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const openEditorBtn = document.getElementById('openEditorBtn');
    const autoGridCheckbox = document.getElementById('autoGridCheckbox');
    const controls = document.getElementById('controls');
    const rectListDiv = document.getElementById('rectList');
    const downloadBtn = document.getElementById('downloadCrops');

    let originalImage = null;
    const finalRects = []; // A lista final de recortes para download

    // --- Lógica Principal ---
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
                finalRects.length = 0;
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    openEditorBtn.addEventListener('click', () => {
        if (originalImage) launchFullscreenEditor();
    });

    function launchFullscreenEditor() {
        // --- Criação do Editor ---
        const overlay = document.createElement('div');
        overlay.id = 'fullscreen-editor-overlay';
        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d');
        
        const instructions = document.createElement('p');
        instructions.className = 'editor-instructions';
        instructions.textContent = 'Desenhe um recorte. Use o mouse ou as setas do teclado para ajustar.';

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'editor-controls';
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Limpar Seleção';
        clearButton.className = 'btn btn-danger';
        const okButton = document.createElement('button');
        okButton.textContent = 'Confirmar Cortes';
        okButton.className = 'btn btn-success';
        
        controlsContainer.appendChild(clearButton);
        controlsContainer.appendChild(okButton);
        overlay.appendChild(instructions);
        overlay.appendChild(canvas);
        overlay.appendChild(controlsContainer);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // --- Estado do Editor ---
        let drawing = false;
        let isDragging = false;
        let startX, startY;
        let gridTemplate = null; // {x, y, w, h}
        let gridOffset = { x: 0, y: 0 };
        let tempRects = []; // Para recortes manuais

        // --- Funções do Editor ---
        const getMousePos = (evt) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (evt.clientX - rect.left) * (canvas.width / rect.width),
                y: (evt.clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        const redraw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(originalImage, 0, 0);
            ctx.strokeStyle = '#198754';
            ctx.lineWidth = 2;

            if (gridTemplate) {
                const { w, h } = gridTemplate;
                const startX = (gridTemplate.x % w) + gridOffset.x;
                const startY = (gridTemplate.y % h) + gridOffset.y;
                for (let y = startY - h; y < originalImage.height; y += h) {
                    for (let x = startX - w; x < originalImage.width; x += w) {
                        ctx.strokeRect(x, y, w, h);
                    }
                }
            } else {
                tempRects.forEach(r => ctx.strokeRect(r.x, r.y, r.w, r.h));
            }
        };

        const clearSelection = () => {
            gridTemplate = null;
            gridOffset = { x: 0, y: 0 };
            tempRects = [];
            redraw();
        };

        const moveSelection = (dx, dy) => {
            if (gridTemplate) {
                gridOffset.x += dx;
                gridOffset.y += dy;
            } else if (tempRects.length > 0) {
                tempRects.forEach(r => {
                    r.x += dx;
                    r.y += dy;
                });
            }
            redraw();
        };

        // --- Event Listeners do Editor ---
        canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            if (gridTemplate || tempRects.length > 0) {
                isDragging = true;
                startX = pos.x;
                startY = pos.y;
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
                const dx = pos.x - startX;
                const dy = pos.y - startY;
                startX = pos.x;
                startY = pos.y;
                moveSelection(dx, dy);
            } else if (drawing) {
                redraw();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 3;
                ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
            } else {
                canvas.style.cursor = (gridTemplate || tempRects.length > 0) ? 'move' : 'crosshair';
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            canvas.style.cursor = 'move';
            if (isDragging) {
                isDragging = false;
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
                    h: Math.abs(height)
                };
                if (autoGridCheckbox.checked) {
                    gridTemplate = drawnRect;
                } else {
                    tempRects.push(drawnRect);
                }
                redraw();
            }
        });

        const handleKeyDown = (e) => {
            const step = e.shiftKey ? 10 : 1;
            switch (e.key) {
                case 'ArrowUp': moveSelection(0, -step); e.preventDefault(); break;
                case 'ArrowDown': moveSelection(0, step); e.preventDefault(); break;
                case 'ArrowLeft': moveSelection(-step, 0); e.preventDefault(); break;
                case 'ArrowRight': moveSelection(step, 0); e.preventDefault(); break;
                case 'Escape': closeEditor(); break;
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        clearButton.addEventListener('click', clearSelection);

        const closeEditor = () => {
            // Confirmação: Transforma a seleção temporária em recortes finais
            finalRects.length = 0;
            if (gridTemplate) {
                const { w, h } = gridTemplate;
                const startX = (gridTemplate.x % w) + gridOffset.x;
                const startY = (gridTemplate.y % h) + gridOffset.y;
                for (let y = startY - h; y < originalImage.height; y += h) {
                    for (let x = startX - w; x < originalImage.width; x += w) {
                        finalRects.push({ x, y, w, h, shape: 'rect' });
                    }
                }
            } else {
                finalRects.push(...tempRects.map(r => ({ ...r, shape: 'rect' })));
            }

            document.body.removeChild(overlay);
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleKeyDown);
            updateMainUI();
        };
        okButton.addEventListener('click', closeEditor);
        
        redraw();
    }

    function updateMainUI() {
        rectListDiv.innerHTML = '';
        if (finalRects.length === 0) {
            controls.classList.add('d-none');
            return;
        }
        controls.classList.remove('d-none');
        const summaryItem = document.createElement('div');
        summaryItem.className = 'list-group-item';
        summaryItem.innerHTML = `<strong>${finalRects.length} recortes prontos para download.</strong>`;
        rectListDiv.appendChild(summaryItem);
    }

    downloadBtn.addEventListener('click', async () => {
        if (!imgInput.files[0] || finalRects.length === 0) {
            alert('Nenhum recorte selecionado para baixar.');
            return;
        }
        const formData = new FormData();
        formData.append('image', imgInput.files[0]);
        formData.append('rects', JSON.stringify(finalRects));
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
