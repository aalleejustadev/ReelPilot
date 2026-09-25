// Public API of the workspaces slice. Other code imports only from here.
export { renameWorkspace } from "./actions"
export {
  assertCan,
  can,
  workspaceActions,
  type WorkspaceAction,
} from "./lib/permissions"
export { getCurrentWorkspace, requireWorkspaceAccess } from "./queries"
export { RenameWorkspaceForm } from "./components/rename-workspace-form"
