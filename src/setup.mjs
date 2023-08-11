import * as fs from 'fs'
import * as path from 'path'

import createError from 'http-errors'
import findPlugins from 'find-plugins'

import { readFJSON } from '@liquid-labs/federated-json'
import { checkGitHubAPIAccess, checkGitHubSSHAccess } from '@liquid-labs/github-toolkit'
import { types } from '@liquid-labs/liq-credentials-db'
import { LIQ_HOME } from '@liquid-labs/liq-defaults'

const setup = ({ app, model, reporter }) => {
  setupCredentials({ app })
  setupPathResolvers({ app, model })
  installProjectPlugins({ app, model, reporter })
}

/**
* Our 'liq-audit' setup called when we are loaded as a 'liq-core' plugin. This setup in turns finds and loads our own
* plugins.
*/
const installProjectPlugins = ({ app, model, reporter }) => {
  const pluginPkg = path.join(LIQ_HOME(), 'plugins', 'liq-projects', 'package.json')
  if (fs.statSync(pluginPkg, { throwIfNoEntry : false }) === undefined) {
    reporter.log(`No plugin entries (${path.dirname(pluginPkg)})...`)
    return
  }

  const pluginDir = path.join(LIQ_HOME(), 'plugins', 'liq-projects', 'node_modules')
  reporter.log(`Searching for audit plugins (in ${path.dirname(pluginDir)})...`)
  const pluginOptions = {
    pkg    : pluginPkg,
    dir    : pluginDir,
    filter : () => true
  }

  const plugins = findPlugins(pluginOptions)

  reporter.log(plugins.length === 0 ? 'No plugins found.' : `Found ${plugins.length} plugins.`)

  model.projects.creationTypes = {}
  model.projects.setupFunctions = {}
  for (const plugin of plugins) {
    const sourcePkg = plugin.pkg.name
    reporter.log(`Loading plugins from ${sourcePkg}...`)
    const { creationTypes, setupFunctions } = require(plugin.dir) || {}

    // TODO: check for overlap!
    Object.assign(model.projects.creationTypes, creationTypes)
    Object.assign(model.projects.setupFunctions, setupFunctions)
  }
}

const setupCredentials = ({ app }) => {
  app.ext.credentialsDB.registerCredentialType({
    key         : 'GITHUB_SSH',
    name        : 'GitHub SSH key',
    description : 'Used to authenticate user for git operations such as clone, fetch, and push.',
    type        : types.SSH_KEY_PAIR,
    verifyFunc  : ({ files }) => checkGitHubAPIAccess({ filePath : files[0] })
  })
  app.ext.credentialsDB.registerCredentialType({
    key          : 'GITHUB_API',
    name         : 'GitHub API token',
    description  : 'Used to authenticate REST/API actions.',
    type         : types.AUTH_TOKEN,
    verifyFunc   : ({ files }) => checkGitHubSSHAccess({ privKeyPath : files[0] }),
    getTokenFunc : ({ files }) => {
      let credentialData
      try {
        credentialData = readFJSON(files[0], { readAs : 'yaml' })
      }
      catch (e) {
        throw createError.InternalServerError("There was a problem reading the 'GITHUB_API' credential file",
          { cause : e })
      }
      const token = credentialData?.['github.com']?.[0]?.oauth_token
      if (token === undefined) { throw createError.NotFound("The 'GITHUB_API' token was not defined in the credential source.") }

      return token
    }
  })
}

const setupPathResolvers = ({ app, model }) => {
  app.ext.pathResolvers.newProjectName = {
    bitReString    : '[a-zA-Z][a-zA-Z0-9-]*',
    optionsFetcher : () => []
  }

  app.ext.pathResolvers.localProjectName = {
    bitReString    : '[a-zA-Z][a-zA-Z0-9-]*',
    optionsFetcher : ({ model, orgKey }) => {
      return model.playground.projects
        .list({ rawData : true })
        .filter(({ orgName }) => orgKey === orgName)
        .map(({ baseName }) => baseName)
    }
  }
}

export { setup }
