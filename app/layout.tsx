import type { Metadata } from "next";
import "./globals.css";
import "./monochrome.css";
import "./contemporary.css";
import "./admin.css";
import "./commerce.css";
import { AnalyticsTracker } from "../components/analytics-tracker";

export const metadata: Metadata = {
  title: "INFLUVIA — Find your people. Grow your brand.",
  description:
    "Find your next local creator. A considered influencer directory with powerful filters and effortless Excel exports.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
