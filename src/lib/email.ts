import nodemailer from "nodemailer";

type ReminderEmailInput = {
  qqNumber: string;
  ownerNames: string[];
  certificateCount: number;
};

const CERTIFICATE_SYSTEM_URL = "https://certification.pvzcs.com";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 0);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP 配置不完整，请检查 SMTP_HOST、SMTP_PORT、SMTP_USER、SMTP_PASS。");
  }

  return {
    host,
    port,
    user,
    pass,
  };
};

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
};

const getSenderAddress = () => {
  const { user } = getSmtpConfig();

  return `证书发放系统 <${user}>`;
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: getSenderAddress(),
    to,
    subject,
    text,
    html,
  });
};

const formatOwnerNames = (ownerNames: string[]) => {
  if (ownerNames.length === 0) {
    return "证书归属信息以系统内记录为准。";
  }

  const preview = ownerNames.slice(0, 3).join("、");

  if (ownerNames.length > 3) {
    return `证书归属昵称包括：${preview} 等 ${ownerNames.length} 位。`;
  }

  return `证书归属昵称：${preview}。`;
};

export const sendVerificationCodeEmail = async (
  qqNumber: string,
  code: string
) => {
  const to = `${qqNumber}@qq.com`;

  await sendEmail({
    to,
    subject: "您的证书查询验证码",
    text: `您好，您的验证码是 ${code}，10 分钟内有效。如非本人操作，请忽略此邮件。`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #111827; line-height: 1.7;">
        <p>您好：</p>
        <p>您的证书查询验证码为：</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${code}</p>
        <p>证书发放系统入口：<a href="${escapeHtml(
          CERTIFICATE_SYSTEM_URL
        )}" target="_blank" rel="noreferrer">${escapeHtml(
          CERTIFICATE_SYSTEM_URL
        )}</a></p>
        <p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  });
};

export const sendCertificateReminderEmail = async ({
  qqNumber,
  ownerNames,
  certificateCount,
}: ReminderEmailInput) => {
  const to = `${qqNumber}@qq.com`;
  const ownerSummary = formatOwnerNames(ownerNames);
  const certificateSummary = `当前共有 ${certificateCount} 份证书待领取。`;

  await sendEmail({
    to,
    subject: "您有新的证书待领取",
    text: `您好，${certificateSummary}${ownerSummary}请访问证书发放系统 ${CERTIFICATE_SYSTEM_URL}，使用 QQ 号 ${qqNumber} 获取验证码后登录领取。如已领取，请忽略此邮件。`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #111827; line-height: 1.7;">
        <p>您好：</p>
        <p>系统检测到您的账号下已有证书可领取。</p>
        <p style="font-size: 22px; font-weight: 700; margin: 16px 0;">${escapeHtml(
          certificateSummary
        )}</p>
        <p>${escapeHtml(ownerSummary)}</p>
        <p>请访问证书发放系统，使用 QQ 号 <strong>${escapeHtml(
          qqNumber
        )}</strong> 获取验证码后登录领取。</p>
        <p><a href="${escapeHtml(
          CERTIFICATE_SYSTEM_URL
        )}" target="_blank" rel="noreferrer">${escapeHtml(
          CERTIFICATE_SYSTEM_URL
        )}</a></p>
        <p>如您已经领取完成，可忽略此邮件。</p>
      </div>
    `,
  });
};
