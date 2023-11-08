/* global describe jest test */
import { func } from '../close-implied'
import { doClose } from '../_lib/close-lib'
import { testNoXCWD } from './lib/test-no-x-cwd'
import { testCallsImplied } from './lib/test-calls-implied'

jest.mock('../_lib/close-lib', () => ({
  ...(jest.requireActual('../_lib/close-lib')),
  doClose : jest.fn()
}))

describe('GET:/projects/close', () => {
  test("calls 'doClose' with 'projectName'", async() => {
    await testCallsImplied(doClose, func)
  })

  testNoXCWD(func)
})
