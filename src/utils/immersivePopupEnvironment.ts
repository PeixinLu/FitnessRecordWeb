const activePopups = new Set<symbol>()

function syncEnvironment(): void {
  const active = activePopups.size > 0
  document.documentElement.classList.toggle(
    'immersive-popup-open',
    active,
  )
}

export function enterImmersivePopupEnvironment(token: symbol): void {
  activePopups.add(token)
  syncEnvironment()
}

export function leaveImmersivePopupEnvironment(token: symbol): void {
  activePopups.delete(token)
  syncEnvironment()
}
