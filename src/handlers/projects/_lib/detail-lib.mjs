// TODO: we should do more with this; expose liq-specific info.
import createError from 'http-errors'

import { httpSmartResponse } from '@liquid-labs/http-smart-response'

/**
 * Implements detailing a project. Used by the named and implied project detail endpoints.
 */
const doDetail = async({ app, projectName, req, res }) => {
  const projectData = await app.ext._liqProjects.playgroundMonitor.getProjectData(projectName)
  if (projectData === undefined) throw createError.NotFound(`No such project '${projectName}'.`)

  httpSmartResponse({ data : projectData, msg : `Retrieved project '${projectName}'.`, req, res })
}

/**
 * Defines parameters for named and implied project detail endpoints.
 */
const getDetailEndpointParameters = ({ alternateTo, workDesc }) => {
  const parameters = []
  Object.freeze(parameters)

  return {
    help : {
      alternateTo,
      name        : `Project detail (${workDesc})`,
      summary     : `Details the ${workDesc} project.`,
      description : `Provides detailed information about the ${workDesc} project.`
    },
    method : 'get',
    parameters
  }
}

export { doDetail, getDetailEndpointParameters }
