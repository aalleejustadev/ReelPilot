/**
 * "Ali’s workspace" from "Ali Murtaza". Magic-link sign-ups have no name
 * yet, so they get "My workspace".
 */
export function personalWorkspaceName(userName: string | null | undefined) {
  const firstName = userName?.trim().split(/\s+/)[0]
  return firstName ? `${firstName}’s workspace` : "My workspace"
}
