/** Comparte estimado/recibo por WhatsApp: tarjeta imagen + texto corto. */

export interface TarjetaWhatsapp {
  tipo: 'estimado' | 'recibo';
  totalTxt: string;
  cuando?: string;
  detalle?: string;
  nota?: string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Genera PNG de tarjeta de marca (1080×1080). */
export async function crearTarjetaWhatsapp(data: TarjetaWhatsapp): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas no disponible');
  }

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#1a0a0e');
  g.addColorStop(0.45, '#0b0b0c');
  g.addColorStop(1, '#2a0610');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(size * 0.75, size * 0.15, 20, size * 0.75, size * 0.15, 420);
  glow.addColorStop(0, 'rgba(255,30,50,0.45)');
  glow.addColorStop(1, 'rgba(255,30,50,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,30,50,0.55)';
  ctx.lineWidth = 6;
  roundRect(ctx, 36, 36, size - 72, size - 72, 48);
  ctx.stroke();

  const logo = await loadImage('/logo.png');
  if (logo) {
    const lw = 220;
    const lh = 220;
    const lx = (size - lw) / 2;
    const ly = 90;
    ctx.save();
    roundRect(ctx, lx, ly, lw, lh, 36);
    ctx.clip();
    ctx.drawImage(logo, lx, ly, lw, lh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,77,92,0.7)';
    ctx.lineWidth = 4;
    roundRect(ctx, lx, ly, lw, lh, 36);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px Oswald, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIAJA EN EL ROJO', size / 2, 360);

  ctx.fillStyle = '#ff4d5c';
  ctx.font = '800 28px Manrope, Arial, sans-serif';
  ctx.letterSpacing = '4px';
  const titulo = data.tipo === 'estimado' ? 'ESTIMADO' : 'RECIBO';
  ctx.fillText(titulo, size / 2, 420);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 140px Oswald, Arial, sans-serif';
  ctx.fillText(data.totalTxt, size / 2, 580);

  ctx.fillStyle = '#c4a8ae';
  ctx.font = '600 36px Manrope, Arial, sans-serif';
  let y = 660;
  if (data.cuando) {
    ctx.fillText(data.cuando, size / 2, y);
    y += 52;
  }
  if (data.detalle) {
    ctx.fillText(data.detalle, size / 2, y);
    y += 52;
  }
  if (data.nota) {
    ctx.fillStyle = '#8a7076';
    ctx.font = '500 28px Manrope, Arial, sans-serif';
    ctx.fillText(data.nota, size / 2, y + 10);
  }

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png');
  });
}

function textoCorto(data: TarjetaWhatsapp): string {
  const lineas = ['*Viaja en el Rojo*'];
  if (data.tipo === 'estimado') {
    lineas.push(data.cuando ? `Estimado · ${data.cuando}` : 'Estimado');
  } else {
    lineas.push('Viaje cerrado');
  }
  lineas.push(`*${data.totalTxt}*`);
  if (data.detalle) lineas.push(data.detalle);
  return lineas.join('\n');
}

/**
 * Intenta compartir imagen + texto (móvil).
 * Si no se puede, abre WhatsApp con texto corto y descarga la tarjeta.
 */
export async function compartirWhatsappTarjeta(data: TarjetaWhatsapp): Promise<void> {
  const texto = textoCorto(data);
  const blob = await crearTarjetaWhatsapp(data);
  const file = new File([blob], data.tipo === 'estimado' ? 'estimado-viaja-en-el-rojo.png' : 'recibo-viaja-en-el-rojo.png', {
    type: 'image/png',
  });

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Viaja en el Rojo',
        text: texto,
      });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
  }

  // Fallback: baja la imagen y abre WhatsApp con texto limpio
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  window.open('https://wa.me/?text=' + encodeURIComponent(texto + '\n(Adjunta la tarjeta que se descargó)'), '_blank');
}
