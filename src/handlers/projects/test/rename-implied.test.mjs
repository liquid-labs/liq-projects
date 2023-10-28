/* global describe jest test */
import { func } from '../rename-implied'
import { doRename } from '../_lib/rename-lib'
import { testNoXCWD } from './lib/test-no-x-cwd'
import { testCallsImplied } from './lib/test-calls-implied'

jest.mock('../_lib/rename-lib', () => ({
  ...(jest.requireActual('../_lib/rename-lib')),
  doRename : jest.fn()
}))

describe('GET:/projects/rename', () => {
  test("calls 'doRename' with 'projectName'", async() => {
    await testCallsImplied(doRename, func)
  })

  testNoXCWD(func)
})
