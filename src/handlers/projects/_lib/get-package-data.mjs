import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

const getPackageData = async ({ orgKey, localProjectName, projectPath, requireImplements, res }) => {
  const liqPlayground = fsPath.join(process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq'), 'playground')
  projectPath = projectPath || fsPath.join(liqPlayground, orgKey, localProjectName)
  const projectPkgPath = fsPath.join(projectPath, 'package.json')
  
  if (!existsSync(projectPkgPath)) {
    console.log(1)
    res
      .status(404/* Entity Not Found */)
      .setHeader('content-type', 'text/terminal')
      .send(`Could not locate local package file for project <code>${localProjectName}<rst>. Perhaps the project needs to be imported.`)
    return false
  }
  // else we have what looks like a project
  let packageSpec
  try {
    const packageContents = await fs.readFile(projectPkgPath)
    packageSpec = JSON.parse(packageContents)
  }
  catch (e) {
    res
      .status(400)
      .setHeader('content-type', 'text/terminal')
      .send(`Could not process package definition. Ensure local project <code>${localProjectName}<rst> checkout contains a valid <code>package.json<rst> file. (${e.message})`)
    return false
  }

  let projectFQN = packageSpec.name
  if (projectFQN.startsWith('@')) projectFQN = projectFQN.slice(1)
  const githubOrg = (packageSpec.repository.url || packageSpec.repository)
    .replace(/^.+?\/([^/]+)\/[^/]+(?:.git)$/, '$1')
  const githubProjectName = githubOrg + '/' + localProjectName

  for (const reqImpl of requireImplements || []) {
    const isImplemented = packageSpec?.liq?.tags?.includes(reqImpl)
    if (isImplemented !== true) {
      res
        .status(400)
        .setHeader('content-type', 'text/terminal')
        .send(`The package spec does not mark required implementation '${reqImpl}'.`)
      return false
    }
  }

  return {
    githubOrg,
    githubProjectName,
    localProjectName,
    packageSpec,
    projectFQN,
    projectPath
  }
}

export { getPackageData }
