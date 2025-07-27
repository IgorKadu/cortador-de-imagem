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

        // --- Estado do Editor ---
        let editorState = 'IDLE'; // IDLE, DRAWING, ADJUSTING_GRID, DRAGGING_HANDLE
        let startX, startY;
        let tempRects = [];
        
        let gridParams = null; // { x, y, w, h, xStep, yStep }
        let spacingHandles = {
            x: { x: 0, y: 0, size: 10, isDragging: false },
            y: { x: 0, y: 0, size: 10, isDragging: false }
        };

        const updateInstructions = () => {
            if (autoGridCheckbox.checked) {
                instructions.textContent = gridParams ? 
                    'Ajuste o espaçamento com as alças ou mova a grade com o mouse/setas.' : 
                    'Desenhe um retângulo sobre o primeiro item para criar a grade.';
            } else {
                instructions.textContent = 'Desenhe os recortes ou mova-os com o mouse.';
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
            
            if (gridParams) {
                // --- INÍCIO DA CORREÇÃO ---
                // Salva o estado do canvas (sem a máscara)
                ctx.save();
                // Cria a máscara de recorte com o tamanho exato da imagem
                ctx.beginPath();
                ctx.rect(0, 0, originalImage.width, originalImage.height);
                ctx.clip();
                // --- FIM DA CORREÇÃO ---

                // Agora, desenha a grade. Qualquer parte que vaze será visualmente cortada pela máscara.
                ctx.strokeStyle = '#198754'; // Verde
                ctx.lineWidth = 2;
                for (let y = gridParams.y; y < originalImage.height; y += gridParams.yStep) {
                    for (let x = gridParams.x; x < originalImage.width; x += gridParams.xStep) {
                        ctx.strokeRect(x, y, gridParams.w, gridParams.h);
                    }
                }
                
                // Restaura o canvas, removendo a máscara para desenhar as alças
                ctx.restore();

                // Desenha as alças DEPOIS de remover a máscara, para que sempre fiquem visíveis
                const handleSize = spacingHandles.x.size;
                spacingHandles.x.x = gridParams.x + gridParams.xStep - (handleSize / 2);
                spacingHandles.x.y = gridParams.y + (gridParams.h / 2) - (handleSize / 2);
                spacingHandles.y.x = gridParams.x + (gridParams.w / 2) - (handleSize / 2);
                spacingHandles.y.y = gridParams.y + gridParams.yStep - (handleSize / 2);

                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.fillRect(spacingHandles.x.x, spacingHandles.x.y, handleSize, handleSize);
                ctx.fillRect(spacingHandles.y.x, spacingHandles.y.y, handleSize, handleSize);

            } else {
                ctx.strokeStyle = '#198754';
                ctx.lineWidth = 2;
                tempRects.forEach(r => ctx.strokeRect(r.x, r.y, r.w, r.h));
            }
        };

        const reset = () => {
            editorState = 'IDLE';
            gridParams = null;
            tempRects = [];
            updateInstructions();
            redraw();
        };

        const moveSelection = (dx, dy) => {
            if (gridParams) {
                gridParams.x += dx;
                gridParams.y += dy;
            } else {
                tempRects.forEach(r => { r.x += dx; r.y += dy; });
            }
            redraw();
        };

        const isOverHandle = (pos) => {
            if (!gridParams) return null;
            const { x, y, size } = spacingHandles.x;
            if (pos.x >= x && pos.x <= x + size && pos.y >= y && pos.y <= y + size) return 'x';
            const { x: yx, y: yy, size: ysize } = spacingHandles.y;
            if (pos.x >= yx && pos.x <= yx + ysize && pos.y >= yy && pos.y <= yy + ysize) return 'y';
            return null;
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            const handle = isOverHandle(pos);

            if (handle) {
                editorState = 'DRAGGING_HANDLE';
                if (handle === 'x') spacingHandles.x.isDragging = true;
                if (handle === 'y') spacingHandles.y.isDragging = true;
            } else if (gridParams || tempRects.length > 0) {
                editorState = 'ADJUSTING_GRID';
                startX = pos.x;
                startY = pos.y;
            } else {
                editorState = 'DRAWING';
                startX = pos.x;
                startY = pos.y;
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            const pos = getMousePos(e);
            if (editorState === 'DRAGGING_HANDLE') {
                if (spacingHandles.x.isDragging) {
                    const newStep = pos.x - gridParams.x + (spacingHandles.x.size / 2);
                    gridParams.xStep = Math.max(gridParams.w + 1, newStep);
                }
                if (spacingHandles.y.isDragging) {
                    const newStep = pos.y - gridParams.y + (spacingHandles.y.size / 2);
                    gridParams.yStep = Math.max(gridParams.h + 1, newStep);
                }
                redraw();
            } else if (editorState === 'ADJUSTING_GRID') {
                const dx = pos.x - startX;
                const dy = pos.y - startY;
                startX = pos.x;
                startY = pos.y;
                moveSelection(dx, dy);
            } else if (editorState === 'DRAWING') {
                redraw();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 3;
                ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
            }
            // Atualiza o cursor
            const handle = isOverHandle(pos);
            if (handle === 'x') canvas.style.cursor = 'ew-resize';
            else if (handle === 'y') canvas.style.cursor = 'ns-resize';
            else if (gridParams || tempRects.length > 0) canvas.style.cursor = 'move';
            else canvas.style.cursor = 'crosshair';
        });

        canvas.addEventListener('mouseup', (e) => {
            if (editorState === 'DRAWING') {
                const pos = getMousePos(e);
                const width = pos.x - startX;
                const height = pos.y - startY;
                if (Math.abs(width) < 5 || Math.abs(height) < 5) { reset(); return; }
                
                const rect = {
                    x: width > 0 ? startX : pos.x,
                    y: height > 0 ? startY : pos.y,
                    w: Math.abs(width),
                    h: Math.abs(height)
                };

                if (autoGridCheckbox.checked) {
                    gridParams = { ...rect, xStep: rect.w + 10, yStep: rect.h + 10 };
                } else {
                    tempRects.push(rect);
                }
            }
            editorState = 'IDLE';
            spacingHandles.x.isDragging = false;
            spacingHandles.y.isDragging = false;
            updateInstructions();
            redraw();
        });

        const closeEditor = () => {
            finalRects.length = 0;
            if (gridParams) {
                // A LÓGICA DE OURO: Robusta e Precisa
                for (let y = gridParams.y; y < originalImage.height; y += gridParams.yStep) {
                    for (let x = gridParams.x; x < originalImage.width; x += gridParams.xStep) {
                        // Condição de Intersecção: O retângulo da grade cruza com a área da imagem?
                        const gridRectOverlapsImage = 
                            x < originalImage.width &&
                            x + gridParams.w > 0 &&
                            y < originalImage.height &&
                            y + gridParams.h > 0;

                        if (gridRectOverlapsImage) {
                            // Adiciona o retângulo com suas dimensões completas.
                            // O backend fará o recorte final das bordas.
                            finalRects.push({ x: x, y: y, w: gridParams.w, h: gridParams.h, shape: 'rect' });
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
