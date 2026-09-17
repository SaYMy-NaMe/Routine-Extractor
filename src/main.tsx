import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './presentation/App'
import { ErrorBoundary } from './presentation/components/ErrorBoundary'
import { RoutineProvider } from './presentation/providers/RoutineProvider'
import { ServicesProvider } from './presentation/providers/ServicesProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ServicesProvider>
        <RoutineProvider>
          <App />
        </RoutineProvider>
      </ServicesProvider>
    </ErrorBoundary>
  </StrictMode>,
)
