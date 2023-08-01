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
import * as renameImpliedHandler from './rename-implied'
import * as setupHandler from './setup'
import * as setupImpliedHandler from './setup-implied'
import * as updateHandler from './update'
import * as updateImpliedHandler from './update-implied'

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
  renameImpliedHandler,
  setupHandler,
  setupImpliedHandler,
  updateHandler,
  updateImpliedHandler
)

export { handlers }
