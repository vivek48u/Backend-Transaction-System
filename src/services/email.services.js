require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});



// Function to send email
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Backend-ledger" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

async function sendRegisterEmail(email, name) {
  const subject = 'Welcome to Our Service!';
  const text = `Hello ${name},\n\nThank you for registering with our service! We're excited to have you on board.\n\nBest regards,\nThe Team`;
  const html = `<p>Hello ${name},</p><p>Thank you for registering with our service! We're excited to have you on board.</p><p>Best regards,<br>The Team</p>`;
  await sendEmail(email, subject, text, html);
}

async function sendTransactionEmail(email, name, amount, toAccount) {
  const subject = 'Transaction Succcefully!!'
  const text = `Hello ${name}\n\n Your Transaction of $${amount} to account ${toAccount} was succesfully \n Best Regards \n From The Backend Ledger Team`
  const html = `<p>Hello ${name}</p><p>Your Transaction of $${amount} to account ${toAccount} was succesfully</p> <p>Best Regards </p> <p>From The Backend Ledger Team</p>`
  await sendEmail(email, subject, text, html)
}

async function sendTransactionFailureEmail(email, name, amount, toAccount) {
  const subject = 'Transaction Failed!'
  const text = `Hello ${name}\n\n we regeret to inform Your Transaction of $${amount} to account ${toAccount} was failed \n Best Regards \n From The Backend Ledger Team`
  const html = `<p>Hello ${name}</p><p>we regret to inform Your Transaction of $${amount} to account ${toAccount} was failed</p> <p>Best Regards </p> <p>From The Backend Ledger Team</p>`
  await sendEmail(email, subject, text, html)
}

module.exports = { sendEmail, sendRegisterEmail, sendTransactionEmail,sendTransactionFailureEmail };