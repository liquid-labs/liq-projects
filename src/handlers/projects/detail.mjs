// TODO: we should do more with this; expose liq-specific info.
import { doDetail, getDetailEndpointParameters } from './_lib/detail-lib'

const path = ['projects', ':projectName', 'detail']

const { help, method, parameters } = getDetailEndpointParameters({
  alternateTo : {
    altlId    : '/projects/detail',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doDetail({ app, projectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
