import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'
import * as os from 'node:os'

import createError from 'http-errors'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { getPackageOrgAndBasename } from '@liquid-labs/npm-toolkit'
import { Octocache } from '@liquid-labs/octocache'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { getPackageData } from './get-package-data'

/**
 * Implements verifying local status and destroying repositories on GitHub. Used by the named and implied project
 * destroy endpoints.
 */
const doDestroy = async({ app, cache, projectName, reporter, req, res }) => {
  const { confirmed = false, githubOwner, noCopy = false } = req.vars
  let destroyedGitHubProject, localCopyPath // results that go in the JSON return

  if (confirmed !== true) {
    throw createError.BadRequest("The 'confirmed' option must be set true.")
  }

  await checkGitHubAPIAccess() // throws HTTP Error on failure

  const pkgData = await getPackageData({ app, projectName, noThrow : true })

  let githubName
  if (pkgData !== undefined) {
    ({ githubName } = pkgData)
  }
  else if (githubOwner === undefined) {
    throw createError.BadRequest("It appears that the local project has been deleted already. In this case, the 'githubOwner' parameter is required.")
  }
  else {
    const { basename } = await getPackageOrgAndBasename({ pkgName : projectName })
    githubName = `${githubOwner}/${basename}`
  }

  // user may overrid the standard path v but usually won't
  const projectPath = req.vars.projectPath || pkgData?.projectPath

  const credDB = app.ext.credentialsDB
  const authToken = await credDB.getToken('GITHUB_API')

  const octocache = new Octocache({ authToken })
  try { // TODO: move to github-toolkit as 'deleteGitHubProject'
    reporter.push(`About to <em>delete<rst> of <code>${githubName}<rst>...`)
    await octocache.request(`DELETE /repos/${githubName}`)
    reporter.push('  success.')
    destroyedGitHubProject = githubName
  }
  catch (e) {
    throw createError.BadRequest(`There was a problem removing '${projectName}' from github (${githubName}): ${e.message}`, { cause : e })
  }

  let tmpDir
  if (noCopy !== true) {
    const tmpPrefix = fsPath.join(os.tmpdir(), projectName)
    tmpDir = await fs.mkdtemp(tmpPrefix)
    localCopyPath = await makeBackupCopy(({ projectName, projectPath, reporter, tmpDir }))
    localCopyPath = tmpDir
  }
  else {
    localCopyPath = null
  }

  if (pkgData === undefined) {
    reporter.push('Local project does not appear to exist anymore; nothing to delete.')
  }
  else {
    try {
      reporter.push(`About to <em>delete<rst> local copy of project <code>${projectName}<rst> from playground...`)
      await fs.rm(projectPath, { recursive : true })
      reporter.push('  success.')
    }
    catch (e) {
      throw createError.InternalServerError(`Project '${projectName}' was removed from GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause : e })
    }
  }

  const data = { destroyedGitHubProject, localCopyPath }

  let msg = reporter.taskReport.join('\n')
    + '\n\n'
    + `Removed '${projectName}' from GitHub and deleted project at '${projectPath}'.`
  if (noCopy !== true) msg += `Project has been temporarily saved at ${tmpDir}.`

  httpSmartResponse({ data, msg, req, res })
}

/**
 * Defines parameters for named and implied project destroy endpoints.
 */
const getDestroyEndpointParameters = ({ alternateTo, workDesc }) => {
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
      alternateTo,
      name        : `Work destroy (${workDesc})`,
      summray     : `Deletes the ${workDesc} project repository on GitHub and locally.`,
      description : `Attempts to delete the ${workDesc} project repository on GitHub and delete the local copy as well. In order to better avoid accidental deletion, the \`confirmed\` parameter must be set to \`true\`. By default, a copy of the project is made in the system's tmp directory unless \`noCopy\` is specified. `
    },
    method : 'delete',
    parameters
  }
}

const makeBackupCopy = async({ projectName, projectPath, reporter, tmpDir }) => {
  if (projectPath === undefined || existsSync(projectPath) === false) {
    throw new Error(`It appears that the project has already been deleted (projectPath: ${projectPath}); cannot make backup copy.`)
  }

  const fsSep = fsPath.sep
  try {
    reporter.push(`About to copy ${projectName} to ${tmpDir}...`)
    // TODO: why not just move? Then put the 'rm' in an else.
    // TODO: filter out based on '.gitignore'?
    await fs.cp(projectPath, tmpDir, {
      recursive : true,
      filter    : (src) => !src.match(new RegExp(`${fsSep}(?:.git|dist|node_modules)(?:${fsSep}|$)`))
    })
    reporter.push('  success.')
  }
  catch (e) {
    throw createError.InternalServerError(`Project '${projectName}' was removed from GitHub, but there was an error copying the local repo to temp.`, { cause : e })
  }
}

export { doDestroy, getDestroyEndpointParameters }
