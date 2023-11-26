import createError from 'http-errors'

import { getGitHubOrgAndProjectBasename } from '@liquid-labs/github-toolkit'

/**
 * Retrieve the `package.json` data while extracting commonly useful bits.
 *
 * #### Parameters
 *
 * - `app`: the plugable-express application
 * - `projectName`: the project name ('.name' from the 'package.json' file)
 * - `requireImplements`: an array of strings representing tags expected to be found in 'package.json' under 'liq.tags'.
 *
 * #### Returns
 *
 * An info object containing:
 * - `githubName` the full project name on GitHub
 * - `githubOrg`: the GitHub organization associated to the project
 * - `pkgJSON`: the 'package.json' contents (as JSON object)`
 * - `projectPath`: the absolute path to the project on local disk
 */
const getPackageData = async({ app, projectName, noThrow }) => {
  const { packageJSON, projectPath } = await app.ext._liqProjects.playgroundMonitor.getProjectData(projectName) || {}
  if (packageJSON === undefined) {
    if (noThrow === true) {
      return undefined
    }
    else {
      throw createError.NotFound(`No such project '${projectName}' found in state model.`)
    }
  }
  // else we have what looks like a project

  const { org: githubOrg, projectBasename } = getGitHubOrgAndProjectBasename({ packageJSON })
  const githubName = githubOrg + '/' + projectBasename

  return {
    githubBasename : projectBasename,
    githubName,
    githubOrg,
    packageJSON,
    projectPath
  }
}

export { getPackageData }
