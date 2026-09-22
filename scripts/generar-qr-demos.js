#!/usr/bin/env node
/**
 * Genera el QR y la tarjeta A6 de cada demo en docs/material-venta/demos/.
 *
 *   npm i --no-save qrcode   (en /app; no es dependencia del proyecto)
 *   node scripts/generar-qr-demos.js
 *
 * Cada QR abre WhatsApp con el primer mensaje ya escrito: quien lo escanea
 * solo tiene que pulsar enviar, y la demo empieza por la pregunta que mejor
 * luce. Van con corrección H para que la K del centro no los rompa.
 * Si cambia un número o un texto, se cambia en DEMOS y se vuelve a lanzar.
 */
const fs = require("fs");
const path = require("path");
const QR = require(require.resolve('qrcode', { paths: [path.join(__dirname, '..', 'app')] }));
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '..', 'app')] }));

const PUB = path.join(__dirname, '..', 'app', 'public');
const SALIDA = path.join(__dirname, '..', 'docs', 'material-venta', 'demos');
fs.mkdirSync(SALIDA, { recursive: true });

const C = { azul: '#8FB8C6', gris: '#5f5f5f', oro: '#D2BE82', teja: '#B5532E', tinta: '#3a3a3a', fondo: '#FFFFFF', suave: '#F4F8F9' };

const DEMOS = [
  { slug: 'peluqueria', sector: 'Peluquería', numero: '34623790343', visible: '+34 623 79 03 43',
    texto: 'Hola, ¿cuánto cuestan unas mechas?',
    gancho: 'Pregúntale precios, pide cita o di que quieres hablar con alguien.' },
  { slug: 'dental', sector: 'Clínica dental', numero: '34613013979', visible: '+34 613 01 39 79',
    texto: 'Hola, me duele una muela, ¿me podéis ver?',
    gancho: 'Pregúntale por un tratamiento, pide cita o cuéntale una urgencia.' },
  { slug: 'fisio', sector: 'Fisioterapia', numero: '34623814787', visible: '+34 623 81 47 87',
    texto: 'Hola, tengo una contractura, ¿tenéis hueco esta semana?',
    gancho: 'Pregúntale por un tratamiento, pide cita o elige fisio.' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function qrConMarca(url, lado) {
  // Corrección H (30 %): aguanta el hueco de la K en el centro y las tarjetas
  // arrugadas o impresas regular.
  const svg = await QR.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: C.tinta, light: C.fondo } });
  const base = await sharp(Buffer.from(svg)).resize(lado, lado).png().toBuffer();

  const hueco = Math.round(lado * 0.22);
  const marca = await sharp(path.join(PUB, 'kivuk-marca.png')).resize({ height: Math.round(hueco * 0.72) }).toBuffer();
  const placa = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${hueco}" height="${hueco}"><rect width="100%" height="100%" rx="${hueco * 0.18}" fill="#fff"/></svg>`);
  const off = Math.round((lado - hueco) / 2);
  const m = await sharp(marca).metadata();
  return sharp(base).composite([
    { input: placa, left: off, top: off },
    { input: marca, left: Math.round((lado - m.width) / 2), top: Math.round((lado - m.height) / 2) },
  ]).png().toBuffer();
}

async function tarjeta(d, url, qr) {
  // A6 a 300 ppp.
  const W = 1240, H = 1748;
  const logo = await sharp(path.join(PUB, 'kivuk-logo.png')).resize({ width: 380 }).toBuffer();
  const lq = 760;
  const qrPeq = await sharp(qr).resize(lq, lq).toBuffer();
  const F = "Segoe UI, Arial, sans-serif";

  const fondo = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="${C.fondo}"/>
  <rect x="0" y="0" width="${W}" height="18" fill="${C.azul}"/>
  <text x="${W / 2}" y="345" text-anchor="middle" font-family="${F}" font-size="40" fill="${C.teja}" letter-spacing="6">DEMO · ${esc(d.sector.toUpperCase())}</text>
  <text x="${W / 2}" y="430" text-anchor="middle" font-family="${F}" font-size="68" font-weight="700" fill="${C.tinta}">Tu recepcionista 24 h</text>
  <text x="${W / 2}" y="495" text-anchor="middle" font-family="${F}" font-size="44" fill="${C.gris}">en WhatsApp</text>
  <rect x="${(W - lq) / 2 - 30}" y="${545}" width="${lq + 60}" height="${lq + 60}" rx="36" fill="${C.suave}"/>
  <text x="${W / 2}" y="1440" text-anchor="middle" font-family="${F}" font-size="44" font-weight="700" fill="${C.tinta}">Escanéalo con la cámara y escríbele</text>
  <text x="${W / 2}" y="1500" text-anchor="middle" font-family="${F}" font-size="34" fill="${C.gris}">${esc(d.gancho)}</text>
  <text x="${W / 2}" y="1605" text-anchor="middle" font-family="${F}" font-size="36" fill="${C.tinta}">${esc(d.visible)}</text>
  <text x="${W / 2}" y="1680" text-anchor="middle" font-family="${F}" font-size="32" fill="${C.azul}">agenciakivuk.com</text>
</svg>`;

  const lm = await sharp(logo).metadata();
  return sharp(Buffer.from(fondo)).composite([
    { input: logo, left: Math.round((W - lm.width) / 2), top: 90 },
    { input: qrPeq, left: (W - lq) / 2, top: 575 },
  ]).png().toBuffer();
}

(async () => {
  const enlaces = [];
  for (const d of DEMOS) {
    const url = `https://wa.me/${d.numero}?text=${encodeURIComponent(d.texto)}`;
    const qr = await qrConMarca(url, 1200);
    fs.writeFileSync(path.join(SALIDA, `qr-${d.slug}.png`), qr);
    fs.writeFileSync(path.join(SALIDA, `tarjeta-${d.slug}.png`), await tarjeta(d, url, qr));
    enlaces.push(`${d.sector}: ${url}`);
  }
  console.log(enlaces.join('\n'));
})();
