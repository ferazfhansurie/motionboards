import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata: Metadata = {
  title: "MotionBoards — AI Creative Canvas | Works with Adobe PSD",
  description: "Generate AI videos and images with 30+ models. Import and export PSD files. Edit, crop, and adjust — all on one infinite canvas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[#08131f] font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
