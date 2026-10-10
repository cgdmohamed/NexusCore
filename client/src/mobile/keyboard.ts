import { useEffect, useState } from "react";

export interface KeyboardState {
  // Height of the on-screen keyboard (0 when closed)
  inset: number;
  // Height of the part of the page the person can actually see
  height: number | null;
}

// iOS keeps fixed elements pinned to the full window, so a sheet sits behind the keyboard unless it is lifted by this amount
export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ inset: 0, height: null });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setState((prev) => (prev.inset === inset && prev.height === vv.height ? prev : { inset, height: vv.height }));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return state;
}
