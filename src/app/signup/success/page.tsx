"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SignupSuccessPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setError("No session ID found");
      return;
    }

    // Verify payment via our API
    fetch(`/api/stripe/verify?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setError(data.error || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Verification failed");
      });
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <img src="/logo.jpg" alt="MotionBoards" className="h-14 rounded-lg" />
        </div>

        {status === "verifying" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#f26522] mx-auto mb-4" />
            <h1 className="text-xl font-bold text-[#0d1117] mb-2">Verifying payment...</h1>
            <p className="text-sm text-gray-400">Please wait while we confirm your payment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-[#0d1117] mb-2">Welcome to MotionBoards!</h1>
            <p className="text-sm text-gray-400 mb-6">
              Your account has been created and credits added. You can now sign in.
            </p>
            <a
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 bg-[#f26522] text-white text-sm font-semibold rounded-xl hover:bg-[#d9541a] transition-colors"
            >
              Sign In
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl font-bold">!</span>
            </div>
            <h1 className="text-xl font-bold text-[#0d1117] mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-400 mb-2">{error}</p>
            <p className="text-xs text-gray-400 mb-6">
              If you were charged, your account will be created shortly. Contact support if the issue persists.
            </p>
            <a
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 bg-[#f26522] text-white text-sm font-semibold rounded-xl hover:bg-[#d9541a] transition-colors"
            >
              Try Sign In
            </a>
          </>
        )}

        <p className="text-[10px] text-gray-300 text-center mt-8">
          Powered by Adletic Digital Marketing Agency &copy; 2026
        </p>
      </div>
    </div>
  );
}
