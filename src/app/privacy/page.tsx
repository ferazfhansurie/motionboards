export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <a href="/signup" className="text-sm text-[#f26522] hover:underline mb-6 inline-block">&larr; Back to Sign Up</a>
        <h1 className="text-2xl font-bold text-[#0d1117] mb-2">Privacy Policy</h1>
        <p className="text-xs text-gray-400 mb-8">Last updated: March 27, 2026</p>

        <div className="prose prose-sm text-gray-600 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">1. Information We Collect</h2>
            <p>We collect information you provide when creating an account: your name, email address, and payment information (processed securely by Stripe). We also collect usage data such as generation history and canvas activity.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve the Service, process payments, communicate with you about your account, and ensure compliance with our Terms of Service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">3. Data Storage</h2>
            <p>Your account data is stored on secure servers. Generated content and canvas boards are stored to provide persistence across sessions. Media files may be temporarily stored on third-party cloud storage (FAL.ai) for processing.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Stripe</strong> for payment processing</li>
              <li><strong>FAL.ai & Replicate</strong> for AI model inference</li>
              <li><strong>Neon</strong> for database hosting</li>
              <li><strong>Vercel</strong> for application hosting</li>
            </ul>
            <p className="mt-2">These services have their own privacy policies. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">5. Cookies & Local Storage</h2>
            <p>We use session cookies for authentication and local storage to save your canvas state. No third-party tracking cookies are used.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">6. Data Retention</h2>
            <p>We retain your account data and generation history for as long as your account is active. You may request deletion of your account and associated data by contacting us.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">7. Security</h2>
            <p>We implement industry-standard security measures to protect your data. Passwords are hashed. Payment information is handled exclusively by Stripe and never stored on our servers.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">8. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. You may also request a copy of your data. Contact us to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">9. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. We will notify you of significant changes via email or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#0d1117] mb-2">10. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:hello@adleticagency.com" className="text-[#f26522] hover:underline">hello@adleticagency.com</a>.</p>
          </section>
        </div>

        <p className="text-[10px] text-gray-300 text-center mt-12">
          Adletic Digital Marketing Agency &copy; 2026
        </p>
      </div>
    </div>
  );
}
