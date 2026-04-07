"use client";

import { MemberCountProvider } from "./MemberCountContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <MemberCountProvider>{children}</MemberCountProvider>;
}