/* global describe jest test */
import { func } from '../document-implied'
import { doDocument } from '../_lib/document-lib'
import { testNoXCWD } from './lib/test-no-x-cwd'
import { testCallsImplied } from './lib/test-calls-implied'

jest.mock('../_lib/document-lib', () => ({
  ...(jest.requireActual('../_lib/document-lib')),
  doDocument : jest.fn()
}))

describe('GET:/projects/document', () => {
  test("calls 'doDocument' with 'projectName'", async() => {
    await testCallsImplied(doDocument, func)
  })

  testNoXCWD(func)
})
