import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const path = ['projects', ':projectName', 'archive']

const { help, method, parameters } = getArchiveEndpointParameters({
  alternateTo : {
    altId     : '/projects/archive',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

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
