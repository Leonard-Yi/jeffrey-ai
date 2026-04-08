import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })
}

export function generateVerifyEmailHtml(name: string | null, url: string): string {
  return `
    <p>您好 ${name || "用户"}，</p>
    <p>请点击以下链接验证您的邮箱地址：</p>
    <p><a href="${url}">${url}</a></p>
    <p>如果这不是您的操作，请忽略此邮件。</p>
    <p>— Jeffrey.AI</p>
  `
}

export function generateResetPasswordHtml(name: string | null, url: string): string {
  return `
    <p>您好 ${name || "用户"}，</p>
    <p>请点击以下链接重置您的密码：</p>
    <p><a href="${url}">${url}</a></p>
    <p>此链接 1 小时后失效。</p>
    <p>如果这不是您的操作，请忽略此邮件。</p>
    <p>— Jeffrey.AI</p>
  `
}