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

/** Always send with a friendly display name (avoids Outlook "[Unknown]"). */
function smtpFromAddress() {
  const configured = process.env.SMTP_FROM?.trim() || "";
  const angle = configured.match(/<([^>]+)>/);
  const email =
    angle?.[1]?.trim() ||
    (configured.includes("@") ? configured : "") ||
    process.env.SMTP_USER?.trim() ||
    "";
  return `"Honda Recall Website" <${email}>`;
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
      from: smtpFromAddress(),
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

function appointmentInbox() {
  const dedicated = process.env.APPOINTMENT_TO?.trim();
  if (dedicated) return dedicated;

  const from = process.env.SMTP_FROM?.trim() || "";
  const match = from.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  if (from.includes("@")) return from;

  return process.env.SMTP_USER?.trim() || "";
}

export async function sendAppointmentRequestEmail(input: {
  customerEmail: string;
  customerName: string;
  telephone: string;
  city: string;
  regNo: string;
  recallNo: string;
  description: string;
  odometerKm: string;
}) {
  const to = appointmentInbox();
  if (!to) {
    throw new Error(
      "Appointment inbox is not configured. Set APPOINTMENT_TO or SMTP_FROM / SMTP_USER.",
    );
  }

  const subject = `Appointment request — ${input.regNo} / ${input.recallNo || "Recall"}`;
  const text =
    `Appointment Request\n\n` +
    `Email: ${input.customerEmail}\n` +
    `Name: ${input.customerName}\n` +
    `Telephone: ${input.telephone}\n` +
    `City: ${input.city}\n` +
    `Car Number: ${input.regNo}\n` +
    `Recall Number: ${input.recallNo || "—"}\n` +
    `Description: ${input.description || "—"}\n` +
    `Odometer (KM): ${input.odometerKm}\n`;

  const html = `
    <h2>Appointment Request</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Email</strong></td><td>${input.customerEmail}</td></tr>
      <tr><td><strong>Name</strong></td><td>${input.customerName}</td></tr>
      <tr><td><strong>Telephone</strong></td><td>${input.telephone}</td></tr>
      <tr><td><strong>City</strong></td><td>${input.city}</td></tr>
      <tr><td><strong>Car Number</strong></td><td>${input.regNo}</td></tr>
      <tr><td><strong>Recall Number</strong></td><td>${input.recallNo || "—"}</td></tr>
      <tr><td><strong>Description</strong></td><td>${input.description || "—"}</td></tr>
      <tr><td><strong>Odometer (KM)</strong></td><td>${input.odometerKm}</td></tr>
    </table>
  `;

  if (!isSmtpConfigured()) {
    console.info("[email:dev] Appointment request to", to, text);
    return {
      sent: false,
      message:
        "SMTP is not configured. Appointment details were logged on the server for development.",
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

  await transporter.sendMail({
    from: smtpFromAddress(),
    to,
    replyTo: input.customerEmail,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    message: "Appointment request sent. We will contact you soon.",
  };
}
