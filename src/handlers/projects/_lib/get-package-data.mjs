import * as fsPath from 'node:path'

import createError from 'http-errors'

import { LIQ_PLAYGROUND } from '@liquid-labs/liq-defaults'

/**
 * Retrieve the `package.json` data while extracting commonly useful bits.
 *
 * #### Parameters
 *
 * - `localProjectName`: (req) the local project base name within the org directory of the liq playground.
 * - `model`: (req) the liq state model
 * - `orgKey`: (req) the liq org key, corresponding to a local playground presence.
 * - `requireImplements`: (opt) if set, then will investigation the `.liq.tags` in `package.json` for the required
 *   implementation tags.
 *
 * #### Returns
 *
 * An info object containing:
 * - `githubOrg`: the github org as extracted from the `package.json` `.name` field.
 * - `projectBaseName`: the github project name as extracted from the `package.json` `.name` field.
 * - `packageSpec`: the `package.json` data
 * - `projectFQN`: the fully qualified project name as extracted from the `package.json` `.name` field.
 * - 'projectPath': the inferred/standard project path; user should ignore if the project path is explicitly overriden
 */
const getPackageData = async({ localProjectName, model, orgKey, requireImplements }) => {
  const projectFQN = orgKey + '/' + localProjectName
  const packageSpec = model.playground.projects.get(projectFQN)?.packageJSON
  if (packageSpec === undefined) {
    throw createError.NotFound(`No such project '${projectFQN}' found in state model.`)
  }

  const projectPath = fsPath.join(LIQ_PLAYGROUND(), orgKey, localProjectName)
  // else we have what looks like a project

  const githubOrg = model.orgs[orgKey].getSetting('github.ORG_NAME')

  for (const reqImpl of requireImplements || []) {
    const isImplemented = packageSpec?.liq?.tags?.includes(reqImpl)
    if (isImplemented !== true) {
      throw createError.BadRequest(`The package spec does not mark required implementation '${reqImpl}'.`)
    }
  }

  return {
    githubOrg,
    projectBaseName : localProjectName, // TODO: does anyone use this? The caller already knows it...
    packageSpec,
    projectFQN,
    projectPath
  }
}

export { getPackageData }
