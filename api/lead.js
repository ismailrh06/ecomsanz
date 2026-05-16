const crypto = require('crypto');

const DEFAULT_SITE_URL = 'https://ecomsanz.com';
const DEFAULT_LEADS_TABLE = 'leads';
const DEFAULT_ADMIN_EMAIL = 'ecomsanz01@gmail.com';
const CALENDLY_URL = 'https://calendly.com/boumharafarhaneismael/30min';
const VALIDATION_TIMEOUT_MS = 3000;
const VERIFICATION_TTL_MINUTES = 15;

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

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tableName = process.env.SUPABASE_LEADS_TABLE || DEFAULT_LEADS_TABLE;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    supabaseKey,
    tableName
  };
}

function getVerificationSecret() {
  return process.env.VERIFICATION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || DEFAULT_ADMIN_EMAIL;
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashVerificationCode({ email, code }) {
  return crypto
    .createHmac('sha256', getVerificationSecret())
    .update(`${normalizeEmail(email)}:${String(code).trim()}`)
    .digest('hex');
}

function getVerificationExpiry() {
  return new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60 * 1000).toISOString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return {
      skipped: true,
      reason: 'Email service not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS, or RESEND_API_KEY.'
    };
  }

  await sendEmailWithResend({
    apiKey: resendKey,
    from,
    to,
    subject,
    html,
    text
  });
  return { provider: 'resend' };
}

async function saveLeadToSupabase({ name, email, phone }) {
  const { supabaseUrl, supabaseKey, tableName } = getSupabaseConfig();
  const endpoint = `${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      name,
      email,
      phone,
      source: 'masterclass'
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SUPABASE_ERROR_${response.status}: ${body}`);
  }

  const data = await response.json().catch(() => []);
  return { skipped: false, lead: data[0] || null };
}

async function getLeadByEmailOrPhone(email, phone) {
  const { supabaseUrl, supabaseKey, tableName } = getSupabaseConfig();
  const params = new URLSearchParams({
    select: 'id,name,email,phone,email_verified_at,email_verification_code_hash,email_verification_expires_at',
    or: `(email.eq.${email},phone.eq.${phone})`,
    limit: '1'
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?${params}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SUPABASE_SELECT_ERROR_${response.status}: ${body}`);
  }

  const data = await response.json().catch(() => []);
  return data[0] || null;
}

async function updateLeadVerificationInSupabase({ id, name, email, phone }) {
  const { supabaseUrl, supabaseKey, tableName } = getSupabaseConfig();
  const params = new URLSearchParams();

  if (id) {
    params.set('id', `eq.${id}`);
  } else {
    params.set('or', `(email.eq.${email},phone.eq.${phone})`);
  }

  const endpoint = `${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?${params}`;
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      name,
      email,
      phone,
      source: 'masterclass'
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SUPABASE_UPDATE_ERROR_${response.status}: ${body}`);
  }

  const data = await response.json().catch(() => []);
  return { skipped: false, lead: data[0] || null, updated: true };
}

async function saveOrUpdateLeadVerification(payload) {
  const existingLead = await getLeadByEmailOrPhone(payload.email, payload.phone);
  if (existingLead) {
    return updateLeadVerificationInSupabase({
      id: existingLead.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone
    });
  }

  try {
    return await saveLeadToSupabase(payload);
  } catch (error) {
    if (isSupabaseDuplicateError(error)) {
      return updateLeadVerificationInSupabase(payload);
    }
    throw error;
  }
}

async function getLeadByEmail(email) {
  const { supabaseUrl, supabaseKey, tableName } = getSupabaseConfig();
  const params = new URLSearchParams({
    select: 'id,name,email,phone,email_verification_code_hash,email_verification_expires_at',
    email: `eq.${email}`,
    limit: '1'
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?${params}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SUPABASE_SELECT_ERROR_${response.status}: ${body}`);
  }

  const data = await response.json().catch(() => []);
  return data[0] || null;
}

async function markLeadEmailVerified(leadId) {
  const { supabaseUrl, supabaseKey, tableName } = getSupabaseConfig();
  const params = new URLSearchParams({ id: `eq.${leadId}` });

  const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?${params}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      email_verified_at: new Date().toISOString(),
      email_verification_code_hash: null,
      email_verification_expires_at: null
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SUPABASE_VERIFY_ERROR_${response.status}: ${body}`);
  }

  const data = await response.json().catch(() => []);
  return data[0] || null;
}

async function verifyLeadEmailCode({ email, code }) {
  const lead = await getLeadByEmail(email);

  if (!lead?.email_verification_code_hash || !lead?.email_verification_expires_at) {
    return { ok: false, reason: 'missing_code' };
  }

  if (new Date(lead.email_verification_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired_code' };
  }

  const expectedHash = Buffer.from(lead.email_verification_code_hash, 'hex');
  const submittedHash = Buffer.from(hashVerificationCode({ email, code }), 'hex');

  if (expectedHash.length !== submittedHash.length || !crypto.timingSafeEqual(expectedHash, submittedHash)) {
    return { ok: false, reason: 'invalid_code' };
  }

  const verifiedLead = await markLeadEmailVerified(lead.id);
  return { ok: true, lead: verifiedLead || lead };
}

function isSupabaseDuplicateError(error) {
  return String(error?.message || error).includes('SUPABASE_ERROR_409')
    || String(error?.message || error).includes('23505')
    || String(error?.message || error).toLowerCase().includes('duplicate key');
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
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px">
          <a href="${DEFAULT_SITE_URL}/masterclass" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;min-width:180px;text-align:center">Ver masterclass ahora</a>
          <a href="${CALENDLY_URL}" style="display:inline-block;background:#007bff;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;min-width:180px;text-align:center">Reservar llamada</a>
        </div>
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

function buildVerificationEmail({ name, code }) {
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);

  return {
    subject: 'Tu código de acceso a la Masterclass',
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#111827;max-width:620px;margin:auto;padding:20px">
        <h2 style="margin:0 0 12px;color:#111827">Hola ${safeName},</h2>
        <p style="margin:0 0 12px">Usa este código para confirmar tu email y acceder a la masterclass:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:800;margin:18px 0;color:#111827">${safeCode}</p>
        <p style="margin:0 0 12px">Este código caduca en ${VERIFICATION_TTL_MINUTES} minutos.</p>
        <p style="margin:18px 0 0;color:#6b7280;font-size:13px">Si no has solicitado este acceso, puedes ignorar este correo.</p>
      </div>
    `,
    text: [
      `Hola ${name},`,
      '',
      'Usa este código para confirmar tu email y acceder a la masterclass:',
      code,
      '',
      `Este código caduca en ${VERIFICATION_TTL_MINUTES} minutos.`,
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
      const code = String(body.code || '').replace(/\D/g, '');

      if (!email || code.length !== 6) {
        return res.status(400).json({ error: 'Código de verificación inválido.', field: 'code' });
      }

      const verification = await verifyLeadEmailCode({ email, code });

      if (!verification.ok) {
        const expired = verification.reason === 'expired_code';
        return res.status(422).json({
          error: expired
            ? 'El código ha caducado. Pide uno nuevo.'
            : 'El código no es correcto. Revisa tu email e inténtalo de nuevo.',
          field: 'code',
          reason: verification.reason
        });
      }

      let emailResult = { skipped: false };
      try {
        const clientEmail = buildClientEmail({
          name: verification.lead.name,
          phone: verification.lead.phone
        });
        emailResult = await sendLeadEmail({
          from: fromEmail,
          to: verification.lead.email,
          subject: clientEmail.subject,
          html: clientEmail.html,
          text: clientEmail.text
        });

        if (adminEmail) {
          const adminPayload = buildAdminEmail({
            name: verification.lead.name,
            email: verification.lead.email,
            phone: verification.lead.phone
          });
          await sendLeadEmail({
            from: fromEmail,
            to: adminEmail,
            subject: adminPayload.subject,
            html: adminPayload.html,
            text: adminPayload.text
          });
        }
      } catch (emailError) {
        emailResult.skipped = true;
        emailResult.error = String(emailError?.message || emailError);
      }

      return res.status(200).json({
        ok: true,
        verified: true,
        email: emailResult,
        lead: {
          name: verification.lead.name,
          email: verification.lead.email,
          phone: verification.lead.phone
        }
      });
    }

    const name = String(body.name || '').trim();
    const phone = normalizePhoneNumber(body.phone);

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabaseResult = await saveOrUpdateLeadVerification({
      name,
      email,
      phone
    });

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
      supabase: supabaseResult,
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
