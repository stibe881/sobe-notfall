import { useRef, useState } from 'react'
import { KeyRound, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { isLastAdmin, uid, useStore } from '../store'
import type { Role, User } from '../types'
import { Badge, Button, Card, Field, Modal, inputClass, useConfirm } from '../components/ui'
import { MIN_PASSWORD_LENGTH, hasPassword, passwordProblem } from '../lib/auth'

export default function UsersPage() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<User | null>(null)
  const [filter, setFilter] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const { ask, confirmEl } = useConfirm()
  const today = new Date().toISOString().slice(0, 10)

  function newUser(): User {
    return {
      id: uid('u'), firstName: '', lastName: '', email: '', phone: '', role: 'mitarbeiter',
      groupIds: ['gr-alle'], locationId: state.locations[0]?.id ?? '', language: 'de',
    }
  }

  function importCsv(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const startIdx = /vorname|firstname/i.test(lines[0] ?? '') ? 1 : 0
      const users: User[] = []
      for (const line of lines.slice(startIdx)) {
        const [firstName, lastName, email, phone, role] = line.split(/[;,]/).map((s) => s?.trim() ?? '')
        if (!firstName || !lastName) continue
        users.push({
          id: uid('u'), firstName, lastName,
          email: email || `${firstName}.${lastName}@firma.ch`.toLowerCase(),
          phone: phone || '', role: (['admin', 'krisenstab', 'mitarbeiter'].includes(role) ? role : 'mitarbeiter') as Role,
          groupIds: ['gr-alle'], locationId: state.locations[0]?.id ?? '', language: 'de',
        })
      }
      if (users.length) dispatch({ type: 'IMPORT_USERS', users })
      else alert('Keine gültigen Zeilen gefunden. Format: Vorname;Nachname;E-Mail;Telefon;Rolle')
    }
    reader.readAsText(file)
  }

  const filtered = state.users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Benutzerverwaltung</h1>
          <p className="text-sm text-slate-500">
            Manuelle Erfassung, CSV-Upload oder automatische Synchronisation mit dem Personalsystem (siehe Integrationen) ·
            Anmeldung mit E-Mail und Passwort oder mit Microsoft (SSO, siehe Integrationen)
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInput} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = '' }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={16} /> CSV-Import</Button>
          <Button onClick={() => setEditing(newUser())}><Plus size={16} /> Neuer Benutzer</Button>
        </div>
      </div>

      <Card>
        <input className={inputClass + ' mb-4 max-w-xs'} placeholder="Suchen…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Kontakt</th>
                <th className="py-2 pr-4">Rolle</th>
                <th className="py-2 pr-4">Gruppen</th>
                <th className="py-2 pr-4">Standort</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Anmeldung</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const absent = u.absence && u.absence.from <= today && today <= u.absence.to
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {u.firstName} {u.lastName}
                      <span className="ml-1.5 text-xs text-slate-400 uppercase">{u.language}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      <div>{u.email}</div>
                      <div className="text-xs">{u.phone}</div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge color={u.role === 'admin' ? 'red' : u.role === 'krisenstab' ? 'violet' : 'slate'}>{u.role}</Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {u.groupIds.map((gid) => {
                          const g = state.groups.find((x) => x.id === gid)
                          return g ? <Badge key={gid}>{g.name}</Badge> : null
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{state.locations.find((l) => l.id === u.locationId)?.name ?? '–'}</td>
                    <td className="py-2.5 pr-4">
                      {absent && <Badge color="amber">abwesend bis {u.absence!.to}</Badge>}
                      {u.partTimeNote && <Badge color="blue">{u.partTimeNote}</Badge>}
                      {!absent && !u.partTimeNote && <Badge color="green">erreichbar</Badge>}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        {!hasPassword(u) ? (
                          // Wer sich über Microsoft anmeldet, braucht kein Passwort – das ist kein Mangel
                          u.ssoLoginAt ? null : <Badge color="amber">kein Passwort</Badge>
                        ) : u.mustChangePassword ? (
                          <Badge color="blue">Passwortwechsel nötig</Badge>
                        ) : (
                          <Badge color="green">aktiv</Badge>
                        )}
                        {u.ssoLoginAt && (
                          <span title={`Letzte Microsoft-Anmeldung: ${new Date(u.ssoLoginAt).toLocaleString('de-CH')}`}>
                            <Badge color="violet">Microsoft</Badge>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => setEditing(u)}><Pencil size={14} /></Button>
                      <Button
                        variant="ghost"
                        disabled={isLastAdmin(state, u.id)}
                        title={isLastAdmin(state, u.id) ? 'Der letzte Administrator kann nicht gelöscht werden' : 'Benutzer löschen'}
                        onClick={() => ask(`${u.firstName} ${u.lastName} löschen?`, () => dispatch({ type: 'DELETE_USER', userId: u.id }))}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-400 mt-3">
          CSV-Format: <code>Vorname;Nachname;E-Mail;Telefon;Rolle</code> (mit oder ohne Kopfzeile)
        </div>
      </Card>

      {confirmEl}
      {editing && <UserEditor user={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function UserEditor({ user, onClose }: { user: User; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<User>({ ...user })
  const [absenceFrom, setAbsenceFrom] = useState(user.absence?.from ?? '')
  const [absenceTo, setAbsenceTo] = useState(user.absence?.to ?? '')
  const [password, setPassword] = useState('')
  const [mustChange, setMustChange] = useState(!hasPassword(user) || Boolean(user.mustChangePassword))
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const letzterAdmin = isLastAdmin(state, user.id)

  function save() {
    if (letzterAdmin && draft.role !== 'admin') {
      return setPasswordError('Dies ist der einzige Administrator – die Rolle kann nicht geändert werden. Legen Sie zuerst einen weiteren Administrator an.')
    }
    if (password) {
      const problem = passwordProblem(password)
      if (problem) return setPasswordError(problem)
    }
    // Passwort gehört in dieselbe Aktion: sonst laufen Anlegen und Passwortvergabe
    // im Live-Betrieb als zwei Serveraufrufe in einen Wettlauf
    dispatch({
      type: 'UPSERT_USER',
      user: {
        ...draft,
        absence: absenceFrom && absenceTo ? { from: absenceFrom, to: absenceTo } : undefined,
        mustChangePassword: mustChange,
      },
      password: password || undefined,
    })
    onClose()
  }

  return (
    <Modal title={user.firstName ? `Benutzer: ${user.firstName} ${user.lastName}` : 'Neuer Benutzer'} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vorname">
          <input className={inputClass} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
        </Field>
        <Field label="Nachname">
          <input className={inputClass} value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
        </Field>
        <Field label="E-Mail">
          <input className={inputClass} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <Field label="Mobiltelefon">
          <input className={inputClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </Field>
        <Field label="Rolle / Berechtigung">
          <select
            className={inputClass} value={draft.role} disabled={letzterAdmin}
            onChange={(e) => { setDraft({ ...draft, role: e.target.value as Role }); setPasswordError(null) }}
          >
            <option value="mitarbeiter">Mitarbeiter</option>
            <option value="krisenstab">Krisenstab</option>
            <option value="admin">Administrator</option>
          </select>
          {letzterAdmin && (
            <span className="block text-xs text-slate-400 mt-1">
              Einziger Administrator – die Rolle bleibt gesperrt, bis ein weiterer Administrator existiert.
            </span>
          )}
        </Field>
        <Field label="App-Sprache – vorbereitet, noch nicht aktiv (die Inhalte sind deutsch)">
          <select className={inputClass} value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as User['language'] })}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
          </select>
        </Field>
      </div>
      <Field label="Standort">
        <select className={inputClass} value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}>
          {state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Gruppen">
        <div className="space-y-1">
          {state.groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" checked={draft.groupIds.includes(g.id)}
                onChange={() =>
                  setDraft({
                    ...draft,
                    groupIds: draft.groupIds.includes(g.id) ? draft.groupIds.filter((id) => id !== g.id) : [...draft.groupIds, g.id],
                  })
                }
              />
              {g.name}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Ferienabwesenheit von">
          <input type="date" className={inputClass} value={absenceFrom} onChange={(e) => setAbsenceFrom(e.target.value)} />
        </Field>
        <Field label="bis">
          <input type="date" className={inputClass} value={absenceTo} onChange={(e) => setAbsenceTo(e.target.value)} />
        </Field>
      </div>
      <Field label="Teilzeit-Notiz (optional)">
        <input className={inputClass} placeholder="z. B. 60 %, Mo–Mi" value={draft.partTimeNote ?? ''} onChange={(e) => setDraft({ ...draft, partTimeNote: e.target.value || undefined })} />
      </Field>

      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
          <KeyRound size={15} /> Anmeldung
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {hasPassword(user)
            ? 'Für dieses Konto ist ein Passwort gesetzt. Ein neues Passwort überschreibt das bisherige.'
            : 'Ohne Passwort kann sich diese Person weder im Webportal noch in der App anmelden.'}
        </p>
        <Field label={hasPassword(user) ? 'Neues Passwort (optional)' : `Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen, mit Ziffer)`}>
          <input
            type="text" autoComplete="new-password" className={inputClass}
            placeholder={hasPassword(user) ? 'leer lassen = unverändert' : 'z. B. Startpasswort vergeben'}
            value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError(null) }}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 mt-2">
          <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
          Passwortänderung bei der nächsten Anmeldung erzwingen
        </label>
        {passwordError && <div className="text-xs text-alarm-600 mt-2">{passwordError}</div>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={!draft.firstName.trim() || !draft.lastName.trim()}>Speichern</Button>
      </div>
    </Modal>
  )
}
