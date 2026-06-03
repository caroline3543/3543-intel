export function vibe(pattern) {
  try { navigator.vibrate(pattern); } catch (_) {}
}
