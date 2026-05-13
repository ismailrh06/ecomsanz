const DEFAULT_SITE_URL = 'https://ecomsanz-dropshipping.vercel.app';
const DEFAULT_ADMIN_EMAIL = 'ecomsanz01@gmail.com';
const CALENDLY_URL = 'https://calendly.com/boumharafarhaneismael/30min';
const VALIDATION_TIMEOUT_MS = 3000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizePhoneNumber(phone) {
  const value = normalizePhone(phone);
  const compact = value.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return compact;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9) return `+34${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `+34${digits.slice(1)}`;
  if (digits.length >= 10) return `+${digits}`;
  return value;
}

function timeoutSignal(ms = VALIDATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function validateEmailWithAbstract(email) {
  const apiKey = process.env.ABSTRACT_EMAIL_API_KEY;
  if (!apiKey) return { skipped: true, provider: 'abstract-email' };

  const timeout = timeoutSignal();
  try {
    const params = new URLSearchParams({ api_key: apiKey, email });
    const response = await fetch(`https://emailvalidation.abstractapi.com/v1/?${params}`, {
      signal: timeout.signal
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`ABSTRACT_EMAIL_ERROR_${response.status}`);
    }

    const isFormatValid = data?.is_valid_format?.value !== false;
    const isDeliverable = data?.deliverability === 'DELIVERABLE';
    const isRisky = data?.is_disposable_email?.value === true || data?.is_role_email?.value === true;

    return {
      skipped: false,
      provider: 'abstract-email',
      valid: Boolean(isFormatValid && isDeliverable && !isRisky),
      reason: !isFormatValid
        ? 'bad_format'
        : !isDeliverable
          ? 'undeliverable'
          : isRisky
            ? 'risky_email'
            : undefined
    };
  } finally {
    timeout.clear();
  }
}

async function validatePhoneWithAbstract(phone) {
  const apiKey = process.env.ABSTRACT_PHONE_API_KEY;
  if (!apiKey) return { skipped: true, provider: 'abstract-phone' };

  const timeout = timeoutSignal();
  try {
    const params = new URLSearchParams({ api_key: apiKey, phone: normalizePhoneNumber(phone) });
    const response = await fetch(`https://phonevalidation.abstractapi.com/v1/?${params}`, {
      signal: timeout.signal
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`ABSTRACT_PHONE_ERROR_${response.status}`);
    }

    return {
      skipped: false,
      provider: 'abstract-phone',
      valid: data?.valid === true,
      reason: data?.valid === true ? undefined : 'invalid_phone'
    };
  } finally {
    timeout.clear();
  }
}

async function validateLeadContact({ email, phone }) {
  const [emailResult, phoneResult] = await Promise.allSettled([
    validateEmailWithAbstract(email),
    validatePhoneWithAbstract(phone)
  ]);

  const emailValidation = emailResult.status === 'fulfilled'
    ? emailResult.value
    : { skipped: true, provider: 'abstract-email', error: String(emailResult.reason?.message || emailResult.reason) };

  const phoneValidation = phoneResult.status === 'fulfilled'
    ? phoneResult.value
    : { skipped: true, provider: 'abstract-phone', error: String(phoneResult.reason?.message || phoneResult.reason) };

  if (emailValidation.valid === false) {
    return {
      ok: false,
      field: 'email',
      message: 'Este email no parece existir. Introduce un email real para recibir el acceso.',
      validation: { email: emailValidation, phone: phoneValidation }
    };
  }

  if (phoneValidation.valid === false) {
    return {
      ok: false,
      field: 'phone',
      message: 'Este teléfono no parece válido. Introduce un número real con prefijo de país.',
      validation: { email: emailValidation, phone: phoneValidation }
    };
  }

  return { ok: true, validation: { email: emailValidation, phone: phoneValidation } };
}

async function sendEmailWithSmtp({ host, port, user, pass, from, to, subject, html, text }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port || 465),
    secure: String(port || 465) === '465',
    auth: { user, pass }
  });

  await transporter.sendMail({ from, to, subject, html, text });
}

async function sendLeadEmail({ from, to, subject, html, text }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    await sendEmailWithSmtp({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      from,
      to,
      subject,
      html,
      text
    });
    return { provider: 'smtp' };
  }

  return {
    skipped: true,
    reason: 'Email service not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.'
  };
}

function buildClientEmail({ name, phone }) {
  const safeName = escapeHtml(name);
  const safePhone = escapeHtml(phone);

  return {
    subject: '✅ Tu acceso a la Masterclass está listo',
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#111827;max-width:620px;margin:auto;padding:20px">
        <h2 style="margin:0 0 12px;color:#111827">Hola ${safeName},</h2>
        <p style="margin:0 0 12px">Gracias por registrarte en la masterclass de <strong>Kevin Dropshipping IA</strong>.</p>
        <p style="margin:0 0 12px">Tu acceso está confirmado. Aquí tienes los siguientes pasos:</p>
        <ol style="margin:0 0 14px;padding-left:18px">
          <li>Ver la masterclass completa.</li>
          <li>Tomar notas de los pasos clave.</li>
          <li>Reservar una llamada para tu plan personalizado.</li>
        </ol>
        <p style="margin:0 0 12px"><strong>Tu teléfono registrado:</strong> ${safePhone}</p>
        <p style="margin:0 0 16px">
          Enlace directo: <a href="${DEFAULT_SITE_URL}/masterclass" target="_blank" rel="noreferrer">${DEFAULT_SITE_URL}/masterclass</a>
        </p>
        <a href="${DEFAULT_SITE_URL}/masterclass" style="display:inline-block;background:linear-gradient(135deg,#ffffff,#d0d3db);color:#101216;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px">Ver masterclass ahora</a>
        <a href="${CALENDLY_URL}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;margin-left:8px">Reservar llamada</a>
        <p style="margin:18px 0 0;color:#6b7280;font-size:13px">Si necesitas ayuda, responde a este correo y te ayudamos.</p>
      </div>
    `,
    text: [
      `Hola ${name},`,
      '',
      'Gracias por registrarte en la masterclass de Kevin Dropshipping IA.',
      'Tu acceso está confirmado.',
      '',
      'Siguientes pasos:',
      '1) Ver la masterclass completa',
      '2) Tomar notas de los pasos clave',
      '3) Reservar una llamada para tu plan personalizado',
      '',
      `Teléfono registrado: ${phone}`,
      `Acceso directo: ${DEFAULT_SITE_URL}/masterclass`,
      `Reservar llamada: ${CALENDLY_URL}`,
      '',
      'Equipo Kevin Dropshipping IA'
    ].join('\n')
  };
}

function buildAdminEmail({ name, email, phone }) {
  return {
    subject: `📩 Nuevo lead: ${name}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111827">
        <h3>Nuevo lead registrado</h3>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
      </div>
    `,
    text: [
      'Nuevo lead registrado',
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Teléfono: ${phone}`,
      `Fecha: ${new Date().toISOString()}`
    ].join('\n')
  };
}

async function leadHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action === 'confirm' ? 'confirm' : 'start';
    const email = normalizeEmail(body.email);
    const fromEmail = process.env.FROM_EMAIL || DEFAULT_ADMIN_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

    if (action === 'confirm') {
      return res.status(410).json({
        error: 'La vérification email est désactivée.',
        field: 'code'
      });
    }

    const name = String(body.name || '').trim();
    const phone = normalizePhoneNumber(body.phone);

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const leadResult = {
      skipped: true,
      reason: 'Supabase connection disabled.'
    };

    let emailResult = { skipped: false };
    let adminEmailResult = { skipped: true };

    try {
      const clientEmail = buildClientEmail({ name, phone });
      emailResult = await sendLeadEmail({
        from: fromEmail,
        to: email,
        subject: clientEmail.subject,
        html: clientEmail.html,
        text: clientEmail.text
      });
    } catch (emailError) {
      emailResult.skipped = true;
      emailResult.error = String(emailError?.message || emailError);
    }

    try {
      if (adminEmail) {
        const adminPayload = buildAdminEmail({ name, email, phone });
        adminEmailResult = await sendLeadEmail({
          from: fromEmail,
          to: adminEmail,
          subject: adminPayload.subject,
          html: adminPayload.html,
          text: adminPayload.text
        });
      }
    } catch (emailError) {
      adminEmailResult.skipped = true;
      adminEmailResult.error = String(emailError?.message || emailError);
    }

    return res.status(200).json({
      ok: true,
      requiresVerification: false,
      message: 'Acceso concedido.',
      leadStorage: leadResult,
      email: emailResult,
      adminEmail: adminEmailResult
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to process lead',
      details: String(err?.message || err)
    });
  }
}

module.exports = leadHandler;
