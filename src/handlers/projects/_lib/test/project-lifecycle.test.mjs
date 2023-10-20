/* global beforeAll describe expect test */
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'
import * as os from 'node:os'

import { CredentialsDB } from '@liquid-labs/liq-credentials-db'
import { setupCredentials } from '@liquid-labs/credentials-db-plugin-github'
import { Octocache } from '@liquid-labs/octocache'
import { tryExec } from '@liquid-labs/shell-toolkit'

import { doArchive } from '../archive-lib'
import { doCreate } from '../create-lib'
import { doRename } from '../rename-lib'

describe('project lifecyle', () => {
  const randKey = Math.round(Math.random() * 100000000000000000000)
  const projectName = 'test-project-' + randKey
  const playgroundDir = fsPath.join(os.tmpdir(), 'liq-projects-test-' + randKey)
  process.env.LIQ_PLAYGROUND = playgroundDir
  console.log('playgroundDir:', playgroundDir) // DEBUG

  const reporterMock = {
    log        : () => {},
    error      : (msg) => { console.error(msg) },
    push       : (msg) => { reporterMock.taskReport.push(msg) },
    taskReport : []
  }

  const resMock = {
    status : () => resMock,
    type   : () => resMock,
    send   : () => resMock,
    end    : () => {}
  }

  const newProjectOrg = process.env.TEST_GITHUB_OWNER || 'liquid-labs'
  const newProjectBasename = `test-project-${randKey}`
  const newProjectName = `@${newProjectOrg}/${newProjectBasename}`
  const newProjectPath = fsPath.join(playgroundDir, ...(newProjectName.split('/')))
  const newPkgJSONPath = fsPath.join(newProjectPath, 'package.json')

  describe('create project', () => {
    beforeAll(async() => {
      const reqMock = {
        vars : {
          newProjectName
        }
      }

      await doCreate({ reporter : reporterMock, req : reqMock, res : resMock })
    }, 5 * 60 * 1000) // give it 5 minutes

    test('creates a local repository in the playground', async() => {
      const pkgContents = await fs.readFile(newPkgJSONPath, { encoding : 'utf8' })
      const pkgJSON = JSON.parse(pkgContents)
      expect(pkgJSON.name).toBe(newProjectName)
    })

    test('creates a repo on GitHub', async() => {
      const credDB = new CredentialsDB()
      setupCredentials({ credentialsDB : credDB })
      const authToken = await credDB.getToken('GITHUB_API')

      const octocache = new Octocache({ authToken })
      const repoData = await octocache.request(`GET /repos/${newProjectName.slice(1)}`)
      expect(repoData.name).toBe(newProjectBasename)
    })
  })

  // the rename section
  const renamedName = '@' + newProjectOrg + '/test-project-new-name-' + randKey
  const renamedProjectPath = fsPath.join(playgroundDir, ...(renamedName.split('/')))
  const renamedPkgJSONPath = fsPath.join(renamedProjectPath, 'package.json')

  describe('rename project', () => {
    let renamedPkgJSON

    beforeAll(async() => {
      const reqMock = { vars : { newName : renamedName }, accepts: () => 'application/json' }

      const pkgJSON = JSON.parse(await fs.readFile(newPkgJSONPath, { encoding : 'utf8' }))

      const appMock = {
        ext : {
          _liqProjects : {
            playgroundMonitor : {
              getProjectData : (project) => {
                return project === newProjectName
                  ? { pkgJSON, projectPath : newProjectPath }
                  : undefined
              }
            }
          }
        }
      }

      await doRename({ app : appMock, projectName : newProjectName, reporter : reporterMock, req : reqMock, res : resMock })
    })

    test('moves the project to the new playground location', () => expect(existsSync(renamedPkgJSONPath)).toBe(true))
  })

  describe('archive project', () => {

    beforeAll(async() => {
      // Normally, the rename would get associated to a new unit of work and saved there. That ends up making the local 
      // git repo "clean". We simulate the end result of all that here.
      tryExec(`cd '${renamedProjectPath}' && git commit -am 'clean brnaches after rename' && git push`)

      const reqMock = { vars : { }, accepts: () => 'application/json' }

      const pkgJSON = JSON.parse(await fs.readFile(renamedPkgJSONPath, { encoding : 'utf8' }))
      console.log('pkgJSON:', pkgJSON) // DEBUG

      const credentialsDB = new CredentialsDB()
      setupCredentials({ credentialsDB })

      const appMock = {
        ext : {
          _liqProjects : {
            playgroundMonitor : {
              getProjectData : (project) => {
                return project === renamedName
                  ? { pkgJSON, projectPath : renamedProjectPath }
                  : undefined
              }
            }
          }, // _liqProjects
          credentialsDB
        }
      }

      await doArchive({ app : appMock, projectName : renamedName, reporter : reporterMock, req : reqMock, res : resMock })
    })

    test('removes the local project clone', () => expect(existsSync(renamedPkgJSONPath)).toBe(false))

    test('archives the project on GitHub', async () => {
      const credDB = new CredentialsDB()
      setupCredentials({ credentialsDB : credDB })
      const authToken = await credDB.getToken('GITHUB_API')

      const octocache = new Octocache({ authToken })
      const repoData = await octocache.request(`GET /repos/${renamedName.slice(1)}`)
      expect(repoData.archived).toBe(true)
    })
  })
})
