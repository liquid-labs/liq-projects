/* global describe jest test */
import { func } from '../detail-implied'
import { doDetail } from '../_lib/detail-lib'
import { testNoXCWD } from './lib/test-no-x-cwd'
import { testCallsImplied } from './lib/test-calls-implied'

jest.mock('../_lib/detail-lib', () => ({
  ...(jest.requireActual('../_lib/detail-lib')),
  doDetail : jest.fn()
}))

describe('GET:/projects/detail', () => {
  test("calls 'doDetail' with 'projectName'", async() => {
    await testCallsImplied(doDetail, func)
  })

  testNoXCWD(func)
})
