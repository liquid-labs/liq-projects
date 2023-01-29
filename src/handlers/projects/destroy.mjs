import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'
import shell from 'shelljs'

import { checkGitHubAPIAccess, deleteGitHubProject } from '@liquid-labs/github-toolkit'

import { commonProjectPathParameters } from './_lib/common-project-path-parameters'
import { getPackageData } from './_lib/get-package-data'

const method = 'delete'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'destroy'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'destroy']
]
const parameters = [ ...commonProjectPathParameters ]
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async (req, res) => {
  await checkGitHubAPIAccess() // throws HTTP Error on failure

  const {
    orgKey,
    localProjectName,
    newBaseName,
    noRenameDir=false
  } = req.vars

  let projectPath = req.vars.projectPath

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath })
  if (pkgData === false) return
  let { githubOrg, githubProjectName } = pkgData
  projectPath = pkgData.projectPath

  const result = shell.exec(`hub api --method DELETE -H "Accept: application/vnd.github+json" /repos/${githubProjectName}`)
  if (result.code !== 0) throw createError.BadRequest(`There was a problem removing '${githubProjectName}' from github: ${result.stderr}`)

  try {
    await fs.rm(projectPath, { recursive: true })
  }
  catch (e) {
    throw createError.InternalServerError(`Project '${githubProjectName}' was removed from GitHub, but there was an error removing the local project at '${projectPath}'. Check and address manually.`, { cause: e })
  }

  res.type('text/terminal').send(`Removed '${githubProjectName}' from GitHub and deleted project at '${projectPath}'.`)
}

export {
  func,
  method,
  parameters,
  paths
}
