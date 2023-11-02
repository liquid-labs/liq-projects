import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'
import shell from 'shelljs'

import { readFJSON, writeFJSON } from '@liquid-labs/federated-json'
import {
  checkGitHubAPIAccess,
  checkGitHubSSHAccess,
  setupGitHubLabels,
  setupGitHubMilestones
} from '@liquid-labs/github-toolkit'
import { LIQ_PLAYGROUND } from '@liquid-labs/liq-defaults'
import { getPackageOrgAndBasename } from '@liquid-labs/npm-toolkit'

import { commonProjectSetupParameters } from './common-project-setup-parameters'
import { DEFAULT_LICENSE, DEFAULT_VERSION } from './common-constants'

const doCreate = async({ app, reporter, req, res }) => {
  const {
    description,
    license,
    newProjectName,
    noCleanup,
    noFork = false,
    public : publicRepo = false,
    retainLeadingAt,
    skipLabels,
    skipMilestones,
    version = DEFAULT_VERSION
  } = req.vars

  // regularize to follow NPM convention of prepending org name with a '@'
  if (!newProjectName.startsWith('@') && newProjectName.indexOf('/') !== -1) {
    newProjectName = '@' + newProjectName
  }

  let orgGithubName = req.vars.githubOwner
  // note the 'nmpOrg' here does NOT start with tho '@'
  const { org: npmOrg, basename } = await getPackageOrgAndBasename({ pkgName : newProjectName })
  if (orgGithubName === undefined) {
    orgGithubName = npmOrg // comes out sans '@'
  // TODO: check that we can access this org or something
  }

  if (orgGithubName === undefined) {
    throw createError.BadRequest("'githubOwner' was not defined and could not be determined from 'newProjectName'.")
  }

  reporter.push('Checking GitHub SSH access...')
  checkGitHubSSHAccess({ reporter }) // the check will throw HTTP errors or failure
  reporter.push('Checking GitHub API access...')
  await checkGitHubAPIAccess({ reporter }) // ditto

  // else we are good to proceed
  const cleanupFuncs = {}
  const cleanup = async({ msg, res, status }) => {
    if (noCleanup === true) {
      res.status(status).type('text/plain').send(`Failed to fully create '${newProjectName}'; no cleanup performed: ${msg}`)
      return true
    }

    const successes = []
    const failures = []
    let success = true
    for (const [func, desc] of Object.values(cleanupFuncs)) {
      try {
        success = await func() && success
        if (!success) failures.push(desc)
        else successes.push(desc)
      }
      catch (e) {
        reporter.error(e)
        failures.push(desc)
      }
    }

    res.status(status).type('text/plain')
      .send(msg + '\n\n'
      + 'Cleanup appears to have '
        + (failures.length === 0
          ? 'succeeded;\n' + successes.join(' succeeded\n') + ' succeeded'
          : 'failed;\n' + failures.join(' failed\n') + ' failed'))

    return failures.length === 0
  }

  const stagingDir = fsPath.join(app.ext.serverHome, 'tmp', 'liq-projects', 'new-project-staging', newProjectName)
  const gitHubQualifiedName = orgGithubName + '/' + basename

  try {
  // set up the staging directory
    reporter.push(`Creating staging directory '${newProjectName}': <code>${stagingDir}<rst>.`)

    await fs.mkdir(stagingDir, { recursive : true })

    cleanupFuncs.stagingDir = [
      async() => {
        await fs.rm(stagingDir, { recursive : true })
        return true
      },
      'remove staging dir'
    ]

    reporter.push(`Initializing staging directory '${newProjectName}'.`)
    const initResult = shell.exec(`cd "${stagingDir}" && git init --quiet . && npm init -y > /dev/null`)
    if (initResult.code !== 0) {
      await cleanup({
        msg    : `There was an error initalizing the local project in staging dir '${stagingDir}' (${initResult.code}):\n${initResult.stderr}`,
        res,
        status : 500
      })
      return
    }

    reporter.push(`Updating '${newProjectName}' package.json...`)
    const packagePath = stagingDir + '/package.json'
    const packageJSON = readFJSON(packagePath)

    const repoFragment = 'github.com/' + gitHubQualifiedName
    const repoURL = `git+ssh://git@${repoFragment}.git`
    const bugsURL = `https://${repoFragment}/issues`
    const homepage = `https://${repoFragment}#readme`
    const pkgLicense = license || DEFAULT_LICENSE

    packageJSON.name = newProjectName
    packageJSON.main = `dist/${basename}.js`
    packageJSON.version = version
    packageJSON.repository = repoURL
    packageJSON.bugs = { url : bugsURL }
    packageJSON.homepage = homepage
    packageJSON.license = pkgLicense
    if (description) {
      packageJSON.description = description
    }

    writeFJSON({ data : packageJSON, file : packagePath, noMeta : true })

    reporter.push(`Committing initial package.json to '${newProjectName}'...`)
    const initCommitResult = shell.exec(`cd "${stagingDir}" && git add package.json && git commit -m "package initialization"`)
    if (initCommitResult.code !== 0) {
      await cleanup({
        msg    : `Could not make initial project commit for '${gitHubQualifiedName}'.`,
        res,
        status : 500
      })
      return
    }
    reporter.push(`Initialized local repository for project '${gitHubQualifiedName}'.`)

    reporter.push(`Creating github repository for '${newProjectName}'...`)
    const creationOpts = '--remote-name origin'
    + ` -d "${description}"`
    + (publicRepo === true ? '' : ' --private')
    const hubCreateResult = shell.exec(`cd "${stagingDir}" && hub create ${creationOpts} ${gitHubQualifiedName}`)
    if (hubCreateResult.code !== 0) {
      await cleanup({
        msg    : `There was an error initalizing the github repo '${gitHubQualifiedName}' (${hubCreateResult.code}):\n${hubCreateResult.stderr}`,
        res,
        status : 500
      })
      return
    }
    reporter.push(`Created GitHub repo '${gitHubQualifiedName}'.`)

    cleanupFuncs.githubRepo = [
      async() => {
        const delResult = shell.exec(`hub delete -y ${gitHubQualifiedName}`)
        return delResult.code === 0
      },
      'delete GitHub repo'
    ]

    reporter.push(`Pushing '${newProjectName}' local updates to GitHub...`)
    let retry = 5 // will try a total of four times
    const pushCmd = `cd "${stagingDir}" && git push --set-upstream origin main`
    let pushResult = shell.exec(pushCmd)
    while (pushResult.code !== 0 && retry > 0) {
      reporter.push(`Pausing for GitHub to catch up (${retry})...`)
      await new Promise(resolve => setTimeout(resolve, 2500))
      pushResult = shell.exec(pushCmd)
      retry -= 1
    }
    if (pushResult.code !== 0) {
      await cleanup({ msg : 'Could not push local staging dir changes to GitHub.', res, status : 500 })
      return
    }

    if (publicRepo === true && noFork === false) {
      const forkResult = shell.exec('hub fork --remote-name workspace')
      if (forkResult.code === 0) reporter.push(`Created personal workspace fork for '${gitHubQualifiedName}'.`)
      else reporter.push('Failed to create personal workspace fork.')
    }

    if (skipLabels !== true) await setupGitHubLabels({ projectFQN : gitHubQualifiedName, reporter })
    if (skipMilestones !== true) {
      await setupGitHubMilestones({
        pkgJSON     : packageJSON,
        projectFQN  : gitHubQualifiedName,
        projectPath : stagingDir,
        reporter,
        unpublished : true
      })
    }
  }
  catch (e) {
    await cleanup({ msg : `There was an error creating project '${gitHubQualifiedName}'; ${e.message}`, res, status : 500 })
    process.stderr.write(e.stack)
    return
  }

  const targetDirBits = [LIQ_PLAYGROUND()]
  if (npmOrg !== undefined) {
    targetDirBits.push((retainLeadingAt === true ? '@' : '' ) + npmOrg)
  }
  targetDirBits.push(basename)
  const targetDir = fsPath.join(...targetDirBits)
  await fs.mkdir(fsPath.dirname(targetDir), { recursive : true })
  await fs.rename(stagingDir, targetDir)

  res.send(reporter.taskReport.join('\n')).end()
}

const getCreateEndpointParameters = ({ workDesc }) => {
  const parameters = [
    {
      name          : 'description',
      isSingleValue : true,
      required      : true,
      description   : 'If provided, will be used to set the newly created package description.'
    },
    {
      name        : 'githubOwner',
      description : "The GitHub owner name to use when creating the GitHub repository. If none is provided, then the 'org' part, if any, from the (NPM) 'newProjectName' will be used. If there is no org part, then an error is raised."
    },
    {
      name          : 'license',
      isSingleValue : true,
      description   : `Sets the license string for the newly created package. If not provided, then defaults to org setting 'ORG_DEFAULT_LICENSE' if set and '${DEFAULT_LICENSE}' otherwise.`
    },
    {
      name        : 'newProjectName',
      required    : true,
      description : 'The (NPM) name of the project.'
    },
    {
      name        : 'noCleanup',
      isBoolean   : true,
      description : 'By default, on error, the process will attempt to cleanup any artifacts created and restore everything to the state prior to invocation. If `noCleanup` is specified this behavior is suppressed.'
    },
    {
      name        : 'noFork',
      isBoolean   : true,
      description : 'Suppresses default behavior of proactively creating workspace fork for public repos.'
    },
    {
      name        : 'public',
      isBoolean   : true,
      description : 'By default, project repositories are created private. If `public` is set to true, then the repository will be made public.'
    },
    {
      name        : 'retainLeadingAt',
      isBoolean   : true,
      description : "By default the leading '@' is dropped from the project name when creating the local playground diroctery. E.g, '@liquid-labs/some-project' would be saved in '~/liquid-labs/some-project' by default. Setting 'retainLeadingAt' to true would save the new project in '@liquid-labs/some-project'."
    },
    {
      name          : 'version',
      isSingleValue : true,
      description   : `The version string to use for the newly initialized package \`version\` field. Defaults to '${DEFAULT_VERSION}'.`
    },
    ...commonProjectSetupParameters
  ]
  parameters.sort((a, b) => a.name.localeCompare(b.name))
  Object.freeze(parameters)

  return {
    help : {
      name        : 'Project create',
      summray     : 'Creates theh named project repository on GitHub and locally.',
      description : 'Attempts to create the named project repository on GitHub and locally.'
    },
    method : 'post',
    parameters
  }
}

export { doCreate, getCreateEndpointParameters }
