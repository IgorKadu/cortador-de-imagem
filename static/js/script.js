document.addEventListener('DOMContentLoaded', () => {
    // Elementos da UI principal
    const imgInput = document.getElementById('imgInput');
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const openEditorBtn = document.getElementById('openEditorBtn');
    const autoGridCheckbox = document.getElementById('autoGridCheckbox'); // Controle da grade
    const controls = document.getElementById('controls');
    const rectListDiv = document.getElementById('rectList');
    const downloadBtn = document.getElementById('downloadCrops');

    let originalImage = null;
    const rects = [];

    // 1. Carregar a imagem
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

    // 2. Abrir o editor de tela cheia
    openEditorBtn.addEventListener('click', () => {
        if (originalImage) {
            launchFullscreenEditor();
        }
    });

    function launchFullscreenEditor() {
        // --- Criação dos elementos do editor ---
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

        // --- Lógica de desenho no canvas do editor ---
        let drawing = false;
        let startX, startY;

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
            rects.forEach(r => {
                ctx.strokeStyle = '#198754'; // Verde para recortes confirmados
                ctx.lineWidth = 2;
                ctx.strokeRect(r.x, r.y, r.w, r.h);
            });
        };

        canvas.addEventListener('mousedown', (e) => {
            drawing = true;
            const pos = getMousePos(e);
            startX = pos.x;
            startY = pos.y;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!drawing) return;
            const pos = getMousePos(e);
            redraw();
            ctx.strokeStyle = 'red'; // Vermelho para o desenho atual
            ctx.lineWidth = 3;
            ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        });

        canvas.addEventListener('mouseup', (e) => {
            if (!drawing) return;
            drawing = false;
            const pos = getMousePos(e);
            const width = pos.x - startX;
            const height = pos.y - startY;

            if (Math.abs(width) < 5 || Math.abs(height) < 5) {
                redraw();
                return;
            }

            const templateRect = {
                x: width > 0 ? startX : pos.x,
                y: height > 0 ? startY : pos.y,
                w: Math.abs(width),
                h: Math.abs(height),
                shape: 'rect'
            };

            // --- LÓGICA DA GRADE AUTOMÁTICA ---
            if (autoGridCheckbox.checked) {
                rects.length = 0; // Limpa recortes anteriores
                const templateW = templateRect.w;
                const templateH = templateRect.h;

                for (let y = 0; y + templateH <= originalImage.height; y += templateH) {
                    for (let x = 0; x + templateW <= originalImage.width; x += templateW) {
                        rects.push({ x: x, y: y, w: templateW, h: templateH, shape: 'rect' });
                    }
                }
            } else {
                // Comportamento antigo: apenas adiciona o retângulo desenhado
                templateRect.shape = e.shiftKey ? 'ellipse' : 'rect';
                rects.push(templateRect);
            }
            redraw();
        });

        redraw();

        // --- Funções para fechar o editor ---
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

    // 3. Atualizar a UI principal após fechar o editor
    function updateMainUI() {
        rectListDiv.innerHTML = '';
        if (rects.length === 0) {
            controls.classList.add('d-none');
            return;
        }

        controls.classList.remove('d-none');
        // Mostra um resumo se houver muitos recortes
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

    // 4. Lógica de Download
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
