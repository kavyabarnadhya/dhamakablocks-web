// Interactive score calculator for Dhamaka Blocks blog posts. Computes a
// single move's score using the documented formula (see
// .jules/content-style.md "Confirmed game facts") so readers can check
// their own numbers instead of just reading the tables.
(function () {
  var LINE_BONUS = { 1: 10, 2: 35, 3: 75, 4: 130, 5: 200 };
  var COMBO_MULTIPLIER = { 1: 1.0, 2: 2.0, 3: 3.5, 4: 5.0, 5: 7.0, 6: 10.0 };
  var VOICE_CUE = { 1: '', 2: 'AMAZING', 3: 'ON FIRE', 4: 'UNSTOPPABLE', 5: 'LEGENDARY', 6: 'UNREAL' };

  function computeScore(cells, lines, combo, fullBoard) {
    var lineKey = Math.min(lines, 5);
    var comboKey = Math.min(combo, 6);
    var basePoints = cells;
    var bonus = LINE_BONUS[lineKey];
    var multiplier = COMBO_MULTIPLIER[comboKey];
    var total = basePoints + Math.round(bonus * multiplier);
    if (fullBoard) total += 500;
    return { total: total, basePoints: basePoints, bonus: bonus, multiplier: multiplier, voiceCue: VOICE_CUE[comboKey] };
  }

  function initCalculators() {
    var widgets = document.querySelectorAll('.score-calc');
    widgets.forEach(function (widget) {
      var cellsInput = widget.querySelector('[data-calc-cells]');
      var linesInput = widget.querySelector('[data-calc-lines]');
      var comboInput = widget.querySelector('[data-calc-combo]');
      var fullBoardInput = widget.querySelector('[data-calc-fullboard]');
      var resultEl = widget.querySelector('[data-calc-result]');
      var breakdownEl = widget.querySelector('[data-calc-breakdown]');
      var cellsOutEl = widget.querySelector('[data-calc-cells-out]');
      var linesOutEl = widget.querySelector('[data-calc-lines-out]');
      var comboOutEl = widget.querySelector('[data-calc-combo-out]');
      if (!linesInput || !comboInput || !resultEl) return;

      function update() {
        var cells = cellsInput ? (parseInt(cellsInput.value, 10) || 0) : 0;
        var lines = parseInt(linesInput.value, 10) || 1;
        var combo = parseInt(comboInput.value, 10) || 1;
        var fullBoard = fullBoardInput ? fullBoardInput.checked : false;
        var result = computeScore(cells, lines, combo, fullBoard);

        if (cellsOutEl) cellsOutEl.textContent = String(cells);
        if (linesOutEl) linesOutEl.textContent = lines >= 5 ? '5+' : String(lines);
        if (comboOutEl) comboOutEl.textContent = combo >= 6 ? '6+' : String(combo);

        resultEl.textContent = result.total.toLocaleString() + ' pts';
        if (breakdownEl) {
          var parts = result.basePoints + ' base + ' + result.bonus + ' bonus × ' + result.multiplier.toFixed(1) + '× combo';
          if (fullBoard) parts += ' + 500 full-board bonus';
          if (result.voiceCue) parts += ' — "' + result.voiceCue + '"';
          breakdownEl.textContent = parts;
        }
      }

      if (cellsInput) cellsInput.addEventListener('input', update);
      linesInput.addEventListener('input', update);
      comboInput.addEventListener('input', update);
      if (fullBoardInput) fullBoardInput.addEventListener('change', update);
      update();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalculators);
  } else {
    initCalculators();
  }
})();
