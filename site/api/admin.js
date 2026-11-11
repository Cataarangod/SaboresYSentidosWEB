// Panel de pedidos: leer y actualizar. Protegido con la clave ADMIN_PASSWORD (variable de entorno en Vercel).
const crypto = require('crypto');
const { SB, KEY, sb } = require('./_sb');
const h = s => crypto.createHash('sha256').update(String(s)).digest();
const ESTADOS = ['pendiente', 'confirmado', 'entregado', 'cancelado'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return res.status(500).json({ error: 'Falta la variable ADMIN_PASSWORD en Vercel' });
  if (!crypto.timingSafeEqual(h(req.headers['x-admin-key'] || ''), h(pw))) {
    await new Promise(r => setTimeout(r, 700));
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  if (!SB || !KEY) return res.status(500).json({ error: 'Falta configurar Supabase' });
  try {
    if (req.method === 'GET') {
      const r = await sb('/rest/v1/pedidos?select=*&order=id.desc&limit=2000');
      if (!r.ok) return res.status(502).json({ error: 'No se pudo leer la base de datos' });
      return res.status(200).json({ pedidos: await r.json() });
    }
    if (req.method === 'PATCH') {
      const { id, estado, saldo_cobrado, pasado } = req.body || {};
      const upd = {};
      if (ESTADOS.includes(estado)) upd.estado = estado;
      if (typeof saldo_cobrado === 'boolean') upd.saldo_cobrado = saldo_cobrado;
      if (typeof pasado === 'boolean') upd.pasado = pasado;
      if (!Number.isInteger(id) || !Object.keys(upd).length) return res.status(400).json({ error: 'Datos inválidos' });
      const r = await sb(`/rest/v1/pedidos?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upd) });
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
    }
    res.status(405).json({ error: 'Método no permitido' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error del servidor' }); }
};
