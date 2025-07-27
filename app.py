import io
import json
import zipfile
from flask import Flask, render_template, request, send_file
import cv2
import numpy as np

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/crop', methods=['POST'])
def crop_image():
    if 'image' not in request.files:
        return "Nenhuma imagem enviada", 400

    file = request.files['image']
    img_stream = file.read()
    np_img = np.frombuffer(img_stream, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_UNCHANGED)

    if img is None:
        return "Não foi possível decodificar a imagem", 400

    rects = json.loads(request.form.get('rects'))
    img_format = request.form.get('format', 'png')
    quality = int(request.form.get('quality', 95))

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        img_h, img_w = img.shape[:2]

        for i, r in enumerate(rects):
            # --- INÍCIO DA LÓGICA DE VALIDAÇÃO APRIMORADA ---
            # Garante que as coordenadas sejam inteiras e dentro dos limites
            x1 = max(0, int(r['x']))
            y1 = max(0, int(r['y']))
            w = int(r['w'])
            h = int(r['h'])
            
            # Calcula o ponto final e o prende aos limites da imagem
            x2 = min(img_w, x1 + w)
            y2 = min(img_h, y1 + h)

            # Só processa se a área de recorte for válida
            if x2 > x1 and y2 > y1:
                cropped_img = img[y1:y2, x1:x2]

                # Lida com imagens com canal alfa (transparência)
                if cropped_img.shape[2] == 4:
                    # Se o formato for jpeg, que não suporta transparência,
                    # preenche o fundo com branco.
                    if img_format == 'jpeg':
                        alpha_channel = cropped_img[:, :, 3]
                        rgb_channels = cropped_img[:, :, :3]
                        white_background = np.ones_like(rgb_channels, dtype=np.uint8) * 255
                        alpha_factor = alpha_channel[:, :, np.newaxis].astype(np.float32) / 255.0
                        merged_img = white_background * (1 - alpha_factor) + rgb_channels * alpha_factor
                        cropped_img = merged_img.astype(np.uint8)

                # Codifica a imagem recortada para o formato desejado
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality] if img_format == 'jpeg' else None
                is_success, buffer = cv2.imencode(f'.{img_format}', cropped_img, encode_param)
                
                if is_success:
                    zf.writestr(f'crop_{i+1}.{img_format}', buffer)
            # --- FIM DA LÓGICA DE VALIDAÇÃO ---

    memory_file.seek(0)
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name='crops.zip'
    )

if __name__ == '__main__':
    app.run(debug=True)
