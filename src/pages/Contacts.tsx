import { useState } from 'react'
import { ChevronDown, ChevronUp, Phone, Plus, Trash2 } from 'lucide-react'
import { uid, useStore } from '../store'
import { Button, Card, Field, Modal, inputClass, useConfirm } from '../components/ui'

export default function Contacts() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [description, setDescription] = useState('')
  const { ask, confirmEl } = useConfirm()

  /** Tauscht die Reihenfolge mit dem Nachbarn und schreibt saubere, lückenlose Werte fest */
  function verschieben(contactId: string, richtung: -1 | 1) {
    const liste = state.contacts
    const von = liste.findIndex((c) => c.id === contactId)
    const nach = von + richtung
    if (von < 0 || nach < 0 || nach >= liste.length) return
    const neu = [...liste]
    ;[neu[von], neu[nach]] = [neu[nach], neu[von]]
    neu.forEach((c, i) => {
      if (c.order !== i) dispatch({ type: 'UPSERT_CONTACT', contact: { ...c, order: i } })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notfallkontakte</h1>
          <p className="text-sm text-slate-500">
            Externe Notrufnummern (Blaulichtorganisationen) – in der App direkt anrufbar, Reihenfolge mit den Pfeilen anpassbar
          </p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus size={16} /> Kontakt hinzufügen</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {state.contacts.map((c, i) => (
          <Card key={c.id}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Phone size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800">{c.name}</div>
                <div className="text-2xl font-bold text-alarm-600">{c.number}</div>
                <div className="text-xs text-slate-400">{c.description}</div>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button variant="ghost" disabled={i === 0} onClick={() => verschieben(c.id, -1)} title="Nach oben">
                  <ChevronUp size={14} />
                </Button>
                <Button variant="ghost" disabled={i === state.contacts.length - 1} onClick={() => verschieben(c.id, 1)} title="Nach unten">
                  <ChevronDown size={14} />
                </Button>
              </div>
              <Button variant="ghost" onClick={() => ask(`Kontakt «${c.name}» löschen?`, () => dispatch({ type: 'DELETE_CONTACT', contactId: c.id }))}>
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {confirmEl}
      {adding && (
        <Modal title="Notfallkontakt hinzufügen" onClose={() => setAdding(false)}>
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Rufnummer">
            <input className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Beschreibung">
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button
              disabled={!name.trim() || !number.trim()}
              onClick={() => {
                const naechsteOrder = state.contacts.reduce((max, c) => Math.max(max, c.order ?? -1), -1) + 1
                dispatch({ type: 'UPSERT_CONTACT', contact: { id: uid('ec'), name, number, description, order: naechsteOrder } })
                setAdding(false); setName(''); setNumber(''); setDescription('')
              }}
            >
              Speichern
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
