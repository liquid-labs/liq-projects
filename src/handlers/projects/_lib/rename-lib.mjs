import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'
import shell from 'shelljs'

import { determineOriginAndMain } from '@liquid-labs/git-toolkit'
import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { getPackageData } from './get-package-data'

/**
 * Provides common endpoint parameters for the document endpoints.
 */
const getRenameEndpointParameters = ({ workDesc }) => {
  const help = {
    name        : `Project rename (${workDesc})`,
    summary     : `Renames the ${workDesc} local and GitHub projects names and updates git configuration.`,
    description : `Renames the ${workDesc} local and GitHub projects names and updates git configuration. It is safe to make repeated calls and in the case of partial success, the process can be re-run is safe to repeat. By default, the process will do four things:

1. Rename the local project directory.
2. Rename the GitHub project.
3. Update the local repository origin remote URLs.
4. Update the <code>package.json<rst> name, URLs, and <code>main<rst> (where applicable).`
  }

  const method = 'post'

  const parameters = [
    {
      name        : 'newBaseName',
      isRequried  : true,
      description : 'The new base package name.'
    },
    {
      name        : 'noRenameDir',
      isBoolean   : true,
      description : 'Leaves the local project directory in place rather than trying to rename it to the new name.'
    },
    {
      name        : 'noRenameGitHubProject',
      isBoolean   : true,
      description : 'Leaves the GitHub project in place rather than trying to rename it to the new name.'
    },
    ...commonProjectPathParameters
  ]
  parameters.sort((a, b) => a.name.localeCompare(b.name))
  Object.freeze(parameters)

  return { help, method, parameters }
}

/**
 * Implements common rename logic for the named and implied rename endpoints.
 */
const doRename = async({ localProjectName, model, orgKey, reporter, req, res }) => {
  await checkGitHubAPIAccess({ reporter }) // throws on failure

  const { newBaseName, noRenameDir = false, noRenameGitHubProject = false } = req.vars

  let pkgData
  let origLocale = true
  try {
    reporter.push('Checking original project location...')
    pkgData = await getPackageData({ localProjectName, model, orgKey })
    reporter.push('  Found.')
  }
  catch (e) {
    if (e.statusCode === 404 && req.vars.projectPath === undefined) {
      origLocale = false
    }
    else throw e
  }

  if (origLocale === false) {
    try {
      reporter.push('Checking new project location (for partial rename)...')
      pkgData = await getPackageData({ orgKey, localProjectName : newBaseName })
    }
    catch (e) {
      if (e.statusCode === 404) {
        throw createError.NotFound(`Could not find package at under default locations for either original ('${localProjectName}') or new ('${newBaseName}') name.`, { cause : e })
      }
      else throw e
    }
    // then we definietly found a package definition in the new place.
  }

  // user may overrid the standard path v but usually won't
  let projectPath = req.vars.projectPath || pkgData.projectPath
  const { githubOrg, packageSpec, projectFQN } = pkgData

  if (noRenameDir === true) reporter.push('Skipping dir rename per <code>noRenameDir<rst>.')
  else if (origLocale === false) reporter.push('Looks like dir ha already been renamed; skipping.')
  else {
    const newProjectPath = fsPath.join(fsPath.dirname(projectPath), newBaseName)
    reporter.push(`Moving project from <code>${projectPath}<rst> to <code>${newProjectPath}<rst>...`)
    await fs.rename(projectPath, newProjectPath)
    projectPath = newProjectPath
  }
  // note 'projectPath' now points to the new location, if moved

  if (noRenameGitHubProject === true) { reporter.push('Skipping GitHub project rename per <code>noRenameGitHubProject<rst>.') }
  else {
    const projCheckResult = 
      shell.exec(`gh api -H "Accept: application/vnd.github+json" /repos/${githubOrg}/${newBaseName}`)
    if (projCheckResult.code === 0) { reporter.push(`It appears '${githubOrg}/${localProjectName}' is already renamed in GitHub to '${newBaseName}'.`) }
    else {
      reporter.push(`Updating GitHub project name from ${localProjectName} to ${newBaseName}...`)
      const renameResult = shell.exec(`hub api --method PATCH -H "Accept: application/vnd.github+json" /repos/${projectFQN} -f name='${newBaseName}'`)
      if (renameResult.code !== 0) { throw new Error('There was a problem renaming the remote project name. Update manually.') }
    }
  }

  const [originRemote] = determineOriginAndMain({ projectPath : projectPath })
  const newURL = `git@github.com:${githubOrg}/${newBaseName}.git`
  reporter.push(`Updating origin remote URL to ${newURL}...`)
  const urlResult = shell.exec(`cd ${projectPath} && git remote set-url ${originRemote} ${newURL}`)
  if (urlResult.code !== 0) throw new Error(`There was a problem updating 'origin' remote URL to ${newURL}`)

  const newFQN = `${githubOrg}/${newBaseName}`
  packageSpec.name = `@${newFQN}`
  const repositoryURL = packageSpec.repository?.url || packageSpec.repository
  packageSpec.repository = {
    url  : repositoryURL.replace(new RegExp(localProjectName + '\\.git$'), newBaseName + '.git'),
    type : 'git'
  }
  packageSpec.bugs.url = packageSpec.bugs.url.replace(new RegExp(localProjectName + '/issues'), newBaseName + '/issues')
  packageSpec.homepage = packageSpec.homepage.replace(new RegExp(localProjectName + '#readme'), newBaseName + '#readme')
  if (packageSpec.main !== undefined) {
    packageSpec.main = packageSpec.main.replace(new RegExp(localProjectName + '.js'), newBaseName + '.js')
  }
  const pkgPath = fsPath.join(projectPath, 'package.json')
  reporter.push(`Updating <code>${pkgPath}<rst> with new project name '${newFQN}`)
  await fs.writeFile(pkgPath, JSON.stringify(packageSpec, null, '  '))

  model.refreshModel()

  const msg = reporter.taskReport.join('\n') + '\n\n'
    + `<em>Renamed<rst> <code>${projectFQN}<rst> to <code>${newFQN}<rst>.`
  httpSmartResponse({ msg, req, res })
}

export { doRename, getRenameEndpointParameters }
