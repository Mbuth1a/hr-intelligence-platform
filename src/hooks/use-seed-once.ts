import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Runs the idempotent demo seed exactly once per /dashboard or /employees visit. */
export function useSeedOnce() {
  const { isAuthenticated } = useConvexAuth();
  const seed = useMutation(api.seed.seedIfEmpty);
  const fired = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !fired.current) {
      fired.current = true;
      seed({})
        .then(() => undefined)
        .catch(() => undefined);
    }
  }, [isAuthenticated, seed]);
}
