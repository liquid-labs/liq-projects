// import findPlugins from 'find-plugins'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import { PlaygroundMonitor } from '@liquid-labs/playground-monitor'
import { setupCredentials } from '@liquid-labs/credentials-db-plugin-github'

const setup = async({ app, reporter }) => {
  setupCredentials({ credentialsDB : app.ext.credentialsDB })
  await setupPlayground({ app })
  setupPathResolvers({ app })
  // installProjectPlugins({ app, model, reporter })
}

/**
* Our 'liq-projects' setup called when we are loaded as a 'liq-core' plugin. This setup in turns finds and loads our own
* plugins.
*//* This may have been done before we had dependency runners?
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

const projectNameReString = '(?:(?:@|%40)[a-zA-Z][a-zA-Z0-9-]*(?:[/]|%2F|%2f))?[a-zA-Z][a-zA-Z0-9-]*'

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

const setupPlayground = async({ app }) => {
  const playgroundPath = process.env.PLUGABLE_PLAYGROUND // TOOD: pull from plugable-defaults
    || process.env.LIQ_PLAYGROUND
    || fsPath.join(process.env.HOME, 'playground')
  await fs.mkdir(playgroundPath, { recursive : true })
  const playgroundMonitor = new PlaygroundMonitor({ root : playgroundPath })
  // works wether or not app.ext._liqProjects is defined or not
  app.ext._liqProjects = Object.assign({}, app.ext._liqProjects, { playgroundMonitor, playgroundPath })
}

export { setup }
