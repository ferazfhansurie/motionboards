import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — Start Creating AI Videos & Images",
  description:
    "Join MotionBoards and start generating AI videos, images, and animations with 30+ AI models. Pay-per-use pricing from RM10. No subscription required.",
  keywords: [
    "sign up AI video generator",
    "create account AI video maker",
    "AI video generator pricing",
    "cheap AI video generator",
    "affordable AI video tool",
    "pay per use AI video",
  ],
  openGraph: {
    title: "Sign Up for MotionBoards — AI Video Generator",
    description:
      "Start creating AI videos and images with 30+ models. Pay-per-use from RM10.",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
