// Entry of the render bundle (built by the export worker with
// @remotion/bundler); the app's Player imports the compositions directly.
import { registerRoot } from "remotion"

import { RemotionRoot } from "./Root"

registerRoot(RemotionRoot)
