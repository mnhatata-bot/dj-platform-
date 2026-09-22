import "./globals.css";
import { LocaleProvider } from "@/modules/localization/ui/provider";
export const metadata = {
  title: "Cuelance",
  description:
    "EPK, marketplace, events, communities and controlled entry for DJs and promoters",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
