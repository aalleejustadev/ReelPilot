// Public API of the footage slice. Other code imports only from here; the
// worker imports its job handlers from "@/features/footage/jobs".
export { FootageEditor } from "./components/footage-editor"
export { DeleteClipButton } from "./components/delete-clip-button"
export { FootageGrid } from "./components/footage-grid"
export { FootageUploader } from "./components/footage-uploader"
export { RefreshWhileProcessing } from "./components/refresh-while-processing"
export { ScreenRecorder } from "./components/screen-recorder"
export { formatDuration } from "./lib/format"
export { footageLimitsFor, footageUsage } from "./lib/limits"
export { presentationFor } from "./lib/motion"
export {
  clipMediaUrls,
  getFootage,
  listFootage,
  withPosterUrls,
  type FootageDetail,
} from "./queries"
