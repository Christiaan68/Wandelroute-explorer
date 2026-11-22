import type { Metadata } from "next";
import { ContactScreen } from "@/components/screens/ContactScreen";

export const metadata: Metadata = {
  title: "Contact | Mijnloopje.nl",
  description: "Stel een vraag of geef een opmerking over Mijnloopje.nl, de rondwandelingplanner.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactScreen />;
}
