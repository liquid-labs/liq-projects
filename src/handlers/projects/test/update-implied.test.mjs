/* global describe jest test */
import { func } from '../update-implied'
import { doUpdate } from '../_lib/update-lib'
import { testNoXCWD } from './lib/test-no-x-cwd'
import { testCallsImplied } from './lib/test-calls-implied'

jest.mock('../_lib/update-lib', () => ({
  ...(jest.requireActual('../_lib/update-lib')),
  doUpdate : jest.fn()
}))

describe('GET:/projects/update', () => {
  test("calls 'doUpdate' with 'projectName'", async() => {
    await testCallsImplied(doUpdate, func)
  })

  testNoXCWD(func)
})
