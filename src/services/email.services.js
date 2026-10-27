require('dotenv').config()
const crypto = require('crypto')
const nodemailer = require('nodemailer')

const BANK_NAME = process.env.BANK_NAME || 'Dhanadhya Finance'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || ''

// ---------- transporter ----------
// Option A (recommended for real use): any SMTP provider (Brevo, Resend, SendGrid, SES, Mailgun)
//   set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
// Option B (testing): Gmail with an App Password
//   set EMAIL_USER, EMAIL_APP_PASSWORD in .env

const useCustomSmtp = Boolean(process.env.SMTP_HOST)

const commonOptions = {
  pool: true, // reuse connections instead of logging in for every mail
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1000, // max 3 mails per second, avoids looking like a burst sender
  rateLimit: 3,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
}

const transporter = useCustomSmtp
  ? nodemailer.createTransport({
      ...commonOptions,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : nodemailer.createTransport({
      ...commonOptions,
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    })

// From address: use EMAIL_FROM (an address on your verified domain) if set,
// otherwise fall back to the login account.
const FROM_ADDRESS = process.env.EMAIL_FROM || process.env.EMAIL_USER
const FROM_DOMAIN = (FROM_ADDRESS || '').split('@')[1] || 'localhost'

transporter.verify((error) => {
  if (error) {
    console.error('Error connecting to email server:', error.message)
  } else {
    console.log(
      `Email server is ready (${useCustomSmtp ? process.env.SMTP_HOST : 'gmail'}), sending from ${FROM_ADDRESS}`
    )
  }
})

// ---------- helpers ----------

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// removes line breaks so a name can never inject extra mail headers
function cleanHeaderText(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

function maskAccount(accountNumber) {
  return `XXXX${String(accountNumber ?? '').slice(-4)}`
}

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortRef(id) {
  return id ? String(id).slice(-10).toUpperCase() : null
}

const supportLineText = SUPPORT_EMAIL
  ? `If this was not you, please contact us at ${SUPPORT_EMAIL}.`
  : 'If this was not you, please contact support.'

const supportLineHtml = SUPPORT_EMAIL
  ? `If this was not you, please contact us at <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#b91c1c;">${escapeHtml(SUPPORT_EMAIL)}</a>.`
  : 'If this was not you, please contact support.'

// table based layout, sab mail apps mein ek jaisa dikhta hai
function layout({ preheader, title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="padding:22px 28px;border-bottom:1px solid #e2e8f0;">
              <span style="font-size:20px;font-weight:bold;color:#1d4ed8;">${escapeHtml(BANK_NAME)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#0f172a;font-size:15px;line-height:1.6;">
              <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${escapeHtml(title)}</h2>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;">
              ${escapeHtml(BANK_NAME)} will never ask for your password, OTP or PIN by email.<br>
              This is an automated service message about your account activity.${
                SUPPORT_EMAIL
                  ? `<br>Questions? Write to <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#64748b;">${escapeHtml(SUPPORT_EMAIL)}</a>.`
                  : ''
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function detailsTable(rows) {
  const html = rows
    .filter(Boolean)
    .map(
      ([label, value], i) => `
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;${i ? 'border-top:1px solid #e2e8f0;' : ''}">${escapeHtml(label)}</td>
        <td align="right" style="padding:10px 0;color:#0f172a;font-size:14px;${i ? 'border-top:1px solid #e2e8f0;' : ''}${i === 0 ? 'font-weight:bold;' : ''}">${escapeHtml(value)}</td>
      </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${html}</table>`
}

// ---------- core sender ----------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// errors that are worth retrying (network or temporary server problems)
function isTransient(error) {
  const code = error && error.code
  const status = error && error.responseCode
  return (
    ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EDNS'].includes(code) ||
    (typeof status === 'number' && status >= 400 && status < 500)
  )
}

// true = mail gayi, false = fail hui (app crash nahi hota)
const sendEmail = async (to, subject, text, html) => {
  if (!isValidEmail(to)) {
    console.error('Error sending email: invalid recipient address:', to)
    return false
  }
  if (!FROM_ADDRESS) {
    console.error('Error sending email: EMAIL_USER / EMAIL_FROM is not set in .env')
    return false
  }

  const mail = {
    from: { name: BANK_NAME, address: FROM_ADDRESS },
    replyTo: SUPPORT_EMAIL || FROM_ADDRESS,
    to: to.trim(),
    subject: cleanHeaderText(subject),
    text,
    html,
    // a stable Message-ID on your own domain looks more legitimate
    messageId: `<${crypto.randomUUID()}@${FROM_DOMAIN}>`,
    headers: {
      // marks this as a system generated message, not bulk marketing mail
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'X-Entity-Ref-ID': crypto.randomUUID(),
    },
  }

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transporter.sendMail(mail)
      console.log('Message sent:', info.messageId)
      return true
    } catch (error) {
      const canRetry = attempt < maxAttempts && isTransient(error)
      console.error(
        `Error sending email (attempt ${attempt}/${maxAttempts}):`,
        error.message,
        canRetry ? '- retrying' : ''
      )
      if (!canRetry) return false
      await sleep(1000 * attempt)
    }
  }
  return false
}

// ---------- emails ----------

async function sendRegisterEmail(email, name) {
  const safeName = cleanHeaderText(name)
  const subject = `Welcome to ${BANK_NAME}`

  const text =
    `Hello ${safeName},\n\n` +
    `Your ${BANK_NAME} profile has been created.\n\n` +
    `Next steps:\n` +
    `1. Log in to your dashboard\n` +
    `2. Create your first bank account\n` +
    `3. Transfer money using an 8 digit account number\n\n` +
    `If you did not create this profile, you can ignore this message.\n\n` +
    `Regards,\n${BANK_NAME}`

  const html = layout({
    preheader: 'Your profile has been created. Here is how to get started.',
    title: `Welcome, ${safeName}`,
    bodyHtml: `
      <p style="margin:0 0 14px;">Your ${escapeHtml(BANK_NAME)} profile has been created.</p>
      <p style="margin:0 0 8px;font-weight:bold;">Next steps</p>
      <ol style="margin:0 0 18px;padding-left:20px;">
        <li>Log in to your dashboard</li>
        <li>Create your first bank account</li>
        <li>Transfer money using an 8 digit account number</li>
      </ol>
      <p style="margin:0;color:#64748b;font-size:13px;">If you did not create this profile, you can ignore this message.</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendTransactionEmail(email, name, amount, toAccount, transactionId) {
  const safeName = cleanHeaderText(name)
  const ref = shortRef(transactionId)
  const subject = `Payment of ${formatAmount(amount)} sent`

  const text =
    `Hello ${safeName},\n\n` +
    `A payment from your account was completed.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `To account: ${maskAccount(toAccount)}\n` +
    `Date: ${formatDate()}\n` +
    (ref ? `Reference: ${ref}\n` : '') +
    `\n${supportLineText}\n\n${BANK_NAME}`

  const html = layout({
    preheader: `${formatAmount(amount)} was sent to account ${maskAccount(toAccount)}.`,
    title: 'Payment sent',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(safeName)}, a payment from your account was completed.</p>
      ${detailsTable([
        ['Amount', formatAmount(amount)],
        ['To account', maskAccount(toAccount)],
        ['Date', formatDate()],
        ref ? ['Reference', ref] : null,
      ])}
      <p style="margin:18px 0 0;color:#b91c1c;font-size:13px;">${supportLineHtml}</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendTransactionFailureEmail(email, name, amount, toAccount) {
  const safeName = cleanHeaderText(name)
  const subject = `Payment of ${formatAmount(amount)} could not be completed`

  const text =
    `Hello ${safeName},\n\n` +
    `Your payment could not be completed.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `To account: ${maskAccount(toAccount)}\n` +
    `Date: ${formatDate()}\n\n` +
    `No money was taken from your account. You can try again.\n\n${BANK_NAME}`

  const html = layout({
    preheader: 'No money was taken from your account.',
    title: 'Payment not completed',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(safeName)}, your payment could not be completed.</p>
      ${detailsTable([
        ['Amount', formatAmount(amount)],
        ['To account', maskAccount(toAccount)],
        ['Date', formatDate()],
      ])}
      <p style="margin:18px 0 0;color:#64748b;font-size:13px;">No money was taken from your account. You can try again.</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendMoneyReceivedEmail(email, name, amount, fromAccount, transactionId) {
  const safeName = cleanHeaderText(name)
  const ref = shortRef(transactionId)
  const subject = `${formatAmount(amount)} received in your account`

  const text =
    `Hello ${safeName},\n\n` +
    `Money has been added to your account.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `From account: ${maskAccount(fromAccount)}\n` +
    `Date: ${formatDate()}\n` +
    (ref ? `Reference: ${ref}\n` : '') +
    `\n${BANK_NAME}`

  const html = layout({
    preheader: `${formatAmount(amount)} was added to your account.`,
    title: 'Money received',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(safeName)}, money has been added to your account.</p>
      ${detailsTable([
        ['Amount', formatAmount(amount)],
        ['From account', maskAccount(fromAccount)],
        ['Date', formatDate()],
        ref ? ['Reference', ref] : null,
      ])}
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendAccountCreatedEmail(email, name, accountNumber, isPrimary) {
  const safeName = cleanHeaderText(name)
  const subject = `Your new ${BANK_NAME} account is ready`

  const text =
    `Hello ${safeName},\n\n` +
    `A new bank account has been created.\n\n` +
    `Account number: ${maskAccount(accountNumber)}\n` +
    `Primary account: ${isPrimary ? 'Yes' : 'No'}\n` +
    `Date: ${formatDate()}\n\n` +
    `You can see the full account number in your dashboard under Account.\n` +
    `${supportLineText}\n\n${BANK_NAME}`

  const html = layout({
    preheader: `New account ${maskAccount(accountNumber)} has been created.`,
    title: 'New account created',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(safeName)}, a new bank account has been created.</p>
      ${detailsTable([
        ['Account number', maskAccount(accountNumber)],
        ['Primary account', isPrimary ? 'Yes' : 'No'],
        ['Date', formatDate()],
      ])}
      <p style="margin:18px 0 0;color:#64748b;font-size:13px;">You can see the full account number in your dashboard under Account.</p>
      <p style="margin:10px 0 0;color:#b91c1c;font-size:13px;">${supportLineHtml}</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendFundsAddedEmail(email, name, amount, toAccount, transactionId) {
  const safeName = cleanHeaderText(name)
  const ref = shortRef(transactionId)
  const subject = `${formatAmount(amount)} added to your account`

  const text =
    `Hello ${safeName},\n\n` +
    `Funds have been added to your account.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `Account: ${maskAccount(toAccount)}\n` +
    `Date: ${formatDate()}\n` +
    (ref ? `Reference: ${ref}\n` : '') +
    `\nYou can check your updated balance in your dashboard.\n\n${BANK_NAME}`

  const html = layout({
    preheader: `${formatAmount(amount)} was added to account ${maskAccount(toAccount)}.`,
    title: 'Funds added',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(safeName)}, funds have been added to your account.</p>
      ${detailsTable([
        ['Amount', formatAmount(amount)],
        ['Account', maskAccount(toAccount)],
        ['Date', formatDate()],
        ref ? ['Reference', ref] : null,
      ])}
      <p style="margin:18px 0 0;color:#64748b;font-size:13px;">You can check your updated balance in your dashboard.</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

module.exports = {
  sendEmail,
  sendRegisterEmail,
  sendTransactionEmail,
  sendTransactionFailureEmail,
  sendMoneyReceivedEmail,
  sendAccountCreatedEmail,
  sendFundsAddedEmail,
}
