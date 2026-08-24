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

  try {
    await createTransporter().sendMail({
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function appointmentConfirmationCopy(input: {
  customerName: string;
  regNo: string;
  recallNo: string;
  description: string;
}) {
  const greetingName = input.customerName.trim() || "customer";
  const recallLabel = input.recallNo || "—";
  const description = input.description || "—";
  const subject = `Appointment request received — ${input.regNo || "Honda recall"}`;
  const text =
    `Hello ${greetingName},\n\n` +
    `Thank you. Your appointment request was submitted successfully.\n\n` +
    `The service department will call you soon to arrange your appointment.\n\n` +
    `Car Number: ${input.regNo || "—"}\n` +
    `Recall Number: ${recallLabel}\n` +
    `Description: ${description}\n\n` +
    `Galatariotis Recall Check`;
  const html = `
    <p>Hello ${escapeHtml(greetingName)},</p>
    <p>Thank you. Your appointment request was submitted successfully.</p>
    <p>The service department will call you soon to arrange your appointment.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Car Number</strong></td><td>${escapeHtml(input.regNo || "—")}</td></tr>
      <tr><td><strong>Recall Number</strong></td><td>${escapeHtml(recallLabel)}</td></tr>
      <tr><td><strong>Description</strong></td><td>${escapeHtml(description)}</td></tr>
    </table>
    <p>Galatariotis Recall Check</p>
  `;
  return { subject, text, html };
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
      <tr><td><strong>Email</strong></td><td>${escapeHtml(input.customerEmail)}</td></tr>
      <tr><td><strong>Name</strong></td><td>${escapeHtml(input.customerName)}</td></tr>
      <tr><td><strong>Telephone</strong></td><td>${escapeHtml(input.telephone)}</td></tr>
      <tr><td><strong>City</strong></td><td>${escapeHtml(input.city)}</td></tr>
      <tr><td><strong>Car Number</strong></td><td>${escapeHtml(input.regNo)}</td></tr>
      <tr><td><strong>Recall Number</strong></td><td>${escapeHtml(input.recallNo || "—")}</td></tr>
      <tr><td><strong>Description</strong></td><td>${escapeHtml(input.description || "—")}</td></tr>
      <tr><td><strong>Odometer (KM)</strong></td><td>${escapeHtml(input.odometerKm)}</td></tr>
    </table>
  `;
  const confirmation = appointmentConfirmationCopy(input);

  if (!isSmtpConfigured()) {
    console.info("[email:dev] Appointment request to", to, text);
    console.info(
      "[email:dev] Appointment confirmation to",
      input.customerEmail,
      confirmation.text,
    );
    return {
      sent: false,
      message:
        "SMTP is not configured. Appointment details were logged on the server for development.",
    };
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: smtpFromAddress(),
    to,
    replyTo: input.customerEmail,
    subject,
    text,
    html,
  });

  let confirmationSent = false;
  try {
    await transporter.sendMail({
      from: smtpFromAddress(),
      to: input.customerEmail,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
    });
    confirmationSent = true;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown SMTP error.";
    console.error("[email] Failed to send appointment confirmation:", detail);
  }

  return {
    sent: true,
    message: confirmationSent
      ? "Appointment request sent. A confirmation email was sent to you. The service department will call you soon to arrange your appointment."
      : "Appointment request sent. The service department will call you soon to arrange your appointment.",
  };
}
