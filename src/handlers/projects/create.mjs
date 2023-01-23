import * as fs from 'node:fs/promises'

import shell from 'shelljs'

import { readFJSON, writeFJSON } from '@liquid-labs/federated-json'
import { getOrgFromKey } from '@liquid-labs/liq-handlers-lib'

import { checkGitHubAPIAccess, checkGitHubSSHAccess } from './_lib/github-lib'
import { commonProjectSetupParameters } from './_lib/common-project-setup-parameters'
import { DEFAULT_LICENSE, DEFAULT_VERSION, GITHUB_REPO_KEY } from './_lib/common-constants'
import { setupGitHubLabels } from './_lib/setup-github-labels'
import { setupGitHubMilestones } from './_lib/setup-github-milestones'

const method = 'post'
const paths = [
  ['projects', ':localOrgKey', ':newProjectName', 'create'],
  ['orgs', ':localOrgKey', 'projects', ':newProjectName', 'create']
]
const parameters = [
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

const func = ({ app, model, reporter }) => {
  app.commonPathResolvers.newProjectName = {
    optionsFetcher : () => [],
    bitReString    : '[a-zA-Z][a-zA-Z0-9-]*'
  }

  return async(req, res) => {
    const org = getOrgFromKey({ model, orgKey: localOrgKey, res })
    if (org === false) return

    const report = []

    const {
      description,
      license,
      localOrgKey,
      newProjectName,
      noCleanup,
      noFork = false,
      public : publicRepo = false,
      skipLabels,
      skipMilestones,
      version = DEFAULT_VERSION
    } = req.vars
    const orgGithubName = org.getSetting(GITHUB_REPO_KEY)
    if (!orgGithubName) {
      res.status(400).type('text/plain').send(`'${GITHUB_REPO_KEY}' not defined for org '${localOrgKey}'.`)
      return
    }

    if (!checkGitHubSSHAccess({ res })) return // the check will handle user feedback
    if (!(await checkGitHubAPIAccess({ res }))) return // ditto
    // else we are good to proceed
    const cleanupFuncs = []
    const cleanup = async({ msg, res, status }) => {
      if (noCleanup === true) {
        res.status(status).type('text/plain').send(`Failed to fully create '${newProjectName}; no cleanup performed.`)
        return true
      }

      const successes = []
      const failures = []
      let success = true
      for (const [func, desc] of cleanupFuncs) {
        try {
          success = await func() && success
          if (!success) failures.push(desc)
          else successes.push(desc)
        }
        catch (e) {
          console.log(e)
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

    const stagingDir = `${app.liqHome()}/tmp/liq-core/project-staging/${newProjectName}`
    const qualifiedName = orgGithubName + '/' + newProjectName

    try {
      // set up the staging directory
      reporter.log(`Creating staging directory '${newProjectName}'.`)
      
      await fs.mkdir(stagingDir, { recursive : true })

      cleanupFuncs.push([
        async() => {
          await fs.rm(stagingDir, { recursive : true })
          return true
        },
        'remove staging dir'
      ])

      reporter.log(`Initializing staging directory '${newProjectName}'.`)
      const initResult = shell.exec(`cd "${stagingDir}" && git init --quiet . && npm init -y > /dev/null`)
      if (initResult.code !== 0) {
        await cleanup({
          msg    : `There was an error initalizing the local project in staging dir '${stagingDir}' (${initResult.code}):\n${initResult.stderr}`,
          res,
          status : 500
        })
        return
      }

      reporter.log(`Updating '${newProjectName}' package.json...`)
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

      reporter.log(`Committing initial package.json to '${newProjectName}'...`)
      const initCommitResult = shell.exec(`cd "${stagingDir}" && git add package.json && git commit -m "package initialization"`)
      if (initCommitResult.code !== 0) {
        await cleanup({
          msg    : `Could not make initial project commit for '${qualifiedName}'.`,
          res,
          status : 500
        })
        return
      }
      report.push(`Initialized local repository for project '${qualifiedName}'.`)

      reporter.log(`Creating github repository for '${newProjectName}'...`)
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
      report.push(`Created GitHub repo '${qualifiedName}'.`)

      cleanupFuncs.push([
        async() => {
          const delResult = shell.exec(`hub delete -y ${qualifiedName}`)
          return delResult.code === 0
        },
        'delete GitHub repo'
      ])

      reporter.log(`Pushing '${newProjectName}' local updates to GitHub...`)
      let retry = 3 // will try a total of four times
      const pushCmd = `cd "${stagingDir}" && git push --all origin`
      let pushResult = shell.exec(pushCmd)
      while (pushResult.code !== 0 && retry > 0) {
        reporter.log('Pausing for GitHub to catch up...')
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
        if (forkResult.code === 0) report.push(`Created personal workspace fork for '${qualifiedName}'.`)
        else report.push('Failed to create personal workspace fork.')
      }

      if (skipLabels !== true) setupGitHubLabels({ projectName : qualifiedName, report })
      if (skipMilestones !== true) {
        await setupGitHubMilestones({
          model,
          projectName : qualifiedName,
          projectPath : stagingDir,
          report,
          unpublished : true
        })
      }
    }
    catch (e) {
      await cleanup({ msg : `There was an error creating project '${qualifiedName}'; ${e.message}`, res, status : 500 })
    }

    await fs.rename(stagingDir, app.liqPlayground() + '/' + qualifiedName)

    res.send(report.join('\n')).end()
  } // actual, closure bound handler func return
}

export {
  func,
  method,
  parameters,
  paths
}
