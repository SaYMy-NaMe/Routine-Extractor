import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_EMPTY_DAY_SETTINGS, type RoutineGrid as Grid, occupantOf } from '../../../domain'
import { freeColumns, usedTimeSlots } from '../../../application'
import { useViewport } from '../../hooks/useMediaQuery'
import { useRoutine } from '../../hooks/useRoutine'
import { useServices } from '../../hooks/useServices'
import { useToast } from '../../hooks/useToast'
import { EveningSlotPopover } from './EveningSlotPopover'
import { GridCards } from './GridCards'
import { GridTable, type CellOpen } from './GridTable'
import { GridToolbar } from './GridToolbar'
import { SlotEditor } from './SlotEditor'
import { useGridScale } from './viewSettings'

/** Container for the routine grid: toolbar + auto table/card view + editors. */
export function RoutineGrid({ grid }: { grid: Grid }) {
  const { storage } = useServices()
  const toasts = useToast()
  const { actions } = useRoutine()
  const viewport = useViewport()
  const [scale, setScale] = useGridScale(storage)
  const [dayEditor, setDayEditor] = useState<CellOpen | null>(null)
  const [eveningEditor, setEveningEditor] = useState<CellOpen | null>(null)

  const mode = viewport === 'mobile' ? 'cards' : 'table'
  const columns = useMemo(() => usedTimeSlots(grid), [grid])
  const closeDay = useCallback(() => setDayEditor(null), [])
  const closeEvening = useCallback(() => setEveningEditor(null), [])

  /** Last line of defence for the one-class-per-cell rule (editors already prevent it). */
  const save = useCallback(
    (slot: Grid['slots'][number]) => {
      const taken = occupantOf(grid.slots, slot.day, slot.slotId, slot.id)
      if (taken) {
        toasts.notify(
          'error',
          `That slot already holds ${taken.courseCode} — each cell can only have one class.`,
        )
        return false
      }
      actions.upsertSlot(slot)
      return true
    },
    [grid.slots, actions, toasts],
  )

  return (
    <div className="space-y-3">
      <GridToolbar
        grid={grid}
        scale={scale}
        onScale={setScale}
        onAddTimeSlot={actions.addTimeSlot}
        onReset={actions.resetGrid}
      />

      {mode === 'table' ? (
        <GridTable
          grid={grid}
          columns={columns}
          scale={scale}
          emptyDay={DEFAULT_EMPTY_DAY_SETTINGS}
          onOpenDay={setDayEditor}
          onOpenEvening={setEveningEditor}
          onSetOffDay={actions.setOffDay}
          onRemoveTimeSlot={actions.removeTimeSlot}
          newManualSlot={actions.newManualSlot}
        />
      ) : (
        <GridCards
          grid={grid}
          columns={columns}
          scale={scale}
          emptyDay={DEFAULT_EMPTY_DAY_SETTINGS}
          onOpen={setDayEditor}
          onSetOffDay={actions.setOffDay}
          onSetEveningOff={actions.setEveningOff}
          newManualSlot={actions.newManualSlot}
        />
      )}

      {dayEditor && (
        <SlotEditor
          slot={dayEditor.slot}
          isNew={dayEditor.isNew}
          columns={mode === 'cards' ? freeColumns(grid, dayEditor.slot.day, dayEditor.slot.id) : undefined}
          onSave={(s) => save(s) && closeDay()}
          onDelete={(id) => {
            actions.removeSlot(id)
            closeDay()
          }}
          onClose={closeDay}
        />
      )}

      {eveningEditor && (
        <EveningSlotPopover
          anchor={eveningEditor.anchor ?? null}
          slot={eveningEditor.slot}
          isNew={eveningEditor.isNew}
          isOff={grid.eveningOff.includes(eveningEditor.slot.day)}
          onSave={(s) => save(s) && closeEvening()}
          onClear={(id) => {
            actions.removeSlot(id)
            closeEvening()
          }}
          onMarkOff={(off) => {
            actions.setEveningOff(eveningEditor.slot.day, off)
            closeEvening()
          }}
          onClose={closeEvening}
        />
      )}
    </div>
  )
}
