export type EmailMessage = { to: string; subject: string; text: string };

class ResendEmailProvider {
  configured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL);
  }

  async send(message: EmailMessage) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (!key || !from) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`EMAIL_DELIVERY_FAILED_${response.status}`);
  }
}

export const notificationEmail = new ResendEmailProvider();
