import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In — Access Your AI Creative Canvas",
  description:
    "Log in to MotionBoards to generate AI videos, images, and animations on your infinite creative canvas.",
  openGraph: {
    title: "Log In to MotionBoards",
    description: "Access your AI creative canvas and start generating.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
