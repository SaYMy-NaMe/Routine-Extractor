import { createContext } from 'react'
import {
  ExportRoutineUseCase,
  ImportRoutineUseCase,
  RoutineLibraryUseCase,
  type FileSaver,
  type KeyValueStorage,
} from '../../application'
import {
  BrowserStorage,
  createExporters,
  createExtractors,
  createRoutineRepository,
} from '../../infrastructure'
import { ToastStore } from '../toast/toastStore'

/** Everything the UI needs from the application layer, resolved once at the DI root. */
export interface Services {
  readonly importRoutine: ImportRoutineUseCase
  readonly exportRoutine: ExportRoutineUseCase
  readonly library: RoutineLibraryUseCase
  readonly storage: KeyValueStorage
  readonly toasts: ToastStore
}

const browserFileSaver: FileSaver = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function createDefaultServices(): Services {
  return {
    importRoutine: new ImportRoutineUseCase(createExtractors()),
    exportRoutine: new ExportRoutineUseCase(createExporters(), browserFileSaver),
    library: new RoutineLibraryUseCase(createRoutineRepository()),
    storage: new BrowserStorage(),
    toasts: new ToastStore(),
  }
}

export const ServicesContext = createContext<Services | null>(null)
