/** Tiny class-name joiner (avoids a dependency for something this small). */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
