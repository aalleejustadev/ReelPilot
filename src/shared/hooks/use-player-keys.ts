"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** True while focus is in something that takes typed text. */
export function isTypingText(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.closest("textarea, [contenteditable=true], [contenteditable='']"))
    return true
  const input = el.closest("input")
  return Boolean(
    input &&
    ![
      "checkbox",
      "radio",
      "range",
      "button",
      "submit",
      "color",
      "file",
    ].includes(input.type)
  )
}

/**
 * Space plays and pauses wherever focus is (a button, a tab, a select, the
 * stage), except while typing text. Captured before anything else, and
 * the keyup too: buttons would otherwise click on Space's keyup.
 */
export function useSpaceToPlay(toggle: () => void) {
  useEffect(() => {
    const onSpace = (event: KeyboardEvent) => {
      if (event.key !== " " || event.metaKey || event.ctrlKey || event.altKey)
        return
      if (isTypingText(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.type === "keydown" && !event.repeat) toggle()
    }
    window.addEventListener("keydown", onSpace, { capture: true })
    window.addEventListener("keyup", onSpace, { capture: true })
    return () => {
      window.removeEventListener("keydown", onSpace, { capture: true })
      window.removeEventListener("keyup", onSpace, { capture: true })
    }
  }, [toggle])
}

/**
 * Full screen for a stage: native element full screen where the browser
 * allows it, else the element fills the window (style it from
 * `fullscreen`). F toggles it; Esc (or the browser's own control) leaves.
 */
export function useFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = useState(false)
  const enter = useCallback(() => {
    setFullscreen(true)
    const box = ref.current
    if (box && document.fullscreenEnabled && !document.fullscreenElement) {
      box.requestFullscreen().catch(() => {
        // Refused (e.g. not from a user gesture): the window fill stays.
      })
    }
  }, [ref])
  // Exits we asked for: their "left full screen" event arrives later, and
  // must not close a full screen entered again in the meantime (F right
  // after Esc).
  const ownExits = useRef(0)
  const exit = useCallback(() => {
    setFullscreen(false)
    if (document.fullscreenElement) {
      ownExits.current++
      document.exitFullscreen().catch(() => ownExits.current--)
    }
  }, [])
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) return
      if (ownExits.current > 0) ownExits.current--
      else setFullscreen(false)
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingText(event.target)) return
      if (event.key === "f" || event.key === "F") {
        event.preventDefault()
        if (fullscreen) exit()
        else enter()
      } else if (event.key === "Escape" && fullscreen) {
        exit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, enter, exit])
  return { fullscreen, enter, exit }
}
