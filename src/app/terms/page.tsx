export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <a href="/signup" className="text-sm text-[#f26522] hover:underline mb-6 inline-block">&larr; Back to Sign Up</a>
        <h1 className="text-2xl font-bold text-[#0d1117] mb-2">Terms of Service</h1>
        <p className="text-xs text-gray-400 mb-8">Last updated: March 27, 2026</p>

        <div className="prose prose-sm text-gray-600 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using MotionBoards (&ldquo;the Service&rdquo;), operated by Adletic Digital Marketing Agency (&ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">2. Description of Service</h2>
            <p>MotionBoards is an AI-powered video and image generation platform. The Service allows users to generate, edit, organize, and export media content using various AI models and creative tools.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">3. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials and for all activities under your account.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">4. Credits & Payments</h2>
            <p>The Service operates on a pay-per-use credit system. Credits are purchased via Stripe and are non-refundable once used for generation. Minimum top-up is RM10. Credits do not expire. All prices are in Malaysian Ringgit (MYR).</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">5. Acceptable Use</h2>
            <p>You agree not to use the Service to generate content that is illegal, harmful, harassing, defamatory, obscene, or violates the rights of others. We reserve the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">6. Intellectual Property</h2>
            <p>Content you generate using the Service belongs to you, subject to the terms of the underlying AI model providers. You grant us a limited license to store and process your content solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">7. Disclaimers</h2>
            <p>The Service is provided &ldquo;as is&rdquo; without warranties of any kind. AI-generated content may not always meet your expectations. We do not guarantee uptime, accuracy, or availability of any specific AI model.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Adletic Digital Marketing Agency shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">9. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">10. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:hello@adleticagency.com" className="text-[#f26522] hover:underline">hello@adleticagency.com</a>.</p>
          </section>
        </div>

        <p className="text-[10px] text-gray-300 text-center mt-12">
          Adletic Digital Marketing Agency &copy; 2026
        </p>
      </div>
    </div>
  );
}
