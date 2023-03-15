import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const { help, method, parameters } = getArchiveEndpointParameters({ workDesc : 'named' })

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'archive'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'archive']
]

const func = ({ app, cache, model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  await doArchive({ app, cache, model, orgKey, localProjectName, reporter, res, req })
}

export {
  help,
  func,
  method,
  parameters,
  paths
}
