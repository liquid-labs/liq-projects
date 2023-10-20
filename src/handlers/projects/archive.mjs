import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const { help, method, parameters } = getArchiveEndpointParameters({ workDesc : 'named' })

const paths = ['projects', ':projectName', 'archive']

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doArchive({ app, cache, projectName, reporter, res, req })
}

export {
  help,
  func,
  method,
  parameters,
  paths
}
