/* global describe jest test */
import { func } from '../archive-implied'
import { doArchive } from '../_lib/archive-lib'
import { testCallsImplied } from './lib/test-calls-implied'
import { testNoXCWD } from './lib/test-no-x-cwd'

jest.mock('../_lib/archive-lib', () => ({
  ...(jest.requireActual('../_lib/archive-lib')),
  doArchive : jest.fn()
}))

describe('GET:/projects/archive', () => {
  test("calls 'doArchive' with 'projectName'", async() => {
    await testCallsImplied(doArchive, func)
  })

  testNoXCWD(func)
})
