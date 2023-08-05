import * as fs from 'fs'
import * as path from 'path'

import findPlugins from 'find-plugins'

import { LIQ_HOME } from '@liquid-labs/liq-defaults'

const setup = ({ app, model, reporter }) => {
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
