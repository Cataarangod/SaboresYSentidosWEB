// Guarda el pedido en Supabase (tabla + comprobante) y además avisa por correo con Resend.
// Variables de entorno (Vercel): SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, PEDIDOS_TO, PEDIDOS_FROM (opcional)
const crypto = require('crypto');
const { calcular } = require('./_catalogo');

const { SB, KEY, sb } = require('./_sb');
const esc = (s = '') => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const cop = n => '$' + Number(n).toLocaleString('es-CO');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const b = req.body || {};
    const { nombre, whatsapp, email, municipio, direccion, notas, carta, desde, hasta, comprobante } = b;
    const { preventa, total, lineas } = calcular(b.items);
    if (!nombre || !whatsapp || !desde || !hasta || !lineas.length || !comprobante?.content)
      return res.status(400).json({ error: 'Faltan datos del pedido' });

    const mitad = b.pago === 'mitad';
    const anticipo = mitad ? Math.round(total / 2) : total, saldo = total - anticipo;
    let id = null, url = null, dbOk = false;

    // 1) Base de datos + comprobante
    if (SB && KEY) {
      try {
        const ext = ((comprobante.filename || '').match(/\.(pdf|png|webp|heic|heif|jpe?g)$/i) || [, 'jpg'])[1].toLowerCase();
        const MIME = { pdf: 'application/pdf', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
        const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
        const up = await sb(`/storage/v1/object/comprobantes/${path}`, {
          method: 'POST', headers: { 'Content-Type': MIME[ext] || 'image/jpeg' },
          body: Buffer.from(comprobante.content, 'base64'),
        });
        if (up.ok) {
          const sg = await sb(`/storage/v1/object/sign/comprobantes/${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 31536000 }),
          });
          const j = await sg.json();
          if (j.signedURL) url = SB + '/storage/v1' + j.signedURL;
        }
        const ins = await sb('/rest/v1/pedidos', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({
            nombre, whatsapp, email, municipio, direccion, notas, carta: carta || null,
            entrega_desde: desde, entrega_hasta: hasta, items: lineas, total, total_cliente: Number(b.total) || null,
            preventa, pago: mitad ? 'mitad' : 'completo', anticipo, saldo, comprobante_url: url,
          }),
        });
        if (ins.ok) { id = (await ins.json())[0]?.id; dbOk = true; } else console.error('DB', await ins.text());
      } catch (e) { console.error('DB', e); }
    }

    // 2) Aviso por correo (respaldo)
    let mailOk = false;
    if (process.env.RESEND_API_KEY && process.env.PEDIDOS_TO) {
      try {
        const aviso = b.total && Number(b.total) !== total ? `<p style="color:#b00"><b>Revisar:</b> el cliente vio ${cop(b.total)} y el sistema calculó ${cop(total)}.</p>` : '';
        const html = `<h2>Nuevo pedido${id ? ' #' + id : ''}</h2>${aviso}
          <p><b>${esc(nombre)}</b><br>WhatsApp: ${esc(whatsapp)}<br>Correo: ${esc(email)}<br>Municipio: ${esc(municipio)}<br>Dirección / punto de encuentro: ${esc(direccion)}</p>
          <p>Entrega entre <b>${esc(desde)}</b> y <b>${esc(hasta)}</b></p>
          <ul>${lineas.map(l => `<li>${l.cantidad} × ${esc(l.nombre)} (${cop(l.precio)} c/u)</li>`).join('')}</ul>
          <p><b>Total: ${cop(total)}</b> ${preventa ? '(preventa)' : '(precio completo)'}<br>${mitad ? `Pagó el 50% (${cop(anticipo)}). <b>Saldo a cobrar en la entrega: ${cop(saldo)}</b>` : 'Pago completo'}</p>
          <p>Notas: ${esc(notas)}</p><p><b>Mini carta:</b> ${carta ? esc(carta) : 'No'}</p>
          ${url ? `<p><a href="${url}">Ver comprobante</a></p>` : ''}`;
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.PEDIDOS_FROM || 'Pedidos <onboarding@resend.dev>', to: [process.env.PEDIDOS_TO], reply_to: email || undefined,
            subject: `Pedido Navidad${id ? ' #' + id : ''} – ${nombre}${mitad ? ' (50% + saldo en entrega)' : ''}`, html,
            attachments: [{ filename: comprobante.filename || 'comprobante', content: comprobante.content }],
          }),
        });
        mailOk = r.ok;
      } catch (e) { console.error('Mail', e); }
    }

    // 3) Confirmación al cliente (solo si PEDIDOS_FROM es una dirección de un dominio verificado en Resend)
    if (process.env.RESEND_API_KEY && process.env.PEDIDOS_FROM && email) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.PEDIDOS_FROM, to: [email], subject: `Recibimos tu pedido de Navidad${id ? ' #' + id : ''}`,
            html: `<p>Hola ${esc(nombre)}, ¡gracias por tu precompra en Sabores y Sentidos!</p>
              <ul>${lineas.map(l => `<li>${l.cantidad} × ${esc(l.nombre)}</li>`).join('')}</ul>
              <p><b>Total: ${cop(total)}</b><br>${mitad ? `Pagaste ${cop(anticipo)}. Saldo a pagar al recibir: <b>${cop(saldo)}</b>` : 'Pago completo'}</p>
              <p>Entrega entre ${esc(desde)} y ${esc(hasta)}. Te escribiremos por WhatsApp para confirmar los detalles. Dudas: 304 428 6946.</p>`,
          }),
        });
      } catch (e) { console.error('Confirmación', e); }
    }

    if (!dbOk && !mailOk) return res.status(502).json({ error: 'No se pudo guardar el pedido' });
    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
