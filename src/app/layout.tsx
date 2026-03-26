import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

const SITE_URL = "https://motionboards.com";
const SITE_NAME = "MotionBoards";
const SITE_DESCRIPTION =
  "AI video generator and image creator with 30+ models on one infinite canvas. Create AI videos, AI images, motion graphics, and animations — no editing skills needed.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MotionBoards — AI Video Generator & Creative Canvas",
    template: "%s | MotionBoards",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "AI video generator",
    "AI video maker",
    "AI image generator",
    "AI video software",
    "AI video creation",
    "AI video editing",
    "AI animation maker",
    "AI motion graphics",
    "text to video AI",
    "image to video AI",
    "AI creative tool",
    "AI art generator",
    "video generation AI",
    "AI content creation",
    "AI video production",
    "AI visual effects",
    "AI storyboard",
    "AI moodboard",
    "infinite canvas AI",
    "AI video app",
    "generate video with AI",
    "create AI video online",
    "best AI video generator",
    "free AI video maker",
    "AI video generator online",
    "AI powered video editor",
    "AI video creator",
    "Runway alternative",
    "Pika alternative",
    "Kling AI alternative",
    "Sora alternative",
    "Luma Dream Machine alternative",
    "MotionBoards",
    "motionboards AI",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "MotionBoards — AI Video Generator & Creative Canvas",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MotionBoards — AI Video Generator & Creative Canvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MotionBoards — AI Video Generator & Creative Canvas",
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "MotionBoards",
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Web",
              description: SITE_DESCRIPTION,
              url: SITE_URL,
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "MYR",
                lowPrice: "10",
                highPrice: "250",
                offerCount: 4,
              },
              featureList: [
                "AI Video Generation",
                "AI Image Generation",
                "Text to Video",
                "Image to Video",
                "30+ AI Models",
                "Infinite Canvas Editor",
                "Motion Graphics",
                "AI Animation",
              ],
            }),
          }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
