// Public API of the projects slice. Other code imports only from here.
export { NewProjectButton } from "./components/new-project-button"
export { ProjectEditor } from "./components/project-editor"
export { ProjectsGrid } from "./components/projects-grid"
export { RefreshWhenClipsReady } from "./components/refresh-when-clips-ready"
export {
  getProject,
  getProjectName,
  listProjects,
  type ProjectDetail,
  type ProjectListItem,
} from "./queries"
