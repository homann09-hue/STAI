import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen | StockPilot AI",
  description: "Link zum Zurücksetzen des Passworts anfordern.",
  // Anmeldeseiten gehoeren nicht in den Index.
  robots: { index: false, follow: false }
};

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Wird geladen …</p>}>
      <AuthForm mode="forgot" />
    </Suspense>
  );
}
