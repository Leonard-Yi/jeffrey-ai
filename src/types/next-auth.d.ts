import "next-auth";

declare module "next-auth" {
  interface User {
    password?: string;
    keySalt?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      encKey?: string;
      pseudoKey?: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    encKey?: string;
    pseudoKey?: string;
  }
}
