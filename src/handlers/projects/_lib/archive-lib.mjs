import * as fs from 'node:fs/promises'

import createError from 'http-errors'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { verifyClean, verifyMainBranchUpToDate } from '@liquid-labs/git-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { Octocache } from '@liquid-labs/octocache'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { getPackageData } from './get-package-data'

/**
 * Implements verifying local status and archiving repositories on GitHub. Used by the named and implied project
 * archive endpoints.
 */
const doArchive = async({ app, projectName, reporter, res, req }) => {
  await checkGitHubAPIAccess() // throws HTTP Error on failure

  const { keepLocal = false } = req.vars

  const pkgData = await getPackageData({ app, projectName })

  const { githubName } = pkgData
  // user may overrid the standard path v but usually won't
  const projectPath = req.vars.projectPath || pkgData.projectPath

  verifyMainBranchUpToDate({ reporter, ...pkgData })
  verifyClean({ reporter, ...pkgData })

  // TODO: move to github-toolkit as 'deleteGitHubProject'
  const credDB = app.ext.credentialsDB
  const authToken = await credDB.getToken('GITHUB_API')

  const octocache = new Octocache({ authToken })
  try {
    reporter.push(`About to achive ${githubName} on GitHub...`)
    await octocache.request(`PATCH /repos/${githubName}`, { archived : true })
    reporter.push('  success.')
  }
  catch (e) {
    throw createError.BadRequest(`There was a problem archiving '${projectName}' on github: ${e.message}`, { cause : e })
  }

  if (keepLocal !== true) {
    try {
      reporter.push(`About to <em>delete<rst> local project at <code>${projectPath}<rst>...`)
      await app.ext._liqProjects.playgroundMonitor.close()
      await fs.rm(projectPath, { force: true, recursive : true })
      reporter.push('  success.')
    }
    catch (e) {
      throw createError.InternalServerError(`Project '${projectName}' was archived on GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause : e })
    }
    finally {
      await app.ext._liqProjects.playgroundMonitor.refreshProjects()
    }
  }
  else {
    reporter.push('Skipping deletion of local project.')
  }

  let msg = reporter.taskReport.join('\n') + '\n\n' + `<em>Archived<rst> '<code>${projectName}<rst>' on GitHub.`
  if (keepLocal !== true) msg += ' <em>Removed local project<rst>.'

  httpSmartResponse({ msg, req, res })
}

/**
 * Defines parameters for named and implied project archive endpoints.
 */
const getArchiveEndpointParameters = ({ alternateTo, workDesc }) => {
  const parameters = [
    {
      name        : 'keepLocal',
      isBoolean   : true,
      description : 'If true, then will not remove the local project repo.'
    },
    ...commonProjectPathParameters
  ]
  Object.freeze(parameters)

  return {
    help : {
      alternateTo,
      name        : `Project archive (${workDesc})`,
      summary     : `Archives the ${workDesc} project.`,
      description : `Archives the repository associated with the ${workDesc} project on GitHub and deletes the local project. Use \`keepLocal\` to retain the local project.`
    },
    method : 'put',
    parameters
  }
}

export { doArchive, getArchiveEndpointParameters }
