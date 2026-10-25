require('dotenv').config()
const nodemailer = require('nodemailer')

const BANK_NAME = 'Dhanadhya Finance'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
})

transporter.verify((error) => {
  if (error) {
    console.error('Error connecting to email server:', error.message)
  } else {
    console.log('Email server is ready to send messages')
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
              <span style="font-size:20px;font-weight:bold;color:#1d4ed8;">${BANK_NAME}</span>
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
              ${BANK_NAME} will never ask for your password, OTP or PIN by email.<br>
              This is an automated service message about your account.
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

// true = mail gayi, false = fail hui (app crash nahi hota)
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"${BANK_NAME}" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    })
    console.log('Message sent:', info.messageId)
    return true
  } catch (error) {
    console.error('Error sending email:', error.message)
    return false
  }
}

// ---------- emails ----------

async function sendRegisterEmail(email, name) {
  const subject = `Welcome to ${BANK_NAME}, ${name}`

  const text =
    `Hello ${name},\n\n` +
    `Your ${BANK_NAME} profile has been created.\n\n` +
    `Next steps:\n` +
    `1. Log in to your dashboard\n` +
    `2. Create your first bank account\n` +
    `3. Transfer money using an 8 digit account number\n\n` +
    `If you did not create this profile, you can ignore this message.\n\n` +
    `Regards,\n${BANK_NAME}`

  const html = layout({
    preheader: 'Your profile has been created. Here is how to get started.',
    title: `Welcome, ${name}`,
    bodyHtml: `
      <p style="margin:0 0 14px;">Your ${BANK_NAME} profile has been created.</p>
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
  const ref = shortRef(transactionId)
  const subject = `Payment of ${formatAmount(amount)} sent`

  const text =
    `Hello ${name},\n\n` +
    `A payment from your account was completed.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `To account: ${maskAccount(toAccount)}\n` +
    `Date: ${formatDate()}\n` +
    (ref ? `Reference: ${ref}\n` : '') +
    `\nIf you did not make this payment, contact support immediately.\n\n${BANK_NAME}`

  const html = layout({
    preheader: `${formatAmount(amount)} was sent to account ${maskAccount(toAccount)}.`,
    title: 'Payment sent',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(name)}, a payment from your account was completed.</p>
      ${detailsTable([
        ['Amount', formatAmount(amount)],
        ['To account', maskAccount(toAccount)],
        ['Date', formatDate()],
        ref ? ['Reference', ref] : null,
      ])}
      <p style="margin:18px 0 0;color:#b91c1c;font-size:13px;">If you did not make this payment, contact support immediately.</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendTransactionFailureEmail(email, name, amount, toAccount) {
  const subject = `Payment of ${formatAmount(amount)} could not be completed`

  const text =
    `Hello ${name},\n\n` +
    `Your payment could not be completed.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `To account: ${maskAccount(toAccount)}\n` +
    `Date: ${formatDate()}\n\n` +
    `No money was taken from your account. You can try again.\n\n${BANK_NAME}`

  const html = layout({
    preheader: 'No money was taken from your account.',
    title: 'Payment not completed',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(name)}, your payment could not be completed.</p>
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
  const ref = shortRef(transactionId)
  const subject = `${formatAmount(amount)} received in your account`

  const text =
    `Hello ${name},\n\n` +
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
      <p style="margin:0 0 16px;">Hello ${escapeHtml(name)}, money has been added to your account.</p>
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
  const subject = `Your new ${BANK_NAME} account is ready`

  const text =
    `Hello ${name},\n\n` +
    `A new bank account has been created.\n\n` +
    `Account number: ${maskAccount(accountNumber)}\n` +
    `Primary account: ${isPrimary ? 'Yes' : 'No'}\n` +
    `Date: ${formatDate()}\n\n` +
    `You can see the full account number in your dashboard under Account.\n` +
    `If you did not create this account, contact support immediately.\n\n${BANK_NAME}`

  const html = layout({
    preheader: `New account ${maskAccount(accountNumber)} has been created.`,
    title: 'New account created',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${escapeHtml(name)}, a new bank account has been created.</p>
      ${detailsTable([
        ['Account number', maskAccount(accountNumber)],
        ['Primary account', isPrimary ? 'Yes' : 'No'],
        ['Date', formatDate()],
      ])}
      <p style="margin:18px 0 0;color:#64748b;font-size:13px;">You can see the full account number in your dashboard under Account.</p>
      <p style="margin:10px 0 0;color:#b91c1c;font-size:13px;">If you did not create this account, contact support immediately.</p>
    `,
  })

  return sendEmail(email, subject, text, html)
}

async function sendFundsAddedEmail(email, name, amount, toAccount, transactionId) {
  const ref = shortRef(transactionId)
  const subject = `${formatAmount(amount)} added to your account`

  const text =
    `Hello ${name},\n\n` +
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
      <p style="margin:0 0 16px;">Hello ${escapeHtml(name)}, funds have been added to your account.</p>
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
  sendFundsAddedEmail
}