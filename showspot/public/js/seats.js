(function () {
  const map = document.querySelector('.seat-map');
  const list = document.getElementById('seat-list');
  const sub = document.getElementById('seat-sub');
  const hidden = document.getElementById('seat-values');
  const go = document.getElementById('seat-go');
  if (!map) return;

  const max = Number(map.dataset.max || 10);
  const selected = new Map();

  function money(n) {
    return Number(n).toFixed(2);
  }

  function render() {
    const seats = [...selected.values()];
    hidden.value = seats.map((s) => s.label).join(',');
    const total = seats.reduce((sum, s) => sum + Number(s.price), 0);
    sub.textContent = money(total);
    go.disabled = seats.length === 0;
    list.textContent = seats.length
      ? seats.map((s) => `${s.label} (${s.category})`).join(' · ')
      : `Tap seats on the map. Max ${max}.`;
  }

  map.addEventListener('click', (e) => {
    const btn = e.target.closest('.seat');
    if (!btn || btn.disabled) return;
    const label = btn.dataset.label;
    if (selected.has(label)) {
      selected.delete(label);
      btn.classList.remove('is-on');
    } else {
      if (selected.size >= max) return;
      selected.set(label, {
        label,
        price: btn.dataset.price,
        category: btn.dataset.category,
      });
      btn.classList.add('is-on');
    }
    render();
  });

  render();
})();
