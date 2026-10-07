import { LegalPage } from "@/components/LegalPage";

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Cookie Policy"
      description="How cookies help Klick-Pro provide a reliable website experience."
      sections={[
        {
          title: "Essential cookies",
          body: "We use essential cookies to keep you signed in, protect your account, and remember basic preferences.",
        },
        {
          title: "Managing cookies",
          body: "You can control browser cookies in your browser settings. Disabling essential cookies may affect some platform features.",
        },
      ]}
    />
  );
}
