import * as fs from 'node:fs/promises'

import createError from 'http-errors'
import shell from 'shelljs'

import { readFJSON, writeFJSON } from '@liquid-labs/federated-json'
import {
  checkGitHubAPIAccess,
  checkGitHubSSHAccess,
  setupGitHubLabels,
  setupGitHubMilestones
} from '@liquid-labs/github-toolkit'
import { LIQ_HOME, LIQ_PLAYGROUND } from '@liquid-labs/liq-defaults'

import { commonProjectSetupParameters } from './_lib/common-project-setup-parameters'
import { DEFAULT_LICENSE, DEFAULT_VERSION, GITHUB_REPO_KEY } from './_lib/common-constants'

const method = 'post'
const paths = [
  ['projects', 'create'],
  ['orgs', ':orgKey', 'projects', 'create']
]
const parameters = [
  {
    name        : 'basename',
    required    : true,
    description : 'The basename of the project (without the org qualifier).'
  },
  {
    name          : 'description',
    isSingleValue : true,
    required      : true,
    description   : 'If provided, will be used to set the newly created package description.'
  },
  {
    name          : 'license',
    isSingleValue : true,
    description   : `Sets the license string for the newly created package. If not provided, then defaults to org setting 'ORG_DEFAULT_LICENSE' if set and '${DEFAULT_LICENSE}' otherwise.`
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
    name        : 'org',
    description : "The liq org key. Required when using the '/projects/create' endpount. Should be omitted if using the '/org/XXX/projects/create' (and must match if provided).",
    bitReString : '[a-zA-Z][a-zA-Z0-9-]*',
    optionsFunc : ({ model }) => model.orgsAlphaList
  },
  {
    name        : 'public',
    isBoolean   : true,
    description : 'By default, project repositories are created private. If `public` is set to true, then the repository will be made public.'
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

const func = ({ app, model, reporter }) => async(req, res) => {
  if (req.vars.org !== undefined && req.vars.orgKey !== undefined && req.vars.org !== req.vars.orgKey) {
    throw createError.BadRequest(`Both path 'orgKey' (${req.vars.orgKey}) and parameter 'org' (${req.vars.org}) are defined and in conflict. Try again with 'org' parameter omitted or use '/projects/create' form and specify 'org' parameter.`)
  }

  const orgKey = req.vars.orgKey || req.vars.org
  const org = model.orgs[orgKey]
  if (org === undefined) {
    throw createError.NotFound(`No such org '${orgKey}' found.`)
  }

  const newProjectName = req.vars.basename

  const {
    description,
    license,
    noCleanup,
    noFork = false,
    public : publicRepo = false,
    skipLabels,
    skipMilestones,
    version = DEFAULT_VERSION
  } = req.vars
  const orgGithubName = org.getSetting(GITHUB_REPO_KEY)
  if (!orgGithubName) {
    res.status(400).type('text/plain').send(`'${GITHUB_REPO_KEY}' not defined for org '${orgKey}'.`)
    return
  }

  reporter.reset()
  reporter = reporter.isolate()

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

  const stagingDir = `${LIQ_HOME()}/tmp/liq-core/project-staging/${newProjectName}`
  const qualifiedName = orgGithubName + '/' + newProjectName

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

    const repoFragment = 'github.com/' + qualifiedName
    const repoURL = `git+ssh://git@${repoFragment}.git`
    const bugsURL = `https://${repoFragment}/issues`
    const homepage = `https://${repoFragment}#readme`
    const pkgLicense = license || org.getSetting('ORG_DEFAULT_LICENSE') || DEFAULT_LICENSE

    packageJSON.name = '@' + qualifiedName
    packageJSON.main = `dist/${newProjectName}.js`
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
        msg    : `Could not make initial project commit for '${qualifiedName}'.`,
        res,
        status : 500
      })
      return
    }
    reporter.push(`Initialized local repository for project '${qualifiedName}'.`)

    reporter.push(`Creating github repository for '${newProjectName}'...`)
    const creationOpts = '--remote-name origin'
    + ` -d "${description}"`
    + (publicRepo === true ? '' : ' --private')
    const hubCreateResult = shell.exec(`cd "${stagingDir}" && hub create ${creationOpts} ${qualifiedName}`)
    if (hubCreateResult.code !== 0) {
      await cleanup({
        msg    : `There was an error initalizing the github repo '${qualifiedName}' (${hubCreateResult.code}):\n${hubCreateResult.stderr}`,
        res,
        status : 500
      })
      return
    }
    reporter.push(`Created GitHub repo '${qualifiedName}'.`)

    cleanupFuncs.githubRepo = [
      async() => {
        const delResult = shell.exec(`hub delete -y ${qualifiedName}`)
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
      if (forkResult.code === 0) reporter.push(`Created personal workspace fork for '${qualifiedName}'.`)
      else reporter.push('Failed to create personal workspace fork.')
    }

    if (skipLabels !== true) await setupGitHubLabels({ projectFQN : qualifiedName, reporter })
    if (skipMilestones !== true) {
      await setupGitHubMilestones({
        model,
        projectFQN  : qualifiedName,
        projectPath : stagingDir,
        reporter,
        unpublished : true
      })
    }
  }
  catch (e) {
    await cleanup({ msg : `There was an error creating project '${qualifiedName}'; ${e.message}`, res, status : 500 })
    process.stderr.write(e.stack)
    return
  }

  await fs.rename(stagingDir, LIQ_PLAYGROUND() + '/' + qualifiedName)

  model.load()

  res.send(reporter.taskReport.join('\n')).end()
}

export {
  func,
  method,
  parameters,
  paths
}
