import { getRetryAfterSeconds, YafetchPluginRetryResponse } from './index'

class FakeHeaders extends Map<string, string | null> {
  constructor(values: { [key: string]: string | null }) {
    super()
    Object.keys(values).forEach((key) => this.set(key.toLocaleLowerCase('en'), values[key]))
  }
}

jest.setTimeout(60000)

describe('@yafetch/plugin-retry unit tests', () => {
  it('can find the "Retry-After" header', () => {
    const aDate = new Date()
    aDate.setMilliseconds(120000) // +2min
    const inArrayHeaders = getRetryAfterSeconds({ headers: [['Content-Type', 'text/plain'], ['Retry-After', '30']] } as YafetchPluginRetryResponse)
    const inHeaders = getRetryAfterSeconds({ headers: new FakeHeaders({ 'Content-Type': 'text/plain', 'Retry-After': aDate.toLocaleString('en') }) } as unknown as YafetchPluginRetryResponse)
    const inObjHeaders = getRetryAfterSeconds({ headers: { 'Content-Type': 'text/plain', 'Retry-After': 60 } } as unknown as YafetchPluginRetryResponse)

    expect(inArrayHeaders).toBe(30)
    expect(inHeaders).toBe(120)
    expect(inObjHeaders).toBe(60)
  })

  it('prints a warning for invalid "Retry-After" header values', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { /** noop */ })
    const resultWhenNotExists = getRetryAfterSeconds({ headers: [['Content-Type', 'text/plain']] } as YafetchPluginRetryResponse)
    const resultWhenInvalidDate = getRetryAfterSeconds({ headers: [['Content-Type', 'text/plain'], ['Retry-After', new Date('bad date').toLocaleString('en')]] } as YafetchPluginRetryResponse)

    expect(resultWhenNotExists).toBeUndefined()
    expect(resultWhenInvalidDate).toBeUndefined()
    expect(warnSpy.mock.calls.length).toBe(2)

    warnSpy.mockReset()
    warnSpy.mockRestore()
  })
})
