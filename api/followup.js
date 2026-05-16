const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SITE_URL = 'https://ecomsanz.com';
const CALENDLY_URL = 'https://calendly.com/boumharafarhaneismael/30min';

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tableName = process.env.SUPABASE_LEADS_TABLE || 'leads';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    supabaseKey,
    tableName
  };
}

async function sendEmailWithResend({ apiKey, from, to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html, text })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RESEND_ERROR_${response.status}: ${body}`);
  }
}

async function sendFollowupEmail(email, name) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@ecomsanz.com';
  const siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL;
  const calendlyUrl = CALENDLY_URL;

  const subject = 'Recordatorio: Reserva tu llamada gratuita sobre Dropshipping IA';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hola ${name},</h2>
      <p>Espero que hayas disfrutado de la masterclass sobre Dropshipping con IA.</p>
      <p>¿Listo para dar el siguiente paso? Reserva una llamada gratuita de 30 minutos conmigo para discutir tu proyecto y cómo puedo ayudarte.</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:18px 0">
        <a href="${calendlyUrl}" style="background-color:#007bff;color:#ffffff;padding:14px 20px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block">Reservar llamada gratuita</a>
        <a href="${siteUrl}/masterclass" style="background-color:#111827;color:#ffffff;padding:14px 20px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block">Ver la masterclass</a>
      </div>
      <p>O si prefieres, revisa nuevamente la masterclass:</p>
      <p><a href="${siteUrl}/masterclass">${siteUrl}/masterclass</a></p>
      <p>¡No pierdas esta oportunidad!</p>
      <p>Saludos,<br>Kevin</p>
    </div>
  `;
  const text = `Hola ${name},

Espero que hayas disfrutado de la masterclass sobre Dropshipping con IA.

¿Listo para dar el siguiente paso? Reserva una llamada gratuita de 30 minutos conmigo para discutir tu proyecto.

Reserva aquí: ${calendlyUrl}

O revisa la masterclass: ${siteUrl}/masterclass

¡No pierdas esta oportunidad!

Saludos,
Kevin`;

  await sendEmailWithResend({ apiKey, from, to: email, subject, html, text });
}

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { supabaseUrl, supabaseKey, tableName } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get leads created 5-10 minutes ago that haven't received followup
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const { data: leads, error } = await supabase
      .from(tableName)
      .select('id, name, email')
      .eq('followup_sent', false)
      .gte('created_at', tenMinutesAgo.toISOString())
      .lt('created_at', fiveMinutesAgo.toISOString());

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    const sentEmails = [];
    for (const lead of leads) {
      try {
        await sendFollowupEmail(lead.email, lead.name);
        sentEmails.push(lead.email);

        // Mark as sent
        await supabase
          .from(tableName)
          .update({ followup_sent: true })
          .eq('id', lead.id);
      } catch (emailError) {
        console.error(`Failed to send email to ${lead.email}:`, emailError);
      }
    }

    res.status(200).json({ message: `Sent ${sentEmails.length} followup emails`, emails: sentEmails });
  } catch (error) {
    console.error('Followup error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = handler;