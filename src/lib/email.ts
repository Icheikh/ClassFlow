import { Resend } from "resend"

type EmailPayload = {
  to: string
  subject: string
  text: string
  html: string
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const from = process.env.EMAIL_FROM || "ClassFlow <onboarding@resend.dev>"

async function sendEmail(payload: EmailPayload) {
  if (!resend) return { skipped: true as const, reason: "NO_API_KEY" }
  const { error, data } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  })
  if (error) {
    console.error("[email] send failed:", error)
    return { skipped: false as const, error }
  }
  return { skipped: false as const, id: data?.id }
}

export type EmailLocale = "ar" | "fr"

function baseHtml({ title, body, ctaText, ctaUrl, locale, footer }: {
  title: string
  body: string
  ctaText?: string
  ctaUrl?: string
  locale: EmailLocale
  footer?: string
}) {
  const isAr = locale === "ar"
  const dir = isAr ? "rtl" : "ltr"
  const lang = isAr ? "ar" : "fr"
  const font = isAr ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'Segoe UI', Arial, sans-serif"
  const defaultFooter = isAr
    ? "فريق ClassFlow — منصة الإدارة المدرسية"
    : "L'équipe ClassFlow — Plateforme de gestion scolaire"
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${font};color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px 32px;text-align:${isAr ? "right" : "left"};">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;line-height:1.7;font-size:15px;text-align:${isAr ? "right" : "left"};">
            ${body}
            ${ctaText && ctaUrl ? `
            <div style="text-align:center;margin-top:28px;">
              <a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">
                ${ctaText}
              </a>
            </div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center;">
            ${footer || defaultFooter}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function sendPasswordResetEmail(opts: {
  to: string
  name: string
  resetUrl: string
  locale: EmailLocale
}) {
  const isAr = opts.locale === "ar"
  const subject = isAr ? "إعادة تعيين كلمة المرور — ClassFlow" : "Réinitialisation du mot de passe — ClassFlow"
  const title = isAr ? "إعادة تعيين كلمة المرور" : "Réinitialisation du mot de passe"
  const hello = isAr ? `مرحباً ${escapeHtml(opts.name)}` : `Bonjour ${escapeHtml(opts.name)}`
  const body = isAr
    ? `<p>${hello},</p><p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لاختيار كلمة مرور جديدة:</p><p style="color:#6b7280;font-size:13px;">الرابط صالح لمدة ساعة واحدة فقط. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.</p>`
    : `<p>${hello},</p><p>Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p><p style="color:#6b7280;font-size:13px;">Ce lien est valable pendant une heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.</p>`
  return sendEmail({
    to: opts.to,
    subject,
    text: `${hello}\n\n${isAr ? "إعادة تعيين كلمة المرور:" : "Réinitialisation du mot de passe :"} ${opts.resetUrl}`,
    html: baseHtml({ title, body, ctaText: isAr ? "إعادة تعيين كلمة المرور" : "Réinitialiser le mot de passe", ctaUrl: opts.resetUrl, locale: opts.locale }),
  })
}

export function sendCredentialsEmail(opts: {
  to: string
  name: string
  email: string
  password: string
  locale: EmailLocale
  schoolName?: string
}) {
  const isAr = opts.locale === "ar"
  const subject = isAr ? "بيانات دخولك إلى ClassFlow" : "Vos identifiants ClassFlow"
  const title = isAr ? "تم إنشاء حسابك" : "Votre compte a été créé"
  const school = opts.schoolName ? (isAr ? ` في ${escapeHtml(opts.schoolName)}` : ` à ${escapeHtml(opts.schoolName)}`) : ""
  const hello = isAr ? `مرحباً ${escapeHtml(opts.name)}` : `Bonjour ${escapeHtml(opts.name)}`
  const body = isAr
    ? `<p>${hello},</p><p>تم إنشاء حسابك${school}. إليك بيانات الدخول:</p>
       <table role="presentation" cellpadding="8" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin:16px 0;font-size:14px;">
         <tr><td style="color:#6b7280;">البريد الإلكتروني</td><td><strong>${escapeHtml(opts.email)}</strong></td></tr>
         <tr><td style="color:#6b7280;">كلمة المرور المؤقتة</td><td><strong>${escapeHtml(opts.password)}</strong></td></tr>
       </table>
       <p style="color:#b91c1c;font-size:13px;">يجب عليك تغيير كلمة المرور عند أول تسجيل دخول.</p>`
    : `<p>${hello},</p><p>Votre compte a été créé${school}. Voici vos identifiants :</p>
       <table role="presentation" cellpadding="8" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin:16px 0;font-size:14px;">
         <tr><td style="color:#6b7280;">E-mail</td><td><strong>${escapeHtml(opts.email)}</strong></td></tr>
         <tr><td style="color:#6b7280;">Mot de passe temporaire</td><td><strong>${escapeHtml(opts.password)}</strong></td></tr>
       </table>
       <p style="color:#b91c1c;font-size:13px;">Vous devrez changer le mot de passe lors de votre première connexion.</p>`
  return sendEmail({
    to: opts.to,
    subject,
    text: `${hello}\n\n${isAr ? "البريد الإلكتروني" : "E-mail"} : ${opts.email}\n${isAr ? "كلمة المرور المؤقتة" : "Mot de passe temporaire"} : ${opts.password}`,
    html: baseHtml({ title, body, locale: opts.locale }),
  })
}

export function sendNotificationEmail(opts: {
  to: string
  name: string
  title: string
  message: string
  locale: EmailLocale
}) {
  const isAr = opts.locale === "ar"
  const subject = `${opts.title} — ClassFlow`
  const title = isAr ? "إشعار جديد" : "Nouvelle notification"
  const hello = isAr ? `مرحباً ${escapeHtml(opts.name)}` : `Bonjour ${escapeHtml(opts.name)}`
  const body = isAr
    ? `<p>${hello},</p><p><strong>${escapeHtml(opts.title)}</strong></p><p>${escapeHtml(opts.message)}</p>`
    : `<p>${hello},</p><p><strong>${escapeHtml(opts.title)}</strong></p><p>${escapeHtml(opts.message)}</p>`
  return sendEmail({
    to: opts.to,
    subject,
    text: `${hello}\n\n${opts.title}\n\n${opts.message}`,
    html: baseHtml({ title, body, locale: opts.locale }),
  })
}