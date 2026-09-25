import type { Metadata } from "next"

import { SignOutButton } from "@/features/auth"
import { getCurrentWorkspace, RenameWorkspaceForm } from "@/features/workspaces"
import { plans } from "@/shared/config/plans"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar"
import { Badge } from "@/shared/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Separator } from "@/shared/ui/separator"

export const metadata: Metadata = { title: "Dashboard" }

const roleLabel = { OWNER: "Owner", EDITOR: "Editor", VIEWER: "Viewer" }

function initials(name: string, email: string) {
  return (name.trim() || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

// Temporary: replaced by the real app shell and dashboard in Part F.
export default async function DashboardPage() {
  const { user, workspace, role } = await getCurrentWorkspace()

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Badge variant="outline" className="mb-2">
            Temporary dashboard
          </Badge>
          <CardTitle>{workspace.name}</CardTitle>
          <CardDescription>
            The real dashboard arrives with the app shell.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">
                {user.name || "No name yet"}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {user.email}
              </span>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Badge variant="secondary">{roleLabel[role]}</Badge>
              <Badge variant="outline">{plans[workspace.plan].name} plan</Badge>
            </div>
          </div>
          <Separator />
          <RenameWorkspaceForm currentName={workspace.name} />
        </CardContent>
        <CardFooter>
          <SignOutButton />
        </CardFooter>
      </Card>
    </main>
  )
}
