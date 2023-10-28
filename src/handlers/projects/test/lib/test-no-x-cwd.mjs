/* global expect test */

const testNoXCWD = (func) => {
  test('raises an exception when X-CWD is not provided', async() => {
    const reporterMock = { isolate : () => {} }
    const reqMock = { get : () => undefined }

    const handler = func({ reporter : reporterMock })
    try {
      await handler(reqMock)
      throw new Error('did not throw as expected')
    }
    catch (e) {
      expect(e.message).toMatch(/'X-CWD' header not found/)
    }
  })
}

export { testNoXCWD }
