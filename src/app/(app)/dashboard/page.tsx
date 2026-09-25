import type { Metadata } from "next"

import { requireUser, SignOutButton } from "@/features/auth"
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

export const metadata: Metadata = { title: "Dashboard" }

function initials(name: string, email: string) {
  const source = name.trim() || email
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

// Temporary: replaced by the real app shell and dashboard in Part F.
export default async function DashboardPage() {
  const { user } = await requireUser()

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Badge variant="outline" className="mb-2">
            Temporary dashboard
          </Badge>
          <CardTitle>You’re signed in</CardTitle>
          <CardDescription>
            The real dashboard arrives with the app shell.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar size="lg">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {user.name || "No name yet"}
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {user.email}
            </span>
          </div>
        </CardContent>
        <CardFooter>
          <SignOutButton />
        </CardFooter>
      </Card>
    </main>
  )
}
