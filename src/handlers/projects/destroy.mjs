import * as fs from 'node:fs/promises'

import createError from 'http-errors'
import shell from 'shelljs'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'

import { commonProjectPathParameters } from './_lib/common-project-path-parameters'
import { getPackageData } from './_lib/get-package-data'

const method = 'delete'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'destroy'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'destroy']
]
const parameters = [...commonProjectPathParameters]
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async(req, res) => {
  await checkGitHubAPIAccess() // throws HTTP Error on failure

  const { orgKey, localProjectName } = req.vars

  let projectPath = req.vars.projectPath

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath })

  const { projectFQN } = pkgData
  projectPath = pkgData.projectPath

  // TODO: move to github-toolkit as 'deleteGitHubProject'
  const result = shell.exec(`hub api --method DELETE -H "Accept: application/vnd.github+json" /repos/${projectFQN}`)
  if (result.code !== 0) throw createError.BadRequest(`There was a problem removing '${projectFQN}' from github: ${result.stderr}`)

  try {
    await fs.rm(projectPath, { recursive : true })
  }
  catch (e) {
    throw createError.InternalServerError(`Project '${projectFQN}' was removed from GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause : e })
  }

  res.type('text/terminal').send(`Removed '${projectFQN}' from GitHub and deleted project at '${projectPath}'.`)
}

export {
  func,
  method,
  parameters,
  paths
}
