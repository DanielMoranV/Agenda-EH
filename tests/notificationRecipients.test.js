import { describe, it, expect } from 'vitest'
import { recipientKeys, pendingRecipientKeys } from '../src/utils/notificationRecipients'

const base = { notificar_responsable: true, contacto_id: 'ana', contactos_copia_ids: ['luis', 'eva'] }

describe('recipientKeys', () => {
  it('incluye responsable y copias con su rol', () => {
    expect([...recipientKeys(base)].sort()).toEqual(['copia:eva', 'copia:luis', 'responsable:ana'])
  })

  it('no devuelve nada si el aviso está desactivado o no hay tarea', () => {
    expect(recipientKeys({ ...base, notificar_responsable: false }).size).toBe(0)
    expect(recipientKeys(undefined).size).toBe(0)
  })

  it('no repite al responsable como copia', () => {
    const keys = recipientKeys({ ...base, contactos_copia_ids: ['ana', 'luis'] })
    expect([...keys].sort()).toEqual(['copia:luis', 'responsable:ana'])
  })

  it('funciona sin responsable o sin copias', () => {
    expect([...recipientKeys({ notificar_responsable: true, contactos_copia_ids: ['luis'] })]).toEqual(['copia:luis'])
    expect([...recipientKeys({ notificar_responsable: true, contacto_id: 'ana' })]).toEqual(['responsable:ana'])
  })
})

describe('pendingRecipientKeys', () => {
  it('avisa a todos cuando el aviso se acaba de activar', () => {
    const before = { ...base, notificar_responsable: false }
    expect(pendingRecipientKeys(before, base)).toHaveLength(3)
  })

  it('no reenvía al editar sin cambiar destinatarios', () => {
    expect(pendingRecipientKeys(base, { ...base, titulo: 'otro' })).toEqual([])
  })

  it('avisa solo al destinatario nuevo', () => {
    const after = { ...base, contactos_copia_ids: ['luis', 'eva', 'pedro'] }
    expect(pendingRecipientKeys(base, after)).toEqual(['copia:pedro'])
  })

  it('un cambio de rol cuenta como aviso nuevo', () => {
    const after = { ...base, contacto_id: 'luis', contactos_copia_ids: ['eva'] }
    expect([...pendingRecipientKeys(base, after)].sort()).toEqual(['responsable:luis'])
  })
})
