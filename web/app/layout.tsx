import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StacksProvider } from "./components/StacksProvider";
import { ToastProvider } from "../providers/ToastProvider";
import Footer from "./components/Footer";
import MarketListPreloader from "./components/MarketListPreloader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Predinex | Next-Gen Prediction Markets on Stacks",
  description: "The decentralized prediction market built for the Bitcoin economy. Predict, bet, and win on Stacks.",
  openGraph: {
    title: "Predinex | Next-Gen Prediction Markets on Stacks",
    description: "The decentralized prediction market built for the Bitcoin economy. Predict, bet, and win on Stacks.",
    url: "https://predinex.io",
    siteName: "Predinex",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Predinex - Prediction Markets on Stacks",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Predinex | Next-Gen Prediction Markets on Stacks",
    description: "Predict the future. Win on Bitcoin.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StacksProvider>
          <ToastProvider>
            <MarketListPreloader />
            {children}
            <Footer />
          </ToastProvider>
        </StacksProvider>
      </body>
    </html>
  );
}
