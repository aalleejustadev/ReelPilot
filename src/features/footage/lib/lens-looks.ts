import type { Lens } from "@/shared/motion"

export type LensLook = { id: string; title: string; hint: string; lens: Lens }

export const noLens: Lens = {
  depthOfField: { enabled: false, fStop: 2.8, maxBlur: 1.2 },
  progressiveBlur: {
    enabled: false,
    from: "bottom",
    strength: 0.8,
    reach: 0.3,
  },
}

/** One-click lenses; each is fully adjustable below. */
export const lensLooks: LensLook[] = [
  { id: "sharp", title: "Sharp", hint: "Everything in focus", lens: noLens },
  {
    id: "shallow",
    title: "Shallow focus",
    hint: "f/2: what the camera looks at pops",
    lens: {
      ...noLens,
      depthOfField: { enabled: true, fStop: 2, maxBlur: 0.7 },
    },
  },
  {
    id: "cinematic",
    title: "Cinematic",
    hint: "f/4, the screen soft top and bottom",
    lens: {
      depthOfField: { enabled: true, fStop: 4, maxBlur: 0.45 },
      progressiveBlur: {
        enabled: true,
        from: "both",
        strength: 0.4,
        reach: 0.15,
      },
    },
  },
  {
    id: "fade",
    title: "Soft fade",
    hint: "The screen melts away at the bottom",
    lens: {
      ...noLens,
      progressiveBlur: {
        enabled: true,
        from: "bottom",
        strength: 1,
        reach: 0.35,
      },
    },
  },
]
