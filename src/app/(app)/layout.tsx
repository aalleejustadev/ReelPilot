import { cookies } from "next/headers"

import { SignOutMenuItem } from "@/features/auth"
import { getCurrentWorkspace } from "@/features/workspaces"
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar"

import { AppHeader } from "./_components/app-header"
import { AppSidebar } from "./_components/app-sidebar"
import { userMenuItemClass } from "./_components/nav-config"

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

  const menuUser = { name: user.name, email: user.email, image: user.image }
  const signOutItem = <SignOutMenuItem className={userMenuItemClass} />

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        workspaceName={workspace.name}
        user={menuUser}
        signOutItem={signOutItem}
      />
      <SidebarInset>
        <AppHeader user={menuUser} signOutItem={signOutItem} />
        <div className="flex flex-1 flex-col p-6 md:p-8">
          {/* Centred column; text stays left-aligned. */}
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
