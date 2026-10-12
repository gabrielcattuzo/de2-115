/*
 * probe.js — painel "Sonda lógica": bits de A, B e R, flags e uma explicação
 * em texto do que a ULA acabou de calcular.
 */
(function (ns) {
  'use strict';

  const $ = s => document.querySelector(s);
  const mk = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const h4 = v => v.toString(16).toUpperCase().padStart(4, '0');
  const fm = n => n < 0 ? '−' + (-n) : String(n);
  const pr = n => n < 0 ? '(−' + (-n) + ')' : String(n);
  const fs = n => n > 0 ? '+' + n : fm(n);

  const FLAGS = [['Z', 'Zero'], ['V', 'Overflow'], ['C', 'Cout'], ['N', 'Negativo']];
  const rows = {}, flagEls = {};

  function build() {
    const bus = $('#bus');
    for (const name of ['A', 'B', 'R']) {
      const r = mk('div', 'bus-r' + (name === 'R' ? ' res' : ''));
      const bits = mk('span', 'bits');
      const bitEls = [];
      for (let i = 15; i >= 0; i--) { const e = mk('i', null, '·'); bitEls[i] = e; bits.append(e); }
      const hx = mk('span', 'v'), u = mk('span', 'v'), s = mk('span', 'v');
      r.append(mk('span', 'bn', name), bits, hx, u, s);
      bus.append(r);
      rows[name] = { bitEls, hx, u, s };
    }
    for (const [f, label] of FLAGS) {
      const e = mk('span', 'flag', label);
      flagEls[f] = e;
      $('#probeFlags').append(e);
    }
  }

  /** Três frases curtas explicando o resultado atual. */
  function explain(r, mode) {
    const { s16 } = ns.ula;
    const sA = s16(r.A), sB = s16(r.B), sR = s16(r.R);
    const ovfHint = mode === 0
      ? 'Com extensão de sinal, A e B ficam entre −64 e 63 e o resultado nunca estoura. Ligue SW14 (bits altos) para ver Overflow = 1.'
      : '';
    switch (r.ctl) {
      case 0: case 1: case 7:
        return ['Operação bit a bit sobre os 16 bits de A e B.', 'Overflow e Cout ficam em 0. Zero olha apenas o resultado.', ''];
      case 3:
        return ['XOR bit a bit: cada bit de R é 1 quando os bits de A e B são diferentes.',
          'Overflow e Cout ficam em 0.',
          r.A === r.B ? 'A e B são iguais, então R = 0 e Zero acende. É um jeito rápido de comparar igualdade.' : ''];
      case 2:
        return [
          `Com sinal: ${pr(sA)} + ${pr(sB)} = ${fm(sA + sB)}` + (r.V ? `, fora de −32768…32767. Em 16 bits vira ${fm(sR)} e Overflow = 1.` : ', cabe em 16 bits (Overflow = 0).'),
          `Sem sinal: ${r.A} + ${r.B} = ${r.A + r.B}` + (r.C ? `, passa de 65535: Cout = 1 e sobra ${r.R}.` : ', sem carry-out (Cout = 0).'),
          ovfHint
        ];
      case 4:
        return [
          `Com sinal: ${pr(sA)} − ${pr(sB)} = ${fm(sA - sB)}` + (r.V ? `, fora de −32768…32767. Em 16 bits vira ${fm(sR)} e Overflow = 1.` : ', cabe em 16 bits (Overflow = 0).'),
          `A ULA faz A + not(B) + 1. Sem sinal, ${r.A} ${r.C ? '≥' : '<'} ${r.B}, então Cout = ${r.C}` + (r.C ? ' (não houve empréstimo).' : ' (houve empréstimo).'),
          ovfHint
        ];
      case 5: {
        const first = `Desloca A ${r.n} ${r.n === 1 ? 'posição' : 'posições'} para a esquerda; n = B[3:0] = ${r.n}. Entram zeros pela direita.`;
        const second = r.n
          ? `Cout guarda o último bit que saiu (${r.C}). Equivale a ${r.A} × ${2 ** r.n} mod 65536 = ${r.R}.`
          : 'Com n = 0 nada se move e Cout = 0.';
        const third = mode === 1 ? 'No modo bits altos, B[3:0] é sempre 0. Desligue SW14 para deslocar.' : '';
        return [first, second, third];
      }
      case 6:
        return [`Comparação com sinal: ${fm(sA)} ${sA < sB ? '<' : '≥'} ${fm(sB)}, então R = ${r.R}.`, 'Overflow e Cout ficam em 0 nesta operação.', ''];
    }
    return ['', '', ''];
  }

  /** r = resultado da ULA ou null (placa desligada / em autoteste). */
  function update(r, status, mode) {
    const { s16, OPS } = ns.ula;
    $('#probeStatus').textContent = status;
    $('#probe').classList.toggle('live', !!r);
    for (const name of ['A', 'B', 'R']) {
      const row = rows[name], val = r ? r[name] : null;
      for (let i = 0; i < 16; i++) {
        const e = row.bitEls[i];
        if (val === null) { e.textContent = '·'; e.classList.remove('one', 'ext'); continue; }
        const b = (val >> i) & 1;
        e.textContent = b;
        e.classList.toggle('one', b === 1);
        e.classList.toggle('ext', name !== 'R' && (mode === 0 ? i >= 7 : i < 9));
      }
      row.hx.textContent = val === null ? '—' : '0x' + h4(val);
      row.u.textContent = val === null ? '—' : val;
      row.s.textContent = val === null ? '—' : fs(s16(val));
    }
    $('#busNote').textContent = !r ? '' : mode === 0
      ? 'Bits esmaecidos de A e B são cópias do bit 6 (extensão de sinal).'
      : 'Modo bits altos: A[6:0] e B[6:0] vão para os bits 15–9; os bits esmaecidos são zeros.';
    const op = r ? OPS[r.ctl] : null;
    $('#probeOp').textContent = op ? op.m : '—';
    $('#probeFx').textContent = op ? `${op.fx} · ULACtl = ${r.ctl.toString(2).padStart(3, '0')}` : '';
    for (const [f] of FLAGS) flagEls[f].classList.toggle('on', !!(r && r[f]));
    const ex = r ? explain(r, mode)
      : status === 'autoteste'
        ? ['Autoteste em andamento: todos os segmentos e LEDs piscam antes da ULA assumir.', '', '']
        : ['Placa desligada. Pressione POWER para ver os sinais.', 'As chaves continuam mudando de posição mesmo sem energia.', ''];
    ['#ex1', '#ex2', '#ex3'].forEach((sel, i) => { $(sel).textContent = ex[i]; });
  }

  ns.probe = { build, update };
})(window.DE2 = window.DE2 || {});
