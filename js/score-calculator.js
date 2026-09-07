// Interactive score calculator for Dhamaka Blocks blog posts. Computes a
// single move's score using the documented formula (see
// .jules/content-style.md "Confirmed game facts") so readers can check
// their own numbers instead of just reading the tables.
/**
 * Performance Optimization: High-Frequency Input Frame Throttling
 * 1. Uses requestAnimationFrame with a `ticking` guard flag to throttle DOM updates
 *    during high-frequency range slider `input` events, keeping updates at 60fps.
 * 2. Uses ES6 arrow functions for consistency across script modules.
 */
(() => {
  const LINE_BONUS = { 1: 10, 2: 35, 3: 75, 4: 130, 5: 200 };
  const COMBO_MULTIPLIER = { 1: 1.0, 2: 2.0, 3: 3.5, 4: 5.0, 5: 7.0, 6: 10.0 };
  const VOICE_CUE = { 1: '', 2: 'AMAZING', 3: 'ON FIRE', 4: 'UNSTOPPABLE', 5: 'LEGENDARY', 6: 'UNREAL' };

  const computeScore = (cells, lines, combo, fullBoard) => {
    const lineKey = Math.min(lines, 5);
    const comboKey = Math.min(combo, 6);
    const basePoints = cells;
    const bonus = LINE_BONUS[lineKey];
    const multiplier = COMBO_MULTIPLIER[comboKey];
    let total = basePoints + Math.round(bonus * multiplier);
    if (fullBoard) total += 500;
    return { total, basePoints, bonus, multiplier, voiceCue: VOICE_CUE[comboKey] };
  };

  const initCalculators = () => {
    const widgets = document.querySelectorAll('.score-calc');
    widgets.forEach((widget) => {
      const cellsInput = widget.querySelector('[data-calc-cells]');
      const linesInput = widget.querySelector('[data-calc-lines]');
      const comboInput = widget.querySelector('[data-calc-combo]');
      const fullBoardInput = widget.querySelector('[data-calc-fullboard]');
      const resultEl = widget.querySelector('[data-calc-result]');
      const breakdownEl = widget.querySelector('[data-calc-breakdown]');
      const cellsOutEl = widget.querySelector('[data-calc-cells-out]');
      const linesOutEl = widget.querySelector('[data-calc-lines-out]');
      const comboOutEl = widget.querySelector('[data-calc-combo-out]');
      if (!linesInput || !comboInput || !resultEl) return;

      let ticking = false;

      const update = () => {
        const cells = cellsInput ? (parseInt(cellsInput.value, 10) || 0) : 0;
        const lines = parseInt(linesInput.value, 10) || 1;
        const combo = parseInt(comboInput.value, 10) || 1;
        const fullBoard = fullBoardInput ? fullBoardInput.checked : false;
        const result = computeScore(cells, lines, combo, fullBoard);

        if (cellsOutEl) cellsOutEl.textContent = String(cells);
        if (linesOutEl) linesOutEl.textContent = lines >= 5 ? '5+' : String(lines);
        if (comboOutEl) comboOutEl.textContent = combo >= 6 ? '6+' : String(combo);

        resultEl.textContent = `${result.total.toLocaleString()} pts`;
        if (breakdownEl) {
          let parts = `${result.basePoints} base + ${result.bonus} bonus × ${result.multiplier.toFixed(1)}× combo`;
          if (fullBoard) parts += ' + 500 full-board bonus';
          if (result.voiceCue) parts += ` — "${result.voiceCue}"`;
          breakdownEl.textContent = parts;
        }
        ticking = false;
      };

      const requestUpdate = () => {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      };

      if (cellsInput) cellsInput.addEventListener('input', requestUpdate);
      linesInput.addEventListener('input', requestUpdate);
      comboInput.addEventListener('input', requestUpdate);
      if (fullBoardInput) fullBoardInput.addEventListener('change', requestUpdate);
      update();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalculators);
  } else {
    initCalculators();
  }
})();
