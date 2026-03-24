import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import ServerStatusBanner from "./components/ServerStatusBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "シフらく",
  description: "当直表作成を、もっと早く、もっと公平に。AIでたたき台を作り、現場で仕上げる。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ServerStatusBanner />
        <Toaster
          position="bottom-center"
          containerStyle={{ bottom: 100 }}
          toastOptions={{
            duration: 1500,
            success: { duration: 1500 },
            error: { duration: 3000 },
            style: { fontSize: "14px", borderRadius: "10px", padding: "10px 16px" },
          }}
        />
        {children}
      </body>
    </html>
  );
}
