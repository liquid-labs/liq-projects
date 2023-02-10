// TODO: we should do more with this; expose liq-specific info. Right now, we're duplicating playground/projects/get-package
import createError from 'http-errors'

import { httpSmartResponse } from '@liquid-labs/http-smart-response'

const method = 'get'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'detail'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'detail']
]
const parameters = []
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async(req, res) => {
  const { localProjectName, orgKey } = req.vars
  const projectFQN = orgKey + '/' + localProjectName

  const projectData = model.playground.projects[projectFQN]
  if (projectData === undefined) throw createError.NotFound(`No such project '${projectFQN}'.`)

  httpSmartResponse({ data: projectData, msg: `Retrieved project '${projectFQN}'.`, req, res })
}

export {
  func,
  method,
  parameters,
  paths
}
