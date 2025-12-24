import nodemailer from "nodemailer";
import 'dotenv/config';

async function testEmail() {
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465, // Port 465 requires SSL, others use STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  console.log("📧 Testing SMTP Configuration...");
  console.log("Host:", smtpConfig.host);
  console.log("Port:", smtpConfig.port);
  console.log("Secure:", smtpConfig.secure);
  console.log("User:", smtpConfig.auth.user);
  console.log("From:", process.env.SMTP_FROM);
  console.log("From Name:", process.env.SMTP_FROM_NAME);

  if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.error("❌ SMTP_USER and SMTP_PASS must be configured!");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport(smtpConfig);

  try {
    console.log("\n🔄 Verifying SMTP connection...");
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully!");

    const testRecipient = process.argv[2] || smtpConfig.auth.user;
    console.log(`\n📤 Sending test email to: ${testRecipient}`);

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Creative Code Nexus'}" <${process.env.SMTP_FROM || smtpConfig.auth.user}>`,
      to: testRecipient,
      subject: "Test Email from Creative Code Nexus",
      text: "This is a test email to verify your SMTP configuration is working correctly.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Creative Code Nexus - Email Test</h2>
          <p>This is a test email to verify your SMTP configuration is working correctly.</p>
          <p style="color: #10b981; font-weight: bold;">✅ Your email system is configured and working!</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    process.exit(1);
  }
}

testEmail();
