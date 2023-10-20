import createError from 'http-errors'
// import findPlugins from 'find-plugins'

import { setupCredentials } from '@liquid-labs/credentials-db-plugin-github'
import { checkGitHubAPIAccess, checkGitHubSSHAccess } from '@liquid-labs/github-toolkit'
import { types } from '@liquid-labs/liq-credentials-db'
import { LIQ_PLAYGROUND } from '@liquid-labs/liq-defaults'
import { PlaygroundMonitor } from '@liquid-labs/playground-monitor'

const setup = ({ app, reporter }) => {
  setupCredentials({ credentialsDB: app.ext.credentialsDB })
  setupPlayground({ app })
  setupPathResolvers({ app })
  // installProjectPlugins({ app, model, reporter })
}

/**
* Our 'liq-projects' setup called when we are loaded as a 'liq-core' plugin. This setup in turns finds and loads our own
* plugins.
*//*
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
*/

const projectNameReString = '^(?:@[a-zA-Z][a-zA-Z0-9-]*[/])?[a-zA-Z][a-zA-Z0-9-]*'

const setupPathResolvers = ({ app }) => {
  app.ext.pathResolvers.newProjectName = {
    bitReString    : projectNameReString,
    optionsFetcher : () => []
  }

  app.ext.pathResolvers.projectName = {
    bitReString    : projectNameReString,
    optionsFetcher : ({ app }) => app.ext._liqProjects.playgroundMonitor.listProjects()
  }
}

const setupPlayground = ({ app }) => {
  const playgroundMonitor = new PlaygroundMonitor({ root : LIQ_PLAYGROUND() })
  app.ext._liqProjects = Object.assign({}, app.ext_liqProjects, { playgroundMonitor })
  app.ext.teardownMethods.push(async() => await playgroundMonitor.close())
}

export { setup }
