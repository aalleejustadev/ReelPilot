"use client"

import { TrashIcon, VideoIcon } from "lucide-react"
import { useState, useTransition } from "react"

import {
  defaultShot,
  presetOf,
  shotPresetNames,
  shotPresets,
  type Shot,
  type ShotPresetName,
} from "@/shared/motion"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
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
import { toast } from "@/shared/ui/toast"

import { deleteFootageMarker, updateFootageMarker } from "../actions"
import { formatTimecode } from "../lib/format"
import type { FootageDetail } from "../queries"
import { footageLimits } from "../schema"
import { PanelHeading } from "./editor-panels"

type Marker = FootageDetail["markers"][number]

/** Every key moment: label it, give it a shot, or remove it. */
export function MomentsPanel({
  markers,
  selectedId,
  readOnly,
  shotOf,
  onSelect,
  onShotChange,
}: {
  markers: Marker[]
  selectedId: string | null
  readOnly: boolean
  shotOf: (marker: Marker) => Shot | null
  onSelect: (marker: Marker) => void
  onShotChange: (marker: Marker, shot: Shot | null) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <PanelHeading
        title="Key moments"
        description="Scripts cut to these moments, and the camera moves at each one. Auto ones come from scene changes; label them so you know what each shows."
      />
      {markers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No key moments yet. Play the clip and add one where something happens.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {markers.map((marker) => (
            <MarkerRow
              key={marker.id}
              marker={marker}
              readOnly={readOnly}
              isSelected={marker.id === selectedId}
              shot={shotOf(marker)}
              onSelect={() => onSelect(marker)}
              onShotChange={(shot) => onShotChange(marker, shot)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function MarkerRow({
  marker,
  readOnly,
  isSelected,
  shot,
  onSelect,
  onShotChange,
}: {
  marker: Marker
  readOnly: boolean
  isSelected: boolean
  shot: Shot | null
  onSelect: () => void
  onShotChange: (shot: Shot | null) => void
}) {
  const [label, setLabel] = useState(marker.label ?? "")
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const time = formatTimecode(marker.atMs)

  function saveLabel() {
    if (label.trim() === (marker.label ?? "")) return
    startSave(async () => {
      const result = await updateFootageMarker({ markerId: marker.id, label })
      if (!result.ok) toast.add({ type: "error", title: result.error.message })
    })
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteFootageMarker(marker.id)
      toast.add(
        result.ok
          ? { type: "success", title: `Marker at ${time} removed` }
          : { type: "error", title: result.error.message }
      )
    })
  }

  return (
    // Narrow screens: time, badge and delete on one line, label below.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        type="button"
        variant={isSelected ? "secondary" : "ghost"}
        className="font-mono"
        aria-label={`Select the moment at ${time}`}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        {time}
      </Button>
      <Input
        aria-label={`Label for ${time}`}
        placeholder="What happens here?"
        value={label}
        maxLength={footageLimits.label}
        disabled={readOnly || isSaving}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={saveLabel}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="order-last w-full"
      />
      <div className="ml-auto flex items-center gap-2">
        <ShotSelect
          time={time}
          shot={shot}
          disabled={readOnly}
          onChange={onShotChange}
        />
        <Badge variant={marker.source === "AUTO" ? "secondary" : "outline"}>
          {marker.source === "AUTO" ? "Auto" : "Manual"}
        </Badge>
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove marker at ${time}`}
            disabled={isDeleting}
            onClick={remove}
          >
            {isDeleting ? <Spinner /> : <TrashIcon />}
          </Button>
        )}
      </div>
    </li>
  )
}

const keepPrevious = "keep"
const customShot = "custom"

/** A moment's shot, right in its row: keep the previous one or pick one. */
function ShotSelect({
  time,
  shot,
  disabled,
  onChange,
}: {
  time: string
  shot: Shot | null
  disabled: boolean
  onChange: (shot: Shot | null) => void
}) {
  const value = shot ? (presetOf(shot.camera) ?? customShot) : keepPrevious
  const items = [
    { value: keepPrevious, label: "Keep previous shot" },
    ...shotPresetNames.map((name) => ({
      value: name,
      label: shotPresets[name].label,
    })),
    ...(value === customShot ? [{ value: customShot, label: "Custom" }] : []),
  ]
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (!next || next === customShot) return
        if (next === keepPrevious) return onChange(null)
        const preset = shotPresets[next as ShotPresetName]
        onChange({ ...(shot ?? defaultShot), camera: preset.camera })
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Camera shot at ${time}`}
        className="w-36"
      >
        <VideoIcon data-icon="inline-start" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
