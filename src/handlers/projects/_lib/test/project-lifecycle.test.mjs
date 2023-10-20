/* global beforeAll describe expect test */
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'
import * as os from 'node:os'

import { CredentialsDB } from '@liquid-labs/liq-credentials-db'
import { setupCredentials } from '@liquid-labs/credentials-db-plugin-github'
import { Octocache } from '@liquid-labs/octocache'

import { doCreate } from '../create-lib'

describe('project lifecyle', () => {
  const randKey = Math.round(Math.random() * 100000000000000000000)
  const projectName = 'test-project-' + randKey
  const playgroundDir = fsPath.join(os.tmpdir(), 'liq-projects-test-' + randKey)
  process.env.LIQ_PLAYGROUND = playgroundDir
  console.log('playgroundDir:', playgroundDir) // DEBUG

  const reporterMock = {
    log: () => {},
    error: (msg) => { console.error(msg) },
    push: (msg) => { reporterMock.taskReport.push(msg) },
    taskReport: []
  }

  const resMock = {
    status: () => resMock,
    type: () => resMock,
    send: () => resMock,
    end: () => {}
  }

  describe('create project', () => {  
    const newProjectOrg = process.env.TEST_GITHUB_OWNER || 'liquid-labs'
    const newProjectBasename = `test-project-${randKey}`
    const newProjectName = `@${newProjectOrg}/${newProjectBasename}`

    beforeAll(async () => {
      const reqMock = {
        vars: {
          newProjectName : newProjectName
        }
      }

      await doCreate({ reporter: reporterMock, req: reqMock, res: resMock })
    }, 5 * 60 * 1000) // give it 5 minutes

    test('creates a local repository in the playground', async () => {
      const pkgJSONPath = fsPath.join(playgroundDir, ...(newProjectName.split('/')), 'package.json')
      const pkgContents = await fs.readFile(pkgJSONPath, { encoding: 'utf8'})
      const pkgJSON = JSON.parse(pkgContents)
      expect(pkgJSON.name).toBe(newProjectName)
    })

    test('creates a repo on GitHub', async () => {
      const credDB = new CredentialsDB()
      setupCredentials({ credentialsDB: credDB })
      const authToken = await credDB.getToken('GITHUB_API')

      const octocache = new Octocache({ authToken })
      const repoData = await octocache.request(`GET /repos/${newProjectName.slice(1)}`)
      expect(repoData.name).toBe(newProjectBasename)
    })
  })

  /*describe('rename project', () => {
    beforeAll(async () => {

    })
  })*/
})