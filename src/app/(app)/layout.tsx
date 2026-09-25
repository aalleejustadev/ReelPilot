import { cookies } from "next/headers"

import { SignOutMenuItem } from "@/features/auth"
import { getCurrentWorkspace } from "@/features/workspaces"
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar"

import { AppHeader } from "./_components/app-header"
import { AppSidebar } from "./_components/app-sidebar"

/**
 * App shell (build plan §12.4). getCurrentWorkspace() is the server-side
 * gate for every (app) page: it redirects signed-out visitors and creates
 * the personal workspace on first use.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, workspace } = await getCurrentWorkspace()
  // Remember collapsed/expanded across visits (cookie set by the sidebar).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        workspaceName={workspace.name}
        user={{ name: user.name, email: user.email, image: user.image }}
        signOutItem={<SignOutMenuItem />}
      />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col p-6 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
