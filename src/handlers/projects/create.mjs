import { doCreate, getCreateEndpointParameters } from './_lib/create-lib'

const { help, method, parameters } = getCreateEndpointParameters({ workDesc : 'named' })

const path = ['projects', 'create']

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  await doCreate({ app, reporter, res, req })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
