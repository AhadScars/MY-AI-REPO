const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function rowLetter(index) {
  return ROW_LETTERS[index] || `R${index + 1}`;
}

function categoryForRow(rowIndex, rowCount) {
  if (rowCount <= 3) return rowIndex === rowCount - 1 ? 'vip' : 'regular';
  if (rowIndex >= rowCount - 2) return 'vip';
  if (rowIndex >= Math.max(2, Math.floor(rowCount * 0.35))) return 'premium';
  return 'regular';
}

function aisleSet(colCount) {
  const set = new Set();
  if (colCount >= 10) {
    set.add(3);
    set.add(colCount - 4);
  }
  return set;
}

function priceFor(category, showtime) {
  if (category === 'vip') return Number(showtime.price_vip);
  if (category === 'premium') return Number(showtime.price_premium);
  return Number(showtime.price_regular);
}

function buildLayout(screen, showtime, takenSet) {
  const rows = [];
  const aisles = aisleSet(screen.col_count);
  for (let r = 0; r < screen.row_count; r++) {
    const letter = rowLetter(r);
    const category = categoryForRow(r, screen.row_count);
    const seats = [];
    for (let c = 0; c < screen.col_count; c++) {
      if (aisles.has(c)) {
        seats.push({ type: 'aisle' });
        continue;
      }
      const label = `${letter}${c + 1}`;
      seats.push({
        type: 'seat',
        label,
        category,
        price: priceFor(category, showtime),
        taken: takenSet.has(label),
      });
    }
    rows.push({ letter, category, seats });
  }
  return rows;
}

function parseSeatList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).toUpperCase());
  return String(raw)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function validateSeats(screen, showtime, labels) {
  const wanted = [...new Set(parseSeatList(labels))];
  if (!wanted.length) throw Object.assign(new Error('Pick at least one seat'), { status: 400 });
  const layout = buildLayout(screen, showtime, new Set());
  const map = new Map();
  for (const row of layout) {
    for (const seat of row.seats) {
      if (seat.type === 'seat') map.set(seat.label, seat);
    }
  }
  const selected = [];
  for (const label of wanted) {
    const seat = map.get(label);
    if (!seat) throw Object.assign(new Error(`Seat ${label} does not exist`), { status: 400 });
    selected.push({ label, category: seat.category, price: seat.price });
  }
  return selected;
}

module.exports = {
  rowLetter,
  categoryForRow,
  buildLayout,
  parseSeatList,
  validateSeats,
  priceFor,
};
