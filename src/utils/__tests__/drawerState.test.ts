import {
  DRAWER_INITIAL_STATE,
  isDrawerOpen,
  reduceDrawerState,
  shouldCloseDrawerOnRouteChange,
  toCloseHandler,
  toDrawerOpen,
  type DrawerEvent,
  type DrawerState,
} from '../drawerState'

describe('reduceDrawerState — success paths', () => {
  it('opens from closed', () => {
    expect(reduceDrawerState('closed', { type: 'OPEN' })).toBe('open')
  })

  it('closes from open', () => {
    expect(reduceDrawerState('open', { type: 'CLOSE' })).toBe('closed')
  })

  it('toggles closed -> open and open -> closed', () => {
    expect(reduceDrawerState('closed', { type: 'TOGGLE' })).toBe('open')
    expect(reduceDrawerState('open', { type: 'TOGGLE' })).toBe('closed')
  })

  it('closes on route change when open (deep link / back / in-app nav)', () => {
    expect(reduceDrawerState('open', { type: 'ROUTE_CHANGE' })).toBe('closed')
  })

  it('closes on desktop resize when open', () => {
    expect(reduceDrawerState('open', { type: 'RESIZE_DESKTOP' })).toBe('closed')
  })

  it('initializes closed', () => {
    expect(DRAWER_INITIAL_STATE).toBe('closed')
  })
})

describe('reduceDrawerState — idempotency and boundary invariants', () => {
  it('OPEN is idempotent: repeated opens can never close the drawer', () => {
    let state = DRAWER_INITIAL_STATE
    state = reduceDrawerState(state, { type: 'OPEN' })
    state = reduceDrawerState(state, { type: 'OPEN' })
    state = reduceDrawerState(state, { type: 'OPEN' })
    expect(state).toBe('open')
  })

  it('CLOSE is idempotent: duplicate close events (Escape + backdrop) settle once', () => {
    let state = reduceDrawerState('open', { type: 'CLOSE' })
    state = reduceDrawerState(state, { type: 'CLOSE' })
    state = reduceDrawerState(state, { type: 'CLOSE' })
    expect(state).toBe('closed')
  })

  it('ROUTE_CHANGE and RESIZE_DESKTOP can never open a closed drawer', () => {
    expect(reduceDrawerState('closed', { type: 'ROUTE_CHANGE' })).toBe('closed')
    expect(reduceDrawerState('closed', { type: 'RESIZE_DESKTOP' })).toBe('closed')
  })

  it('every event produces a valid, non-contradictory state', () => {
    const states: DrawerState[] = ['closed', 'open']
    const events: DrawerEvent[] = [
      { type: 'OPEN' },
      { type: 'CLOSE' },
      { type: 'TOGGLE' },
      { type: 'ROUTE_CHANGE' },
      { type: 'RESIZE_DESKTOP' },
    ]

    for (const state of states) {
      for (const event of events) {
        const next = reduceDrawerState(state, event)
        expect(['closed', 'open']).toContain(next)
      }
    }
  })

  it('rapid alternating events settle on a consistent state', () => {
    const events: DrawerEvent[] = [
      { type: 'OPEN' },
      { type: 'CLOSE' },
      { type: 'OPEN' },
      { type: 'CLOSE' },
      { type: 'CLOSE' }, // duplicate close
      { type: 'TOGGLE' },
    ]

    let state: DrawerState = 'closed'
    for (const event of events) {
      state = reduceDrawerState(state, event)
    }
    expect(state).toBe('open')
  })
})

describe('reduceDrawerState — stale events and retry recovery', () => {
  it('a stale close arriving before the open cannot corrupt a later open', () => {
    let state = reduceDrawerState('closed', { type: 'CLOSE' }) // stale/duplicate close
    state = reduceDrawerState(state, { type: 'OPEN' })
    state = reduceDrawerState(state, { type: 'CLOSE' })
    expect(state).toBe('closed')
  })

  it('preserves user intent across an interrupted open (route change): retry re-opens', () => {
    let state = reduceDrawerState('closed', { type: 'OPEN' })
    state = reduceDrawerState(state, { type: 'ROUTE_CHANGE' }) // interrupted
    expect(state).toBe('closed')

    state = reduceDrawerState(state, { type: 'OPEN' }) // user retries
    expect(state).toBe('open')
  })

  it('preserves user intent across an interrupted open (desktop resize): retry re-opens', () => {
    let state = reduceDrawerState('closed', { type: 'OPEN' })
    state = reduceDrawerState(state, { type: 'RESIZE_DESKTOP' })
    expect(state).toBe('closed')

    state = reduceDrawerState(state, { type: 'OPEN' })
    expect(state).toBe('open')
  })
})

describe('hostile-input boundary', () => {
  it('rejects unknown events without corrupting state', () => {
    const unknown = { type: 'TELEPORT' } as unknown as DrawerEvent
    expect(reduceDrawerState('open', unknown)).toBe('open')
    expect(reduceDrawerState('closed', unknown)).toBe('closed')
  })

  it('isDrawerOpen only treats the open state as open', () => {
    expect(isDrawerOpen('open')).toBe(true)
    expect(isDrawerOpen('closed')).toBe(false)
    expect(isDrawerOpen('bogus' as DrawerState)).toBe(false)
  })

  it('toDrawerOpen accepts only the literal boolean true', () => {
    expect(toDrawerOpen(true)).toBe(true)
    expect(toDrawerOpen(false)).toBe(false)
    expect(toDrawerOpen('true')).toBe(false)
    expect(toDrawerOpen('false')).toBe(false)
    expect(toDrawerOpen(1)).toBe(false)
    expect(toDrawerOpen(0)).toBe(false)
    expect(toDrawerOpen(null)).toBe(false)
    expect(toDrawerOpen(undefined)).toBe(false)
    expect(toDrawerOpen({})).toBe(false)
    expect(toDrawerOpen([])).toBe(false)
  })

  it('toCloseHandler returns only callable values', () => {
    const fn = () => {}
    expect(toCloseHandler(fn)).toBe(fn)
    expect(toCloseHandler(undefined)).toBeUndefined()
    expect(toCloseHandler(null)).toBeUndefined()
    expect(toCloseHandler('close')).toBeUndefined()
    expect(toCloseHandler(42)).toBeUndefined()
    expect(toCloseHandler({})).toBeUndefined()
  })

  it('shouldCloseDrawerOnRouteChange only closes on a real path change', () => {
    expect(shouldCloseDrawerOnRouteChange('/', '/')).toBe(false)
    expect(shouldCloseDrawerOnRouteChange('/vaults', '/vaults')).toBe(false)
    expect(shouldCloseDrawerOnRouteChange('/', '/dashboard')).toBe(true)
    expect(shouldCloseDrawerOnRouteChange('/dashboard', '/')).toBe(true)
  })
})
