import "@fontsource-variable/inter/wght.css"
import "@fontsource-variable/montserrat/wght.css"
import "@fontsource/poppins/400.css"
import "@fontsource/poppins/700.css"
import "@fontsource-variable/roboto/wght.css"
import "@fontsource-variable/open-sans/wght.css"
import "@fontsource/lato/400.css"
import "@fontsource/lato/700.css"
import "@fontsource-variable/dm-sans/wght.css"
import "@fontsource-variable/nunito/wght.css"
import "@fontsource-variable/raleway/wght.css"
import "@fontsource-variable/rubik/wght.css"
import "@fontsource-variable/oswald/wght.css"
import "@fontsource/bebas-neue/400.css"
import "@fontsource/anton/400.css"
import "@fontsource/archivo-black/400.css"
import "@fontsource-variable/playfair-display/wght.css"

import { useState } from "react"
import { Composition, continueRender, delayRender } from "remotion"

import { defaultClipTransition, defaultPresentation } from "@/shared/motion"

import { framesFor, stageFps, stageSizes } from "./compositions/FootageStage"
import {
  projectDurationMs,
  ProjectStage,
  type ProjectStageProps,
} from "./compositions/ProjectStage"

/** What the export worker renders: a video (a clip is a one-clip video). */
export type RenderProps = Omit<
  ProjectStageProps,
  "preview" | "playing" | "onVideoError"
> & { shape: keyof typeof stageSizes }

/** The first family in a CSS font-family list, unquoted. */
const firstFamily = (list: string) =>
  list
    .split(",")[0]!
    .trim()
    .replace(/^['"]|['"]$/g, "")

/**
 * The stage, once the kit's fonts have loaded: a font that arrives after
 * the first frames would change the text mid-video.
 */
function RenderVideo(props: RenderProps) {
  const [handle] = useState(() => {
    const id = delayRender("Loading the brand kit's fonts")
    const fonts = props.fonts
    const loads = fonts
      ? [
          `${fonts.headingWeight} 64px "${firstFamily(fonts.heading)}"`,
          `400 64px "${firstFamily(fonts.body)}"`,
          `700 64px "${firstFamily(fonts.body)}"`,
        ]
      : []
    Promise.all(loads.map((font) => document.fonts.load(font)))
      .catch(() => undefined)
      .finally(() => continueRender(id))
    return id
  })
  void handle
  const { shape: _shape, ...stage } = props
  return <ProjectStage {...stage} />
}

const placeholder: RenderProps = {
  shape: "16:9",
  clips: [
    {
      id: "placeholder",
      videoUrl: "",
      videoWidth: 1920,
      videoHeight: 1080,
      presentation: defaultPresentation,
      shots: [],
      durationMs: 1000,
      transition: defaultClipTransition,
    },
  ],
}

export function RemotionRoot() {
  return (
    <Composition
      id="Video"
      component={RenderVideo}
      defaultProps={placeholder}
      fps={stageFps}
      width={1920}
      height={1080}
      durationInFrames={1}
      calculateMetadata={({ props }) => ({
        ...stageSizes[props.shape],
        durationInFrames: framesFor(projectDurationMs(props)),
      })}
    />
  )
}
