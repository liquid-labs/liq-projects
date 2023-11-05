import { doSetup, getSetupEndpointParameters } from './_lib/setup-lib'

const path = ['projects', ':projectName', 'setup']

const { help, method, parameters } = getSetupEndpointParameters({
  alternateTo : {
    altId     : '/projects/setup',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doSetup({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
