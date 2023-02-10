import * as fs from 'node:fs/promises'

import createError from 'http-errors'
import shell from 'shelljs'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { verifyClean, verifyMainBranchUpToDate } from '@liquid-labs/git-toolkit'

import { commonProjectPathParameters } from './_lib/common-project-path-parameters'
import { getPackageData } from './_lib/get-package-data'

const method = 'put'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'archive'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'archive']
]
const parameters = [
  {
    name        : 'keepLocal',
    isBoolean   : true,
    description : 'If true, then will not remove the local project repo.'
  },
  ...commonProjectPathParameters
]
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async(req, res) => {
  await checkGitHubAPIAccess() // throws HTTP Error on failure

  const { keepLocal = false, localProjectName, orgKey } = req.vars

  let projectPath = req.vars.projectPath

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath })

  const { projectFQN } = pkgData
  projectPath = pkgData.projectPath

  verifyMainBranchUpToDate({ reporter, ...pkgData })
  verifyClean({ reporter, ...pkgData })

  // TODO: move to github-toolkit as 'deleteGitHubProject'
  const result = shell.exec(`hub api --method PATCH -H "Accept: application/vnd.github+json" /repos/${projectFQN} -F archive=true`)
  if (result.code !== 0) throw createError.BadRequest(`There was a problem archiving '${projectFQN}' on github: ${result.stderr}`)

  if (keepLocal !== true) {
    try {
      await fs.rm(projectPath, { recursive : true })
    }
    catch (e) {
      throw createError.InternalServerError(`Project '${projectFQN}' was archived GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause : e })
    }

    model.refreshModel()
  }

  let msg = `Archived '<em>${projectFQN}<rst>' on GitHub and deleted project at '${projectPath}'.`
  if (keepLocal !== true) msg += ' Removed local project.'
  res.type('text/terminal').send(msg)
}

export {
  func,
  method,
  parameters,
  paths
}
