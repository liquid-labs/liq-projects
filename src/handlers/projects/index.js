import { handlers } from './releases'

import * as archiveHandler from './archive'
import * as archiveImpliedHandler from './archive-implied'
import * as createHandler from './create'
import * as destroyHandler from './destroy'
import * as destroyImpliedHandler from './destroy-implied'
import * as detailHandler from './detail'
import * as detailImpliedHandler from './detail-implied'
import * as documentHandler from './document'
import * as documentImpliedHandler from './document-implied'
import * as renameHandler from './rename'
import * as setupHandler from './setup'

handlers.push(
  archiveHandler,
  archiveImpliedHandler,
  createHandler,
  destroyHandler,
  destroyImpliedHandler,
  detailHandler,
  detailImpliedHandler,
  documentHandler,
  documentImpliedHandler,
  renameHandler,
  setupHandler
)

export { handlers }
