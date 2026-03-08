import nodemailer from "nodemailer";

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

export const sendVerificationCodeEmail = async (
  qqNumber: string,
  code: string
) => {
  const transporter = getTransporter();
  const { user } = getSmtpConfig();
  const to = `${qqNumber}@qq.com`;

  await transporter.sendMail({
    from: `证书发放系统 <${user}>`,
    to,
    subject: "您的证书查询验证码",
    text: `您好，您的验证码是 ${code}，10 分钟内有效。如非本人操作，请忽略此邮件。`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #111827; line-height: 1.7;">
        <p>您好：</p>
        <p>您的证书查询验证码为：</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${code}</p>
        <p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  });
};
