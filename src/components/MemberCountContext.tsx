"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type MemberCountContextType = {
  count: number;
  loading: boolean;
  refresh: () => void;
};

const MemberCountContext = createContext<MemberCountContextType>({
  count: 0,
  loading: true,
  refresh: () => {},
});

export function MemberCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const res = await fetch("/api/members/count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count);
      }
    } catch (e) {
      console.error("Failed to fetch member count:", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchCount();
  }, []);

  // Refetch when page becomes visible again (handles tab switch, navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCount();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <MemberCountContext.Provider value={{ count, loading, refresh: fetchCount }}>
      {children}
    </MemberCountContext.Provider>
  );
}

export function useMemberCount() {
  return useContext(MemberCountContext);
}