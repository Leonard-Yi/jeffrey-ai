import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SignUpForm from "./SignUpForm"

export default async function SignUpPage() {
  const session = await auth()
  if (session) redirect("/input")

  return <SignUpForm />
}