import { SettingsNav } from "./_settings-nav"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your profile and workspace.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  )
}
