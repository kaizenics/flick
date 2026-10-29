import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lifty",
  description:
    "Lift every Page, on autopilot. Lifty orchestrates Facebook engagement across your accounts from one quiet, visual control room.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" forcedTheme="dark">
          {children}
          <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#161616", border: "1px solid #2a2a2a", color: "#fff" } }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
