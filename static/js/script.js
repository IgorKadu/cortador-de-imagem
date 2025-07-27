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
    const finalRects = [];

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

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'editor-controls';
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Limpar / Reiniciar';
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

        // --- NOVO: Máquina de estados para o modo de grade ---
        let editorState = 'IDLE'; // IDLE, DRAWING, ADJUSTING
        let gridState = 'DRAW_CROP'; // DRAW_CROP, DRAW_X_STEP, DRAW_Y_STEP, GRID_COMPLETE
        
        let startX, startY;
        let tempRects = [];
        
        // Variáveis para a definição da grade
        let cropBox = null;
        let xStep = null;
        let yStep = null;

        const updateInstructions = () => {
            if (autoGridCheckbox.checked) {
                switch (gridState) {
                    case 'DRAW_CROP':
                        instructions.textContent = 'Passo 1: Desenhe um retângulo sobre o primeiro item.';
                        break;
                    case 'DRAW_X_STEP':
                        instructions.textContent = 'Passo 2: Arraste do início do 1º item ao início do 2º item (horizontal).';
                        break;
                    case 'DRAW_Y_STEP':
                        instructions.textContent = 'Passo 3: Arraste do início do 1º item ao início do item abaixo.';
                        break;
                    case 'GRID_COMPLETE':
                        instructions.textContent = 'Grade completa! Clique em "Confirmar" ou "Limpar".';
                        break;
                }
            } else {
                instructions.textContent = 'Desenhe os recortes. Use o mouse para mover ou apague com "Limpar".';
            }
        };
        
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
            
            // Desenha a grade final se estiver completa
            if (gridState === 'GRID_COMPLETE') {
                ctx.strokeStyle = '#198754';
                ctx.lineWidth = 2;
                for (let y = cropBox.y; y < originalImage.height; y += yStep) {
                    for (let x = cropBox.x; x < originalImage.width; x += xStep) {
                        ctx.strokeRect(x, y, cropBox.w, cropBox.h);
                    }
                }
            } else if (autoGridCheckbox.checked) {
                // Desenha os elementos de ajuda para criar a grade
                if (cropBox) {
                    ctx.strokeStyle = '#198754';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
                }
            } else {
                // Desenha recortes manuais
                ctx.strokeStyle = '#198754';
                ctx.lineWidth = 2;
                tempRects.forEach(r => ctx.strokeRect(r.x, r.y, r.w, r.h));
            }
        };

        const reset = () => {
            editorState = 'IDLE';
            gridState = 'DRAW_CROP';
            cropBox = null;
            xStep = null;
            yStep = null;
            tempRects = [];
            updateInstructions();
            redraw();
        };

        canvas.addEventListener('mousedown', (e) => {
            editorState = 'DRAWING';
            const pos = getMousePos(e);
            startX = pos.x;
            startY = pos.y;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (editorState !== 'DRAWING') return;
            const pos = getMousePos(e);
            redraw();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            if (gridState === 'DRAW_X_STEP' || gridState === 'DRAW_Y_STEP') {
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            } else {
                ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            if (editorState !== 'DRAWING') return;
            editorState = 'IDLE';
            const pos = getMousePos(e);
            const width = pos.x - startX;
            const height = pos.y - startY;

            if (autoGridCheckbox.checked) {
                if (gridState === 'DRAW_CROP') {
                    if (Math.abs(width) < 5 || Math.abs(height) < 5) { redraw(); return; }
                    cropBox = {
                        x: width > 0 ? startX : pos.x,
                        y: height > 0 ? startY : pos.y,
                        w: Math.abs(width),
                        h: Math.abs(height)
                    };
                    gridState = 'DRAW_X_STEP';
                } else if (gridState === 'DRAW_X_STEP') {
                    xStep = Math.abs(width);
                    if (xStep < 1) { redraw(); return; }
                    gridState = 'DRAW_Y_STEP';
                } else if (gridState === 'DRAW_Y_STEP') {
                    yStep = Math.abs(height);
                    if (yStep < 1) { redraw(); return; }
                    gridState = 'GRID_COMPLETE';
                }
            } else {
                if (Math.abs(width) < 5 || Math.abs(height) < 5) { redraw(); return; }
                tempRects.push({
                    x: width > 0 ? startX : pos.x,
                    y: height > 0 ? startY : pos.y,
                    w: Math.abs(width),
                    h: Math.abs(height)
                });
            }
            updateInstructions();
            redraw();
        });

        const closeEditor = () => {
            finalRects.length = 0;
            if (autoGridCheckbox.checked && gridState === 'GRID_COMPLETE') {
                for (let y = cropBox.y; y < originalImage.height; y += yStep) {
                    for (let x = cropBox.x; x < originalImage.width; x += xStep) {
                        const rectW = Math.min(cropBox.w, originalImage.width - x);
                        const rectH = Math.min(cropBox.h, originalImage.height - y);
                        if (rectW > 0 && rectH > 0) {
                            finalRects.push({ x, y, w: rectW, h: rectH, shape: 'rect' });
                        }
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

        const handleKeyDown = (e) => { if (e.key === 'Escape') closeEditor(); };
        document.addEventListener('keydown', handleKeyDown);
        clearButton.addEventListener('click', reset);
        okButton.addEventListener('click', closeEditor);
        
        reset();
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
