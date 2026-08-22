// Browser-only helper — import this only from client components.
// Wraps Meta's Embedded Signup JS SDK configured for WhatsApp Business app
// coexistence: the business keeps using the WhatsApp app on their phone
// while this connects the same number to Cloud API (as opposed to the
// plain flow, which provisions/migrates a number away from the app).

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (callback: (response: { authResponse?: { code?: string } }) => void, params: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export interface EmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
}

let sdkLoadPromise: Promise<void> | null = null;

function loadFacebookSdk(appId: string, graphVersion: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Embedded Signup requires a browser."));
  if (window.FB) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: true, version: graphVersion });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("Failed to load the Facebook SDK."));
    document.body.appendChild(script);
  });
  return sdkLoadPromise;
}

/**
 * Resolves once both the FB.login code and the postMessage session info have
 * arrived (they land independently and in no guaranteed order); rejects if
 * the business cancels or the popup closes without finishing.
 */
export function launchWhatsAppEmbeddedSignup(options: { appId: string; configId: string; graphVersion?: string }): Promise<EmbeddedSignupResult> {
  const graphVersion = options.graphVersion || "v26.0";
  return loadFacebookSdk(options.appId, graphVersion).then(
    () =>
      new Promise<EmbeddedSignupResult>((resolve, reject) => {
        let code: string | null = null;
        let session: { wabaId?: string; phoneNumberId?: string; businessId?: string } | null = null;
        let settled = false;

        const cleanup = () => window.removeEventListener("message", onMessage);
        const finish = () => {
          if (settled || !code || !session?.wabaId || !session?.phoneNumberId) return;
          settled = true; cleanup();
          resolve({ code, wabaId: session.wabaId, phoneNumberId: session.phoneNumberId, businessId: session.businessId });
        };
        const fail = (message: string) => { if (settled) return; settled = true; cleanup(); reject(new Error(message)); };

        function onMessage(event: MessageEvent) {
          if (!event.origin.endsWith("facebook.com")) return;
          let data: { type?: string; event?: string; data?: Record<string, string> } | undefined;
          try { data = JSON.parse(event.data); } catch { return; }
          if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
          if (data.event === "CANCEL") { fail("Signup was cancelled before finishing."); return; }
          if (data.event?.startsWith("FINISH")) {
            session = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id, businessId: data.data?.business_id };
            finish();
          }
        }
        window.addEventListener("message", onMessage);

        window.FB!.login(
          (response) => {
            if (!response.authResponse?.code) { fail("Meta did not return a signup code."); return; }
            code = response.authResponse.code;
            finish();
          },
          {
            config_id: options.configId,
            response_type: "code",
            override_default_response_type: true,
            extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
          },
        );
      }),
  );
}
