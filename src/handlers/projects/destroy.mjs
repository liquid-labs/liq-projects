import { doDestroy, getDestroyEndpointParameters } from './_lib/destroy-lib'

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'destroy'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'destroy']
]

const { help, method, parameters } = getDestroyEndpointParameters({ workDesc : 'named' })

const func = ({ app, cache, model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  await doDestroy({ app, cache, localProjectName, model, orgKey, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  paths
}
