import { createRequestHandler } from '@tanstack/start/server'

export default createRequestHandler({
  build: () => import('../dist/server.js')
})