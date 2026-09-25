import type { Metadata } from "next"

import { getCurrentWorkspace, RenameWorkspaceForm } from "@/features/workspaces"
import { plans } from "@/shared/config/plans"
import { Badge } from "@/shared/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"

export const metadata: Metadata = { title: "Workspace" }

const roleLabel = { OWNER: "Owner", EDITOR: "Editor", VIEWER: "Viewer" }

export default async function WorkspaceSettingsPage() {
  const { workspace, role } = await getCurrentWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Your brand kits, campaigns and ads live in this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            You’re the {roleLabel[role].toLowerCase()}
          </Badge>
          <Badge variant="outline">{plans[workspace.plan].name} plan</Badge>
        </div>
        <RenameWorkspaceForm currentName={workspace.name} />
      </CardContent>
    </Card>
  )
}
