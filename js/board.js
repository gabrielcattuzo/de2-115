/*
 * board.js — monta os componentes da placa no DOM e pinta um "quadro".
 * Um quadro é um objeto simples com o que cada saída deve mostrar:
 *   { hex[8], ledr[18], ledg[9], lcdOn, lcd[2], opRow, pwr }
 * Este arquivo não conhece a ULA; ele só desenha o que recebe.
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
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);

  const SWITCH_GROUPS = [
    { name: 'ULACtl',  sub: 'SW17–15', hi: 17, lo: 15 },
    { name: 'Modo',    sub: 'SW14',    hi: 14, lo: 14 },
    { name: 'A[6:0]',  sub: 'SW13–SW7', hi: 13, lo: 7 },
    { name: 'B[6:0]',  sub: 'SW6–SW0', hi: 6,  lo: 0 }
  ];
  const swDesc = i => i >= 15 ? `bit ${i - 15} de ULACtl`
    : i === 14 ? 'modo de extensão (0 sinal, 1 bits altos)'
    : i >= 7 ? `bit ${i - 7} de A` : `bit ${i} de B`;

  const KEYS = {
    3: { fn: 'Ver A', desc: 'segure para ver A com 16 bits' },
    2: { fn: 'Ver B', desc: 'segure para ver B com 16 bits' },
    1: { fn: 'Dec',   desc: 'segure para ver R em decimal com sinal' },
    0: { fn: 'Teste', desc: 'segure para o teste de lâmpadas' }
  };

  const LEDG = {
    8: { fn: 'Altos', tip: 'Modo bits altos (SW14)' },
    3: { fn: 'Neg',   tip: 'Negativo, R[15]' },
    2: { fn: 'Cout',  tip: 'Carry-out' },
    1: { fn: 'Ovf',   tip: 'Overflow' },
    0: { fn: 'Zero',  tip: 'Zero' }
  };

  // Posição de cada display na grade: HEX7–6 | HEX5–4 | HEX3–0
  const DIGIT_COL = { 7: 1, 6: 2, 5: 4, 4: 5, 3: 7, 2: 8, 1: 9, 0: 10 };

  function build(ops, initialSw, cb) {
    const refs = { segs: [], ledr: [], ledg: [], opLeds: [], cells: [], hexLabels: [] };

    /* Displays de 7 segmentos */
    const hexGrid = $('#hexGrid');
    for (let i = 0; i < 3; i++) {
      const l = mk('div', 'grp top silk');
      l.style.gridRow = '1';
      refs.hexLabels.push(l);
      hexGrid.append(l);
    }
    for (const n of [7, 6, 5, 4, 3, 2, 1, 0]) {
      const d = mk('div', 'digit');
      d.style.gridColumn = DIGIT_COL[n]; d.style.gridRow = '2';
      d.innerHTML = ns.seg7.svg;
      refs.segs[n] = Array.from(d.querySelectorAll('.s'));
      const nm = mk('span', 'silk n', 'HEX' + n);
      nm.style.gridColumn = DIGIT_COL[n]; nm.style.gridRow = '3';
      hexGrid.append(d, nm);
    }

    /* LCD 16×2 */
    const glass = $('#lcdGlass');
    for (let i = 0; i < 32; i++) { const c = mk('span', 'cell'); refs.cells.push(c); glass.append(c); }

    /* Tabela de operações em silkscreen */
    ops.forEach((o, i) => {
      const row = mk('div', 'ot-row');
      const led = mk('span', 'led r tiny');
      refs.opLeds[i] = led;
      row.append(led, mk('span', 'code', i.toString(2).padStart(3, '0')), mk('span', 'mn', o.m), mk('span', 'fx', o.fx));
      $(i < 4 ? '#otCol0' : '#otCol1').append(row);
    });

    /* LEDs verdes */
    const ledgGrid = $('#ledgGrid');
    const gMode = mk('div', 'grp top silk', 'SW14'); gMode.style.gridColumn = '1 / 2'; gMode.style.gridRow = '1';
    const gFlags = mk('div', 'grp top silk', 'Flags'); gFlags.style.gridColumn = '6 / 10'; gFlags.style.gridRow = '1';
    ledgGrid.append(gMode, gFlags);
    for (let g = 8; g >= 0; g--) {
      const col = String(9 - g), info = LEDG[g];
      const led = mk('span', 'led g'); led.style.gridColumn = col; led.style.gridRow = '2';
      led.title = `LEDG${g} · ${info ? info.tip : 'Livre'}`;
      const nm = mk('span', 'silk n', 'G' + g); nm.style.gridColumn = col; nm.style.gridRow = '3';
      const fn = mk('span', 'silk fn' + (info ? '' : ' dim'), info ? info.fn : '—'); fn.style.gridColumn = col; fn.style.gridRow = '4';
      refs.ledg[g] = led;
      ledgGrid.append(led, nm, fn);
    }

    /* Chaves deslizantes + LEDs vermelhos */
    const swBlock = $('#swBlock');
    SWITCH_GROUPS.forEach(gp => {
      const g = mk('div', 'sw-group'), cols = mk('div', 'sw-cols');
      for (let i = gp.hi; i >= gp.lo; i--) {
        const col = mk('div', 'swcol');
        const led = mk('span', 'led r'); led.title = `LEDR${i}`;
        const b = mk('button', 'sw'); b.type = 'button'; b.id = 'sw' + i;
        b.setAttribute('aria-label', `SW${i}, ${swDesc(i)}`);
        b.setAttribute('aria-pressed', String(initialSw[i]));
        b.append(mk('span', 'lever'));
        b.addEventListener('click', () => b.setAttribute('aria-pressed', String(cb.onSwitch(i))));
        col.append(led, b, mk('span', 'silk n', 'SW' + i));
        refs.ledr[i] = led;
        cols.append(col);
      }
      const lab = mk('div', 'grp bot silk', gp.name); lab.append(mk('small', null, gp.sub));
      g.append(cols, lab);
      swBlock.append(g);
    });

    /* Botões KEY (momentâneos: valem enquanto estiverem pressionados) */
    const keysWrap = $('#keys');
    for (const k of [3, 2, 1, 0]) {
      const c = mk('div', 'keycomp');
      const b = mk('button', 'key'); b.type = 'button'; b.id = 'key' + k;
      b.setAttribute('aria-label', `KEY${k}, ${KEYS[k].desc}`);
      b.append(mk('span', 'cap'));
      let down = false;
      const press = () => { if (down) return; down = true; b.classList.add('down'); cb.onKeyDown(k); };
      const release = () => { if (!down) return; down = false; b.classList.remove('down'); cb.onKeyUp(k); };
      b.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        try { b.setPointerCapture(e.pointerId); } catch (_) { /* sem captura, segue */ }
        press();
      });
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('lostpointercapture', release);
      b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } });
      b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } });
      b.addEventListener('blur', release);
      c.append(b, mk('span', 'silk n', 'KEY' + k), mk('span', 'silk fn', KEYS[k].fn));
      keysWrap.append(c);
    }

    /* Botão de energia */
    const powerBtn = $('#power');
    powerBtn.addEventListener('click', () => {
      const on = cb.onPower();
      powerBtn.setAttribute('aria-pressed', String(on));
      powerBtn.setAttribute('aria-label', on ? 'Botão de energia: desligar a placa' : 'Botão de energia: ligar a placa');
    });

    const boardEl = $('#board'), pwrLed = $('#pwrLed'), lcd = $('#lcd');

    /** Pinta um quadro em todas as saídas da placa. */
    function apply(f, powered) {
      boardEl.classList.toggle('is-off', !powered);
      pwrLed.classList.toggle('on', f.pwr);
      for (let n = 0; n < 8; n++) {
        const m = f.hex[n];
        refs.segs[n].forEach((el, s) => el.classList.toggle('on', ((m >> s) & 1) === 1));
      }
      for (let i = 0; i < 18; i++) refs.ledr[i].classList.toggle('on', !!f.ledr[i]);
      for (let g = 0; g < 9; g++) refs.ledg[g].classList.toggle('on', !!f.ledg[g]);
      refs.opLeds.forEach((el, i) => el.classList.toggle('on', f.opRow === -2 || f.opRow === i));
      lcd.classList.toggle('on', f.lcdOn);
      const text = pad(f.lcd[0], 16) + pad(f.lcd[1], 16);
      for (let i = 0; i < 32; i++) {
        const ch = f.lcdOn ? text[i] : ' ';
        const blk = ch === '\x7f';
        refs.cells[i].classList.toggle('blk', blk);
        const v = (blk || ch === ' ') ? '' : ch;
        if (refs.cells[i].textContent !== v) refs.cells[i].textContent = v;
      }
    }

    /** Ajusta as legendas acima dos displays conforme o que eles mostram. */
    function setHexView(view) {
      const [l0, l1, l2] = refs.hexLabels;
      if (view === 'D') {
        l0.hidden = true; l1.hidden = true;
        l2.textContent = 'R · decimal com sinal (KEY1)'; l2.style.gridColumn = '1 / 11';
        return;
      }
      l0.hidden = false; l1.hidden = false;
      l0.textContent = 'A · SW13–7'; l0.style.gridColumn = '1 / 3';
      l1.textContent = 'B · SW6–0'; l1.style.gridColumn = '4 / 6';
      l2.textContent = view === 'A' ? 'A · 16 bits (KEY3)' : view === 'B' ? 'B · 16 bits (KEY2)' : 'R · 16 bits';
      l2.style.gridColumn = '7 / 11';
    }

    return { apply, setHexView };
  }

  ns.board = { build };
})(window.DE2 = window.DE2 || {});
