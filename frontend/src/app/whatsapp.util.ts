/** Comparte estimado/recibo por WhatsApp: tarjeta imagen + texto corto. */

export interface TarjetaWhatsapp {
  tipo: 'estimado' | 'recibo';
  totalTxt: string;
  cuando?: string;
  detalle?: string;
  nota?: string;
  /** Tiempo que duró el viaje (recibo). */
  duracionTxt?: string;
  slogan?: string;
}

const SLOGANS = [
  '¡Huamantla se mueve en rojo!',
  'Rápido, seguro… y bien rojo.',
  'Tu viaje, nuestro orgullo.',
  'Llegamos a tiempo. Llegamos en rojo.',
  'Más que un taxi: Viaja en el Rojo.',
  'La ruta más viva de Tlaxcala.',
  'Confort, trato y el rojo que te distingue.',
  'Del A al B… con estilo.',
  'Gracias por elegir el rojo.',
  '¡Nos vemos en el próximo viaje!',
  'Rojo por fuera, confianza por dentro.',
  'Cuando el reloj corre, el Rojo llega.',
  'Tu destino, nuestra misión.',
  'Huamantla confía en el Rojo.',
  'Un viaje corto… un gran detalle.',
];

const LEYENDA_ESTIMADO =
  'El precio puede variar por tráfico, espera, desvíos u otras condiciones del viaje.';

export function sloganAleatorio(): string {
  return SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, yy);
    yy += lineHeight;
  }
  return yy;
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
    const lw = 200;
    const lh = 200;
    const lx = (size - lw) / 2;
    const ly = 70;
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
  ctx.font = '700 48px Oswald, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIAJA EN EL ROJO', size / 2, 320);

  ctx.fillStyle = '#ff4d5c';
  ctx.font = '800 26px Manrope, Arial, sans-serif';
  const titulo = data.tipo === 'estimado' ? 'ESTIMADO' : 'RECIBO DE VIAJE';
  ctx.fillText(titulo, size / 2, 370);

  ctx.fillStyle = '#c4a8ae';
  ctx.font = '700 22px Manrope, Arial, sans-serif';
  ctx.fillText('TOTAL', size / 2, 430);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 120px Oswald, Arial, sans-serif';
  ctx.fillText(data.totalTxt, size / 2, 545);

  let y = 600;
  if (data.duracionTxt) {
    ctx.fillStyle = '#c4a8ae';
    ctx.font = '700 22px Manrope, Arial, sans-serif';
    ctx.fillText('TIEMPO', size / 2, y);
    y += 42;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Oswald, Arial, sans-serif';
    ctx.fillText(data.duracionTxt, size / 2, y);
    y += 50;
  }

  // Nota opcional del cliente (no “de día / de noche”)
  const nota = (data.nota || data.cuando || '').trim();
  if (nota && !esEtiquetaHorario(nota)) {
    ctx.fillStyle = '#c4a8ae';
    ctx.font = '600 28px Manrope, Arial, sans-serif';
    y = wrapText(ctx, nota, size / 2, y, size - 180, 34) + 12;
  }

  if (data.tipo === 'estimado') {
    ctx.fillStyle = 'rgba(196,168,174,0.9)';
    ctx.font = '600 24px Manrope, Arial, sans-serif';
    y = wrapText(ctx, LEYENDA_ESTIMADO, size / 2, y + 8, size - 160, 32) + 16;
  }

  const slogan = data.slogan || sloganAleatorio();
  ctx.fillStyle = '#ff4d5c';
  ctx.font = '700 28px Manrope, Arial, sans-serif';
  wrapText(ctx, slogan, size / 2, Math.min(Math.max(y + 20, 780), 880), size - 160, 36);

  ctx.fillStyle = 'rgba(196,168,174,0.7)';
  ctx.font = '600 22px Manrope, Arial, sans-serif';
  ctx.fillText('Huamantla', size / 2, 1000);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png');
  });
}

function esEtiquetaHorario(t: string): boolean {
  const s = t.trim().toLowerCase();
  return s === 'de día' || s === 'de dia' || s === 'de noche' || s === 'ahora' || s === 'día' || s === 'dia' || s === 'noche';
}

function textoCorto(data: TarjetaWhatsapp): string {
  const slogan = data.slogan || sloganAleatorio();
  const lineas = ['*Viaja en el Rojo*'];
  if (data.tipo === 'estimado') {
    lineas.push('Estimado');
  } else {
    lineas.push('Viaje cerrado');
  }
  lineas.push(`Total: *${data.totalTxt}*`);
  if (data.duracionTxt) {
    lineas.push(`Tiempo: *${data.duracionTxt}*`);
  }
  const nota = (data.nota || data.cuando || '').trim();
  if (nota && !esEtiquetaHorario(nota)) {
    lineas.push(nota);
  }
  if (data.tipo === 'estimado') {
    lineas.push(LEYENDA_ESTIMADO);
  }
  lineas.push(`_${slogan}_`);
  return lineas.join('\n');
}

async function copiarTextoSeguro(texto: string): Promise<void> {
  const t = (texto || '').trim();
  if (!t) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return;
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {
    /* ignore */
  }
}

export type ResultadoShareWa = {
  modo: 'compartido' | 'descargado';
  /** En Android: pegar el texto en «Añadir mensaje» (ya está copiado). */
  pegarCaption: boolean;
};

/**
 * Comparte la tarjeta (imagen).
 * - iOS: foto + texto en caption.
 * - Android: solo foto (si mandamos text, WA lo pone en otra burbuja);
 *   el texto queda en portapapeles para pegar en «Añadir mensaje».
 */
export async function compartirWhatsappTarjeta(data: TarjetaWhatsapp): Promise<ResultadoShareWa> {
  const payload = { ...data, slogan: data.slogan || sloganAleatorio() };
  const texto = textoCorto(payload);
  const blob = await crearTarjetaWhatsapp(payload);
  const file = new File(
    [blob],
    data.tipo === 'estimado' ? 'estimado-viaja-en-el-rojo.png' : 'recibo-viaja-en-el-rojo.png',
    { type: 'image/png' }
  );

  await copiarTextoSeguro(texto);

  const esAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      const shareData: ShareData = esAndroid
        ? { files: [file], title: 'Viaja en el Rojo' }
        : { files: [file], title: 'Viaja en el Rojo', text: texto };
      await nav.share(shareData);
      return { modo: 'compartido', pegarCaption: esAndroid };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        return { modo: 'compartido', pegarCaption: esAndroid };
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return { modo: 'descargado', pegarCaption: true };
}
