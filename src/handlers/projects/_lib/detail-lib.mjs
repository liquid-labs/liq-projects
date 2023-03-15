// TODO: we should do more with this; expose liq-specific info. Right now, we're duplicating playground/projects/get-package
import createError from 'http-errors'

import { httpSmartResponse } from '@liquid-labs/http-smart-response'

/**
 * Implements detailing a project. Used by the named and implied project detail endpoints.
 */
const doDetail = ({ localProjectName, model, orgKey, req, res }) => {
  const projectFQN = orgKey + '/' + localProjectName

  const projectData = model.playground.projects[projectFQN]
  if (projectData === undefined) throw createError.NotFound(`No such project '${projectFQN}'.`)

  httpSmartResponse({ data : projectData, msg : `Retrieved project '${projectFQN}'.`, req, res })
}

/**
 * Defines parameters for named and implied project detail endpoints.
 */
const getDetailEndpointParameters = ({ workDesc }) => {
  const parameters = []
  Object.freeze(parameters)

  return {
    help : {
      name        : `Project detail (${workDesc})`,
      summary     : `Details the ${workDesc} project.`,
      description : `Provides detailed information about the ${workDesc} project.`
    },
    method : 'get',
    parameters
  }
}

export { doDetail, getDetailEndpointParameters }
