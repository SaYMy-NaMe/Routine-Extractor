import { useServices } from './useServices'

/** Raise toast notifications from any component. */
export function useToast() {
  return useServices().toasts
}
