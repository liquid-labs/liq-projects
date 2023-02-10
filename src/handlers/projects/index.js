import { handlers } from './releases'

import * as archiveHandler from './archive'
import * as createHandler from './create'
import * as destroyHandler from './destroy'
import * as detailHandler from './detail'
import * as documentHandler from './document'
import * as renameHandler from './rename'
import * as setupHandler from './setup'

handlers.push(
  archiveHandler,
  createHandler,
  destroyHandler,
  detailHandler,
  documentHandler,
  renameHandler,
  setupHandler
)

export { handlers }
