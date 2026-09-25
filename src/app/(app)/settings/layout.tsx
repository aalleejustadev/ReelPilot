import { SettingsNav } from "./_settings-nav"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and workspace.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  )
}
