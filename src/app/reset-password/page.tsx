import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Neues Passwort setzen | StockPilot AI",
  description: "Ein neues Passwort für das StockPilot-Konto setzen.",
  // Anmeldeseiten gehoeren nicht in den Index.
  robots: { index: false, follow: false }
};

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Wird geladen …</p>}>
      <AuthForm mode="reset" />
    </Suspense>
  );
}
