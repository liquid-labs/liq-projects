import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'
import shell from 'shelljs'

import { determineOriginAndMain } from '@liquid-labs/git-toolkit'
import { checkGitHubAPIAccess } from '@liquid-labs/github-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { getPackageOrgBasenameAndVersion } from '@liquid-labs/npm-toolkit'
import { Octocache } from '@liquid-labs/octocache'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { getPackageData } from './get-package-data'

/**
 * Provides common endpoint parameters for the document endpoints.
 */
const getRenameEndpointParameters = ({ alternateTo, workDesc }) => {
  const help = {
    alternateTo,
    name        : `Project rename (${workDesc})`,
    summary     : `Renames the ${workDesc} local and GitHub projects names and updates git configuration.`,
    description : `Renames the ${workDesc} local and GitHub projects names and updates git configuration. It is safe to make repeated calls and in the case of partial success, the process can be re-run is safe to repeat. By default, the process will do four things:

1. Rename the local project directory.
2. Rename the GitHub project.
3. Update the local repository origin remote URLs.
4. Update the <code>package.json<rst> name, URLs, and <code>main<rst> (where applicable).

There may be additional steps needed to complete the renaming process.`
  }

  const method = 'post'

  const parameters = [
    {
      name        : 'newName',
      isRequried  : true,
      description : 'The new full package name.'
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
const doRename = async({ app, projectName, reporter, req, res }) => {
  await checkGitHubAPIAccess({ reporter }) // throws on failure

  const { noRenameDir = false, noRenameGitHubProject = false } = req.vars
  let { newName } = req.vars

  // normalize name with leading '@' (unless base name package)
  if (!newName.startsWith('@') && newName.indexOf('/') !== -1) {
    newName = '@' + newName
  }

  let pkgData
  let origLocale = true
  try {
    reporter.push('Checking original project location...')
    pkgData = await getPackageData({ app, projectName })
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
      pkgData = await getPackageData({ app, projectName : newName })
    }
    catch (e) {
      if (e.statusCode === 404) {
        throw createError.NotFound(`Could not find package at default locations for either original ('${projectName}') or new ('${newName}') name.`, { cause : e })
      }
      else throw e
    }
    // then we definietly found a package definition in the new place.
  }

  // user may override the standard path v but usually won't
  let projectPath = req.vars.projectPath || pkgData.projectPath
  const { githubOrg, githubName, packageJSON } = pkgData

  const { basename: newBasename/*, org: newOrg */ } = await getPackageOrgBasenameAndVersion({ pkgSpec : newName })

  const newGitHubName = githubOrg + '/' + newBasename

  if (noRenameDir === true) reporter.push('Skipping dir rename per <code>noRenameDir<rst>.')
  else if (origLocale === false) reporter.push('Looks like dir ha already been renamed; skipping.')
  else {
    const newProjectPath = fsPath.join(app.ext._liqProjects.playgroundPath, newName.replace(/^@/, ''))
    reporter.push(`Moving project from <code>${projectPath}<rst> to <code>${newProjectPath}<rst>...`)
    await fs.rename(projectPath, newProjectPath)
    projectPath = newProjectPath
  }
  // note 'projectPath' now points to the new location, if moved

  const credDB = app.ext.credentialsDB
  const authToken = await credDB.getToken('GITHUB_API')

  const octocache = new Octocache({ authToken })

  if (noRenameGitHubProject === true) {
    reporter.push('Skipping GitHub project rename per <code>noRenameGitHubProject<rst>.')
  }
  else {
    try {
      await octocache.request(`GET /repos/${newGitHubName}`)
      reporter.push(`It appears '${githubName}' is already renamed in GitHub to '${newGitHubName}'.`)
    }
    catch (e) {
      if (e.status === 404) {
        reporter.push(`Updating GitHub project name from ${githubName} to ${newGitHubName}...`)
        await octocache.request(`PATCH /repos/${githubName}`, { name : newBasename })
      }
      else {
        throw e
      }
    }
  }

  const [originRemote] = determineOriginAndMain({ projectPath })
  const newURL = `git@github.com:${newGitHubName}.git`
  reporter.push(`Updating origin remote URL to ${newURL}...`)
  const urlResult = shell.exec(`cd '${projectPath}' && git remote set-url ${originRemote} ${newURL}`)
  if (urlResult.code !== 0) throw new Error(`There was a problem updating 'origin' remote URL to ${newURL}`)

  packageJSON.name = newName
  const repositoryURL = packageJSON.repository?.url || packageJSON.repository
  packageJSON.repository = {
    url  : repositoryURL.replace(new RegExp(githubName + '\\.git$'), newGitHubName + '.git'),
    type : 'git'
  }
  packageJSON.bugs.url = packageJSON.bugs.url.replace(new RegExp(githubName + '/issues'), newGitHubName + '/issues')
  packageJSON.homepage = packageJSON.homepage.replace(new RegExp(githubName + '#readme'), newGitHubName + '#readme')
  if (packageJSON.main !== undefined) {
    packageJSON.main = packageJSON.main.replace(new RegExp(githubName + '.js'), newGitHubName + '.js')
  }
  const pkgPath = fsPath.join(projectPath, 'package.json')
  reporter.push(`Updating <code>${pkgPath}<rst> with new project name '${newName}`)
  await fs.writeFile(pkgPath, JSON.stringify(packageJSON, null, '  '))

  const msg = reporter.taskReport.join('\n') + '\n\n'
    + `<em>Renamed<rst> <code>${projectName}<rst> to <code>${newName}<rst>.`
  httpSmartResponse({ msg, req, res })
}

export { doRename, getRenameEndpointParameters }
