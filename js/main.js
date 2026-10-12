/*
 * main.js — estado da placa, leitura das chaves, montagem dos quadros,
 * autoteste de inicialização e botões. Liga ula.js, board.js e probe.js.
 */
(function (ns) {
  'use strict';

  const { ula, seg7 } = ns;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BOOT_MS = 1800, BLINK_END = 1200, BLINK_STEP = 150;

  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const h4 = v => v.toString(16).toUpperCase().padStart(4, '0');

  /* ---------- estado ---------- */
  const state = {
    power: false,
    booting: false,
    sw: Array(18).fill(false),
    hold: { 0: false, 1: false, 2: false, 3: false },
    msg: null
  };
  // Exemplo inicial: ULACtl = 010 (ADD), A = −5 (1111011), B = 12 (0001100) → R = 0x0007, Cout = 1
  const EX_A = 0b1111011, EX_B = 0b0001100;
  for (let i = 0; i < 7; i++) {
    state.sw[7 + i] = ((EX_A >> i) & 1) === 1;
    state.sw[i] = ((EX_B >> i) & 1) === 1;
  }
  state.sw[16] = true;

  const mode = () => state.sw[14] ? 1 : 0;

  /** Lê as chaves e roda a ULA. */
  function evaluate() {
    let a7 = 0, b7 = 0;
    for (let i = 0; i < 7; i++) {
      if (state.sw[7 + i]) a7 |= 1 << i;
      if (state.sw[i]) b7 |= 1 << i;
    }
    const ctl = (state.sw[17] ? 4 : 0) | (state.sw[16] ? 2 : 0) | (state.sw[15] ? 1 : 0);
    const A = ula.extend(a7, mode()), B = ula.extend(b7, mode());
    return Object.assign({ a7, b7, A, B, ctl }, ula.compute(A, B, ctl));
  }

  /* ---------- quadros ---------- */
  const blankFrame = () => ({ hex: Array(8).fill(0), ledr: Array(18).fill(0), ledg: Array(9).fill(0), lcdOn: false, lcd: ['', ''], opRow: -1, pwr: false });
  const allOn = f => { f.hex.fill(seg7.ALL); f.ledr.fill(1); f.ledg.fill(1); f.opRow = -2; return f; };
  const putHex16 = (f, v) => { for (let i = 0; i < 4; i++) f.hex[i] = seg7.hexDigit(v >> (4 * i)); };

  function normalFrame(r) {
    const f = blankFrame();
    f.lcdOn = true; f.pwr = true;
    f.hex[7] = seg7.hexDigit(r.a7 >> 4); f.hex[6] = seg7.hexDigit(r.a7);
    f.hex[5] = seg7.hexDigit(r.b7 >> 4); f.hex[4] = seg7.hexDigit(r.b7);
    putHex16(f, r.R);
    for (let i = 0; i < 18; i++) f.ledr[i] = state.sw[i] ? 1 : 0;
    f.ledg[0] = r.Z; f.ledg[1] = r.V; f.ledg[2] = r.C; f.ledg[3] = r.N; f.ledg[8] = mode();
    f.opRow = r.ctl;
    f.lcd = [
      pad(`A=${h4(r.A)} B=${h4(r.B)}`, 13) + pad(ula.OPS[r.ctl].m, 3),
      pad('R=' + h4(r.R), 8) + `Z${r.Z} V${r.V} C${r.C}`
    ];
    return f;
  }

  function bootFrame(t) {
    const f = blankFrame();
    f.lcdOn = true; f.pwr = true;
    const k = Math.min(14, Math.round((t / BOOT_MS) * 14));
    f.lcd = ['DE2-115 AUTOTEST', '[' + '\x7f'.repeat(k) + ' '.repeat(14 - k) + ']'];
    if (reduceMotion) return allOn(f);
    if (t < BLINK_END) {
      if (Math.floor(t / BLINK_STEP) % 2 === 0) allOn(f);
    } else { // varredura rápida da esquerda para a direita
      const p = Math.min(0.999, (t - BLINK_END) / (BOOT_MS - BLINK_END));
      const pos = Math.floor(p * 18);
      for (let j = 0; j < 3; j++) { const idx = 17 - (pos - j); if (idx >= 0 && idx <= 17) f.ledr[idx] = 1; }
      f.hex[7 - Math.floor(p * 8)] = seg7.ALL;
      f.ledg[8 - Math.floor(p * 9)] = 1;
      f.opRow = Math.floor(p * 8);
    }
    return f;
  }

  /* ---------- placa ---------- */
  let msgTimer = 0, bootId = 0;

  const board = ns.board.build(ula.OPS, state.sw, {
    onSwitch(i) {
      state.sw[i] = !state.sw[i];
      if (i === 14 && state.power && !state.booting) {
        showMsg('EXTENSAO DE A/B', state.sw[14] ? 'BITS ALTOS 15..9' : 'EXTENSAO SINAL');
      } else {
        render();
      }
      return state.sw[i];
    },
    onKeyDown(k) {
      if (!state.power || state.booting) return;
      state.hold[k] = true;
      render();
    },
    onKeyUp(k) {
      if (!state.hold[k]) return;
      state.hold[k] = false;
      render();
    },
    onPower() {
      state.power = !state.power;
      bootId++;
      clearTimeout(msgTimer);
      state.msg = null;
      state.hold = { 0: false, 1: false, 2: false, 3: false };
      if (state.power) startBoot();
      else { state.booting = false; render(); }
      return state.power;
    }
  });
  ns.probe.build();

  function showMsg(l1, l2, ms = 1200) {
    clearTimeout(msgTimer);
    state.msg = { l1, l2 };
    msgTimer = setTimeout(() => { state.msg = null; render(); }, ms);
    render();
  }

  function render() {
    if (!state.power) {
      board.apply(blankFrame(), false);
      board.setHexView('R');
      ns.probe.update(null, 'sem energia', mode());
      return;
    }
    if (state.booting) return;

    const r = evaluate();
    let f = normalFrame(r), view = 'R';
    if (state.hold[0]) {
      f = allOn(f);
      f.lcd = ['TESTE DE LAMPADA', '\x7f'.repeat(16)];
    } else if (state.hold[1]) {
      view = 'D';
      const s = String(ula.s16(r.R)).padStart(8, ' ');
      for (let i = 0; i < 8; i++) f.hex[7 - i] = seg7.charSeg(s[i]);
      f.lcd = ['KEY1: R DECIMAL', pad('R = ' + ula.s16(r.R), 16)];
    } else if (state.hold[3] || state.hold[2]) {
      view = state.hold[3] ? 'A' : 'B';
      const v = r[view];
      putHex16(f, v);
      f.lcd = [`KEY${view === 'A' ? 3 : 2}: ${view} 16 BITS`, pad(`${h4(v)} = ${ula.s16(v)}`, 16)];
    } else if (state.msg) {
      f.lcd = [state.msg.l1, state.msg.l2];
    }
    board.setHexView(view);
    board.apply(f, true);
    ns.probe.update(r, 'ao vivo', mode());
  }

  function startBoot() {
    state.booting = true;
    const id = ++bootId, t0 = performance.now();
    board.apply(blankFrame(), true);
    ns.probe.update(null, 'autoteste', mode());
    const step = now => {
      if (id !== bootId || !state.power) return;
      const t = now - t0;
      if (t >= BOOT_MS) {
        state.booting = false;
        showMsg('ULA DE 16 BITS', 'PRONTA P/ USO', 1400);
        return;
      }
      board.apply(bootFrame(t), true);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  render();
})(window.DE2 = window.DE2 || {});
