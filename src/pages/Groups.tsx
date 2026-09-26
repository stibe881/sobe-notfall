import { useState } from 'react'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { uid, useStore } from '../store'
import type { Group } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, inputClass, useConfirm } from '../components/ui'

export default function Groups() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Group | null>(null)
  const { ask, confirmEl } = useConfirm()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gruppen &amp; Krisenteams</h1>
          <p className="text-sm text-muted">Nutzergruppen für zielgruppenspezifische Alarmierung und Krisenorganisation</p>
        </div>
        <Button onClick={() => setEditing({ id: uid('gr'), name: '', description: '', isCrisisTeam: false })}>
          <Plus size={16} /> Neue Gruppe
        </Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.groups.map((g) => {
          const members = state.users.filter((u) => u.groupIds.includes(g.id))
          return (
            <Card key={g.id}>
              <div className="flex items-start gap-3">
                <UsersRound size={24} className={g.isCrisisTeam ? 'text-violet-500' : 'text-faint'} />
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    {g.name}
                    {g.isCrisisTeam && <Badge color="violet">Krisenteam</Badge>}
                  </div>
                  <div className="text-sm text-muted mt-0.5">{g.description}</div>
                  <div className="text-xs text-faint mt-2">{members.length} Mitglieder</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {members.slice(0, 6).map((m) => <Badge key={m.id}>{m.firstName} {m.lastName}</Badge>)}
                    {members.length > 6 && <Badge>+{members.length - 6}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" onClick={() => setEditing(g)}><Pencil size={14} /></Button>
                <Button variant="ghost" onClick={() => ask(`Gruppe «${g.name}» löschen?`, () => dispatch({ type: 'DELETE_GROUP', groupId: g.id }))}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {confirmEl}
      {editing && <GroupEditor group={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function GroupEditor({ group, onClose }: { group: Group; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<Group>({ ...group })
  const [memberIds, setMemberIds] = useState<string[]>(state.users.filter((u) => u.groupIds.includes(group.id)).map((u) => u.id))

  function save() {
    dispatch({ type: 'UPSERT_GROUP', group: draft })
    for (const user of state.users) {
      const should = memberIds.includes(user.id)
      const has = user.groupIds.includes(draft.id)
      if (should !== has) {
        dispatch({
          type: 'UPSERT_USER',
          user: { ...user, groupIds: should ? [...user.groupIds, draft.id] : user.groupIds.filter((g) => g !== draft.id) },
        })
      }
    }
    onClose()
  }

  return (
    <Modal title={group.name ? `Gruppe: ${group.name}` : 'Neue Gruppe'} onClose={onClose}>
      <Field label="Name">
        <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label="Beschreibung">
        <input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </Field>
      <div className="mb-4">
        <Toggle checked={draft.isCrisisTeam} onChange={(v) => setDraft({ ...draft, isCrisisTeam: v })} label="Als Krisenteam kennzeichnen" />
      </div>
      <Field label="Mitglieder">
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {state.users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" checked={memberIds.includes(u.id)}
                onChange={() => setMemberIds(memberIds.includes(u.id) ? memberIds.filter((id) => id !== u.id) : [...memberIds, u.id])}
              />
              {u.firstName} {u.lastName}
            </label>
          ))}
        </div>
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={!draft.name.trim()}>Speichern</Button>
      </div>
    </Modal>
  )
}
