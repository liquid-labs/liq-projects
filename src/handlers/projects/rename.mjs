import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import shell from 'shelljs'

import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'

import { commonProjectPathParameters } from './_lib/common-project-path-parameters'
import { getPackageData } from './_lib/get-package-data'

const method = 'post'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'rename'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'rename']
]
const parameters = [
  {
    name        : 'newBaseName',
    isRequried  : true,
    description : 'The new base package name.'
  },
  {
    name : 'noRenameDir',
    isBoolean: true,
    description: 'Leaves the local project directory in place rather than trying to rename it to the new name.'
  },
  ...commonProjectPathParameters
]
parameters.sort((a, b) => a.name.localeCompare(b.name))
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async (req, res, next) => {
  await checkGitHubAPIAccess() // throws on failure

  const {
    orgKey,
    localProjectName,
    newBaseName,
    noRenameDir=false,
  } = req.vars

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath: req.vars.projectPath, res })
  if (pkgData === false) return
  let { githubOrg, githubProjectName, projectPath } = pkgData

  const report = []
  const cleanupFuncs = []

  if (noRenameDir === false) {
    const newProjectPath = fsPath.join(fsPath.dirname(projectPath), newBaseName)
    report.push(`Moving project from <code>${projectPath}<rst> to <code>${newProjectPath}<rst>...`)
    await fs.rename(projectPath, newProjectPath)
    projectPath = newProjectPath
  }
  // note 'projectPath' now points to the new location, if moved

  const newURL = `git@github.com:${githubOrg}/${newBaseName}.git`
  report.push(`Updating origin remote URL to ${newURL}...`)
  const urlResult = shell.exec(`cd ${projectPath} && git remote set-url origin ${newURL}`)
  if (urlResult.code !== 0) throw new Error(`There was a problem updating 'origin' remote URL to ${newURL}`)

  report.push(`Updating GitHub project name from ${localProjectName} to ${newBaseName}...`)
  const renameResult = shell.exec(`hub api --method PATCH -H "Accept: application/vnd.github+json" /repos/${githubProjectName} -f name='${newBaseName}'`)
  if (renameResult.code !== 0) throw new Error(`There was a problem renamin the remote project name. Update manually.`)

  res.type('text/terminal').send(report.join('\n'))
}

export {
  func,
  method,
  parameters,
  paths
}
