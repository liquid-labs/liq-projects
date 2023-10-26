import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const { help, method, parameters } = getArchiveEndpointParameters({ workDesc : 'named' })

const path = ['projects', ':projectName', 'archive']

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doArchive({ app, projectName, reporter, res, req })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
