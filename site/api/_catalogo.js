// Precios de preventa (los mismos de public/index.html). El precio completo = preventa / 0.85 redondeado hacia arriba a $500.
const BASE = {
  completa: ['Caja completa de Navidad', 75000],
  c1: ['Caja 1', 30000], c2: ['Caja 2', 25000], c3: ['Caja 3', 25000], c4: ['Caja 4', 20000],
  c5: ['Caja 5', 10000], c6: ['Caja 6', 15000], bolsa: ['Bolsa de galletas', 12000],
};
const FIN_PREVENTA = '2026-12-01'; // desde este día aplica el precio completo
const completo = v => Math.ceil(v * 100 / 85 / 500) * 500;

function calcular(items) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const preventa = hoy < FIN_PREVENTA;
  let total = 0; const lineas = [];
  for (const i of items || []) {
    const p = BASE[i.id]; const q = Math.floor(Number(i.cantidad));
    if (!p || !(q >= 1 && q <= 20)) continue;
    const precio = preventa ? p[1] : completo(p[1]);
    total += precio * q; lineas.push({ id: i.id, nombre: p[0], cantidad: q, precio });
  }
  return { preventa, total, lineas };
}
module.exports = { calcular };
