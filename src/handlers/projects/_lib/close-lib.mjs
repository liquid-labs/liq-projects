// TODO: we should do more with this; expose liq-specific info.
import * as fs from 'node:fs/promises'

import createError from 'http-errors'

import { verifyClean, verifyLocalChangesSaved, verifyOnlyMainBranch } from '@liquid-labs/git-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'

/**
 * Implements 'closing' a project. This means deleting the local repo clone if all the changes are reflected on origin.
 */
const doClose = async({ app, projectName, reporter, req, res }) => {
  const projectData = app.ext._liqProjects.playgroundMonitor.getProjectData(projectName)
  if (projectData === undefined) throw createError.NotFound(`No such project '${projectName}'.`)

  const { projectPath } = projectData

  reporter.log(`Verify safe to delete local repo clone at ${projectPath}...`)
  verifyClean({ projectPath, reporter })
  const [origin, mainBranch] = verifyOnlyMainBranch({ projectPath, reporter })
  verifyLocalChangesSaved({ branch: mainBranch, origin, projectPath, reporter })
  // if we get here, then it's safe to delete the local copy...
  reporter.log('Attempting to delete local copy...')
  try {
    await app.ext._liqProjects.playgroundMonitor.close()
    await fs.rm(projectPath, { force: true, recursive: true })
  }
  finally {
    app.ext._liqProjects.playgroundMonitor.refreshProjects()
  }

  httpSmartResponse({ msg : `Closed local project '${projectName}'.`, req, res })
}

/**
 * Defines parameters for named and implied project close endpoints.
 */
const getCloseEndpointParameters = ({ alternateTo, workDesc }) => {
  const parameters = []
  Object.freeze(parameters)

  return {
    help : {
      alternateTo,
      name        : `Close project (${workDesc})`,
      summary     : `Closes the ${workDesc} project.`,
      description : `Closes the local the ${workDesc} project after checking that everything has been saved remotely.`
    },
    method : 'delete',
    parameters
  }
}

export { doClose, getCloseEndpointParameters }
