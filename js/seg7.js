/*
 * seg7.js — codificação dos displays de 7 segmentos e o desenho SVG de um dígito.
 * Bits: 0=a 1=b 2=c 3=d 4=e 5=f 6=g 7=ponto. Aqui 1 = aceso; na placa real
 * os segmentos são ativos em 0, então o hardware usa o valor invertido.
 */
(function (ns) {
  'use strict';

  const HEX = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71];
  const ALL = 0xFF;

  const hexDigit = v => HEX[v & 0xF];
  const charSeg = ch => (ch >= '0' && ch <= '9') ? HEX[ch.charCodeAt(0) - 48] : ch === '-' ? 0x40 : 0;

  // Segmentos em losango, levemente inclinados como nos displays reais
  const T = 8, G = 1.6, X1 = 8, X2 = 44, Y1 = 8, YM = 48, Y2 = 88, h = T / 2;
  const hseg = (y, a, b) => `${a},${y} ${a + h},${y - h} ${b - h},${y - h} ${b},${y} ${b - h},${y + h} ${a + h},${y + h}`;
  const vseg = (x, a, b) => `${x},${a} ${x + h},${a + h} ${x + h},${b - h} ${x},${b} ${x - h},${b - h} ${x - h},${a + h}`;
  const POLYS = [
    hseg(Y1, X1 + G, X2 - G),   // a
    vseg(X2, Y1 + G, YM - G),   // b
    vseg(X2, YM + G, Y2 - G),   // c
    hseg(Y2, X1 + G, X2 - G),   // d
    vseg(X1, YM + G, Y2 - G),   // e
    vseg(X1, Y1 + G, YM - G),   // f
    hseg(YM, X1 + G, X2 - G)    // g
  ];
  const svg = '<svg viewBox="0 0 64 96" aria-hidden="true"><g transform="translate(9 0) skewX(-6)">' +
    POLYS.map(p => `<polygon class="s" points="${p}"/>`).join('') +
    '<circle class="s" cx="54" cy="88" r="4.2"/></g></svg>';

  ns.seg7 = { hexDigit, charSeg, ALL, svg };
})(window.DE2 = window.DE2 || {});
