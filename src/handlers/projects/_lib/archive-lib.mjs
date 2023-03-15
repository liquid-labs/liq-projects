import * as fs from 'node:fs/promises'

import createError from 'http-errors'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { verifyClean, verifyMainBranchUpToDate } from '@liquid-labs/git-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { CredentialsDB, purposes } from '@liquid-labs/liq-credentials-db'
import { Octocache } from '@liquid-labs/octocache'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { getPackageData } from './get-package-data'

/**
 * Implements verifying local status and archiving repositories on GitHub. Used by the named and implied project
 * archive endpoints.
 */
const doArchive = async({ app, cache, model, orgKey, localProjectName, reporter, res, req }) => {
  await checkGitHubAPIAccess() // throws HTTP Error on failure

  const { keepLocal = false } = req.vars

  let projectPath = req.vars.projectPath // may be undefined; that's OK; getPackageData will infer the default location

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath })

  const { githubOrg, projectBaseName, projectFQN } = pkgData
  projectPath = pkgData.projectPath

  verifyMainBranchUpToDate({ reporter, ...pkgData })
  verifyClean({ reporter, ...pkgData })

  // TODO: move to github-toolkit as 'deleteGitHubProject'
  const credDB = new CredentialsDB({ app, cache })
  const authToken = credDB.getToken(purposes.GITHUB_API)

  const octocache = new Octocache({ authToken })
  try {
    reporter.push(`About to achive ${githubOrg}/${projectBaseName} on GitHub...`)
    const results = await octocache.request(`PATCH /repos/${githubOrg}/${projectBaseName}`, { archived : true })
    reporter.push('  success.')
    console.log(results)
  }
  catch (e) {
    throw createError.BadRequest(`There was a problem archiving '${projectFQN}' on github: ${e.message}`, { cause : e })
  }

  if (keepLocal !== true) {
    try {
      rporter.push(`About to <em>delete<rst> local project at <code>${projectPath}<rst>...`)
      await fs.rm(projectPath, { recursive : true })
      reporter.push('  success.')
    }
    catch (e) {
      throw createError.InternalServerError(`Project '${projectFQN}' was archived on GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause : e })
    }

    model.refreshModel()
  }
  else {
    reporter.push('Skipping deletion of local project.')
  }

  let msg = reporter.taskReport.join('\n') + '\n\n' + `<em>Archived<rst> '<code>${projectFQN}<rst>' on GitHub.`
  if (keepLocal !== true) msg += ' <em>Removed local project<rst>.'

  httpSmartResponse({ msg, req, res })
}

/**
 * Defines parameters for named and implied project archive endpoints.
 */
const getArchiveEndpointParameters = ({ workDesc }) => {
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
      name        : 'Project archive',
      summary     : `Archives the ${workDesc} project.`,
      description : `Archives the repository associated with the ${workDesc} project on GitHub.`
    },
    method : 'put',
    parameters
  }
}

export { doArchive, getArchiveEndpointParameters }
