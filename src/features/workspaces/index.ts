// Public API of the workspaces slice. Other code imports only from here.
export { getCurrentWorkspace, requireWorkspaceAccess } from "./queries"
export { can } from "./lib/permissions"
export { RenameWorkspaceForm } from "./components/rename-workspace-form"
