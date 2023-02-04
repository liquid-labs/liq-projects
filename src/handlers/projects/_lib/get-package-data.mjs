import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'

/**
 * Retrieve the `package.json` data while extracting commonly useful bits.
 *
 * #### Parameters
 *
 * - `localProjectName`: the local project base name within the org directory of the liq playground.
 * - `orgKey`: the liq org key, corresponding to a local playground presence.
 * - `projectPath`: where to look for the `package.json` file. You must provide either this parameter or both `orgKey`
 *    and `localProjectName`.`
 * - `requireImplements`: if set, then will investigation the `.liq.tags` in `package.json` for the required
 *   implementation tags.
 *
 * #### Returns
 *
 * An info object containing:
 * - `githubOrg`: the github org as extracted from the `package.json` `.name` field.
 * - `githubProjectBaseName`: the github project name as extracted from the `package.json` `.name` field.
 * - `packageSpec`: the `package.json` data
 * - `projectFQN`: the fully qualified project name as extracted from the `package.json` `.name` field.
 * - `projectPath`: a reflection if passed in or, if not, constructed from the default location
 */
const getPackageData = async({ orgKey, localProjectName, projectPath, requireImplements }) => {
  const liqPlayground = fsPath.join(process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq'), 'playground')
  projectPath = projectPath || fsPath.join(liqPlayground, orgKey, localProjectName)
  const projectPkgPath = fsPath.join(projectPath, 'package.json')

  if (!existsSync(projectPkgPath)) {
    throw createError.NotFound(`Could not locate local package file for project <code>${localProjectName}<rst>. Perhaps the project needs to be imported.`)
  }
  // else we have what looks like a project
  let packageSpec
  try {
    const packageContents = await fs.readFile(projectPkgPath)
    packageSpec = JSON.parse(packageContents)
  }
  catch (e) {
    throw createError.BadRequest(`Could not process package definition. Ensure local project <code>${localProjectName}<rst> checkout contains a valid <code>package.json<rst> file. (${e.message})`)
  }

  let projectFQN = packageSpec.name
  if (projectFQN.startsWith('@')) projectFQN = projectFQN.slice(1)
  const [githubOrg, githubProjectBaseName] = projectFQN.split('/')

  for (const reqImpl of requireImplements || []) {
    const isImplemented = packageSpec?.liq?.tags?.includes(reqImpl)
    if (isImplemented !== true) {
      throw createError.BadRequest(`The package spec does not mark required implementation '${reqImpl}'.`)
    }
  }

  return {
    githubOrg,
    githubProjectBaseName,
    packageSpec,
    projectFQN,
    projectPath
  }
}

export { getPackageData }
