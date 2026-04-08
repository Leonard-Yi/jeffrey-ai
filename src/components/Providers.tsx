"use client";

import { SessionProvider } from "next-auth/react";
import { MemberCountProvider } from "./MemberCountContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MemberCountProvider>{children}</MemberCountProvider>
    </SessionProvider>
  );
}
  );
}