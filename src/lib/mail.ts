import nodemailer from "nodemailer";

function appBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

export async function sendVerificationEmail(input: {
  to: string;
  firstName: string;
  token: string;
}) {
  const verifyUrl = `${appBaseUrl()}/verify-email?token=${encodeURIComponent(input.token)}`;
  const subject = "Confirm your Galatariotis Recall Check account";
  const text =
    `Hello ${input.firstName},\n\n` +
    `Please confirm your email to activate your account:\n\n` +
    `${verifyUrl}\n\n` +
    `This link expires in 24 hours.\n\n` +
    `Galatariotis Recall Check`;

  if (!isSmtpConfigured()) {
    console.info("[email:dev] Verification link for", input.to, verifyUrl);
    return {
      sent: false,
      previewUrl: verifyUrl,
      message:
        "Account created. SMTP is not configured, so the verification link was logged on the server. Use the link shown after registration in development.",
    };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM?.trim() ||
        `"Galatariotis Recall Check" <${process.env.SMTP_USER}>`,
      to: input.to,
      subject,
      text,
      html: `
      <p>Hello ${input.firstName},</p>
      <p>Please confirm your email to activate your account:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>Galatariotis Recall Check</p>
    `,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown SMTP error.";
    console.error("[email] Failed to send verification email:", detail);
    return {
      sent: false,
      previewUrl: verifyUrl,
      message:
        "Account created, but the verification email could not be sent. Use the link below to verify your email, or ask IT to enable SMTP AUTH for Microsoft 365.",
    };
  }

  return {
    sent: true,
    previewUrl: null as string | null,
    message:
      "Account created. Please check your email and click the validation link before logging in.",
  };
}
