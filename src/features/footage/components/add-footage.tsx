"use client"

import { useState } from "react"

import { Field, FieldLabel } from "@/shared/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"

import { FootageUploader } from "./footage-uploader"
import { ScreenRecorder } from "./screen-recorder"

/**
 * Record or upload, from anywhere in the workspace. With more than one
 * brand kit, a picker says which kit the clip joins.
 */
export function AddFootage({
  kits,
  maxBytes,
  maxDurationSeconds,
}: {
  kits: { id: string; name: string }[]
  maxBytes: number
  maxDurationSeconds: number
}) {
  const [kitId, setKitId] = useState(kits[0]?.id ?? "")
  const kit = kits.find((each) => each.id === kitId)
  if (!kit) return null

  return (
    <div className="flex flex-col gap-4">
      {kits.length > 1 && (
        <Field className="max-w-xs">
          <FieldLabel htmlFor="footage-kit">Brand kit</FieldLabel>
          <Select
            items={kits.map((each) => ({ value: each.id, label: each.name }))}
            value={kitId}
            onValueChange={(value) => value && setKitId(value as string)}
          >
            <SelectTrigger id="footage-kit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {kits.map((each) => (
                  <SelectItem key={each.id} value={each.id}>
                    {each.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ScreenRecorder
          kitId={kit.id}
          maxBytes={maxBytes}
          maxDurationSeconds={maxDurationSeconds}
        />
        <FootageUploader kitId={kit.id} maxBytes={maxBytes} disabled={false} />
      </div>
    </div>
  )
}
