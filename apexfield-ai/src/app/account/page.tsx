import type { Metadata } from "next";
import { AccountForm } from "./AccountForm";

export const metadata: Metadata = { title: "Your account — ApexField AI" };

export default function AccountPage() {
  return <AccountForm />;
}
