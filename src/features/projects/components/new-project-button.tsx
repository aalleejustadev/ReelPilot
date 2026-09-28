"use client"

import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { projectLimits } from "@/shared/motion"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Spinner } from "@/shared/ui/spinner"

import { createProject } from "../actions"

/** "New project": a name and the brand kit it uses, then its page. */
export function NewProjectButton({
  kits,
  defaultKitId,
  variant = "default",
}: {
  kits: { id: string; name: string }[]
  defaultKitId?: string
  variant?: "default" | "outline"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [kitId, setKitId] = useState(defaultKitId ?? kits[0]?.id ?? "")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [isCreating, startCreate] = useTransition()

  function create() {
    startCreate(async () => {
      const result = await createProject({ name, kitId })
      if (result.ok) {
        router.push(`/projects/${result.data.projectId}`)
        return
      }
      setErrors(result.error.fieldErrors ?? { form: [result.error.message] })
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isCreating) return
        setOpen(next)
        if (!next) setErrors({})
      }}
    >
      <DialogTrigger render={<Button type="button" variant={variant} />}>
        <PlusIcon data-icon="inline-start" />
        New project
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            create()
          }}
        >
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              A video made from a brand kit’s clips. You add the clips next.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                value={name}
                maxLength={projectLimits.name}
                placeholder="Launch video"
                autoFocus
                aria-invalid={errors.name ? true : undefined}
                onChange={(event) => setName(event.target.value)}
              />
              {errors.name && <FieldError>{errors.name[0]}</FieldError>}
            </Field>
            <Field data-invalid={errors.kitId ? true : undefined}>
              <FieldLabel htmlFor="project-kit">Brand kit</FieldLabel>
              <Select
                items={kits.map((kit) => ({ value: kit.id, label: kit.name }))}
                value={kitId}
                onValueChange={(value) => value && setKitId(value as string)}
              >
                <SelectTrigger id="project-kit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {kits.map((kit) => (
                      <SelectItem key={kit.id} value={kit.id}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.kitId && <FieldError>{errors.kitId[0]}</FieldError>}
            </Field>
            {errors.form && <FieldError>{errors.form[0]}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Spinner data-icon="inline-start" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
