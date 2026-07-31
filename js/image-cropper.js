import { node, openDialog, refreshIcons } from './ui.js';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取图片')); };
    image.src = url;
  });
}

export function cropPlacement(imageWidth, imageHeight, canvasWidth, canvasHeight, zoom = 1, offsetX = 0, offsetY = 0) {
  const baseScale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const scale = baseScale * Math.max(1, Number(zoom) || 1);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const overflowX = Math.max(0, width - canvasWidth);
  const overflowY = Math.max(0, height - canvasHeight);
  return {
    x: -overflowX / 2 - overflowX * (Number(offsetX) || 0) / 200,
    y: -overflowY / 2 - overflowY * (Number(offsetY) || 0) / 200,
    width, height
  };
}

function ensureCropDialog() {
  let dialog = document.getElementById('imageCropDialog');
  if (dialog) return dialog;
  dialog = node('dialog', { id: 'imageCropDialog', class: 'app-dialog crop-dialog' }, [
    node('div', { class: 'dialog-head' }, [
      node('div', {}, [node('span', { class: 'eyebrow', text: 'IMAGE CROP' }), node('h2', { id: 'cropDialogTitle', text: '裁剪图片' })]),
      node('button', { class: 'icon-btn', type: 'button', 'data-close-dialog': '', 'aria-label': '关闭' }, [node('i', { 'data-lucide': 'x' })])
    ]),
    node('div', { class: 'crop-stage' }, [node('canvas', { id: 'cropCanvas', width: '720', height: '405' })]),
    node('div', { class: 'crop-controls' }, [
      node('label', {}, [node('span', { text: '缩放' }), node('input', { id: 'cropZoom', type: 'range', min: '100', max: '300', value: '100' })]),
      node('label', {}, [node('span', { text: '水平位置' }), node('input', { id: 'cropOffsetX', type: 'range', min: '-100', max: '100', value: '0' })]),
      node('label', {}, [node('span', { text: '垂直位置' }), node('input', { id: 'cropOffsetY', type: 'range', min: '-100', max: '100', value: '0' })])
    ]),
    node('div', { class: 'dialog-actions' }, [
      node('button', { id: 'cropReset', class: 'secondary-action', type: 'button' }, [node('i', { 'data-lucide': 'rotate-ccw' }), node('span', { text: '重置' })]),
      node('span', { class: 'action-spacer' }),
      node('button', { class: 'secondary-action', type: 'button', 'data-close-dialog': '' }, [node('span', { text: '取消' })]),
      node('button', { id: 'cropConfirm', class: 'primary-action', type: 'button' }, [node('i', { 'data-lucide': 'crop' }), node('span', { text: '应用裁剪' })])
    ])
  ]);
  document.body.append(dialog);
  refreshIcons();
  return dialog;
}

export async function cropImageFile(file, options = {}) {
  const image = await loadImage(file);
  const dialog = ensureCropDialog();
  const canvas = dialog.querySelector('#cropCanvas');
  const context = canvas.getContext('2d');
  const aspectRatio = Number(options.aspectRatio) || 16 / 9;
  const previewWidth = Math.min(720, Number(options.previewWidth) || 720);
  canvas.width = previewWidth;
  canvas.height = Math.round(previewWidth / aspectRatio);
  canvas.classList.toggle('round-crop', options.shape === 'circle');
  dialog.querySelector('#cropDialogTitle').textContent = options.title || '裁剪图片';
  const zoom = dialog.querySelector('#cropZoom');
  const offsetX = dialog.querySelector('#cropOffsetX');
  const offsetY = dialog.querySelector('#cropOffsetY');
  [zoom, offsetX, offsetY].forEach(input => { input.value = input.id === 'cropZoom' ? '100' : '0'; });

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const placement = cropPlacement(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, Number(zoom.value) / 100, offsetX.value, offsetY.value);
    context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  };
  [zoom, offsetX, offsetY].forEach(input => input.oninput = draw);
  dialog.querySelector('#cropReset').onclick = () => {
    zoom.value = '100'; offsetX.value = '0'; offsetY.value = '0'; draw();
  };
  draw();
  openDialog('imageCropDialog');

  return new Promise(resolve => {
    const cleanup = value => {
      dialog.removeEventListener('close', cancel);
      resolve(value);
    };
    const cancel = () => cleanup(null);
    dialog.addEventListener('close', cancel, { once: true });
    dialog.querySelector('#cropConfirm').onclick = () => {
      const output = document.createElement('canvas');
      output.width = Number(options.outputWidth) || 1600;
      output.height = Number(options.outputHeight) || Math.round(output.width / aspectRatio);
      const outputContext = output.getContext('2d');
      const placement = cropPlacement(image.naturalWidth, image.naturalHeight, output.width, output.height, Number(zoom.value) / 100, offsetX.value, offsetY.value);
      outputContext.drawImage(image, placement.x, placement.y, placement.width, placement.height);
      output.toBlob(blob => {
        dialog.removeEventListener('close', cancel);
        dialog.close();
        cleanup(blob);
      }, 'image/jpeg', options.quality || 0.9);
    };
  });
}
