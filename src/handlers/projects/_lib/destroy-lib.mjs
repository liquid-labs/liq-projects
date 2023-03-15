import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'
import * as os from 'node:os'

import createError from 'http-errors'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { CredentialsDB, purposes } from '@liquid-labs/liq-credentials-db'
import { Octocache } from '@liquid-labs/octocache'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { getPackageData } from './get-package-data'

const doDestroy = async({ app, cache, localProjectName, model, orgKey, reporter, req, res }) => {
  const { confirmed = false, noCopy = false } = req.vars

  if (confirmed !== true) {
    throw createError.BadRequest("The 'confirmed' option must be set true.")
  }

  await checkGitHubAPIAccess() // throws HTTP Error on failure

  let projectPath = req.vars.projectPath

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath })

  const { githubOrg, projectBaseName, projectFQN } = pkgData
  projectPath = pkgData.projectPath

  const credDB = new CredentialsDB({ app, cache })
  const authToken = credDB.getToken(purposes.GITHUB_API)

  const octocache = new Octocache({ authToken })
  try { // TODO: move to github-toolkit as 'deleteGitHubProject'
    reporter.push(`About to <em>delete<rst> of <code>${githubOrg}/${projectBaseName}<rst>...`)
    await octocache.request(`DELETE /repos/${githubOrg}/${projectBaseName}`)
    reporter.push('  success.')
  }
  catch (e) {
    throw createError.BadRequest(`There was a problem removing '${projectFQN}' from github: ${e.message}`, { cause : e })
  }

  let tmpDir
  if (noCopy !== true) {
    const tmpPrefix = fsPath.join(os.tmpdir(), orgKey + '-' + localProjectName)
    const fsSep = fsPath.sep
    try {
      reporter.push(`About to copy ${projectFQN} to ${tmpDir}...`)
      tmpDir = await fs.mkdtemp(tmpPrefix)
      // TODO: why not just move? Then put the 'rm' in an else.
      // TODO: filter out based on '.gitignore'?
      await fs.cp(projectPath, tmpDir, {
        recursive : true,
        filter    : (src) => !src.match(new RegExp(`${fsSep}(?:.git|dist|node_modules)(?:${fsSep}|$)`))
      })
      reporter.push('  success.')
    }
    catch (e) {
      throw createError.InternalServerError(`Project '${projectFQN}' was removed from GitHub, but there was an error copying the local repo to temp.`, { cause : e })
    }
  }

  try {
    reporter.push(`About to <em>delete<rst> local copy of project <code>${projectFQN}<rst> from playground...`)
    await fs.rm(projectPath, { recursive : true })
    reporter.push('  success.')
  }
  catch (e) {
    throw createError.InternalServerError(`Project '${projectFQN}' was removed from GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause : e })
  }

  model.refreshModel()

  let msg = reporter.taskReport.join('\n')
    + '\n\n'
    + `Removed '${projectFQN}' from GitHub and deleted project at '${projectPath}'.`
  if (noCopy !== true) msg += `Project has been temporarily saved at ${tmpDir}.`

  httpSmartResponse({ msg, req, res })
}

const getDestroyEndpointParameters = ({ workDesc }) => {
  const parameters = [
    {
      name        : 'noCopy',
      isBoolean   : true,
      description : 'Skips the default backup copy made to tmp.'
    },
    {
      name        : 'confirmed',
      isRequired  : true,
      isBoolean   : true,
      description : 'In order to better prevent accidental destruction, the `confirmed` option must be specified or the process exits.'
    },
    ...commonProjectPathParameters
  ]
  Object.freeze(parameters)

  return {
    help : {
      name        : `Work destroy (${workDesc})`,
      summray     : `Deletes the ${workDesc} project repository on GitHub and locally.`,
      description : `Attempts to delete the ${workDesc} project repository on GitHub and delete the local copy as well. In order to better avoid accidental deletion, the \`confirmed\` parameter must be set to \`true\`. By default, a copy of the project is made in the system's tmp directory unless \`noCopy\` is specified. `
    },
    method : 'delete',
    parameters
  }
}

export { doDestroy, getDestroyEndpointParameters }
