// Recibe el pedido y lo envía por correo (con el comprobante adjunto) usando Resend.
// Variables de entorno en Vercel: RESEND_API_KEY, PEDIDOS_TO (tu correo), PEDIDOS_FROM (opcional)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const { nombre, whatsapp, email, municipio, direccion, carta, preventa, pago, anticipo, saldo, notas, desde, hasta, items, total, comprobante } = req.body || {};
    if (!nombre || !whatsapp || !items?.length || !desde || !hasta || !comprobante?.content)
      return res.status(400).json({ error: 'Faltan datos del pedido' });

    const esc = (s = '') => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const lista = items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)}</li>`).join('');
    const html = `<h2>Nuevo pedido de Navidad</h2>
      <p><b>${esc(nombre)}</b><br>WhatsApp: ${esc(whatsapp)}<br>Correo: ${esc(email)}<br>Municipio: ${esc(municipio)}<br>Dirección / punto de encuentro: ${esc(direccion)}</p>
      <p>Quiere recibirlo entre <b>${esc(desde)}</b> y <b>${esc(hasta)}</b></p>
      <ul>${lista}</ul><p><b>Total: $${Number(total).toLocaleString('es-CO')}</b><br>${pago === 'mitad' ? `Pagó el 50% ($${Number(anticipo).toLocaleString('es-CO')}). <b>Saldo a cobrar en la entrega: $${Number(saldo).toLocaleString('es-CO')}</b>` : 'Pago completo'}</p>
      <p>Notas: ${esc(notas)}</p><p><b>Mini carta:</b> ${carta ? esc(carta) : 'No'}</p><p>${preventa ? 'Precio de preventa (15% de descuento)' : 'Precio completo'}</p><p>El comprobante de pago va adjunto.</p>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.PEDIDOS_FROM || 'Pedidos <onboarding@resend.dev>',
        to: [process.env.PEDIDOS_TO],
        reply_to: email || undefined,
        subject: `Pedido Navidad – ${nombre}${pago === 'mitad' ? ' (50% + saldo en entrega)' : ''}`,
        html,
        attachments: [{ filename: comprobante.filename || 'comprobante', content: comprobante.content }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'No se pudo enviar el pedido' });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
