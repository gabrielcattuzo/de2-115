/*
 * ula.js — lógica da ULA de 16 bits.
 * Não mexe no DOM: recebe números, devolve números. É o único arquivo que
 * precisa mudar para acrescentar ou trocar uma operação.
 */
(function (ns) {
  'use strict';

  const MASK = 0xFFFF;

  // ULACtl → operação.
  const OPS = [
    { code: 0, m: 'AND', fx: 'A and B' },
    { code: 1, m: 'OR',  fx: 'A or B' },
    { code: 2, m: 'ADD', fx: 'A + B' },
    { code: 3, m: 'XOR', fx: 'A xor B' },
    { code: 4, m: 'SUB', fx: 'A − B' },
    { code: 5, m: 'SLL', fx: 'A << B[3:0]' },
    { code: 6, m: 'SLT', fx: 'A < B ? 1 : 0' },
    { code: 7, m: 'NOR', fx: 'not(A or B)' }
  ];

  /** Interpreta 16 bits como inteiro com sinal (complemento de dois). */
  const s16 = x => (x & 0x8000) ? x - 0x10000 : x;

  /**
   * Completa 7 bits até 16.
   * mode 0: extensão de sinal.
   * mode 1: bits altos, v7 vai para os bits 15..9 e o resto é zero.
   */
  function extend(v7, mode) {
    if (mode === 0) return (v7 & 0x40) ? (v7 | 0xFF80) : v7;
    return (v7 << 9) & MASK;
  }

  /** Executa a operação. Devolve R e as flags. */
  function compute(A, B, ctl) {
    let R = 0, C = 0, V = 0, n = 0;
    switch (ctl) {
      case 0: R = A & B; break;
      case 1: R = A | B; break;
      case 2: {
        const t = A + B;
        R = t & MASK;
        C = t > MASK ? 1 : 0;
        V = ((~(A ^ B)) & (A ^ R) & 0x8000) ? 1 : 0;
        break;
      }
      case 3: R = A ^ B; break;
      case 4: { // A + not(B) + 1: Cout = 1 quando não há empréstimo
        const t = A + ((~B) & MASK) + 1;
        R = t & MASK;
        C = t > MASK ? 1 : 0;
        V = ((A ^ B) & (A ^ R) & 0x8000) ? 1 : 0;
        break;
      }
      case 5: // deslocamento lógico à esquerda; Cout = último bit que saiu
        n = B & 0xF;
        R = (A << n) & MASK;
        C = n ? (A >> (16 - n)) & 1 : 0;
        break;
      case 6: R = s16(A) < s16(B) ? 1 : 0; break;
      case 7: R = (~(A | B)) & MASK; break;
    }
    return { R, C, V, n, Z: R === 0 ? 1 : 0, N: (R >> 15) & 1 };
  }

  ns.ula = { OPS, s16, extend, compute };
})(window.DE2 = window.DE2 || {});
