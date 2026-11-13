"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * PMO DE motion opt-in for the public guest discovery route only.
 * Never attach this to authenticated workspaces, editors or native DJ controls.
 */
export function MotionRuntime() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-pmo-de-motion]");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      autoRaf: false,
      anchors: true,
      prevent: node => Boolean(
        node.closest('[data-lenis-prevent], [data-editor-scroll], [role="dialog"], textarea, [contenteditable="true"]')
      ),
    });
    const onScroll = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", onScroll);
    gsap.ticker.add(tick);

    const context = gsap.context(() => {
      gsap.fromTo("[data-pmo-de-enter]",
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.1, clearProps: "all" }
      );
    }, root);

    return () => {
      context.revert();
      gsap.ticker.remove(tick);
      lenis.off("scroll", onScroll);
      lenis.destroy();
    };
  }, []);

  return null;
}
