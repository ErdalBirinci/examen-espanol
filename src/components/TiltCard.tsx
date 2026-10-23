import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/utils";

export function TiltCard({
  children,
  className,
  intensity = 5,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = ref.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    element.style.setProperty("--tilt-x", `${(-y * intensity).toFixed(2)}deg`);
    element.style.setProperty("--tilt-y", `${(x * intensity).toFixed(2)}deg`);
  }

  function reset() {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      className={cn("tilt-card", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
