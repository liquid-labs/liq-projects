import { doDestroy, getDestroyEndpointParameters } from './_lib/destroy-lib'

const path = ['projects', ':projectName', 'destroy']

const { help, method, parameters } = getDestroyEndpointParameters({ workDesc : 'named' })

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doDestroy({ app, cache, projectName, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
