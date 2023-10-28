/* global describe jest test */
import { func } from '../setup-implied'
import { doSetup } from '../_lib/setup-lib'
import { testNoXCWD } from './lib/test-no-x-cwd'
import { testCallsImplied } from './lib/test-calls-implied'

jest.mock('../_lib/setup-lib', () => ({
  ...(jest.requireActual('../_lib/setup-lib')),
  doSetup : jest.fn()
}))

describe('GET:/projects/setup', () => {
  test("calls 'doSetup' with 'projectName'", async() => {
    await testCallsImplied(doSetup, func)
  })

  testNoXCWD(func)
})
