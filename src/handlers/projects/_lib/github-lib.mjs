import * as fs from 'node:fs/promises'

import yaml from 'js-yaml'
import shell from 'shelljs'

const SSH_ACCESS_FAILURE_MSG = 'Test for SSH access to GitHub failed. Try to add your GitHub key like:\n\nssh-add /path/to/key'

const respond = ({ e, msg, quiet, res, status }) => {
  if (res) {
    res.status(status).type('text/plain').send(quiet === true ? '' : msg + (e ? '\n' + e : ''))
  }
  else if (quiet !== true) {
    console.error(msg + (e ? '\n' + e : ''))
  }
}

const API_CREDS_DEFAULT_PATH = `${process.env.HOME}/.config/hub`
const API_NO_CREDENTIALS = `There was a problem reading the API credentials at '${API_CREDS_DEFAULT_PATH}'.`
const API_BAD_JSON = `Could not parse API credentials JSON file at '${API_CREDS_DEFAULT_PATH}'.`
const API_NO_TOKEN = `API credentials JSON file at '${API_CREDS_DEFAULT_PATH}' does not define 'oauth_token'.`
const API_BAD_CHECK = `Failed to execute API authorization check.`

const checkGitHubAPIAccess = async ({ res, quiet=false }) => {
  let creds
  try {
    creds = await fs.readFile(API_CREDS_DEFAULT_PATH)
  }
  catch (e) {
    respond({ e, msg: API_NO_CREDENTIALS, quiet, res, status: 401 })
    return false
  }

  try {
    creds = yaml.load(creds)
  }
  catch (e) {
    respond({ e, msg: API_BAD_JSON, quiet, res, status: 401 })
    return false
  }

  const apiToken = creds['github.com']?.[0]?.oauth_token
  if (!apiToken) {
    respond({ msg: API_NO_TOKEN, quiet, res, status: 401 })
    return false
  }

  const result = shell.exec(`curl -w '%{http_code}' -s -H "Authorization: token ${apiToken}" https://api.github.com/user -o /dev/null`)
  if (result.code !== 0) {
    respond({ e: result.stderr, msg: API_BAD_JSON, quiet, res, status: 500 })
    return false
  }
  const httpStatus = parseInt(result.stdout)
  if (httpStatus !== 200) {
    respond({ msg: API_TOKEN_INVALID, quiet, res, status: 401 })
    return false
  }
  // else, we're good
  return true
}

const checkGitHubSSHAccess = ({ res, quiet=false }) => {
  // the expected resut is idiomaticaly 1 because GitHub does not allow terminal access. But if the connection cannot be made, then the exit 
  // code is different.
  const result = shell.exec('ssh -qT git@github.com 2> /dev/null')
  if (result.code !== 1) {
    respond({ msg: SSH_ACCESS_FAILURE_MSG, quiet, res, status: 401 })
    return false
  }
  return true
}

export { 
  checkGitHubAPIAccess,
  checkGitHubSSHAccess
}