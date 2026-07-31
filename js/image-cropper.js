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

export function backgroundImageQuality(width, height) {
  const sourceWidth = Math.max(0, Number(width) || 0);
  const sourceHeight = Math.max(0, Number(height) || 0);
  const cropWidth = Math.min(sourceWidth, sourceHeight * 16 / 9);
  const cropHeight = cropWidth * 9 / 16;
  if (cropWidth >= 3840 && cropHeight >= 2160) return { level: 'excellent', label: '4K 清晰' };
  if (cropWidth >= 2560 && cropHeight >= 1440) return { level: 'good', label: '2K 清晰' };
  if (cropWidth >= 1920 && cropHeight >= 1080) return { level: 'fair', label: '全高清' };
  return { level: 'low', label: '分辨率偏低' };
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
    node('div', { id: 'cropViewModes', class: 'crop-view-modes hidden' }, [
      node('span', { text: '分别调整显示焦点' }),
      node('div', { class: 'segmented', role: 'group', 'aria-label': '背景裁剪视图' }, [
        node('button', { type: 'button', dataset: { cropView: 'desktop' }, text: '桌面' }),
        node('button', { type: 'button', dataset: { cropView: 'mobile' }, text: '手机' })
      ])
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
  dialog.querySelector('#cropViewModes').classList.add('hidden');
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

function cropViewFromInputs(zoom, offsetX, offsetY) {
  return {
    zoom: Number(zoom.value) / 100,
    positionX: 50 + Number(offsetX.value) / 2,
    positionY: 50 + Number(offsetY.value) / 2
  };
}

function cropInputsFromView(view, zoom, offsetX, offsetY) {
  zoom.value = String(Math.round((Number(view.zoom) || 1) * 100));
  offsetX.value = String(Math.round((Number(view.positionX ?? 50) - 50) * 2));
  offsetY.value = String(Math.round((Number(view.positionY ?? 50) - 50) * 2));
}

export async function selectBackgroundImage(file, options = {}) {
  const image = await loadImage(file);
  const dialog = ensureCropDialog();
  const canvas = dialog.querySelector('#cropCanvas');
  const context = canvas.getContext('2d');
  const zoom = dialog.querySelector('#cropZoom');
  const offsetX = dialog.querySelector('#cropOffsetX');
  const offsetY = dialog.querySelector('#cropOffsetY');
  const viewModes = dialog.querySelector('#cropViewModes');
  const views = {
    desktop: { zoom: 1, positionX: 50, positionY: 50 },
    mobile: { zoom: 1, positionX: 50, positionY: 50 }
  };
  let activeView = 'desktop';

  dialog.querySelector('#cropDialogTitle').textContent = options.title || '调整背景焦点';
  canvas.classList.remove('round-crop');
  viewModes.classList.remove('hidden');

  const draw = () => {
    views[activeView] = cropViewFromInputs(zoom, offsetX, offsetY);
    const aspectRatio = activeView === 'desktop' ? 16 / 9 : 9 / 16;
    const previewWidth = activeView === 'desktop' ? 720 : 300;
    canvas.width = previewWidth;
    canvas.height = Math.round(previewWidth / aspectRatio);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const placement = cropPlacement(
      image.naturalWidth,
      image.naturalHeight,
      canvas.width,
      canvas.height,
      views[activeView].zoom,
      (views[activeView].positionX - 50) * 2,
      (views[activeView].positionY - 50) * 2
    );
    context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  };

  const selectView = view => {
    views[activeView] = cropViewFromInputs(zoom, offsetX, offsetY);
    activeView = view;
    cropInputsFromView(views[activeView], zoom, offsetX, offsetY);
    viewModes.querySelectorAll('[data-crop-view]').forEach(button => button.classList.toggle('active', button.dataset.cropView === activeView));
    draw();
  };

  viewModes.querySelectorAll('[data-crop-view]').forEach(button => {
    button.onclick = () => selectView(button.dataset.cropView);
  });
  [zoom, offsetX, offsetY].forEach(input => { input.oninput = draw; });
  dialog.querySelector('#cropReset').onclick = () => {
    views[activeView] = { zoom: 1, positionX: 50, positionY: 50 };
    cropInputsFromView(views[activeView], zoom, offsetX, offsetY);
    draw();
  };
  selectView('desktop');
  openDialog('imageCropDialog');

  return new Promise(resolve => {
    const cleanup = value => {
      dialog.removeEventListener('close', cancel);
      resolve(value);
    };
    const cancel = () => cleanup(null);
    dialog.addEventListener('close', cancel, { once: true });
    dialog.querySelector('#cropConfirm').onclick = () => {
      views[activeView] = cropViewFromInputs(zoom, offsetX, offsetY);
      dialog.removeEventListener('close', cancel);
      dialog.close();
      cleanup({
        data: file,
        mimeType: file.type || 'application/octet-stream',
        width: image.naturalWidth,
        height: image.naturalHeight,
        crop: structuredClone(views)
      });
    };
  });
}
