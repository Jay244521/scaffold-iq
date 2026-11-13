import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create your company account — ApexField AI" };

export default function SignupPage() {
  return <SignupForm />;
}
