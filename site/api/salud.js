// Diagnóstico: abre /api/salud en el navegador. No muestra claves, solo si están configuradas y si todo conecta.
const { SB, KEY, sb } = require('./_sb');
module.exports = async (req, res) => {
  const out = {
    supabase_url: !!SB, supabase_clave: !!KEY,
    resend_clave: !!process.env.RESEND_API_KEY, pedidos_to: !!process.env.PEDIDOS_TO, pedidos_from: !!process.env.PEDIDOS_FROM,
  };
  if (SB && KEY) {
    try {
      const t = await sb('/rest/v1/pedidos?select=id&limit=1');
      out.tabla_pedidos = t.ok ? 'ok' : `error ${t.status}: ${(await t.text()).slice(0, 150)}`;
      const b = await sb('/storage/v1/bucket/comprobantes');
      out.bucket_comprobantes = b.ok ? 'ok' : `error ${b.status}`;
    } catch (e) { out.conexion = 'falló: ' + e.message; }
  }
  res.status(200).json(out);
};
