import createError from 'http-errors'

import { getGitHubOrgAndProject } from '@liquid-labs/github-toolkit'

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
const getPackageData = async({ app, projectName }) => {
  const { pkgJSON, projectPath } = app.ext._liqProjects.playgroundMonitor.getProjectData(projectName)?.pkgJSON || {}
  if (pkgJSON === undefined) {
    throw createError.NotFound(`No such project '${projectName}' found in state model.`)
  }
  // else we have what looks like a project

  const { org: githubOrg, project } = getGitHubOrgAndProject({ packageJSON : pkgJSON })
  const githubName = githubOrg + '/' + project

  return {
    githubBasename : project,
    githubName,
    githubOrg,
    pkgJSON,
    projectPath
  }
}

export { getPackageData }
