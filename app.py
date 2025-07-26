import io
import json
import zipfile
import numpy as np
import cv2
from flask import (
    Flask, request, render_template, send_file, abort
)

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/crop', methods=['POST'])
def crop():
    if 'image' not in request.files or 'rects' not in request.form:
        abort(400, 'Imagem ou marcações faltando.')
    file   = request.files['image']
    rects  = json.loads(request.form['rects'])
    fmt    = request.form.get('format', 'png').lower()
    quality = int(request.form.get('quality', 90))

    # Decodifica imagem
    data = file.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        abort(400, 'Formato de imagem inválido.')

    # Prepara ZIP em memória
    zip_io = io.BytesIO()
    with zipfile.ZipFile(zip_io, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, r in enumerate(rects, start=1):
            x, y, w, h = map(int, (r['x'], r['y'], r['w'], r['h']))
            shape = r.get('shape', 'rect')  # 'rect' ou 'ellipse'
            crop = img[y:y+h, x:x+w]

            # Se elipse, aplica máscara
            if shape == 'ellipse':
                mask = np.zeros_like(crop)
                center = (w//2, h//2)
                axes   = (w//2, h//2)
                cv2.ellipse(mask, center, axes, 0, 0, 360, (255,)*3, -1)
                crop = cv2.bitwise_and(crop, mask)

            # Codifica no formato desejado
            ext, params = {
                'png':  ('.png',  []),
                'jpeg': ('.jpg', [cv2.IMWRITE_JPEG_QUALITY, quality]),
                'webp': ('.webp',[cv2.IMWRITE_WEBP_QUALITY, quality])
            }.get(fmt, ('.png', []))

            success, buf = cv2.imencode(ext, crop, params)
            if not success:
                continue
            zf.writestr(f'crop_{i:02d}{ext}', buf.tobytes())

    zip_io.seek(0)
    return send_file(
        zip_io,
        mimetype='application/zip',
        as_attachment=True,
        download_name='crops.zip'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
